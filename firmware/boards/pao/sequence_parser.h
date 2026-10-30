#pragma once

#include <array>
#include <charconv>
#include <cstddef>
#include <string>
#include <string_view>
#include <system_error>

namespace pao {

enum class SequenceAction { Forward, Backward, TurnLeft, TurnRight, Fire };

struct SequenceStep {
    SequenceAction action;
    int duration_ms;
};

struct ActionSequence {
    static constexpr std::size_t kMaxSteps = 20;
    static constexpr int kMaxTotalDurationMs = 60000;
    static constexpr int kFireDurationMs = 300;

    std::array<SequenceStep, kMaxSteps> steps{};
    std::size_t count = 0;
    int total_duration_ms = 0;
};

inline bool ParseSequenceAction(std::string_view text, SequenceAction& action) {
    if (text == "forward") {
        action = SequenceAction::Forward;
    } else if (text == "backward") {
        action = SequenceAction::Backward;
    } else if (text == "turn_left") {
        action = SequenceAction::TurnLeft;
    } else if (text == "turn_right") {
        action = SequenceAction::TurnRight;
    } else if (text == "fire") {
        action = SequenceAction::Fire;
    } else {
        return false;
    }
    return true;
}

inline bool ParseActionSequence(std::string_view text, ActionSequence& sequence, std::string& error) {
    sequence = {};
    error.clear();
    if (text.empty()) {
        error = "steps 不能为空";
        return false;
    }
    if (text.back() == ',') {
        error = "steps 末尾不能有逗号";
        return false;
    }

    std::size_t begin = 0;
    while (begin < text.size()) {
        const std::size_t comma = text.find(',', begin);
        const std::size_t end = comma == std::string_view::npos ? text.size() : comma;
        const auto item = text.substr(begin, end - begin);
        if (item.empty()) {
            error = "步骤不能为空";
            return false;
        }
        if (sequence.count >= ActionSequence::kMaxSteps) {
            error = "steps 最多 20 步";
            return false;
        }

        const std::size_t colon = item.find(':');
        if (colon == std::string_view::npos || colon == 0 || colon + 1 == item.size() ||
            item.find(':', colon + 1) != std::string_view::npos) {
            error = "步骤格式应为 action:duration_ms";
            return false;
        }

        SequenceAction action;
        if (!ParseSequenceAction(item.substr(0, colon), action)) {
            error = "action 只支持 forward/backward/turn_left/turn_right/fire";
            return false;
        }

        const auto duration_text = item.substr(colon + 1);
        int duration_ms = 0;
        const auto parsed = std::from_chars(
            duration_text.data(), duration_text.data() + duration_text.size(), duration_ms);
        if (parsed.ec != std::errc{} || parsed.ptr != duration_text.data() + duration_text.size() ||
            duration_ms < 100 || duration_ms > 15000) {
            error = "duration_ms 取 100..15000";
            return false;
        }
        if (action == SequenceAction::Fire && duration_ms != ActionSequence::kFireDurationMs) {
            error = "fire 的 duration_ms 必须为 300";
            return false;
        }
        if (duration_ms > ActionSequence::kMaxTotalDurationMs - sequence.total_duration_ms) {
            error = "steps 总时长不能超过 60000ms";
            return false;
        }

        sequence.steps[sequence.count++] = {action, duration_ms};
        sequence.total_duration_ms += duration_ms;
        if (comma == std::string_view::npos) {
            break;
        }
        begin = comma + 1;
    }
    return true;
}

}  // namespace pao
