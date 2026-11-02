"""Build and simulate the three-ball spring launcher in Blender."""

import argparse
import csv
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent
MM = 0.001
FPS = 120
PHYSICS_HZ = 960
DURATION_S = 1.7
FRAME_END = round(DURATION_S * FPS)

BALL_RADIUS_MM = 5.5
BALL_MASS_KG = 0.0009
BALL_X_MM = 110.0
BALL_Z_MM = 12.5
BALL_SPACING_MM = 12.0
GATE_Z_MM = 18.5
GATE_OPEN_MM = 20.0

STRIKER_REST_X_MM = 90.0
STRIKER_COCKED_X_MM = 64.0
STRIKER_MASS_KG = 0.035
SPRING_DAMPING = 0.55


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--spring-stiffness", type=float, default=130.0)
    parser.add_argument("--output-stem", default="launcher")
    parser.add_argument("--no-save", action="store_true")
    parser.add_argument("--render", action="store_true")
    return parser.parse_args(argv)


def material(name, color, alpha=1.0, metallic=0.0, roughness=0.55):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    value.diffuse_color = (*color, alpha)
    value.surface_render_method = "BLENDED"
    shader = value.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Alpha"].default_value = alpha
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return value


def add_box(
    name,
    location,
    dimensions,
    material_value=None,
    rigid_type=None,
    kinematic=False,
    friction=0.3,
    collision_margin=0.00005,
):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material_value:
        obj.data.materials.append(material_value)
    if rigid_type:
        bpy.ops.rigidbody.object_add(type=rigid_type)
        body = obj.rigid_body
        body.collision_shape = "BOX"
        body.use_margin = True
        body.collision_margin = collision_margin
        body.friction = friction
        body.restitution = 0.0
        body.use_deactivation = False
        if kinematic:
            body.kinematic = True
    return obj


def add_cylinder(
    name,
    location,
    radius,
    depth,
    material_value,
    rotation=(0, 0, 0),
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=64,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material_value)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def add_ball(name, location, material_value):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=48,
        ring_count=24,
        radius=BALL_RADIUS_MM * MM,
        location=location,
    )
    ball = bpy.context.object
    ball.name = name
    ball.data.materials.append(material_value)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.rigidbody.object_add(type="ACTIVE")
    body = ball.rigid_body
    body.mass = BALL_MASS_KG
    body.collision_shape = "SPHERE"
    body.use_margin = True
    body.collision_margin = 0.00005
    body.friction = 0.3
    body.restitution = 0.0
    body.use_deactivation = False
    body.linear_damping = 0.01
    body.angular_damping = 0.08
    return ball


def join_boxes(name, parts, material_values):
    objects = []
    for (location, dimensions), material_value in zip(parts, material_values):
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
        obj = bpy.context.object
        obj.dimensions = dimensions
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(material_value)
        objects.append(obj)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name
    return objects[0]


def add_spring_visual(material_value):
    length = 45 * MM
    curve = bpy.data.curves.new("SpringWire", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.00035
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    count = 320
    spline.points.add(count - 1)
    for index in range(count):
        t = index / (count - 1)
        angle = math.tau * 11 * t
        spline.points[index].co = (
            t * length,
            4 * MM * math.cos(angle),
            4 * MM * math.sin(angle),
            1,
        )
    spring = bpy.data.objects.new("CompressionSpring", curve)
    bpy.context.scene.collection.objects.link(spring)
    spring.location = (20 * MM, 0, BALL_Z_MM * MM)
    spring.data.materials.append(material_value)
    return spring


def add_driver(target, path, expression, source):
    driver = target.driver_add(path, 0).driver
    driver.type = "SCRIPTED"
    variable = driver.variables.new()
    variable.name = "striker_x"
    variable.type = "TRANSFORMS"
    variable.targets[0].id = source
    variable.targets[0].transform_type = "LOC_X"
    variable.targets[0].transform_space = "WORLD_SPACE"
    driver.expression = expression


def add_text(name, body, location, size, material_value, rotation=(math.pi / 2, 0, 0)):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = 0.00005
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    obj.data.materials.append(material_value)
    return obj


def add_camera_and_lights():
    bpy.ops.object.camera_add(location=(0.255, 0.245, 0.165))
    camera = bpy.context.object
    camera.name = "Camera"
    camera.data.lens = 48
    target = (0.090, 0.0, 0.030)
    direction = (
        target[0] - camera.location.x,
        target[1] - camera.location.y,
        target[2] - camera.location.z,
    )
    camera.rotation_euler = (
        math.atan2(math.hypot(direction[0], direction[1]), -direction[2]),
        0,
        math.atan2(direction[1], direction[0]) - math.pi / 2,
    )
    bpy.context.scene.camera = camera

    for name, location, energy, size in (
        ("KeyLight", (0.09, 0.16, 0.35), 8, 0.22),
        ("FillLight", (-0.06, -0.07, 0.24), 4, 0.18),
        ("RimLight", (0.28, -0.08, 0.26), 6, 0.16),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = -1.0
    scene.world = bpy.data.worlds.new("Studio")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (0.045, 0.055, 0.07, 1.0)
    background.inputs["Strength"].default_value = 0.08


def build_scene(spring_stiffness):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"

    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = FRAME_END
    scene.gravity = (0, 0, -9.81)
    bpy.ops.rigidbody.world_add()
    world = scene.rigidbody_world
    world.substeps_per_frame = PHYSICS_HZ // FPS
    world.solver_iterations = 120
    world.point_cache.frame_start = 1
    world.point_cache.frame_end = FRAME_END

    base_mat = material("Base", (0.025, 0.25, 0.23), roughness=0.7)
    frame_mat = material("Frame", (0.045, 0.15, 0.24), roughness=0.55)
    orange = material("Striker", (0.92, 0.20, 0.035), roughness=0.45)
    gold = material("Cam", (0.95, 0.58, 0.055), metallic=0.1, roughness=0.38)
    clear = material("Magazine", (0.28, 0.68, 0.84), alpha=0.18, roughness=0.2)
    clear_barrel = material("Barrel", (0.42, 0.78, 0.86), alpha=0.20, roughness=0.22)
    white = material("Gate", (0.92, 0.94, 0.90), roughness=0.42)
    ball_color = material("Ball", (0.95, 0.16, 0.055), roughness=0.55)
    stored_color = material("Stored", (0.95, 0.57, 0.055), roughness=0.55)
    steel = material("Steel", (0.58, 0.63, 0.67), metallic=0.9, roughness=0.24)
    spring_color = material("Spring", (0.30, 0.62, 0.12), roughness=0.35)
    motor_color = material("Motor", (0.86, 0.55, 0.035), roughness=0.45)
    black = material("MotorCap", (0.025, 0.03, 0.035), metallic=0.25, roughness=0.45)
    label_color = material("Label", (0.75, 0.82, 0.83), roughness=0.5)

    for name, location, dimensions, material_value in (
        ("Base", (85 * MM, 0, 3 * MM), (170 * MM, 80 * MM, 6 * MM), base_mat),
        ("BarrelFloor", (135 * MM, 0, 5 * MM), (70 * MM, 16.4 * MM, 4 * MM), frame_mat),
        ("BarrelRoof", (144.5 * MM, 0, 19.5 * MM), (51 * MM, 17.8 * MM, 2 * MM), clear_barrel),
    ):
        add_box(name, location, dimensions, material_value, rigid_type="PASSIVE")

    for side in (-1, 1):
        add_box(
            f"BarrelRail{side:+d}",
            (132.5 * MM, side * 7.7 * MM, 13 * MM),
            (75 * MM, 2.4 * MM, 13 * MM),
            clear_barrel,
            rigid_type="PASSIVE",
        )
        add_box(
            f"RearRail{side:+d}",
            (60 * MM, side * 7.7 * MM, 12.5 * MM),
            (80 * MM, 2.4 * MM, 9 * MM),
            frame_mat,
            rigid_type="PASSIVE",
        )
        add_box(
            f"MagazineY{side:+d}",
            (BALL_X_MM * MM, side * 7 * MM, 36.5 * MM),
            (16 * MM, 2 * MM, 37 * MM),
            clear,
            rigid_type="PASSIVE",
        )
        add_box(
            f"MagazineX{side:+d}",
            ((BALL_X_MM + side * 7) * MM, 0, 36.5 * MM),
            (2 * MM, 12 * MM, 37 * MM),
            clear,
            rigid_type="PASSIVE",
        )

    gate = add_box(
        "MeteringGate",
        (BALL_X_MM * MM, 0, GATE_Z_MM * MM),
        (12 * MM, 12 * MM, 0.6 * MM),
        white,
        rigid_type="PASSIVE",
        kinematic=True,
        friction=0.02,
        collision_margin=0.00002,
    )
    bpy.ops.ptcache.free_bake_all()

    balls = [
        add_ball("Ball1", (BALL_X_MM * MM, 0, BALL_Z_MM * MM), ball_color),
        add_ball(
            "Ball2",
            (BALL_X_MM * MM, 0, (BALL_Z_MM + BALL_SPACING_MM) * MM),
            stored_color,
        ),
        add_ball(
            "Ball3",
            (BALL_X_MM * MM, 0, (BALL_Z_MM + 2 * BALL_SPACING_MM) * MM),
            stored_color,
        ),
    ]

    striker = join_boxes(
        "Striker",
        (
            ((STRIKER_COCKED_X_MM * MM, 0, BALL_Z_MM * MM), (50 * MM, 7 * MM, 5 * MM)),
            (
                ((STRIKER_COCKED_X_MM + 20) * MM, 11 * MM, BALL_Z_MM * MM),
                (6 * MM, 4 * MM, 8 * MM),
            ),
            (
                ((STRIKER_COCKED_X_MM + 20) * MM, -11 * MM, BALL_Z_MM * MM),
                (6 * MM, 4 * MM, 8 * MM),
            ),
            (
                ((STRIKER_COCKED_X_MM - 22) * MM, 0, BALL_Z_MM * MM),
                (4 * MM, 12 * MM, 11 * MM),
            ),
        ),
        (orange, steel, steel, orange),
    )
    bpy.ops.rigidbody.object_add(type="ACTIVE")
    striker.rigid_body.mass = STRIKER_MASS_KG
    striker.rigid_body.collision_shape = "MESH"
    striker.rigid_body.mesh_source = "BASE"
    striker.rigid_body.use_margin = True
    striker.rigid_body.collision_margin = 0.00002
    striker.rigid_body.friction = 0.05
    striker.rigid_body.linear_damping = 0.0
    striker.rigid_body.angular_damping = 0.0
    striker.rigid_body.use_deactivation = False

    add_box(
        "FrontStop",
        (115 * MM, 11 * MM, BALL_Z_MM * MM),
        (4 * MM, 4 * MM, 12 * MM),
        steel,
        rigid_type="PASSIVE",
    )
    add_box(
        "RearSpringStop",
        (20 * MM, 0, BALL_Z_MM * MM),
        (3 * MM, 16 * MM, 17 * MM),
        frame_mat,
        rigid_type="PASSIVE",
    )

    pusher_x = {}
    for cycle in range(3):
        start = 1 + cycle * 60
        pusher_x.update(
            {
                start: 97 * MM,
                start + 3: 97 * MM,
                start + 6: 123 * MM,
                start + 24: 123 * MM,
                start + 39: 97 * MM,
                start + 59: 97 * MM,
            }
        )
    pusher = add_box(
        "CamSlider",
        (97 * MM, -11 * MM, BALL_Z_MM * MM),
        (20 * MM, 4 * MM, 8 * MM),
        gold,
        rigid_type="PASSIVE",
        kinematic=True,
        friction=0.01,
        collision_margin=0.00002,
    )
    for frame, x in pusher_x.items():
        pusher.location.x = x
        pusher.keyframe_insert(data_path="location", index=0, frame=frame)

    bpy.ops.mesh.primitive_cube_add(size=0.0005, location=(STRIKER_COCKED_X_MM * MM, 0, BALL_Z_MM * MM))
    spring_anchor = bpy.context.object
    spring_anchor.name = "SpringAnchor"
    bpy.ops.rigidbody.object_add(type="ACTIVE")
    spring_anchor.rigid_body.kinematic = True
    spring_anchor.rigid_body.use_deactivation = False

    bpy.ops.object.empty_add(location=(STRIKER_COCKED_X_MM * MM, 0, BALL_Z_MM * MM))
    spring_joint = bpy.context.object
    spring_joint.name = "ElasticActuator"
    bpy.ops.rigidbody.constraint_add(type="GENERIC_SPRING")
    spring = spring_joint.rigid_body_constraint
    spring.object1 = spring_anchor
    spring.object2 = striker
    spring.disable_collisions = True
    spring.use_spring_x = True
    spring.spring_stiffness_x = spring_stiffness
    spring.spring_damping_x = SPRING_DAMPING
    spring.use_limit_lin_y = True
    spring.limit_lin_y_lower = 0
    spring.limit_lin_y_upper = 0
    spring.use_limit_lin_z = True
    spring.limit_lin_z_lower = 0
    spring.limit_lin_z_upper = 0
    for axis in ("x", "y", "z"):
        setattr(spring, f"use_limit_ang_{axis}", True)
        setattr(spring, f"limit_ang_{axis}_lower", 0)
        setattr(spring, f"limit_ang_{axis}_upper", 0)

    for frame, x in (
        (1, STRIKER_COCKED_X_MM * MM),
        (5, STRIKER_REST_X_MM * MM),
        (FRAME_END, STRIKER_REST_X_MM * MM),
    ):
        spring_anchor.location.x = x
        spring_anchor.keyframe_insert(data_path="location", index=0, frame=frame)

    for cycle in range(3):
        start = 1 + cycle * 60
        for frame, y in (
            (start, 0),
            (start + 42, 0),
            (start + 48, GATE_OPEN_MM * MM),
            (start + 54, GATE_OPEN_MM * MM),
            (start + 59, 0),
        ):
            gate.location.y = y
            gate.keyframe_insert(data_path="location", index=1, frame=frame)

    spring_visual = add_spring_visual(spring_color)
    add_driver(
        spring_visual,
        "scale",
        "min(1.1, max(0.05, (striker_x - 0.045) / 0.045))",
        striker,
    )
    add_cylinder(
        "SpringGuide",
        (57.5 * MM, 0, BALL_Z_MM * MM),
        1.2 * MM,
        74 * MM,
        steel,
        (0, math.pi / 2, 0),
    )

    add_box(
        "GateGuide",
        (99 * MM, 0, 18.5 * MM),
        (2 * MM, 28 * MM, 1.4 * MM),
        frame_mat,
        rigid_type=None,
    )
    add_cylinder(
        "MotorShaft",
        (110 * MM, -25 * MM, BALL_Z_MM * MM),
        2.75 * MM,
        34 * MM,
        steel,
        (math.pi / 2, 0, 0),
    )
    add_box(
        "TTMotorBody",
        (110 * MM, -48 * MM, 14 * MM),
        (22.6 * MM, 44 * MM, 18 * MM),
        motor_color,
        rigid_type=None,
    )
    add_box(
        "MotorBracket",
        (110 * MM, -42 * MM, 6.5 * MM),
        (30 * MM, 18 * MM, 5 * MM),
        frame_mat,
        rigid_type=None,
    )
    add_cylinder(
        "CamInputWheel",
        (110 * MM, -12.5 * MM, BALL_Z_MM * MM),
        8 * MM,
        3 * MM,
        gold,
        (math.pi / 2, 0, 0),
    )

    label_rotation = (0, 0, math.pi)
    add_text(
        "SpringLabel",
        "SPRING",
        (34 * MM, 19 * MM, 6.1 * MM),
        4.5 * MM,
        label_color,
        label_rotation,
    )
    add_text(
        "StrikerLabel",
        "STRIKER",
        (75 * MM, 19 * MM, 6.1 * MM),
        4.5 * MM,
        label_color,
        label_rotation,
    )
    add_text(
        "GateLabel",
        "GATE",
        (127 * MM, 19 * MM, 6.1 * MM),
        4.5 * MM,
        label_color,
        label_rotation,
    )
    add_camera_and_lights()
    bpy.ops.ptcache.free_bake_all()
    bpy.ops.ptcache.bake_all(bake=True)
    return scene, striker, gate, balls


def trace_scene(scene, striker, gate, balls, spring_stiffness):
    rows = []
    for frame in range(1, FRAME_END + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        striker_x_mm = striker.matrix_world.translation.x / MM
        row = {
            "frame": frame,
            "time_s": round((frame - 1) / FPS, 5),
            "striker_x_mm": round(striker_x_mm, 4),
            "spring_energy_j": round(
                0.5 * spring_stiffness * ((STRIKER_REST_X_MM - striker_x_mm) * MM) ** 2,
                6,
            ),
            "gate_y_mm": round(gate.matrix_world.translation.y / MM, 4),
        }
        for index, ball in enumerate(balls, start=1):
            for axis, value in zip("xyz", ball.matrix_world.translation / MM):
                row[f"ball{index}_{axis}_mm"] = round(value, 4)
        rows.append(row)
    return rows


def write_trace(rows, path):
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main():
    args = parse_args()
    scene, striker, gate, balls = build_scene(args.spring_stiffness)
    rows = trace_scene(scene, striker, gate, balls, args.spring_stiffness)
    trace_name = "trace.csv" if args.output_stem == "launcher" else f"{args.output_stem}_trace.csv"
    trace_path = ROOT / trace_name
    write_trace(rows, trace_path)
    print("TRACE", trace_path)

    scene.frame_set(52)
    if args.render:
        scene.render.filepath = str(ROOT / "preview.png")
        bpy.ops.render.render(write_still=True)
        print("RENDER", scene.render.filepath)
    scene.frame_set(1)
    if not args.no_save:
        blend_path = ROOT / f"{args.output_stem}.blend"
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
        print("SAVED", blend_path)


if __name__ == "__main__":
    main()
