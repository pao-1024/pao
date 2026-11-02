"""Shared millimetre dimensions for the CAD model and rigid-body scene."""

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "tmp" / "cadquery-launcher"


@dataclass(frozen=True)
class Dimensions:
    base_length: float = 170.0
    base_width: float = 80.0
    ball_radius: float = 5.5
    ball_mass_kg: float = 0.0009  # approximate solid PETG sphere
    floor_top: float = 7.0
    rail_inner_y: float = 6.5
    rail_thickness: float = 2.4
    ball_x: float = 110.0
    ball_z: float = 12.5
    muzzle_x: float = 170.0
    striker_length: float = 50.0
    striker_width: float = 7.0
    striker_height: float = 5.0
    striker_rest_x: float = 90.0
    striker_cocked_x: float = 64.0
    spring_stiffness: float = 130.0  # N/m; assumed, not a measured spring
    spring_damping: float = 0.55  # N·s/m
    striker_mass_kg: float = 0.035


D = Dimensions()
