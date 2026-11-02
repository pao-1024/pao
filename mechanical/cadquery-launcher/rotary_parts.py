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
    phase = degrees % 120
    if phase < 10:
        return 25
    if phase < 60:
        return 25 + 10 * (phase - 10) / 50
    if phase < 94:
        return 35
    if phase < 95:
        return 35 - 10 * (phase - 94)
    return 25


def cam_ring() -> cq.Workplane:
    outline = []
    for degrees in range(360):
        radius = cam_radius(degrees)
        theta = math.radians(degrees)
        outline.append((D.shaft_x + radius * math.cos(theta), radius * math.sin(theta)))
    ring = cq.Workplane("XY").polyline(outline).close().extrude(5).translate((0, 0, 25))
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
    for side in (-1, 1):
        body = body.union(block((75, 2.4, 13), (132.5, side * 7.7, 13)))
        body = body.union(block((70, 2.4, 9), (60, side * 7.7, 12.5)))
    body = body.union(block((51, 17.8, 2), (144.5, 0, 19.5)))
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
        body = body.union(block((3, 4, 16), (89, y, 14)))
    return body


def striker() -> cq.Workplane:
    result = block((36, 7, 5), (D.striker_cocked_x, 0, D.ball_z))
    result = result.union(block((2, 2, 15), (59, 0, 22)))
    # A shallow rear collar centers a roughly 10 mm OD compression spring.
    collar = cq.Workplane("YZ").circle(5.4).extrude(2).translate((59, 0, D.ball_z))
    result = result.union(collar)
    # Two printed ears also accept a rubber band, which pulls toward the muzzle.
    for side in (-1, 1):
        result = result.union(block((4, 4, 4), (75, side * 2, 16)))
        result = result.union(block((4, 23, 2), (75, side * 12.5, 18.5)))
        result = result.union(block((4, 2, 4), (75, side * 24, 20.5)))
    return result


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
