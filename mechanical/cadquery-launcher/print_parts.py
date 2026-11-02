"""Export separated FDM parts and verify that each STL is a closed solid."""

import json

import cadquery as cq
import trimesh
from build import block
from design import OUTPUT, D

PRINT = OUTPUT / "print"
BALL_CLEARANCE = 0.6  # 11 mm ball in a 12.2 mm square bore
SHAFT_DIAMETER = 5.4  # nominal TT D-shaft; verify against the actual motor
SHAFT_FLAT_TO_ROUND = 4.3
SHAFT_CLEARANCE = 0.2


def vertical_hole(
    x: float, y: float, radius: float, z0: float, height: float
) -> cq.Workplane:
    return (
        cq.Workplane("XY")
        .center(x, y)
        .circle(radius)
        .extrude(height)
        .translate((0, 0, z0))
    )


def chassis() -> cq.Workplane:
    base = block((D.base_length, D.base_width, 6), (85, 0, 3)).edges("|Z").fillet(2)
    floor = block((75, 16.4, 1), (132.5, 0, 6.5))
    result = base.union(floor)
    for side in (-1, 1):
        result = result.union(block((75, 2.4, 13), (132.5, side * 7.7, 13)))
        result = result.union(block((80, 2.4, 9), (60, side * 7.7, 12.5)))
    result = result.cut(block((5, 3, 2), (D.ball_x, 7.7, 19)))
    # Compression-spring stop and a zip-tie cradle for a nominal 70 x 19 mm TT motor.
    result = result.union(block((4, 15, 15), (26, 0, 13)))
    for y in (-36, -11):
        result = result.union(block((70, 2, 5), (45, y, 8.5)))
    for x in (25, 65):
        for y in (-36, -11):
            result = result.cut(block((3, 4, 8), (x, y, 3)))
    for x, y in ((100, -13.5), (120, 13.5)):
        result = result.cut(vertical_hole(x, y, 1.7, -1, 8))
    for x in (125, 162):
        for y in (-7.7, 7.7):
            result = result.cut(vertical_hole(x, y, 1.35, 15.5, 6))
    return result


def magazine() -> cq.Workplane:
    outer = block((18, 18, 39), (D.ball_x, 0, 37.5))
    bore = block((12.2, 12.2, 41), (D.ball_x, 0, 37.5))
    result = outer.cut(bore)
    # Slots in the Y walls let the gate slide without cutting the X walls.
    result = result.cut(block((11.9, 20, 2.2), (D.ball_x, 0, 19.1)))
    for side in (-1, 1):
        result = result.cut(block((20, 5, 2), (D.ball_x, side * 7.7, 18.9)))
    for x, y in ((100, -13.5), (120, 13.5)):
        result = result.union(block((10, 8.8, 15.8), (x, y, 14.1)))
        bridge_y = -9.1 if y < 0 else 9.1
        result = result.union(block((6, 2, 3), (x, bridge_y, 21)))
        result = result.cut(vertical_hole(x, y, 1.7, 5, 19))
    return result


def gate() -> cq.Workplane:
    plate = block((11.6, 11.6, 1.8), (D.ball_x, 0, 19))
    tab = block((4, 23.6, 1.8), (D.ball_x, 17.3, 19))
    result = plate.union(tab)
    return result.cut(vertical_hole(D.ball_x, 25, 1.3, 17, 4))


def striker() -> cq.Workplane:
    rod = block(
        (D.striker_length, D.striker_width, D.striker_height),
        (D.striker_cocked_x, 0, D.ball_z),
    )
    collar = cq.Workplane("YZ").circle(5.8).extrude(3).translate((56.5, 0, D.ball_z))
    follower = block((2, 7, 15), (57.5, 0, 22.5))
    return rod.union(collar).union(follower)


def cam() -> cq.Workplane:
    blank = (
        cq.Workplane("XZ")
        .center(46, 30)
        .circle(10)
        .extrude(4, both=True)
        .union(block((8, 8, 6), (52, 0, 30)))
    )
    bore = (
        cq.Workplane("XZ")
        .center(46, 30)
        .circle((SHAFT_DIAMETER + SHAFT_CLEARANCE) / 2)
        .extrude(6, both=True)
    )
    flat_height = (
        SHAFT_FLAT_TO_ROUND + SHAFT_CLEARANCE - (SHAFT_DIAMETER + SHAFT_CLEARANCE) / 2
    )
    d_cut = bore.intersect(block((12, 20, 12), (46, 0, 24 + flat_height)))
    return blank.cut(d_cut)


def cover() -> cq.Workplane:
    result = block((51, 20, 2), (144.5, 0, 20.5))
    for x in (125, 162):
        for y in (-7.7, 7.7):
            result = result.cut(vertical_hole(x, y, 1.7, 18.5, 4))
    return result


def ball() -> cq.Workplane:
    return cq.Workplane("XY").sphere(D.ball_radius)


def shaft_fit() -> cq.Workplane:
    result = block((32, 12, 5), (16, 6, 2.5))
    for x, clearance in ((6, 0.1), (16, 0.2), (26, 0.3)):
        radius = (SHAFT_DIAMETER + clearance) / 2
        flat_height = SHAFT_FLAT_TO_ROUND + clearance - radius
        circle = vertical_hole(x, 6, radius, -1, 7)
        clip = block((10, 12, 8), (x, flat_height, 2.5))
        result = result.cut(circle.intersect(clip))
    return result


def parts() -> dict[str, cq.Workplane]:
    return {
        "chassis": chassis(),
        "magazine": magazine(),
        "gate": gate(),
        "striker": striker(),
        "cam": cam(),
        "cover": cover(),
        "ball": ball(),
        "shaft_fit": shaft_fit(),
    }


def main() -> None:
    PRINT.mkdir(parents=True, exist_ok=True)
    geometry = parts()
    for left, right in (
        ("chassis", "magazine"),
        ("chassis", "gate"),
        ("magazine", "gate"),
        ("chassis", "striker"),
        ("striker", "cam"),
        ("chassis", "cover"),
    ):
        left_shape = geometry[left].val()
        right_shape = geometry[right].val()
        assert isinstance(left_shape, cq.Shape) and isinstance(right_shape, cq.Shape)
        overlap = left_shape.intersect(right_shape).Volume()
        assert overlap < 1e-5, (
            f"assembled parts overlap: {left}, {right} ({overlap:.3f} mm³)"
        )
    report = {}
    for name, part in geometry.items():
        solid = part.val()
        assert isinstance(solid, cq.Shape)
        assert solid.isValid() and len(solid.Solids()) == 1, (
            f"{name} is not one valid solid"
        )
        part.export(str(PRINT / f"{name}.step"))
        # Lay each STL on Z=0. The assembled STEP keeps design coordinates.
        stl = PRINT / f"{name}.stl"
        if name == "ball":
            # The OCCT sphere STL has a seam at the poles; an icosphere closes it.
            ball_mesh = trimesh.creation.icosphere(subdivisions=4, radius=D.ball_radius)
            ball_mesh.apply_translation(-ball_mesh.bounds[0])
            ball_mesh.export(stl)
        else:
            oriented = part.rotate((0, 0, 0), (1, 0, 0), 90) if name == "cam" else part
            oriented_solid = oriented.val()
            assert isinstance(oriented_solid, cq.Shape)
            bb = oriented_solid.BoundingBox()
            oriented = oriented.translate((-bb.xmin, -bb.ymin, -bb.zmin))
            oriented.export(str(stl), tolerance=0.05, angularTolerance=0.1)
        mesh = trimesh.load_mesh(stl)
        assert mesh.is_volume, f"{name} STL is not a closed, outward-facing mesh"
        report[name] = {
            "volume_mm3": round(solid.Volume(), 2),
            "bounds_mm": [round(v, 2) for v in mesh.extents],
        }
    (PRINT / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
