#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

mkdir -p ../tmp/tests
"${CXX:-c++}" -std=c++17 -Wall -Wextra -Werror -pthread \
    -Itests/motor/stubs -Icomponents/pao/include \
    components/pao/motor.cc tests/motor/motor_test.cc \
    -o ../tmp/tests/motor_test
../tmp/tests/motor_test
