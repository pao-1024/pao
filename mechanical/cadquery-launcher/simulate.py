"""Three-ball Bullet simulation with a dynamic spring-driven striker."""

import csv
import json
from pathlib import Path

import pybullet as p  # ty: ignore[unresolved-import]
from design import OUTPUT, D

MM = 0.001
STEP_HZ = 960
FPS = 120
DURATION = 1.7
RELEASE_PHASE = 0.15
CYCLE = 0.50


def box(
    size: tuple[float, float, float],
    center: tuple[float, float, float],
    mass: float = 0,
) -> int:
    collision = p.createCollisionShape(
        p.GEOM_BOX, halfExtents=[value * MM / 2 for value in size]
    )
    return p.createMultiBody(
        baseMass=mass,
        baseCollisionShapeIndex=collision,
        basePosition=[value * MM for value in center],
    )


def scene() -> tuple[int, int, list[int]]:
    p.setGravity(0, 0, -9.81)
    p.setTimeStep(1 / STEP_HZ)
    p.setPhysicsEngineParameter(
        numSolverIterations=120, contactBreakingThreshold=0.0002
    )
    box((170, 80, 6), (85, 0, 3))
    box((75, 16.4, 1), (132.5, 0, 6.5))
    box((51, 17.8, 2), (144.5, 0, 19.5))
    for side in (-1, 1):
        box((75, D.rail_thickness, 13), (132.5, side * 7.7, 13))
        box((80, D.rail_thickness, 9), (60, side * 7.7, 12.5))
        box((16, 2, 37), (D.ball_x, side * 7, 36.5))
    for side in (-1, 1):
        box((2, 12, 37), (D.ball_x + side * 7, 0, 36.5))
    gate = box((12, 12, 1), (D.ball_x, 0, 18.5))

    striker = box(
        (D.striker_length, D.striker_width, D.striker_height),
        (D.striker_cocked_x, 0, D.ball_z),
        D.striker_mass_kg,
    )
    p.changeDynamics(
        striker, -1, lateralFriction=0.05, linearDamping=0.0, angularDamping=0.0
    )
    p.createConstraint(
        striker,
        -1,
        -1,
        -1,
        p.JOINT_PRISMATIC,
        [1, 0, 0],
        [0, 0, 0],
        [D.striker_cocked_x * MM, 0, D.ball_z * MM],
    )

    sphere = p.createCollisionShape(p.GEOM_SPHERE, radius=D.ball_radius * MM)
    balls = []
    for index in range(3):
        ball = p.createMultiBody(
            baseMass=D.ball_mass_kg,
            baseCollisionShapeIndex=sphere,
            basePosition=[D.ball_x * MM, 0, (D.ball_z + 12 * index) * MM],
        )
        p.changeDynamics(
            ball, -1, lateralFriction=0.3, restitution=0, linearDamping=0.01
        )
        balls.append(ball)
    return striker, gate, balls


def cam_target(phase: float) -> float | None:
    if RELEASE_PHASE <= phase < 0.25:
        return None
    if phase < 0.25:
        return D.striker_cocked_x * MM
    progress = min((phase - 0.25) / 0.19, 1.0)
    return (D.striker_rest_x + (D.striker_cocked_x - D.striker_rest_x) * progress) * MM


def gate_position(phase: float) -> float:
    """Return the cam-linked shutter's lateral position in millimetres."""
    if 0.35 <= phase < 0.40:
        return 20 * (phase - 0.35) / 0.05
    if 0.40 <= phase < 0.45:
        return 20.0
    if 0.45 <= phase < 0.49:
        return 20 * (0.49 - phase) / 0.04
    return 0.0


def simulate(
    trace: Path, spring_stiffness: float = D.spring_stiffness
) -> dict[str, object]:
    p.connect(p.DIRECT)
    try:
        striker, gate, balls = scene()
        exits: list[dict[str, float | int]] = []
        rows: list[dict[str, float | int]] = []
        previous_x = [D.ball_x * MM] * len(balls)
        for step in range(int(DURATION * STEP_HZ)):
            time_s = step / STEP_HZ
            phase = time_s % CYCLE
            # The cam-driven shutter opens only after the striker retracts.
            # It meters one ball into the chamber for each later shot.
            gate_y = gate_position(phase) if time_s < 1.1 else 0.0
            p.resetBasePositionAndOrientation(
                gate, [D.ball_x * MM, gate_y * MM, 18.5 * MM], [0, 0, 0, 1]
            )
            x = p.getBasePositionAndOrientation(striker)[0][0]
            vx = p.getBaseVelocity(striker)[0][0]
            # Hooke's law stores 1/2*k*dx² when the cam retracts the plunger.
            spring_force = (
                spring_stiffness * (D.striker_rest_x * MM - x) - D.spring_damping * vx
            )
            target = cam_target(phase)
            cam_force = (
                min(0.0, 90 * (target - x) - 1.0 * vx) if target is not None else 0.0
            )
            p.applyExternalForce(
                striker, -1, [spring_force + cam_force, 0, 0], [0, 0, 0], p.LINK_FRAME
            )
            p.stepSimulation()

            positions = [p.getBasePositionAndOrientation(ball)[0] for ball in balls]
            for index, pos in enumerate(positions):
                if previous_x[index] < D.muzzle_x * MM <= pos[0]:
                    velocity = p.getBaseVelocity(balls[index])[0]
                    exits.append(
                        {
                            "ball": index + 1,
                            "time_s": round(time_s, 4),
                            "speed_m_s": round(velocity[0], 3),
                            "y_mm": round(pos[1] / MM, 3),
                            "z_mm": round(pos[2] / MM, 3),
                        }
                    )
                previous_x[index] = pos[0]
            if step % (STEP_HZ // FPS) == 0:
                row: dict[str, float | int] = {
                    "frame": step // (STEP_HZ // FPS) + 1,
                    "time_s": round(time_s, 5),
                    "striker_x_mm": round(
                        p.getBasePositionAndOrientation(striker)[0][0] / MM, 4
                    ),
                    "spring_energy_j": round(
                        0.5 * spring_stiffness * (D.striker_rest_x * MM - x) ** 2, 6
                    ),
                    "gate_y_mm": gate_y,
                }
                for index, pos in enumerate(positions):
                    for axis, value in zip("xyz", pos):
                        row[f"ball{index + 1}_{axis}_mm"] = round(value / MM, 4)
                rows.append(row)
        trace.parent.mkdir(parents=True, exist_ok=True)
        with trace.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
        result: dict[str, object] = {
            "frames": len(rows),
            "spring_energy_max_j": max(row["spring_energy_j"] for row in rows),
            "striker_min_mm": min(row["striker_x_mm"] for row in rows),
            "striker_max_mm": max(row["striker_x_mm"] for row in rows),
            "exits": exits,
        }
        return result
    finally:
        p.disconnect()


def main() -> None:
    result = simulate(OUTPUT / "trace.csv")
    (OUTPUT / "result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    exits = result["exits"]
    assert isinstance(exits, list)
    assert [event["ball"] for event in exits] == [1, 2, 3], (
        "three ordered shots were not completed"
    )
    assert all(event["speed_m_s"] > 0.2 for event in exits), (
        "a ball crossed the muzzle without launch speed"
    )
    assert all(abs(event["y_mm"]) < 7 and 6 < event["z_mm"] < 20 for event in exits), (
        "a ball crossed the muzzle outside the barrel"
    )
    assert all(
        abs(event["time_s"] - (RELEASE_PHASE + (event["ball"] - 1) * CYCLE)) < 0.2
        for event in exits
    ), "balls did not fire on separate cam cycles"
    control = simulate(OUTPUT / "no_spring_trace.csv", spring_stiffness=0)
    assert control["exits"] == [], "balls exited even with no spring force"
    print("No-spring control: 0 balls exited")


if __name__ == "__main__":
    main()
