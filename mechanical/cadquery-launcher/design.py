"""Dimensions shared by the printable rotary launcher and Bullet scene (mm)."""

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "tmp" / "cadquery-launcher"


@dataclass(frozen=True)
class Dimensions:
    base_length: float = 170.0
    base_width: float = 80.0
    guide_wall: float = 3.2
    shaft_x: float = 95.0
    pocket_radius: float = 12.0
    ball_radius: float = 5.5
    ball_mass_kg: float = 0.0009
    ball_z: float = 12.5
    loaded_ball_z: float = 29.0
    muzzle_x: float = 170.0
    rotor_z: float = 28.0
    rotor_speed_deg_s: float = 240.0
    striker_cocked_x: float = 78.0
    striker_rest_x: float = 89.0
    striker_width: float = 12.0
    striker_height: float = 9.0
    striker_floor_z: float = 7.0
    follower_diameter: float = 8.0
    follower_bottom: float = 18.0
    follower_top: float = 35.0
    band_arm_width: float = 6.0
    band_arm_thickness: float = 4.0
    printed_density_kg_m3: float = 1270.0
    spring_stiffness: float = 100.0
    spring_preload_mm: float = 5.0
    spring_damping: float = 0.02
    shaft_diameter: float = 5.4
    shaft_flat: float = 4.3
    shaft_clearance: float = 0.2


D = Dimensions()
