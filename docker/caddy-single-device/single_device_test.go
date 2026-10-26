package singledevice

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/caddyserver/caddy/v2/caddyconfig"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	_ "github.com/caddyserver/caddy/v2/modules/caddyhttp/reverseproxy"
)

func TestConcurrentBrowsersHaveOneOwner(t *testing.T) {
	var module SingleDevice
	var winners atomic.Int32
	start, release := make(chan struct{}), make(chan struct{})
	var group sync.WaitGroup
	for range 32 {
		group.Go(func() {
			<-start
			recorder := httptest.NewRecorder()
			err := module.ServeHTTP(recorder, websocketRequest("/ws", ""), caddyhttp.HandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
				winners.Add(1)
				w.WriteHeader(http.StatusSwitchingProtocols)
				<-release
				return nil
			}))
			if err != nil {
				t.Error(err)
			}
			if recorder.Code != http.StatusSwitchingProtocols && recorder.Code != http.StatusLocked {
				t.Errorf("unexpected status: %d", recorder.Code)
			}
		})
	}
	close(start)
	deadline := time.Now().Add(5 * time.Second)
	for winners.Load() == 0 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	close(release)
	group.Wait()
	if got := winners.Load(); got != 1 {
		t.Fatalf("different browsers admitted: %d; want 1", got)
	}
}

func TestOwnerSharesSocketsAndReconnectsDuringGrace(t *testing.T) {
	var session lease
	now := time.Unix(100, 0)
	owner, ok := session.reserve("", now)
	if !ok || owner == "" {
		t.Fatal("first browser was not admitted")
	}
	second, ok := session.reserve(owner, now)
	if !ok || second != owner {
		t.Fatal("same browser cannot share simulator and remote sockets")
	}
	session.release(true, now.Add(time.Second))
	if session.status("other", now.Add(time.Hour)).Available {
		t.Fatal("closing one of two sockets released ownership")
	}
	session.release(true, now.Add(10*time.Second))
	if session.status("other", now.Add(14*time.Second)).Available {
		t.Fatal("ownership was released before reconnect grace expired")
	}
	if _, ok := session.reserve(owner, now.Add(14*time.Second)); !ok {
		t.Fatal("owner could not reconnect during grace")
	}
	session.release(true, now.Add(15*time.Second))
	if session.status("other", now.Add(19*time.Second)).Available {
		t.Fatal("reconnection did not restart grace after its final close")
	}
	if !session.status("other", now.Add(20*time.Second)).Available {
		t.Fatal("ownership remained after grace expired")
	}
	newOwner, ok := session.reserve(owner, now.Add(20*time.Second))
	if !ok || newOwner == owner {
		t.Fatal("new session must receive a fresh unpredictable identity")
	}
}

func TestFailedHandshakeDoesNotAcquireOrExtendOwnership(t *testing.T) {
	var session lease
	now := time.Unix(100, 0)
	owner, _ := session.reserve("", now)
	session.release(false, now)
	if !session.status("", now).Available {
		t.Fatal("failed first handshake stranded ownership")
	}
	owner, _ = session.reserve(owner, now)
	session.release(true, now)
	if _, ok := session.reserve(owner, now.Add(4*time.Second)); !ok {
		t.Fatal("owner could not reserve during grace")
	}
	session.release(false, now.Add(4*time.Second))
	if !session.status("", now.Add(grace)).Available {
		t.Fatal("failed reconnect extended the last successful connection's grace")
	}
}

func TestOrdinaryHTTPAndStatusNeverAcquire(t *testing.T) {
	var module SingleDevice
	for _, path := range []string{"/", "/control/", "/health", statusPath} {
		for _, method := range []string{http.MethodGet, http.MethodHead} {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequest(method, "https://pao.example"+path, nil)
			err := module.ServeHTTP(recorder, req, caddyhttp.HandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
				w.WriteHeader(http.StatusOK)
				return nil
			}))
			if err != nil || recorder.Code != http.StatusOK {
				t.Fatalf("%s %s: status %d, error %v", method, path, recorder.Code, err)
			}
			if len(recorder.Result().Cookies()) != 0 || !module.session.status("", time.Now()).Available {
				t.Fatalf("%s %s acquired ownership or set a cookie", method, path)
			}
		}
	}
}

func TestOnlySuccessfulUpgradeReceivesCookie(t *testing.T) {
	for _, secure := range []bool{false, true} {
		var module SingleDevice
		recorder := httptest.NewRecorder()
		req := websocketRequest("/control/ws", "")
		if secure {
			req.TLS = &tls.ConnectionState{}
		}
		err := module.ServeHTTP(recorder, req, caddyhttp.HandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
			if w.Header().Get("Set-Cookie") != "" {
				t.Error("cookie was set before the upstream accepted the handshake")
			}
			w.WriteHeader(http.StatusSwitchingProtocols)
			return nil
		}))
		if err != nil {
			t.Fatal(err)
		}
		cookies := recorder.Result().Cookies()
		if len(cookies) != 1 {
			t.Fatalf("upgrade cookies: %v", cookies)
		}
		cookie := cookies[0]
		if cookie.Name != cookieName || cookie.Value == "" || cookie.Path != "/" || !cookie.HttpOnly ||
			cookie.SameSite != http.SameSiteStrictMode || cookie.Secure != secure || cookie.Domain != "" {
			t.Fatalf("unexpected ownership cookie: %s", cookie)
		}
	}

	for _, code := range []int{http.StatusBadGateway, http.StatusForbidden} {
		var module SingleDevice
		recorder := httptest.NewRecorder()
		_ = module.ServeHTTP(recorder, websocketRequest("/ws", ""), caddyhttp.HandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
			w.WriteHeader(code)
			return nil
		}))
		if len(recorder.Result().Cookies()) != 0 || !module.session.status("", time.Now()).Available {
			t.Fatalf("upstream status %d set a cookie or retained ownership", code)
		}
	}
}

func TestErrorsAndCancellationReleaseReservation(t *testing.T) {
	for _, failure := range []error{errors.New("upstream unavailable"), context.Canceled} {
		var module SingleDevice
		recorder := httptest.NewRecorder()
		err := module.ServeHTTP(recorder, websocketRequest("/ws", ""), caddyhttp.HandlerFunc(func(http.ResponseWriter, *http.Request) error {
			return failure
		}))
		if !errors.Is(err, failure) || len(recorder.Result().Cookies()) != 0 {
			t.Fatalf("upstream failure not propagated cleanly: %v", err)
		}
		if !module.session.status("", time.Now()).Available {
			t.Fatal("upstream failure retained ownership")
		}
	}
}

func TestOccupiedPagesAndAlternateUpgradePaths(t *testing.T) {
	var module SingleDevice
	owner, _ := module.session.reserve("", time.Now())
	defer module.session.release(true, time.Now())
	for _, path := range []string{"/", "/control/", "/ws", "/anything", statusPath} {
		req := websocketRequest(path, "")
		// The emulator treats a key alone as a WebSocket handshake, regardless of path.
		req.Header.Del("Upgrade")
		recorder := httptest.NewRecorder()
		err := module.ServeHTTP(recorder, req, caddyhttp.HandlerFunc(func(http.ResponseWriter, *http.Request) error {
			t.Error("unowned upgrade reached upstream")
			return nil
		}))
		if err != nil || recorder.Code != http.StatusLocked || !strings.Contains(recorder.Body.String(), "模拟器正在使用中") {
			t.Fatalf("alternate path %s bypassed ownership: %d, %v", path, recorder.Code, err)
		}
		if recorder.Header().Get("Retry-After") != "5" || recorder.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("busy response should be retryable and never cached")
		}
	}
	for _, device := range []string{"", owner} {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, statusPath, nil)
		req.AddCookie(&http.Cookie{Name: cookieName, Value: device})
		err := module.ServeHTTP(recorder, req, caddyhttp.HandlerFunc(func(http.ResponseWriter, *http.Request) error {
			t.Error("status request reached upstream")
			return nil
		}))
		var result status
		if err != nil || json.Unmarshal(recorder.Body.Bytes(), &result) != nil || result.Available || result.Owned != (device == owner) {
			t.Fatalf("unexpected status for owned=%v: %s, %v", device == owner, recorder.Body, err)
		}
		if strings.Contains(recorder.Body.String(), owner) || len(recorder.Result().Cookies()) != 0 {
			t.Fatal("read-only status leaked or changed identity")
		}
	}
}

func TestWriterPreservesHijackingAndConnectionLifetime(t *testing.T) {
	var module SingleDevice
	finished := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		err := module.ServeHTTP(w, r, caddyhttp.HandlerFunc(func(w http.ResponseWriter, r *http.Request) error {
			w.Header().Set("Upgrade", "websocket")
			w.Header().Set("Connection", "Upgrade")
			w.WriteHeader(http.StatusSwitchingProtocols)
			conn, buffered, err := http.NewResponseController(w).Hijack()
			if err != nil {
				return err
			}
			defer conn.Close()
			if err := buffered.Flush(); err != nil {
				return err
			}
			_, _ = io.Copy(io.Discard, conn)
			return nil
		}))
		if err != nil {
			t.Error(err)
		}
		close(finished)
	}))
	defer server.Close()
	request, _ := http.NewRequest(http.MethodGet, server.URL+"/ws", nil)
	request.Header.Set("Upgrade", "websocket")
	request.Header.Set("Connection", "Upgrade")
	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusSwitchingProtocols || len(response.Cookies()) != 1 {
		t.Fatalf("handshake failed: %d, cookies %v", response.StatusCode, response.Cookies())
	}
	if module.session.status("", time.Now().Add(time.Hour)).Available {
		t.Fatal("hijacking released the lease while its tunnel was still open")
	}
	_ = response.Body.Close()
	select {
	case <-finished:
	case <-time.After(5 * time.Second):
		t.Fatal("closing the upgraded connection did not finish the handler")
	}
	if module.session.status("", time.Now()).Available || !module.session.status("", time.Now().Add(grace)).Available {
		t.Fatal("closing the actual connection did not begin the reconnect grace")
	}
}

func TestCaddyfileDirective(t *testing.T) {
	var module SingleDevice
	if err := module.UnmarshalCaddyfile(caddyfile.NewTestDispenser("single_device")); err != nil {
		t.Fatal(err)
	}
	for _, input := range []string{"single_device 3", "single_device {\n grace 3s\n}"} {
		if err := module.UnmarshalCaddyfile(caddyfile.NewTestDispenser(input)); err == nil {
			t.Fatalf("unsupported configuration was accepted: %s", input)
		}
	}
	adapter := caddyconfig.GetAdapter("caddyfile")
	output, _, err := adapter.Adapt([]byte(":8080 {\n single_device\n reverse_proxy 127.0.0.1:8000\n}\n"), nil)
	if err != nil || !strings.Contains(string(output), `"handler":"single_device"`) {
		t.Fatalf("Caddyfile adaptation failed: %s, %v", output, err)
	}
}

func websocketRequest(path, device string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "http://pao.example"+path, nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
	if device != "" {
		req.AddCookie(&http.Cookie{Name: cookieName, Value: device})
	}
	return req
}
