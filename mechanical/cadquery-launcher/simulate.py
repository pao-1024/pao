"""Bullet contact simulation of the motor-driven rotor and spring striker."""

import csv
import json
import math
from pathlib import Path

import cadquery as cq
import pybullet as p  # ty: ignore[unresolved-import]
from design import OUTPUT, D
from rotary_parts import (
    cam_ring,
    chassis,
    feed_plate,
    feed_rotor,
    motor_bridge,
    striker_components,
    striker_mass_kg,
)

MM = 0.001
STEP_HZ = 15360
FPS = 120
DURATION = 1.4
CONTACT_TOLERANCE_MM = 0.1


def static_mesh(shape: cq.Workplane, path: Path, centered: bool = False) -> int:
    if centered:
        shape = shape.translate((-D.shaft_x, 0, 0))
    shape.export(str(path), tolerance=0.04, angularTolerance=0.08)
    collision = p.createCollisionShape(
        p.GEOM_MESH,
        fileName=str(path),
        flags=p.GEOM_FORCE_CONCAVE_TRIMESH,
        meshScale=[MM, MM, MM],
    )
    return p.createMultiBody(
        0,
        collision,
        basePosition=[D.shaft_x * MM, 0, 0] if centered else [0, 0, 0],
    )


def penetration_mm() -> float:
    return max(
        (max(0.0, -contact[8] / MM) for contact in p.getContactPoints()), default=0.0
    )


def setup() -> tuple[list[int], int, list[int]]:
    p.setGravity(0, 0, -9.81)
    p.setTimeStep(1 / STEP_HZ)
    p.setPhysicsEngineParameter(
        numSolverIterations=150, contactBreakingThreshold=0.0002, contactERP=0.2
    )
    OUTPUT.mkdir(parents=True, exist_ok=True)
    static_mesh(chassis(), OUTPUT / "chassis_collision.stl")
    static_mesh(feed_plate(), OUTPUT / "feed_plate_collision.stl")
    static_mesh(motor_bridge(), OUTPUT / "motor_bridge_collision.stl")
    rotor = static_mesh(
        feed_rotor(), OUTPUT / "feed_rotor_collision.stl", centered=True
    )
    cam = static_mesh(cam_ring(), OUTPUT / "cam_ring_collision.stl", centered=True)
    collision_files = []
    for index, component in enumerate(striker_components()):
        path = OUTPUT / f"striker_collision_{index}.stl"
        component.translate((-D.striker_cocked_x, 0, -D.ball_z)).export(
            str(path), tolerance=0.02, angularTolerance=0.05
        )
        collision_files.append(str(path))
    shape = p.createCollisionShapeArray(
        shapeTypes=[p.GEOM_MESH] * len(collision_files),
        fileNames=collision_files,
        meshScales=[[MM, MM, MM]] * len(collision_files),
    )
    # PyBullet propagates margins to compound mesh children only on base bodies.
    # Configure the shared shape before attaching it to the prismatic link.
    margin_body = p.createMultiBody(baseMass=0, baseCollisionShapeIndex=shape)
    p.changeDynamics(margin_body, -1, collisionMargin=0)
    p.removeBody(margin_body)
    striker = p.createMultiBody(
        baseMass=0,
        basePosition=[D.striker_cocked_x * MM, 0, D.ball_z * MM],
        linkMasses=[striker_mass_kg()],
        linkCollisionShapeIndices=[shape],
        linkVisualShapeIndices=[-1],
        linkPositions=[[0, 0, 0]],
        linkOrientations=[[0, 0, 0, 1]],
        linkInertialFramePositions=[[0, 0, 0]],
        linkInertialFrameOrientations=[[0, 0, 0, 1]],
        linkParentIndices=[0],
        linkJointTypes=[p.JOINT_PRISMATIC],
        linkJointAxis=[[1, 0, 0]],
    )
    p.setJointMotorControl2(striker, 0, p.VELOCITY_CONTROL, force=0)
    p.changeDynamics(
        striker,
        0,
        lateralFriction=0.05,
        linearDamping=0,
        angularDamping=0,
        collisionMargin=0,
    )
    sphere = p.createCollisionShape(p.GEOM_SPHERE, radius=D.ball_radius * MM)
    balls = []
    for index, degrees in enumerate((0, 120, 240)):
        theta = math.radians(degrees)
        ball = p.createMultiBody(
            D.ball_mass_kg,
            sphere,
            basePosition=[
                (D.shaft_x + D.pocket_radius * math.cos(theta)) * MM,
                D.pocket_radius * math.sin(theta) * MM,
                (D.ball_z if index == 0 else D.loaded_ball_z) * MM,
            ],
        )
        p.changeDynamics(ball, -1, lateralFriction=0.65, restitution=0)
        balls.append(ball)
    p.performCollisionDetection()
    assert penetration_mm() < 0.01, (
        "initial assembly penetrates; check loading height/margins"
    )
    return [rotor, cam], striker, balls


def simulate(
    trace: Path,
    spring_stiffness: float = D.spring_stiffness,
    rotor_speed_deg_s: float = D.rotor_speed_deg_s,
    duration_s: float | None = None,
) -> dict[str, object]:
    p.connect(p.DIRECT)
    try:
        motor_parts, striker, balls = setup()
        previous_x = [(D.shaft_x + D.pocket_radius) * MM] * 3
        exits: list[dict[str, float | int]] = []
        rows: list[dict[str, float | int]] = []
        maximum_penetration = penetration_mm()
        minimum_x = maximum_x = D.striker_cocked_x
        duration = (
            max(DURATION, 360 / rotor_speed_deg_s + 0.15)
            if duration_s is None
            else duration_s
        )
        for step in range(int(duration * STEP_HZ)):
            time_s = step / STEP_HZ
            angle = -math.radians(rotor_speed_deg_s * time_s)
            for motor_part in motor_parts:
                p.resetBasePositionAndOrientation(
                    motor_part,
                    [D.shaft_x * MM, 0, 0],
                    p.getQuaternionFromEuler([0, 0, angle]),
                )
                p.resetBaseVelocity(
                    motor_part, angularVelocity=[0, 0, -math.radians(rotor_speed_deg_s)]
                )
            position, vx, *_ = p.getJointState(striker, 0)
            x = D.striker_cocked_x * MM + position
            force = (
                spring_stiffness * ((D.striker_rest_x + D.spring_preload_mm) * MM - x)
                - D.spring_damping * vx
            )
            p.applyExternalForce(striker, 0, [force, 0, 0], [0, 0, 0], p.LINK_FRAME)
            p.stepSimulation()
            time_s = (step + 1) / STEP_HZ
            x = D.striker_cocked_x * MM + p.getJointState(striker, 0)[0]
            minimum_x = min(minimum_x, x / MM)
            maximum_x = max(maximum_x, x / MM)
            maximum_penetration = max(maximum_penetration, penetration_mm())
            positions = [p.getBasePositionAndOrientation(ball)[0] for ball in balls]
            for index, pos in enumerate(positions):
                if previous_x[index] < D.muzzle_x * MM <= pos[0]:
                    exits.append(
                        {
                            "ball": index + 1,
                            "time_s": round(time_s, 4),
                            "speed_m_s": round(
                                p.getBaseVelocity(balls[index])[0][0], 3
                            ),
                            "y_mm": round(pos[1] / MM, 3),
                            "z_mm": round(pos[2] / MM, 3),
                        }
                    )
                previous_x[index] = pos[0]
            if step % (STEP_HZ // FPS) == 0:
                row: dict[str, float | int] = {
                    "frame": step // (STEP_HZ // FPS) + 1,
                    "time_s": round(time_s, 5),
                    "rotor_angle_deg": round(-rotor_speed_deg_s * time_s, 3),
                    "striker_x_mm": round(
                        D.striker_cocked_x + p.getJointState(striker, 0)[0] / MM, 4
                    ),
                    "spring_energy_j": round(
                        0.5
                        * spring_stiffness
                        * ((D.striker_rest_x + D.spring_preload_mm) * MM - x) ** 2,
                        6,
                    ),
                }
                for index, pos in enumerate(positions, start=1):
                    for axis, value in zip("xyz", pos):
                        row[f"ball{index}_{axis}_mm"] = round(value / MM, 4)
                rows.append(row)
        trace.parent.mkdir(parents=True, exist_ok=True)
        with trace.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
        return {
            "rotor_speed_rpm": rotor_speed_deg_s / 6,
            "spring_stiffness_n_m": spring_stiffness,
            "spring_preload_mm": D.spring_preload_mm,
            "step_hz": STEP_HZ,
            "duration_s": duration,
            "striker_mass_g": round(p.getDynamicsInfo(striker, 0)[0] * 1000, 3),
            "frames": len(rows),
            "spring_energy_max_j": max(row["spring_energy_j"] for row in rows),
            "striker_min_mm": round(minimum_x, 4),
            "striker_max_mm": round(maximum_x, 4),
            "maximum_dynamic_penetration_mm": round(maximum_penetration, 4),
            "exits": exits,
        }
    finally:
        p.disconnect()


def check_contacts(result: dict[str, object]) -> None:
    minimum = result["striker_min_mm"]
    maximum = result["striker_max_mm"]
    penetration = result["maximum_dynamic_penetration_mm"]
    assert isinstance(minimum, float) and isinstance(maximum, float)
    assert isinstance(penetration, float)
    assert minimum >= D.striker_cocked_x - CONTACT_TOLERANCE_MM
    assert maximum <= D.striker_rest_x + CONTACT_TOLERANCE_MM
    assert penetration <= CONTACT_TOLERANCE_MM, f"contact penetration: {penetration} mm"


def main() -> None:
    for rpm in (40, 25, 60):
        name = "" if rpm == 40 else f"speed_{rpm}rpm_"
        result = simulate(OUTPUT / f"{name}trace.csv", rotor_speed_deg_s=rpm * 6)
        (OUTPUT / f"{name}result.json").write_text(json.dumps(result, indent=2) + "\n")
        check_contacts(result)
        exits = result["exits"]
        assert isinstance(exits, list)
        assert [event["ball"] for event in exits] == [1, 2, 3]
        assert [math.floor(event["time_s"] * rpm / 20) for event in exits] == [
            0,
            1,
            2,
        ], "each 120-degree cycle must launch exactly one ball"
        assert all(event["speed_m_s"] > 0.7 for event in exits)
        assert all(abs(event["y_mm"]) < 7 and 6 < event["z_mm"] < 20 for event in exits)
        print(
            f"{rpm} rpm: three ordered launches; maximum penetration {result['maximum_dynamic_penetration_mm']} mm"
        )
        print(json.dumps(result, indent=2))
    # Observe one complete release cycle: later feeds would jam an uncleared bore,
    # which the prescribed-speed motor cannot model as a real motor stall.
    control = simulate(
        OUTPUT / "no_spring_trace.csv",
        spring_stiffness=0,
        duration_s=120 / D.rotor_speed_deg_s,
    )
    (OUTPUT / "no_spring_result.json").write_text(json.dumps(control, indent=2) + "\n")
    check_contacts(control)
    control_exits = control["exits"]
    assert isinstance(control_exits, list)
    assert all(event["speed_m_s"] < 0.5 for event in control_exits), (
        "a ball launched without stored spring energy"
    )
    print(
        f"No-spring control (one cycle): {len(control_exits)} slow roll-off(s), 0 launches"
    )


if __name__ == "__main__":
    main()
