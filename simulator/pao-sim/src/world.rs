//! Centimetres, seconds and radians. The same simulated pose drives the picture and the echo.
pub const WIDTH_CM: f64 = 600.0;
pub const DEPTH_CM: f64 = 400.0;
const BODY_RADIUS_CM: f64 = 12.0;
const SENSOR_FRONT_CM: f64 = 10.5;
const SPEED_CM_S: f64 = 30.0;
const TRACK_CM: f64 = 15.6;

#[derive(Default)]
pub struct World {
    pub x: f64, pub z: f64, pub heading: f64,
    pub distance_override_cm: Option<f64>,
    seconds: f64,
}
impl World {
    pub fn advance(&mut self, seconds: f64, left: f64, right: f64) {
        let mut remaining = (seconds - self.seconds).max(0.0);
        self.seconds = seconds;
        // Short steps prevent a large scheduler quantum from jumping across a wall on a turn.
        while remaining > 0.0 {
            let dt = remaining.min(0.01);
            let speed = (left + right) * 0.5 * SPEED_CM_S;
            let turn = (right - left) * SPEED_CM_S / TRACK_CM;
            let heading = self.heading + turn * dt * 0.5;
            self.x = (self.x + heading.sin() * speed * dt).clamp(-WIDTH_CM / 2.0 + BODY_RADIUS_CM, WIDTH_CM / 2.0 - BODY_RADIUS_CM);
            self.z = (self.z + heading.cos() * speed * dt).clamp(-DEPTH_CM / 2.0 + BODY_RADIUS_CM, DEPTH_CM / 2.0 - BODY_RADIUS_CM);
            self.heading += turn * dt;
            remaining -= dt;
        }
    }
    pub fn distance_cm(&self) -> f64 {
        if let Some(distance) = self.distance_override_cm { return distance; }
        let (dx, dz) = (self.heading.sin(), self.heading.cos());
        let (x, z) = (self.x + dx * SENSOR_FRONT_CM, self.z + dz * SENSOR_FRONT_CM);
        let hit = |origin: f64, direction: f64, half: f64| {
            if direction.abs() < 1e-12 { f64::INFINITY }
            else { (direction.signum() * half - origin) / direction }
        };
        hit(x, dx, WIDTH_CM / 2.0).min(hit(z, dz, DEPTH_CM / 2.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn walls_echo_and_wheel_motion_use_centimetres() {
        let mut world = World::default();
        assert!((world.distance_cm() - 189.5).abs() < 1e-9);
        world.advance(1.0, 0.5, 0.5);
        assert!((world.z - 15.0).abs() < 1e-9);
        assert!((world.distance_cm() - 174.5).abs() < 1e-9);
        world.heading = std::f64::consts::FRAC_PI_2;
        assert!((world.distance_cm() - 289.5).abs() < 1e-9);
        world.advance(100.0, 1.0, 1.0);
        assert!(world.x <= WIDTH_CM / 2.0 - BODY_RADIUS_CM);
        assert!((world.distance_cm() - 1.5).abs() < 1e-9);
        world.advance(101.0, -0.5, 0.5);
        assert!(world.heading > std::f64::consts::FRAC_PI_2);
        let mut arc = World::default();
        arc.advance(1.0, 0.5, 1.0);
        assert!(arc.x > 0.0 && arc.heading > 0.0, "a left arc drifts to +X");
        let mut reverse = World::default();
        reverse.advance(1.0, -1.0, -1.0);
        assert!((reverse.z + 30.0).abs() < 1e-9);
    }
}
