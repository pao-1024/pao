#pragma once

#include <cstddef>
#include <string_view>

namespace pao {

constexpr std::size_t kWebSocketHeaderMaxLength = 128;

inline bool AsciiCaseInsensitiveEqual(std::string_view left, std::string_view right) {
    if (left.size() != right.size()) {
        return false;
    }
    for (std::size_t i = 0; i < left.size(); ++i) {
        auto lhs = static_cast<unsigned char>(left[i]);
        auto rhs = static_cast<unsigned char>(right[i]);
        if (lhs >= 'A' && lhs <= 'Z') {
            lhs = static_cast<unsigned char>(lhs + ('a' - 'A'));
        }
        if (rhs >= 'A' && rhs <= 'Z') {
            rhs = static_cast<unsigned char>(rhs + ('a' - 'A'));
        }
        if (lhs != rhs) {
            return false;
        }
    }
    return true;
}

inline std::string_view WithoutDefaultPort(std::string_view authority, std::string_view scheme) {
    const std::string_view default_port = scheme == "http://" ? ":80" : ":443";
    if (authority.size() > default_port.size() &&
        authority.substr(authority.size() - default_port.size()) == default_port) {
        return authority.substr(0, authority.size() - default_port.size());
    }
    return authority;
}

inline bool OriginMatchesSchemeHost(std::string_view origin, std::string_view scheme,
                                    std::string_view host) {
    return origin.size() >= scheme.size() &&
           AsciiCaseInsensitiveEqual(origin.substr(0, scheme.size()), scheme) &&
           AsciiCaseInsensitiveEqual(
               WithoutDefaultPort(origin.substr(scheme.size()), scheme),
               WithoutDefaultPort(host, scheme));
}

inline bool WebSocketOriginAllowed(std::string_view host, bool has_origin,
                                   std::string_view origin) {
    if (host.empty()) {
        return false;
    }
    if (!has_origin) {
        return true;
    }
    return OriginMatchesSchemeHost(origin, "http://", host) ||
           OriginMatchesSchemeHost(origin, "https://", host);
}

class WebSocketController {
public:
    template <typename IsAlive>
    bool Acquire(int fd, IsAlive&& is_alive) {
        if (fd < 0) {
            return false;
        }
        if (owner_fd_ != fd && owner_fd_ >= 0 && is_alive(owner_fd_)) {
            return false;
        }
        owner_fd_ = fd;
        return true;
    }

    bool Owns(int fd) const {
        return owner_fd_ == fd;
    }

    void Release(int fd) {
        if (owner_fd_ == fd) {
            owner_fd_ = -1;
        }
    }

private:
    int owner_fd_ = -1;
};

}  // namespace pao
