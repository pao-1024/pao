"""Export printable solids and check watertight STLs and assembly clearance."""

import json
from itertools import combinations

import cadquery as cq
import trimesh
from design import OUTPUT, D
from rotary_parts import parts

STL_DIR = OUTPUT / "stl"
STEP_DIR = OUTPUT / "step"


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
