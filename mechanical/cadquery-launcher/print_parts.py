"""Export printable solids and check watertight STLs and assembly clearance."""

import json
import math
from itertools import combinations

import cadquery as cq
import trimesh
from design import OUTPUT, D
from rotary_parts import cam_radius, cylinder, feed_rotor, parts, striker_mass_kg

STL_DIR = OUTPUT / "stl"
STEP_DIR = OUTPUT / "step"


def check_motion_clearance(geometry: dict[str, cq.Workplane]) -> None:
    """Check the flat base, rotor envelope and sampled slider stroke."""
    moving = geometry["striker"].val()
    assert isinstance(moving, cq.Shape)
    bed_faces = [
        face
        for face in moving.Faces()
        if face.geomType() == "PLANE"
        and face.BoundingBox().zlen < 1e-6
        and abs(face.Center().z - D.striker_floor_z) < 1e-6
    ]
    assert len(bed_faces) == 1 and bed_faces[0].Area() > 300, (
        "striker needs one broad, continuous print base"
    )
    fixed = {
        name: geometry[name].val() for name in ("chassis", "feed_plate", "motor_bridge")
    }
    fixed["feed_rotor"] = feed_rotor().val()
    base = fixed["chassis"]
    assert isinstance(base, cq.Shape)
    envelope = cylinder(D.shaft_x, 0, max(cam_radius(a) for a in range(360)), 25, 5)
    envelope = envelope.union(cylinder(D.shaft_x, 0, 22, 30, 1))
    envelope = envelope.union(cylinder(D.shaft_x, 0, 4.5, 31, 4)).val()
    rotor = geometry["rotor_cam"].val()
    assert isinstance(envelope, cq.Shape) and isinstance(rotor, cq.Shape)
    assert rotor.cut(envelope).Volume() < 0.01, "rotor exceeds its rotation envelope"
    rotating_clearances = {}
    for name in ("chassis", "feed_plate", "motor_bridge"):
        obstacle = fixed[name]
        assert isinstance(obstacle, cq.Shape)
        assert envelope.intersect(obstacle).Volume() < 0.01, (
            f"rotation envelope hits {name}"
        )
        rotating_clearances[name] = round(envelope.distance(obstacle), 3)
    minimum = {name: math.inf for name in fixed}
    travel = D.striker_rest_x - D.striker_cocked_x
    samples = math.ceil(travel / 0.5) + 1
    for index in range(samples):
        offset = min(index * 0.5, travel)
        translated = moving.translate((offset, 0, 0))
        for name, obstacle in fixed.items():
            assert isinstance(obstacle, cq.Shape)
            overlap = translated.intersect(obstacle).Volume()
            assert overlap < 0.01, (
                f"striker overlaps {name} at +{offset} mm: {overlap:.3f} mm³"
            )
            minimum[name] = min(minimum[name], translated.distance(obstacle))
        # A solid OD10 envelope must fit behind the spring seat throughout travel.
        spring = (
            cq.Workplane("YZ")
            .circle(5)
            .extrude(13 + offset)
            .translate((46, 0, D.ball_z))
            .val()
        )
        assert isinstance(spring, cq.Shape)
        assert translated.intersect(spring).Volume() < 0.01, "spring space obstructed"
        assert spring.intersect(base).Volume() < 0.01, "chassis obstructs spring space"
    (OUTPUT / "clearance_report.json").write_text(
        json.dumps(
            {
                "stroke_mm": travel,
                "flat_base_area_mm2": round(bed_faces[0].Area(), 3),
                "sample_step_mm": 0.5,
                "samples": samples,
                "minimum_clearance_mm": {
                    name: round(value, 3) for name, value in minimum.items()
                },
                "rotor_envelope_clearance_mm": rotating_clearances,
                "spring_envelope_diameter_mm": 10,
                "striker_mass_g": round(striker_mass_kg() * 1000, 3),
            },
            indent=2,
        )
        + "\n"
    )


def main() -> None:
    STL_DIR.mkdir(parents=True, exist_ok=True)
    STEP_DIR.mkdir(parents=True, exist_ok=True)
    geometry = parts()
    assembled = {
        name: shape
        for name, shape in geometry.items()
        if name not in {"ball", "shaft_fit"}
    }
    for (left, a), (right, b) in combinations(assembled.items(), 2):
        left_shape = a.val()
        right_shape = b.val()
        assert isinstance(left_shape, cq.Shape) and isinstance(right_shape, cq.Shape)
        overlap = left_shape.intersect(right_shape).Volume()
        assert overlap < 0.01, (
            f"assembled parts overlap: {left}, {right}: {overlap:.2f} mm³"
        )
    check_motion_clearance(geometry)
    report: dict[str, object] = {}
    for name, part in geometry.items():
        solid = part.val()
        assert isinstance(solid, cq.Shape)
        assert solid.isValid() and len(solid.Solids()) == 1, (
            f"{name} is not one valid solid"
        )
        part.export(str(STEP_DIR / f"{name}.step"))
        stl = STL_DIR / f"{name}.stl"
        if name == "ball":
            mesh = trimesh.creation.icosphere(subdivisions=4, radius=D.ball_radius)
            mesh.apply_translation(-mesh.bounds[0])
            mesh.export(stl)
        else:
            oriented = part
            if name in {"feed_plate", "motor_bridge", "motor_clip"}:
                oriented = oriented.rotate((0, 0, 0), (1, 0, 0), 180)
            shape = oriented.val()
            assert isinstance(shape, cq.Shape)
            bounds = shape.BoundingBox()
            oriented = oriented.translate((-bounds.xmin, -bounds.ymin, -bounds.zmin))
            oriented.export(str(stl), tolerance=0.05, angularTolerance=0.1)
        mesh = trimesh.load_mesh(stl)
        assert mesh.is_volume, f"{name} STL is not a closed, outward-facing mesh"
        report[name] = {
            "volume_mm3": round(solid.Volume(), 2),
            "bounds_mm": [round(v, 2) for v in mesh.extents],
        }
    (OUTPUT / "print_report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
