#include "websocket_access.h"

#include <cassert>

int main() {
    using pao::WebSocketController;
    using pao::WebSocketOriginAllowed;

    assert(WebSocketOriginAllowed("192.168.1.10", false, {}));
    assert(WebSocketOriginAllowed("192.168.1.10", true, "http://192.168.1.10"));
    assert(WebSocketOriginAllowed("pao.example.com", true, "https://pao.example.com"));
    assert(WebSocketOriginAllowed("PAO.Example.com", true, "http://pao.example.com"));
    assert(WebSocketOriginAllowed("pao.example.com:443", true, "https://pao.example.com"));
    assert(WebSocketOriginAllowed("[::1]:80", true, "http://[::1]"));
    assert(!WebSocketOriginAllowed("", true, "http://192.168.1.10"));
    assert(!WebSocketOriginAllowed("192.168.1.10", true, "http://192.168.1.11"));
    assert(!WebSocketOriginAllowed("pao.example.com", true, "http://pao.example.com.evil"));
    assert(!WebSocketOriginAllowed("pao.example.com:8080", true, "http://pao.example.com"));
    assert(!WebSocketOriginAllowed("pao.example.com", true, ""));

    WebSocketController controller;
    const bool acquired_first = controller.Acquire(10, [](int) { return false; });
    assert(acquired_first);
    const bool rejected_second = controller.Acquire(11, [](int fd) { return fd == 10; });
    assert(!rejected_second);
    assert(controller.Owns(10));
    assert(!controller.Owns(11));
    const bool acquired_after_release = controller.Acquire(11, [](int) { return false; });
    assert(acquired_after_release);
    assert(controller.Owns(11));
    assert(!controller.Owns(10));
    controller.Release(10);
    assert(controller.Owns(11));
    controller.Release(11);
    const bool acquired_again = controller.Acquire(10, [](int) { return false; });
    assert(acquired_again);
}
