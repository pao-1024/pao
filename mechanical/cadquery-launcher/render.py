"""Render a CAD overview and a trace figure for design review."""

import csv

import cadquery as cq
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from build import parts as display_parts
from design import OUTPUT
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from print_parts import parts as printable_parts


def model_preview() -> None:
    fig = plt.figure(figsize=(12, 7), dpi=160, facecolor="#f8fafc")
    ax = fig.add_subplot(111, projection="3d")
    colors = {
        "chassis": ("#31676a", 0.25),
        "cover": ("#467f84", 0.35),
        "magazine": ("#4e84ad", 0.45),
        "gate": ("#eab308", 0.9),
        "striker": ("#ea580c", 1.0),
        "cam": ("#f59e0b", 0.95),
        "spring": ("#64748b", 1.0),
        "ball": ("#dc2626", 0.95),
    }
    geometry = printable_parts()
    geometry["ball"] = geometry["ball"].translate((110, 0, 12.5))
    geometry["spring"] = display_parts()["spring"]
    for name, shape in geometry.items():
        if name == "shaft_fit":
            continue
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
    ax.set_zlim(0, 60)
    ax.set_box_aspect((175, 86, 60), zoom=1.08)
    ax.set_position((0.02, 0.02, 0.96, 0.85))
    ax.view_init(elev=32, azim=-65)
    ax.set_axis_off()
    fig.text(
        0.05,
        0.93,
        "PAO spring launcher | CadQuery assembly",
        fontsize=16,
        color="#0f172a",
    )
    fig.text(
        0.05,
        0.89,
        "170 mm base  •  11 mm balls  •  three-shot magazine",
        fontsize=10,
        color="#475569",
    )
    fig.savefig(
        OUTPUT / "launcher_preview.png",
        bbox_inches="tight",
        facecolor=fig.get_facecolor(),
    )
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
    for release in (0.15, 0.65, 1.15):
        position_ax.axvline(release, color="#cbd5e1", linestyle=":")
    position_ax.set_ylabel("Ball X (mm)")
    position_ax.set_ylim(95, None)
    position_ax.legend(loc="upper left", ncol=4)
    energy_ax.plot(
        time, [float(row["spring_energy_j"]) for row in rows], color="#7c3aed"
    )
    energy_ax.set_ylabel("Spring energy (J)")
    energy_ax.set_xlabel("Time (s)")
    for ax in (position_ax, energy_ax):
        ax.grid(alpha=0.2)
    fig.suptitle("Rigid-body simulation: three ball exits across three cam cycles")
    fig.tight_layout()
    fig.savefig(OUTPUT / "trajectory.png", bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    model_preview()
    trajectory_preview()
    print(f"Previews: {OUTPUT / 'launcher_preview.png'}, {OUTPUT / 'trajectory.png'}")
