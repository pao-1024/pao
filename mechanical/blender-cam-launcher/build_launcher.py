"""Blender-native launcher driven by one motorized cam and real Bullet bodies."""

import csv
import math
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parent
MM = 0.001
FPS = 120
FRAME_END = 240


def material(name, color, alpha=1.0, metallic=0.0, roughness=0.55):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    value.diffuse_color = (*color, alpha)
    value.surface_render_method = "DITHERED"
    shader = value.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Alpha"].default_value = alpha
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return value


def recalc(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def box(name, dimensions, location, material_value, bevel=0.0, passive=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material_value)
    if bevel:
        modifier = obj.modifiers.new("Bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    if passive:
        bpy.ops.rigidbody.object_add(type="PASSIVE")
        obj.rigid_body.collision_shape = "BOX"
        obj.rigid_body.use_margin = True
        obj.rigid_body.collision_margin = 0.00005
        obj.rigid_body.friction = 0.35
        obj.rigid_body.restitution = 0.0
    return obj


def ring(name, center_x, inner_radius, outer_radius, z0, z1, material_value, segments=64):
    vertices, faces = [], []
    for z in (z0, z1):
        for radius in (inner_radius, outer_radius):
            for index in range(segments):
                angle = math.tau * index / segments
                vertices.append(
                    (
                        center_x + radius * math.cos(angle),
                        radius * math.sin(angle),
                        z,
                    )
                )
    for index in range(segments):
        nxt = (index + 1) % segments
        b = 0
        t = 2 * segments
        faces.extend(
            [
                (b + index, t + index, t + nxt, b + nxt),
                (b + segments + index, b + segments + nxt, t + segments + nxt, t + segments + index),
                (t + index, t + segments + index, t + segments + nxt, t + nxt),
                (b + index, b + nxt, b + segments + nxt, b + segments + index),
            ]
        )
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    recalc(mesh)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material_value)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.rigidbody.object_add(type="PASSIVE")
    obj.rigid_body.collision_shape = "MESH"
    obj.rigid_body.mesh_source = "BASE"
    obj.rigid_body.use_margin = True
    obj.rigid_body.collision_margin = 0.00005
    obj.rigid_body.friction = 0.25
    obj.rigid_body.restitution = 0.0
    return obj


def ball(name, location, material_value):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=48,
        ring_count=24,
        radius=5.5 * MM,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material_value)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.rigidbody.object_add(type="ACTIVE")
    body = obj.rigid_body
    body.mass = 0.0005
    body.collision_shape = "SPHERE"
    body.use_margin = True
    body.collision_margin = 0.00005
    body.friction = 0.2
    body.restitution = 0.0
    body.use_deactivation = False
    body.linear_damping = 0.02
    body.angular_damping = 0.1
    return obj


def wedge(name, parent, angle0, angle1, radius_at):
    r0, r1 = 5 * MM, radius_at(angle0 + (angle1 - angle0) / 2)
    y0, y1 = -2.5 * MM, 2.5 * MM
    a0, a1 = math.radians(angle0), math.radians(angle1)
    vertices = []
    for y in (y0, y1):
        vertices.extend(
            [
                (r0 * math.cos(a0), y, r0 * math.sin(a0)),
                (r1 * math.cos(a0), y, r1 * math.sin(a0)),
                (r1 * math.cos(a1), y, r1 * math.sin(a1)),
                (r0 * math.cos(a1), y, r0 * math.sin(a1)),
            ]
        )
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    recalc(mesh)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.hide_render = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.rigidbody.object_add(type="ACTIVE")
    obj.rigid_body.mass = 0.00001
    obj.rigid_body.collision_shape = "CONVEX_HULL"
    obj.rigid_body.use_margin = True
    obj.rigid_body.collision_margin = 0.00005
    obj.rigid_body.friction = 0.0
    return obj


def cam_profile(angle):
    a = angle % 360
    if 180 <= a < 360:
        t = (a - 180) / 180
        return 10 + 14 * t * t * (3 - 2 * t)
    if a < 60:
        t = a / 60
        return 24 - 14 * t * t * (3 - 2 * t)
    return 10


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = FRAME_END
scene.gravity = (0, 0, -9.81)
bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
bpy.ops.rigidbody.world_add()
world = scene.rigidbody_world
world.substeps_per_frame = 60
world.solver_iterations = 100
world.point_cache.frame_end = FRAME_END

base_mat = material("Base", (0.03, 0.31, 0.28), roughness=0.65)
frame_mat = material("Frame", (0.05, 0.19, 0.30), roughness=0.55)
orange = material("Striker", (0.88, 0.18, 0.03), roughness=0.48)
gold = material("Feeder", (0.95, 0.55, 0.04), metallic=0.1, roughness=0.42)
clear = material("Clear", (0.28, 0.65, 0.82), alpha=0.16, roughness=0.2)
ball_color = material("Ball", (0.96, 0.12, 0.04), roughness=0.6)
stored_color = material("Stored", (0.96, 0.56, 0.06), roughness=0.6)
steel = material("Steel", (0.55, 0.6, 0.64), metallic=0.9, roughness=0.25)
spring_color = material("Spring", (0.28, 0.48, 0.1), roughness=0.42)
black = material("Motor", (0.03, 0.035, 0.04), metallic=0.4, roughness=0.4)
yellow = material("Gearbox", (0.85, 0.56, 0.04), roughness=0.45)

FEED_X = 108.0
FIRE_X = 120.0

box("Base", (170 * MM, 80 * MM, 6 * MM), (85 * MM, 0, 3 * MM), base_mat, bevel=0.003)
box("FeedFloor", (20 * MM, 14 * MM, 1 * MM), (110 * MM, 0, 18.5 * MM), frame_mat)
box("FeedFloor", (18 * MM, 14 * MM, 1 * MM), (FEED_X * MM, 0, 6.5 * MM), frame_mat)
for side in (-1, 1):
    box(
        f"Guide_{side:+d}",
        (83 * MM, 3 * MM, 8 * MM),
        (61.5 * MM, side * 7 * MM, 10 * MM),
        frame_mat,
        bevel=0.0007,
    )
    box(
        f"FrontRail_{side:+d}",
        (23.5 * MM, 2.4 * MM, 16.9 * MM),
        (97.75 * MM, side * 7.7 * MM, 14.45 * MM),
        frame_mat,
        bevel=0.0007,
    )
    box(
        f"Barrel_{side:+d}",
        (50.5 * MM, 2.4 * MM, 16.9 * MM),
        (134.75 * MM, side * 7.7 * MM, 14.45 * MM),
        clear,
        bevel=0.0007,
    )
box("BarrelRoof", (41 * MM, 17.8 * MM, 4.8 * MM), (139.5 * MM, 0, 22.9 * MM), clear, bevel=0.0007)

# Vertical magazine. The bottom opening feeds a horizontal indexing slot.

# Sliding feeder: one aperture captures one ball, then shifts it to the firing station.
feed_mesh = bpy.data.meshes.new("FeedSlideMesh")
verts = []
for y in (-6 * MM, 6 * MM):
    for z in (-1.5 * MM, 1.5 * MM):
        for x in (-18 * MM, 18 * MM):
            verts.append((x, y, z))
faces = [(0, 1, 3, 2), (6, 7, 5, 4), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)]
feed_mesh.from_pydata(verts, [], faces)
recalc(feed_mesh)
feed_slide = bpy.data.objects.new("FeedSlide", feed_mesh)
scene.collection.objects.link(feed_slide)
feed_slide.data.materials.append(gold)
feed_slide.location = (FEED_X * MM, 0, 19.5 * MM)
bpy.context.view_layer.objects.active = feed_slide
bpy.ops.rigidbody.object_add(type="ACTIVE")
feed_slide.rigid_body.kinematic = True
feed_slide.rigid_body.collision_shape = "BOX"
feed_slide.rigid_body.use_margin = True
feed_slide.rigid_body.collision_margin = 0.00005

# Carrier aperture in the moving floor.
bpy.ops.mesh.primitive_cylinder_add(
    vertices=64,
    radius=6.0 * MM,
    depth=4 * MM,
    location=(FEED_X * MM, 0, 19.5 * MM),
)
cut = bpy.context.object
boolean = feed_slide.modifiers.new("Ball aperture", "BOOLEAN")
boolean.operation = "DIFFERENCE"
boolean.solver = "EXACT"
boolean.object = cut
bpy.context.view_layer.objects.active = feed_slide
bpy.ops.object.select_all(action="DESELECT")
feed_slide.select_set(True)
bpy.ops.object.modifier_apply(modifier=boolean.name)
bpy.data.objects.remove(cut, do_unlink=True)

# Fixed receiving plate with a firing drop hole.
plate = box("ReceiverPlate", (30 * MM, 14 * MM, 1 * MM), (131 * MM, 0, 19 * MM), frame_mat)
bpy.ops.mesh.primitive_cylinder_add(
    vertices=64,
    radius=6.2 * MM,
    depth=3 * MM,
    location=(FIRE_X * MM, 0, 19 * MM),
)
cut = bpy.context.object
boolean = plate.modifiers.new("Drop hole", "BOOLEAN")
boolean.operation = "DIFFERENCE"
boolean.solver = "EXACT"
boolean.object = cut
bpy.context.view_layer.objects.active = plate
bpy.ops.object.select_all(action="DESELECT")
plate.select_set(True)
bpy.ops.object.modifier_apply(modifier=boolean.name)
bpy.data.objects.remove(cut, do_unlink=True)

for frame, x in (
    (1, FEED_X * MM),
    (20, FIRE_X * MM),
    (30, FIRE_X * MM),
    (35, FEED_X * MM),
    (47, FEED_X * MM),
):
    feed_slide.location.x = x
    feed_slide.keyframe_insert(data_path="location", index=0, frame=frame)

# Rotary cam is the only motorized input. Wedge colliders avoid convexifying the cam profile.
cam = bpy.data.objects.new("CamRotor", bpy.data.meshes.new("CamRotorMesh"))
scene.collection.objects.link(cam)
cam.location = (50 * MM, 0, 30 * MM)
cam.hide_render = True
bpy.context.view_layer.objects.active = cam
bpy.ops.rigidbody.object_add(type="PASSIVE")
cam.rigid_body.kinematic = True
cam.rigid_body.collision_shape = "COMPOUND"
cam.rotation_mode = "XYZ"
for index in range(36):
    wedge(
        f"CamWedge_{index:02d}",
        cam,
        index * 10,
        index * 10 + 10,
        lambda angle: cam_profile(angle) * MM,
    )
for frame in range(1, FRAME_END + 1):
    cam.rotation_euler.y = math.radians(180 + (frame - 1) * 7.5)
    cam.keyframe_insert(data_path="rotation_euler", index=1, frame=frame)

# Dynamic striker with a compound shape.
striker = bpy.data.objects.new("Striker", bpy.data.meshes.new("StrikerBody"))
scene.collection.objects.link(striker)
striker.location = (48 * MM, 0, 11.5 * MM)
bpy.context.view_layer.objects.active = striker
bpy.ops.rigidbody.object_add(type="ACTIVE")
striker.rigid_body.mass = 0.035
striker.rigid_body.collision_shape = "COMPOUND"
striker.rigid_body.use_deactivation = False
striker.rigid_body.kinematic = False

def compound_box(name, location, dimensions):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = striker
    obj.location = location
    obj.data.materials.append(orange)
    bpy.ops.rigidbody.object_add(type="ACTIVE")
    obj.rigid_body.mass = 0.00001
    obj.rigid_body.collision_shape = "BOX"
    obj.rigid_body.use_margin = True
    obj.rigid_body.collision_margin = 0.00005
    obj.rigid_body.friction = 0.25
    return obj

compound_box("StrikerBeam", (16 * MM, 0, 0), (96 * MM, 8 * MM, 5 * MM))
compound_box("StrikerHead", (61 * MM, 0, 0), (6 * MM, 8 * MM, 5 * MM))
compound_box("StrikerRoller", (-25 * MM, 0, 18.5 * MM), (6 * MM, 8 * MM, 6 * MM))

anchor = box("SpringAnchor", (0.5 * MM, 0.5 * MM, 0.5 * MM), (62 * MM, 0, 11.5 * MM), orange, passive=False)
anchor.hide_render = True
bpy.context.view_layer.objects.active = anchor
bpy.ops.rigidbody.object_add(type="PASSIVE")
anchor.rigid_body.kinematic = False

bpy.ops.object.select_all(action="DESELECT")
striker.select_set(True)
anchor.select_set(True)
bpy.context.view_layer.objects.active = anchor
bpy.ops.rigidbody.connect(
    con_type="GENERIC_SPRING",
    pivot_type="ACTIVE",
    connection_pattern="SELECTED_TO_ACTIVE",
)
constraint_obj = next(obj for obj in bpy.data.objects if obj.rigid_body_constraint)
constraint = constraint_obj.rigid_body_constraint
constraint.disable_collisions = True
constraint.use_override_solver_iterations = True
constraint.solver_iterations = 100
constraint.use_limit_lin_x = True
constraint.limit_lin_x_lower = -14 * MM
constraint.limit_lin_x_upper = 2 * MM
constraint.use_limit_lin_x = True
constraint.use_spring_x = True
constraint.spring_stiffness_x = 300
constraint.spring_damping_x = 1.2
constraint.use_limit_lin_y = True
constraint.limit_lin_y_lower = -0.00001
constraint.limit_lin_y_upper = 0.00001
constraint.use_limit_lin_z = True
constraint.limit_lin_z_lower = -0.00001
constraint.limit_lin_z_upper = 0.00001
constraint.use_limit_ang_x = True
constraint.limit_ang_x_lower = -0.001
constraint.limit_ang_x_upper = 0.001
constraint.use_limit_ang_y = True
constraint.limit_ang_y_lower = -0.001
constraint.limit_ang_y_upper = 0.001
constraint.use_limit_ang_z = True
constraint.limit_ang_z_lower = -0.001
constraint.limit_ang_z_upper = 0.001
constraint.use_spring_y = True
constraint.use_spring_z = True
constraint.spring_stiffness_y = 1000
constraint.spring_stiffness_z = 1000
constraint.spring_damping_y = 20
constraint.spring_damping_z = 20

balls = [
    ball("Ball_1", (FEED_X * MM, 0, 24.5 * MM), ball_color),
    ball("Ball_2", (FEED_X * MM, 0, 35.5 * MM), stored_color),
    ball("Ball_3", (FEED_X * MM, 0, 46.5 * MM), stored_color),
]

curve = bpy.data.curves.new("SpringCurve", "CURVE")
curve.dimensions = "3D"
curve.bevel_depth = 0.00035
curve.bevel_resolution = 2
spline = curve.splines.new("POLY")
count = 256
spline.points.add(count - 1)
for index in range(count):
    t = index / (count - 1)
    angle = math.tau * 9 * t
    spline.points[index].co = (t * 0.030, 4 * MM * math.cos(angle), 4 * MM * math.sin(angle), 1)
spring = bpy.data.objects.new("StrikerSpring", curve)
scene.collection.objects.link(spring)
spring.data.materials.append(spring_color)
spring.location = (10 * MM, 0, 11.5 * MM)
driver = spring.driver_add("scale", 0).driver
driver.type = "SCRIPTED"
var = driver.variables.new()
var.name = "p"
var.type = "TRANSFORMS"
var.targets[0].id = striker
var.targets[0].transform_type = "LOC_X"
var.targets[0].transform_space = "WORLD_SPACE"
driver.expression = "max(0.15, (p - 0.010) / 0.030)"

box("SpringStop", (6 * MM, 16 * MM, 20 * MM), (8 * MM, 0, 16 * MM), frame_mat, bevel=0.0007)
bpy.ops.mesh.primitive_cylinder_add(
    vertices=32,
    radius=2.5 * MM,
    depth=16 * MM,
    location=(8 * MM, 0, 11.5 * MM),
    rotation=(0, math.pi / 2, 0),
)
rod = bpy.context.object
rod.name = "SpringStopRod"
rod.data.materials.append(steel)

bpy.ops.mesh.primitive_cylinder_add(
    vertices=48,
    radius=2.75 * MM,
    depth=26 * MM,
    location=(50 * MM, 13 * MM, 30 * MM),
    rotation=(math.pi / 2, 0, 0),
)
shaft = bpy.context.object
shaft.name = "MotorShaft"
shaft.data.materials.append(steel)
bpy.ops.mesh.primitive_cube_add(size=1, location=(50 * MM, 45 * MM, 30 * MM))
motor = bpy.context.object
motor.name = "TTMotorBody"
motor.dimensions = (17.5 * MM, 64.4 * MM, 18 * MM)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
motor.data.materials.append(black)
modifier = motor.modifiers.new("Motor bevel", "BEVEL")
modifier.width = 1.2 * MM
modifier.segments = 4

bpy.ops.ptcache.free_bake_all()
bpy.ops.ptcache.bake_all(bake=True)
trace = ROOT / "trace.csv"
with trace.open("w", newline="") as handle:
    writer = csv.writer(handle)
    writer.writerow(
        [
            "frame",
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
        ]
    )
    for frame in range(1, FRAME_END + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        row = [
            frame,
            round(math.degrees(cam.matrix_world.to_euler().y) % 360, 2),
            round(striker.matrix_world.translation.x / MM, 3),
        ]
        for value in balls:
            row.extend(round(v, 3) for v in value.matrix_world.translation / MM)
        writer.writerow(row)

scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "launcher.blend"))
print("SAVED", ROOT / "launcher.blend")
print("TRACE", trace)
