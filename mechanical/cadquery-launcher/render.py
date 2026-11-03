"""Render the assembled rotary launcher and measured Bullet trajectories."""

import csv
import json

import cadquery as cq
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from build import assembled_parts
from design import OUTPUT, D
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from rotary_parts import striker


def model_preview() -> None:
    fig = plt.figure(figsize=(12, 7), dpi=160, facecolor="#f8fafc")
    ax = fig.add_subplot(111, projection="3d")
    colors = {
        "chassis": ("#31676a", 0.38),
        "feed_plate": ("#4e84ad", 0.65),
        "rotor_cam": ("#eab308", 0.95),
        "striker": ("#ea580c", 1.0),
        "motor_bridge": ("#64748b", 0.18),
        "motor_clip": ("#64748b", 0.18),
    }
    for name, shape in assembled_parts().items():
        solid = shape.val()
        assert isinstance(solid, cq.Shape)
        points, faces = solid.tessellate(1.5)
        triangles = [[points[index].toTuple() for index in face] for face in faces]
        color, alpha = colors.get(name, ("#dc2626", 0.95))
        ax.add_collection3d(
            Poly3DCollection(triangles, facecolor=color, edgecolor="none", alpha=alpha)
        )
    ax.set_xlim(0, 175)
    ax.set_ylim(-43, 43)
    ax.set_zlim(0, 62)
    ax.set_box_aspect((175, 86, 62), zoom=0.85)
    ax.set_position((0.02, 0.02, 0.96, 0.85))
    ax.view_init(elev=33, azim=-62)
    ax.set_axis_off()
    fig.text(
        0.05,
        0.93,
        "PAO rotary spring launcher | CadQuery",
        fontsize=16,
        color="#0f172a",
    )
    fig.text(
        0.05,
        0.89,
        "One motor shaft  •  three printed balls  •  170 mm base",
        fontsize=10,
        color="#475569",
    )
    fig.savefig(
        OUTPUT / "launcher_preview.png",
        bbox_inches="tight",
        facecolor=fig.get_facecolor(),
    )
    plt.close(fig)


def striker_preview() -> None:
    solid = striker().val()
    assert isinstance(solid, cq.Shape)
    points, faces = solid.tessellate(0.1)
    triangles = [[points[index].toTuple() for index in face] for face in faces]
    bounds = solid.BoundingBox()
    fig = plt.figure(figsize=(9, 7), dpi=160, facecolor="#f8fafc")
    ax = fig.add_subplot(111, projection="3d")
    ax.add_collection3d(
        Poly3DCollection(triangles, facecolors="#ea580c", edgecolor="none", shade=True)
    )
    ax.set_xlim(bounds.xmin - 2, bounds.xmax + 2)
    ax.set_ylim(bounds.ymin - 2, bounds.ymax + 2)
    ax.set_zlim(bounds.zmin - 2, bounds.zmax + 2)
    ax.set_box_aspect((bounds.xlen + 4, bounds.ylen + 4, bounds.zlen + 4))
    ax.view_init(elev=28, azim=-125)
    ax.set_xlabel("X (mm)")
    ax.set_ylabel("Y (mm)")
    ax.set_zlabel("Z (mm)")
    fig.suptitle("Striker close-up | CadQuery solid", fontsize=16)
    fig.text(
        0.5,
        0.91,
        f"Slider {D.striker_width:g} × {D.striker_height:g} mm  •  "
        f"Follower Ø{D.follower_diameter:g} mm  •  flat base",
        ha="center",
        color="#475569",
    )
    fig.savefig(OUTPUT / "striker_preview.png", bbox_inches="tight")
    plt.close(fig)


def trajectory_preview() -> None:
    with (OUTPUT / "trace.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    time = [float(row["time_s"]) for row in rows]
    fig, (position_ax, energy_ax) = plt.subplots(
        2,
        1,
        figsize=(11, 6),
        dpi=160,
        sharex=True,
        gridspec_kw={"height_ratios": [2, 1]},
    )
    for index, color in enumerate(("#e85d04", "#2563eb", "#16a34a"), start=1):
        position_ax.plot(
            time,
            [float(row[f"ball{index}_x_mm"]) for row in rows],
            label=f"Ball {index}",
            color=color,
        )
    position_ax.axhline(170, color="#475569", linestyle="--", label="Muzzle")
    result = json.loads((OUTPUT / "result.json").read_text())
    for event in result["exits"]:
        position_ax.axvline(event["time_s"], color="#cbd5e1", linestyle=":")
    position_ax.set_ylabel("Ball X (mm)")
    position_ax.set_ylim(85, 350)
    position_ax.legend(loc="upper left", ncol=4)
    energy_ax.plot(
        time, [float(row["spring_energy_j"]) for row in rows], color="#7c3aed"
    )
    energy_ax.set_ylabel("Spring energy (J)")
    energy_ax.set_xlabel("Time (s)")
    for ax in (position_ax, energy_ax):
        ax.grid(alpha=0.2)
    fig.suptitle("Rigid-body contact: three ball exits with a rotating feed cam")
    fig.tight_layout()
    fig.savefig(OUTPUT / "trajectory.png", bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    model_preview()
    striker_preview()
    trajectory_preview()
    print(
        f"Previews: {OUTPUT / 'launcher_preview.png'}, "
        f"{OUTPUT / 'striker_preview.png'}, {OUTPUT / 'trajectory.png'}"
    )
