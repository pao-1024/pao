"""Printable parts for a one-shaft, three-pocket spring launcher."""

import math

import cadquery as cq
from design import D


def block(
    size: tuple[float, float, float], center: tuple[float, float, float]
) -> cq.Workplane:
    return cq.Workplane("XY").box(*size).translate(center)


def cylinder(
    x: float, y: float, radius: float, z0: float, height: float
) -> cq.Workplane:
    return (
        cq.Workplane("XY")
        .center(x, y)
        .circle(radius)
        .extrude(height)
        .translate((0, 0, z0))
    )


def cam_radius(degrees: float) -> float:
    high = D.shaft_x - (D.striker_cocked_x - 18)
    stroke = D.striker_rest_x - D.striker_cocked_x
    low = high - stroke
    phase = degrees % 120
    if phase < 10:
        return low
    if phase < 60:
        return low + stroke * (phase - 10) / 50
    if phase < 94:
        return high
    return low


def cam_outline() -> list[tuple[float, float]]:
    """A relieved drop edge lets the wide circular follower leave the cam."""
    high = D.shaft_x - (D.striker_cocked_x - 18)
    outline = []
    for degrees in range(360):
        radii_angles = []
        if degrees % 120 == 94:
            radii_angles.extend([(high, degrees), (cam_radius(degrees), degrees - 6)])
        radii_angles.append((cam_radius(degrees), degrees))
        for radius, angle in radii_angles:
            theta = math.radians(angle)
            outline.append(
                (D.shaft_x + radius * math.cos(theta), radius * math.sin(theta))
            )
    return outline


def cam_ring() -> cq.Workplane:
    ring = (
        cq.Workplane("XY")
        .polyline(cam_outline())
        .close()
        .extrude(5)
        .translate((0, 0, 25))
    )
    return ring.cut(cylinder(D.shaft_x, 0, 21.2, 24, 7))


def feed_rotor() -> cq.Workplane:
    rotor = cylinder(D.shaft_x, 0, 22, 25, 6)
    rotor = rotor.union(cylinder(D.shaft_x, 0, 4.5, 31, 4))
    for degrees in (0, 120, 240):
        theta = math.radians(degrees)
        x = D.shaft_x + D.pocket_radius * math.cos(theta)
        y = D.pocket_radius * math.sin(theta)
        rotor = rotor.cut(cylinder(x, y, 6.1, 24, 8))
    radius = (D.shaft_diameter + D.shaft_clearance) / 2
    flat_y = D.shaft_flat + D.shaft_clearance - radius
    bore = cylinder(D.shaft_x, 0, radius, 24, 12)
    clip = block((10, 10, 14), (D.shaft_x, flat_y - 5, 30))
    return rotor.cut(bore.intersect(clip))


def rotor_cam() -> cq.Workplane:
    return feed_rotor().union(cam_ring())


def feed_plate() -> cq.Workplane:
    plate = cylinder(D.shaft_x, 0, 20, 22.5, 1)
    opening = (
        cq.Workplane("XY")
        .center(D.shaft_x + D.pocket_radius, 0)
        .ellipse(6.2, 10)
        .extrude(2)
        .translate((0, 0, 22))
    )
    plate = plate.cut(opening)
    plate = plate.union(block((2, 13, 5), (113.5, 0, 21)))
    for x, y in ((95, -18), (95, 18), (107, -14), (107, 14)):
        plate = plate.union(cylinder(x, y, 1.55, 20.5, 2))
    return plate


def chassis() -> cq.Workplane:
    body = block((D.base_length, D.base_width, 6), (85, 0, 3)).edges("|Z").fillet(2)
    body = body.union(block((75, 16.4, 1), (132.5, 0, 6.5)))
    # The rear guide and bore share one Z=7 sliding plane.
    body = body.union(block((49, 13 + 2 * D.guide_wall, 1), (70.5, 0, 6.5)))
    for side in (-1, 1):
        wall_y = side * (6.5 + D.guide_wall / 2)
        body = body.union(block((75, D.guide_wall, 13.5), (132.5, wall_y, 12.75)))
        body = body.union(block((70, D.guide_wall, 11), (60, wall_y, 11.5)))
        # Low corner stops retain the unloaded slider without blocking the spring.
        rear_stop_x = D.striker_cocked_x - 18 - 1.5
        body = body.union(block((3, 2, 3), (rear_stop_x, side * 5.5, 7.5)))
    body = body.union(block((51, 13 + 2 * D.guide_wall, 2), (144.5, 0, 19.5)))
    body = body.union(block((3, 12, 14), (44.5, 0, 13)))
    for x, y in ((95, -18), (95, 18), (107, -14), (107, 14)):
        post = cylinder(x, y, 2.8, 6, 16.5)
        body = body.union(post).cut(cylinder(x, y, 1.65, 20.2, 2.4))
    for x in (58, 162):
        for y in (-36, 36):
            body = body.union(cylinder(x, y, 3.5, 6, 30.5))
            body = body.cut(cylinder(x, y, 1.65, 33.5, 3.1))
    for y in (-24, 24):
        body = body.union(block((4, 4, 13), (112, y, 12.5)))
        body = body.union(block((4, 6, 2), (112, y, 20)))
        # Hook front reaches this plane at the specified end of the stroke.
        stop_x = 75 + D.band_arm_width / 2 + D.striker_rest_x - D.striker_cocked_x
        body = body.union(block((3, 4, 16), (stop_x + 1.5, y, 14)))
    return body


def striker_components() -> list[cq.Workplane]:
    """Convex pieces shared by the fused print and compound collision body."""
    components = [
        block(
            (36, D.striker_width, D.striker_height),
            (D.striker_cocked_x, 0, D.striker_floor_z + D.striker_height / 2),
        ),
        cylinder(
            60 - D.follower_diameter / 2,
            0,
            D.follower_diameter / 2,
            D.follower_bottom,
            D.follower_top - D.follower_bottom,
        ),
        # A broad L-shaped heel supports the post while leaving the spring space clear.
        block(
            (7, D.follower_diameter, 22 - D.striker_floor_z),
            (62.5, 0, (22 + D.striker_floor_z) / 2),
        ),
        block((14, D.follower_diameter, 4), (59, 0, 20)),
        cq.Workplane("XZ")
        .polyline([(60, 16), (68, 16), (60, 22)])
        .close()
        .extrude(D.follower_diameter / 2, both=True),
        cq.Workplane("YZ").circle(5.4).extrude(3).translate((59, 0, D.ball_z)),
    ]
    for side in (-1, 1):
        components.extend(
            [
                block((D.band_arm_width, 6, 8), (75, side * 3, 17)),
                block(
                    (D.band_arm_width, 23, D.band_arm_thickness), (75, side * 12.5, 20)
                ),
                block((D.band_arm_width, 4, 6), (75, side * 23, 21)),
            ]
        )
    return components


def striker() -> cq.Workplane:
    components = striker_components()
    result = components[0]
    for component in components[1:]:
        result = result.union(component)
    return result


def striker_mass_kg() -> float:
    solid = striker().val()
    assert isinstance(solid, cq.Shape)
    return solid.Volume() * 1e-9 * D.printed_density_kg_m3


def motor_bridge() -> cq.Workplane:
    result = block((110, 74, 3), (110, 0, 38))
    result = result.cut(cylinder(D.shaft_x, 0, 6, 36, 5))
    for x in (58, 162):
        for y in (-36, 36):
            result = result.union(cylinder(x, y, 1.55, 33.5, 3))
    for x in (108, 156):
        for y in (-12.8, 12.8):
            result = result.cut(block((3.5, 3.5, 2.1), (x, y, 38.5)))
    # The three openings let balls be inserted after the bridge is attached.
    for degrees in (0, 120, 240):
        theta = math.radians(degrees)
        x = D.shaft_x + D.pocket_radius * math.cos(theta)
        y = D.pocket_radius * math.sin(theta)
        result = result.cut(cylinder(x, y, 6.4, 36, 5))
    return result


def motor_clip() -> cq.Workplane:
    # Nominal 23 mm wide TT housing; flexible side walls grip its body.
    result = block((56, 2.4, 18), (132, -12.8, 48.5))
    result = result.union(block((56, 2.4, 18), (132, 12.8, 48.5)))
    result = result.union(block((56, 28, 2.4), (132, 0, 58.7)))
    for x in (108, 156):
        for y in (-12.8, 12.8):
            result = result.union(block((3.35, 3.35, 2), (x, y, 38.5)))
    return result


def shaft_fit() -> cq.Workplane:
    result = block((32, 12, 5), (16, 6, 2.5))
    for x, clearance in ((6, 0.1), (16, 0.2), (26, 0.3)):
        radius = (D.shaft_diameter + clearance) / 2
        flat_y = D.shaft_flat + clearance - radius
        bore = cylinder(x, 6, radius, -1, 7)
        clip = block((10, 10, 8), (x, flat_y + 1, 2.5))
        result = result.cut(bore.intersect(clip))
    return result


def parts() -> dict[str, cq.Workplane]:
    return {
        "chassis": chassis(),
        "feed_plate": feed_plate(),
        "rotor_cam": rotor_cam(),
        "striker": striker(),
        "motor_bridge": motor_bridge(),
        "motor_clip": motor_clip(),
        "ball": cq.Workplane("XY").sphere(D.ball_radius),
        "shaft_fit": shaft_fit(),
    }
