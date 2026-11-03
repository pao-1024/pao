"""Animate the measured Bullet trace as top and side cutaway views."""

import csv
import math

import cadquery as cq
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from design import OUTPUT, D
from matplotlib.animation import FFMpegWriter, FuncAnimation
from matplotlib.patches import Circle, Ellipse, Polygon, Rectangle
from rotary_parts import cam_outline, striker_components
from scipy.spatial import ConvexHull

COLORS = ("#dc2626", "#2563eb", "#16a34a")
BACKGROUND = "#f8fafc"
Projection = list[list[tuple[float, float]]]


def trace_frames() -> list[dict[str, float]]:
    with (OUTPUT / "trace.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    return [{key: float(value) for key, value in row.items()} for row in rows[::2]]


def striker_projections() -> tuple[Projection, Projection]:
    """Project each convex CAD component once, before replaying the trace."""
    top: Projection = []
    side: Projection = []
    for component in striker_components():
        solid = component.val()
        assert isinstance(solid, cq.Shape)
        vertices, _ = solid.tessellate(0.1)
        for axis, outlines in ((1, top), (2, side)):
            points = [(point.x, point.toTuple()[axis]) for point in vertices]
            hull = ConvexHull(points)
            outlines.append([points[index] for index in hull.vertices])
    return top, side


def draw_striker(ax: plt.Axes, x: float, outlines: Projection) -> None:
    offset = x - D.striker_cocked_x
    for outline in outlines:
        points = [(px + offset, py) for px, py in outline]
        ax.add_patch(
            Polygon(points, closed=True, facecolor="#ea580c", edgecolor="none")
        )


def draw_top(ax: plt.Axes, frame: dict[str, float], striker: Projection) -> None:
    ax.clear()
    ax.set_facecolor("white")
    ax.add_patch(Rectangle((0, -40), 170, 80, color="#edf2f7"))
    ax.add_patch(Circle((D.shaft_x, 0), 20, color="#60a5fa", alpha=0.16))
    ax.add_patch(
        Ellipse(
            (D.shaft_x + D.pocket_radius, 0),
            12.4,
            20,
            fill=False,
            edgecolor="#2563eb",
            linestyle="--",
            linewidth=1.5,
        )
    )
    angle = math.radians(frame["rotor_angle_deg"])
    outline = []
    for px, py in cam_outline():
        dx = px - D.shaft_x
        outline.append(
            (
                D.shaft_x + dx * math.cos(angle) - py * math.sin(angle),
                dx * math.sin(angle) + py * math.cos(angle),
            )
        )
    ax.add_patch(Polygon(outline, closed=True, color="#eab308", alpha=0.27))
    ax.add_patch(Circle((D.shaft_x, 0), 22, color="#eab308", alpha=0.6))
    for degrees in (0, 120, 240):
        theta = math.radians(degrees) + angle
        cx = D.shaft_x + D.pocket_radius * math.cos(theta)
        cy = D.pocket_radius * math.sin(theta)
        ax.add_patch(Circle((cx, cy), 6.1, color="white", alpha=0.8))
        ax.add_patch(
            Circle((cx, cy), 6.1, fill=False, edgecolor="#a16207", linewidth=1)
        )
    x = frame["striker_x_mm"]
    draw_striker(ax, x, striker)
    ax.add_patch(Circle((D.shaft_x, 0), 2.7, color="#334155"))
    for y in (-6.5, 6.5):
        ax.plot((95, 170), (y, y), color="#475569", linewidth=2)
    ax.plot((170, 170), (-9, 9), color="#0f172a", linewidth=2)
    for index, color in enumerate(COLORS, start=1):
        bx = frame[f"ball{index}_x_mm"]
        by = frame[f"ball{index}_y_mm"]
        if bx < 195:
            ax.add_patch(
                Circle((bx, by), D.ball_radius, color=color, ec="white", linewidth=1)
            )
            ax.text(
                bx,
                by,
                str(index),
                color="white",
                ha="center",
                va="center",
                fontsize=9,
                weight="bold",
            )
    ax.set_xlim(35, 190)
    ax.set_ylim(-42, 42)
    ax.set_aspect("equal")
    ax.set_ylabel("Y (mm)")
    ax.set_title("Top view · rotor and three pockets", loc="left", fontsize=12)
    ax.grid(alpha=0.12)


def draw_spring(ax: plt.Axes, striker_x: float) -> None:
    start = 46.0
    end = striker_x - 19.0
    points_x = (
        [start] + [start + (end - start) * index / 18 for index in range(1, 18)] + [end]
    )
    points_z = (
        [D.ball_z]
        + [D.ball_z + (2.8 if index % 2 else -2.8) for index in range(1, 18)]
        + [D.ball_z]
    )
    ax.plot(points_x, points_z, color="#7c3aed", linewidth=2)


def draw_side(ax: plt.Axes, frame: dict[str, float], striker: Projection) -> None:
    ax.clear()
    ax.set_facecolor("white")
    ax.add_patch(Rectangle((0, 0), 170, 6, color="#cbd5e1"))
    ax.add_patch(Rectangle((46, 6), 49, 1, color="#64748b"))
    ax.add_patch(Rectangle((95, 6), 75, 1, color="#64748b"))
    ax.add_patch(Rectangle((95, 7), 75, 12, color="#94a3b8", alpha=0.09))
    ax.add_patch(Rectangle((119, 18.5), 51, 2, color="#64748b", alpha=0.3))
    ax.add_patch(Rectangle((75, 22.5), 25, 1, color="#3b82f6", alpha=0.65))
    ax.add_patch(Rectangle((114, 22.5), 1, 1, color="#3b82f6", alpha=0.65))
    ax.add_patch(Rectangle((112.5, 18.5), 2, 5, color="#3b82f6", alpha=0.5))
    ax.add_patch(Rectangle((73, 25), 44, 6, color="#eab308", alpha=0.21))
    ax.add_patch(Rectangle((43, 6), 3, 14, color="#475569"))
    x = frame["striker_x_mm"]
    draw_spring(ax, x)
    draw_striker(ax, x, striker)
    for index, color in enumerate(COLORS, start=1):
        bx = frame[f"ball{index}_x_mm"]
        bz = frame[f"ball{index}_z_mm"]
        if bx < 195 and bz > -7:
            ax.add_patch(
                Circle((bx, bz), D.ball_radius, color=color, ec="white", linewidth=1)
            )
            ax.text(
                bx,
                bz,
                str(index),
                color="white",
                ha="center",
                va="center",
                fontsize=9,
                weight="bold",
            )
    ax.plot((170, 170), (6, 20.5), color="#0f172a", linewidth=2)
    ax.set_xlim(35, 190)
    ax.set_ylim(0, 40)
    ax.set_aspect("equal")
    ax.set_xlabel("X (mm) · muzzle at 170 mm")
    ax.set_ylabel("Z (mm)")
    ax.set_title(
        "Side cutaway · spring, striker and ball drop", loc="left", fontsize=12
    )
    ax.text(
        0.99,
        0.96,
        f"t = {frame['time_s']:.2f} s    E = {frame['spring_energy_j'] * 1000:.1f} mJ",
        transform=ax.transAxes,
        ha="right",
        va="top",
        fontsize=10,
    )
    ax.grid(alpha=0.12)


def main() -> None:
    frames = trace_frames()
    top_striker, side_striker = striker_projections()
    fig, (top, side) = plt.subplots(
        2, 1, figsize=(9, 7), dpi=120, gridspec_kw={"height_ratios": [2, 1]}
    )
    fig.patch.set_facecolor(BACKGROUND)
    fig.subplots_adjust(hspace=0.36, left=0.09, right=0.98, top=0.95, bottom=0.09)

    def update(index: int) -> None:
        draw_top(top, frames[index], top_striker)
        draw_side(side, frames[index], side_striker)

    animation = FuncAnimation(fig, update, frames=len(frames), interval=1000 / 24)
    output = OUTPUT / "launcher_motion.mp4"
    animation.save(
        output,
        writer=FFMpegWriter(
            fps=24, codec="libx264", bitrate=1800, extra_args=["-pix_fmt", "yuv420p"]
        ),
    )
    plt.close(fig)
    print(f"Motion preview: {output}")


if __name__ == "__main__":
    main()
