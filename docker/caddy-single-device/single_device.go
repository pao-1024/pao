// Package singledevice restricts a Caddy site to one browser's WebSocket session.
package singledevice

import (
	"crypto/rand"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

const (
	cookieName = "pao_device"
	statusPath = "/_single_device/status"
	grace      = 5 * time.Second
)

func init() {
	caddy.RegisterModule(&SingleDevice{})
	httpcaddyfile.RegisterHandlerDirective("single_device", parseCaddyfile)
	httpcaddyfile.RegisterDirectiveOrder("single_device", httpcaddyfile.Before, "handle")
}

// SingleDevice shares one ownership lease across every route following it.
// Configure one instance around both the simulator and control routes.
type SingleDevice struct {
	session lease
}

func (*SingleDevice) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.single_device",
		New: func() caddy.Module { return new(SingleDevice) },
	}
}

func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	module := new(SingleDevice)
	return module, module.UnmarshalCaddyfile(h.Dispenser)
}

func (*SingleDevice) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	for d.Next() {
		if d.NextArg() || d.NextBlock(0) {
			return d.ArgErr()
		}
	}
	return nil
}

func (s *SingleDevice) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	var device string
	if cookie, err := r.Cookie(cookieName); err == nil {
		device = cookie.Value
	}
	upgrade := isUpgrade(r)
	if r.URL.Path == statusPath && !upgrade {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		return json.NewEncoder(w).Encode(s.session.status(device, time.Now()))
	}
	if !upgrade {
		status := s.session.status(device, time.Now())
		if !status.Available && !status.Owned {
			return occupied(w)
		}
		return next.ServeHTTP(w, r)
	}

	owner, ok := s.session.reserve(device, time.Now())
	if !ok {
		return occupied(w)
	}
	writer := &upgradeWriter{
		ResponseWriterWrapper: &caddyhttp.ResponseWriterWrapper{ResponseWriter: w},
		cookie: &http.Cookie{
			Name: cookieName, Value: owner, Path: "/", HttpOnly: true,
			SameSite: http.SameSiteStrictMode, Secure: r.TLS != nil,
		},
		extendedConnect: r.Method == http.MethodConnect,
	}
	defer func() { s.session.release(writer.upgraded, time.Now()) }()
	return next.ServeHTTP(writer, r)
}

// Inspect every upgrade path: the emulator accepts WebSocket keys on arbitrary URLs.
func isUpgrade(r *http.Request) bool {
	if r.Header.Get("Upgrade") != "" || strings.EqualFold(r.Header.Get(":protocol"), "websocket") ||
		(r.Method == http.MethodConnect && strings.EqualFold(r.Proto, "websocket")) {
		return true
	}
	for key := range r.Header {
		if strings.EqualFold(key, "Sec-WebSocket-Key") {
			return true
		}
	}
	return false
}

type status struct {
	Available bool `json:"available"`
	Owned     bool `json:"owned"`
}

type lease struct {
	mu        sync.Mutex
	owner     string
	active    int
	idleUntil time.Time
}

func (l *lease) expire(now time.Time) {
	if l.active == 0 && !l.idleUntil.IsZero() && !now.Before(l.idleUntil) {
		l.owner = ""
		l.idleUntil = time.Time{}
	}
}

func (l *lease) status(device string, now time.Time) status {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.expire(now)
	return status{Available: l.owner == "", Owned: l.owner != "" && l.owner == device}
}

func (l *lease) reserve(device string, now time.Time) (string, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.expire(now)
	if l.owner != "" && l.owner != device {
		return "", false
	}
	if l.owner == "" {
		l.owner = rand.Text()
	}
	l.active++
	return l.owner, true
}

func (l *lease) release(upgraded bool, now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.active--
	if upgraded {
		l.idleUntil = now.Add(grace)
	}
	// A failed first handshake must not strand an owner that never received its cookie.
	if l.active == 0 && l.idleUntil.IsZero() {
		l.owner = ""
	}
}

type upgradeWriter struct {
	*caddyhttp.ResponseWriterWrapper
	cookie          *http.Cookie
	extendedConnect bool
	upgraded        bool
}

func (w *upgradeWriter) WriteHeader(code int) {
	if !w.upgraded && (code == http.StatusSwitchingProtocols ||
		(w.extendedConnect && code == http.StatusOK)) {
		w.upgraded = true
		// Issue identity only on the winning handshake, avoiding parallel HTML cookie races.
		http.SetCookie(w.ResponseWriter, w.cookie)
	}
	w.ResponseWriter.WriteHeader(code)
}

func occupied(w http.ResponseWriter) error {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Retry-After", "5")
	w.WriteHeader(http.StatusLocked)
	_, err := w.Write([]byte(occupiedPage))
	return err
}

const occupiedPage = `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5"><title>模拟器正在使用中</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111820;color:#e6edf3;font:16px/1.8 system-ui}main{max-width:30em;padding:2em}h1{font-size:1.5em}p{color:#b1bdc9}button{padding:.6em 1.2em;border:0;border-radius:.4em;font:inherit;cursor:pointer}</style>
<main><h1>模拟器正在使用中</h1><p>已有其他设备连接。请等待对方断开，空闲后会自动进入。</p><button onclick="location.reload()">重新连接</button></main></html>`

var (
	_ caddy.Module                = (*SingleDevice)(nil)
	_ caddyhttp.MiddlewareHandler = (*SingleDevice)(nil)
	_ caddyfile.Unmarshaler       = (*SingleDevice)(nil)
)
