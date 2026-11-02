"""Validate the Blender rigid-body trace and its no-spring control."""

import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FPS = 120
FRAMES = 204
EXIT_X_MM = 170.0
GATE_X_MM = 110.0


def load_rows(name):
    with (ROOT / name).open(newline="") as handle:
        return list(csv.DictReader(handle))


def value(row, key):
    return float(row[key])


def validate_schema(rows):
    required = {
        "frame",
        "time_s",
        "striker_x_mm",
        "spring_energy_j",
        "gate_y_mm",
        "ball1_x_mm",
        "ball1_y_mm",
        "ball1_z_mm",
        "ball2_x_mm",
        "ball2_y_mm",
        "ball2_z_mm",
        "ball3_x_mm",
        "ball3_y_mm",
        "ball3_z_mm",
    }
    assert rows and required <= rows[0].keys(), "trace schema is incomplete"
    assert len(rows) == FRAMES, f"expected {FRAMES} frames, got {len(rows)}"
    assert [int(row["frame"]) for row in rows] == list(range(1, FRAMES + 1))
    for row in rows:
        for key in required - {"frame"}:
            assert math.isfinite(value(row, key)), f"non-finite {key} at frame {row['frame']}"


def exits(rows):
    found = []
    previous = [value(rows[0], f"ball{index}_x_mm") for index in range(1, 4)]
    for row_index, row in enumerate(rows[1:], start=1):
        for ball in range(1, 4):
            current = value(row, f"ball{ball}_x_mm")
            if previous[ball - 1] < EXIT_X_MM <= current:
                previous_row = rows[row_index - 1]
                found.append(
                    {
                        "ball": ball,
                        "frame": int(row["frame"]),
                        "time_s": value(row, "time_s"),
                        "speed_m_s": round(
                            (current - value(previous_row, f"ball{ball}_x_mm"))
                            * FPS
                            / 1000,
                            3,
                        ),
                        "y_mm": value(row, f"ball{ball}_y_mm"),
                        "z_mm": value(row, f"ball{ball}_z_mm"),
                    }
                )
            previous[ball - 1] = current
    return found


def balls_in_chamber(row):
    return sum(
        abs(value(row, f"ball{ball}_x_mm") - GATE_X_MM) < 8
        and 6 < value(row, f"ball{ball}_z_mm") < 19
        for ball in range(1, 4)
    )


def validate_main():
    rows = load_rows("trace.csv")
    validate_schema(rows)

    striker = [value(row, "striker_x_mm") for row in rows]
    spring_energy = [value(row, "spring_energy_j") for row in rows]
    gate = [value(row, "gate_y_mm") for row in rows]
    assert min(striker) < 70, "striker is not retracted by the cam"
    assert max(striker) > 80, "striker never compresses the ball"
    assert max(spring_energy) > 0.04, "spring is not storing energy"
    assert min(gate) < 0.01 and max(gate) > 19.9, "gate does not clear the magazine"

    shots = exits(rows)
    assert [shot["ball"] for shot in shots] == [1, 2, 3], "three ordered shots were not completed"
    assert all(shot["speed_m_s"] > 0.2 for shot in shots), "a ball crossed the muzzle too slowly"
    assert all(abs(shot["y_mm"]) < 7 and 6 < shot["z_mm"] < 20 for shot in shots), (
        "a ball crossed the muzzle outside the barrel"
    )
    times = [shot["time_s"] for shot in shots]
    assert all(abs(b - a - 0.5) < 0.05 for a, b in zip(times, times[1:])), (
        "shots did not occur on separate 0.5 s cycles"
    )

    staged = {frame: balls_in_chamber(rows[frame - 1]) for frame in (1, 60, 120, 180)}
    assert staged == {1: 1, 60: 1, 120: 1, 180: 0}, (
        f"gate did not meter exactly one ball per cycle: {staged}"
    )
    return {
        "frames": len(rows),
        "duration_s": round((len(rows) - 1) / FPS, 4),
        "striker_min_mm": round(min(striker), 3),
        "striker_max_mm": round(max(striker), 3),
        "spring_energy_max_j": max(spring_energy),
        "balls_in_chamber": staged,
        "exits": shots,
    }


def validate_control():
    rows = load_rows("no_spring_trace.csv")
    validate_schema(rows)
    controls = exits(rows)
    assert controls == [], f"balls exited without spring force: {controls}"
    assert max(value(row, "spring_energy_j") for row in rows) == 0.0
    return {"frames": len(rows), "exits": controls}


if __name__ == "__main__":
    result = {"main": validate_main(), "no_spring": validate_control()}
    print(json.dumps(result, ensure_ascii=False, indent=2))
