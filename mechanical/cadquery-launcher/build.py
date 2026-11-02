"""Build the spring launcher as editable CadQuery solids and STEP assembly."""

import cadquery as cq
from design import OUTPUT, D


def block(
    size: tuple[float, float, float], center: tuple[float, float, float]
) -> cq.Workplane:
    return cq.Workplane("XY").box(*size).translate(center)


def parts() -> dict[str, cq.Workplane]:
    floor = block((D.base_length, D.base_width, 6), (85, 0, 3))
    floor = floor.edges("|Z").fillet(2)

    # The bottom ball has an open path along +X. The other two start in the
    # vertical magazine and can descend only after the ball below has left.
    barrel_floor = block((75, 16.4, 1), (132.5, 0, 6.5))
    barrel_roof = block((51, 17.8, 2), (144.5, 0, 19.5))
    rail_y = D.rail_inner_y + D.rail_thickness / 2
    rails = [
        block((75, D.rail_thickness, 13), (132.5, side * rail_y, 13))
        for side in (-1, 1)
    ]
    rails.extend(
        block((80, D.rail_thickness, 9), (60, side * 7.7, 12.5)) for side in (-1, 1)
    )
    body = floor.union(barrel_floor).union(barrel_roof)
    for rail in rails:
        body = body.union(rail)

    # Square magazine has a 12 mm clear bore for 11 mm soft balls.
    mag_outer = block((16, 16, 37), (D.ball_x, 0, 36.5))
    mag_bore = block((12, 12, 39), (D.ball_x, 0, 36.5))
    magazine = mag_outer.cut(mag_bore)
    gate = block((12, 12, 1), (D.ball_x, 0, 18.5))

    striker = block(
        (D.striker_length, D.striker_width, D.striker_height),
        (D.striker_cocked_x, 0, D.ball_z),
    )
    striker = striker.union(block((2, 7, 15), (57.5, 0, 22.5)))
    cam = (
        cq.Workplane("XZ")
        .center(46, 30)
        .circle(10)
        .extrude(4, both=True)
        .union(block((8, 8, 6), (52, 0, 30)))
    )
    # The helix is a display part; the simulation applies Hooke's law to
    # the dynamic striker body rather than simulating individual coils.
    spring_path = cq.Wire.makeHelix(3.0, 27.0, 5.0, center=(0, 0, 0), dir=(1, 0, 0))
    spring = (
        cq.Workplane("YZ")
        .center(0, 5)
        .circle(0.45)
        .sweep(spring_path)
        .translate((29, 0, D.ball_z))
    )

    result = {
        "body": body,
        "magazine": magazine,
        "gate": gate,
        "striker": striker,
        "cam": cam,
        "spring": spring,
    }
    for number in range(3):
        result[f"ball_{number + 1}"] = (
            cq.Workplane("XY")
            .sphere(D.ball_radius)
            .translate((D.ball_x, 0, D.ball_z + 12 * number))
        )
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assembly = cq.Assembly(name="pao_spring_launcher")
    geometry = parts()
    for left, right in (
        ("body", "spring"),
        ("striker", "spring"),
        ("striker", "cam"),
        ("cam", "spring"),
    ):
        left_shape = geometry[left].val()
        right_shape = geometry[right].val()
        assert isinstance(left_shape, cq.Shape) and isinstance(right_shape, cq.Shape)
        overlap = left_shape.intersect(right_shape).Volume()
        assert overlap < 1e-5, f"CAD parts overlap: {left}, {right} ({overlap:.3f} mm³)"
    colors = {
        "body": cq.Color("darkslategray"),
        "magazine": cq.Color("steelblue"),
        "gate": cq.Color("gold"),
        "striker": cq.Color("orangered"),
        "cam": cq.Color("orange"),
        "spring": cq.Color(0.75, 0.75, 0.8),
    }
    for name, shape in geometry.items():
        shape.export(str(OUTPUT / f"{name}.step"))
        assembly.add(shape, name=name, color=colors.get(name, cq.Color("yellow")))
    assembly.export(str(OUTPUT / "launcher.step"))
    print(f"CadQuery assembly: {OUTPUT / 'launcher.step'}")


if __name__ == "__main__":
    main()
