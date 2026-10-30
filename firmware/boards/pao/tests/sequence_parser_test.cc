#include "sequence_parser.h"

#include <cstdio>
#include <string>
#include <string_view>

namespace {

int failures = 0;

void Expect(bool condition, const char* message) {
    if (!condition) {
        std::fprintf(stderr, "FAIL: %s\n", message);
        ++failures;
    }
}

bool Parse(std::string_view text, pao::ActionSequence& sequence) {
    std::string error;
    return pao::ParseActionSequence(text, sequence, error) && error.empty();
}

}  // namespace

int main() {
    pao::ActionSequence sequence;
    Expect(Parse("forward:1000,turn_left:800,fire:300", sequence), "valid sequence accepted");
    Expect(sequence.count == 3, "valid sequence count");
    Expect(sequence.total_duration_ms == 2100, "valid sequence total duration");
    Expect(sequence.steps[2].action == pao::SequenceAction::Fire, "fire action parsed");
    Expect(Parse("fire:300", sequence) && sequence.count == 1, "one fire step accepted");

    std::string twenty_steps;
    for (int i = 0; i < 20; ++i) {
        if (i != 0) {
            twenty_steps += ',';
        }
        twenty_steps += "forward:1000";
    }
    Expect(Parse(twenty_steps, sequence), "20 steps accepted");
    twenty_steps += ",forward:1000";
    Expect(!Parse(twenty_steps, sequence), "21 steps rejected");

    Expect(Parse("forward:15000,backward:15000,turn_left:15000,turn_right:15000", sequence),
           "60000ms accepted");
    Expect(!Parse("forward:15000,backward:15000,turn_left:15000,turn_right:15000,fire:300", sequence),
           "over 60000ms rejected");
    Expect(!Parse("", sequence), "empty sequence rejected");
    Expect(!Parse("fly:100", sequence), "unknown action rejected");
    Expect(!Parse("forward:99", sequence), "short duration rejected");
    Expect(!Parse("forward:15001", sequence), "long duration rejected");
    Expect(!Parse("fire:299", sequence), "non-300ms fire rejected");
    Expect(!Parse("forward:1000,", sequence), "trailing comma rejected");
    Expect(!Parse("forward:1000,,fire:300", sequence), "empty step rejected");
    Expect(!Parse("forward:1000:2", sequence), "extra colon rejected");
    Expect(!Parse("forward:1000, turn_left:800", sequence), "space rejected");

    if (failures != 0) {
        std::fprintf(stderr, "%d sequence parser checks failed\n", failures);
        return 1;
    }
    std::puts("sequence parser self-check passed");
    return 0;
}
