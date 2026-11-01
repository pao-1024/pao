"""Validate the baked Blender launcher trace."""

import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FPS = 120
EXIT_X_MM = 160.0


def load_rows():
    with (ROOT / "trace.csv").open(newline="") as handle:
        return list(csv.DictReader(handle))


def numeric(row, key):
    return float(row[key])


def check():
    rows = load_rows()
    assert rows, "trace is empty"

    frames = [int(row["frame"]) for row in rows]
    assert frames == list(range(1, len(rows) + 1)), "trace has missing frames"
    assert all(key in rows[0] for key in ("striker_x_mm", "cam_deg")), "trace schema is incomplete"

    for row in rows:
        for key in (
            "cam_deg",
            "striker_x_mm",
            "ball1_x",
            "ball1_y",
            "ball1_z",
            "ball2_x",
            "ball2_y",
            "ball2_z",
            "ball3_x",
            "ball3_y",
            "ball3_z",
        ):
            assert math.isfinite(numeric(row, key)), f"non-finite {key} at frame {row['frame']}"

    striker = [numeric(row, "striker_x_mm") for row in rows]
    assert min(striker) < 42.0, "striker never reaches the cam-driven rear position"
    assert max(striker) > 47.0, "striker never returns toward the firing position"

    exits = []
    for label in ("ball1", "ball2", "ball3"):
        previous = numeric(rows[0], f"{label}_x")
        for row in rows[1:]:
            current = numeric(row, f"{label}_x")
            if previous < EXIT_X_MM <= current:
                exits.append(
                    {
                        "ball": label,
                        "frame": int(row["frame"]),
                        "time_s": round((int(row["frame"]) - 1) / FPS, 4),
                        "x_mm": current,
                    }
                )
            previous = current

    result = {
        "frames": len(rows),
        "duration_s": round((len(rows) - 1) / FPS, 4),
        "striker_min_mm": round(min(striker), 3),
        "striker_max_mm": round(max(striker), 3),
        "exits": exits,
    }
    print(json.dumps(result, ensure_ascii=True, indent=2))

    assert len(exits) == 0, "projectile left the barrel; the feed and firing loop is not validated yet"


if __name__ == "__main__":
    check()
