"""Export the rotary three-ball launcher as an editable STEP assembly."""

import math

import cadquery as cq
from design import OUTPUT, D
from rotary_parts import parts


def assembled_parts() -> dict[str, cq.Workplane]:
    geometry = {name: part for name, part in parts().items() if name != "shaft_fit"}
    for index, degrees in enumerate((0, 120, 240), start=1):
        theta = math.radians(degrees)
        x = D.shaft_x + D.pocket_radius * math.cos(theta)
        y = D.pocket_radius * math.sin(theta)
        z = D.ball_z if index == 1 else D.loaded_ball_z
        geometry[f"ball_{index}"] = geometry["ball"].translate((x, y, z))
    del geometry["ball"]
    return geometry


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assembly = cq.Assembly(name="pao_rotary_spring_launcher")
    colors = {
        "chassis": cq.Color("darkslategray"),
        "feed_plate": cq.Color("steelblue"),
        "rotor_cam": cq.Color("gold"),
        "striker": cq.Color("orangered"),
        "motor_bridge": cq.Color("lightslategray"),
        "motor_clip": cq.Color("slategray"),
    }
    for name, shape in assembled_parts().items():
        assembly.add(shape, name=name, color=colors.get(name, cq.Color("red")))
    assembly.export(str(OUTPUT / "launcher.step"))
    print(f"CadQuery assembly: {OUTPUT / 'launcher.step'}")


if __name__ == "__main__":
    main()
