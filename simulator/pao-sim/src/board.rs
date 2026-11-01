use esp_soc::board::{BoardEdge, BoardModel};
use crate::ssd1306::{Ssd1306, Ssd1306State};
use crate::trace::{Trace, TracedI2c};
use esp_soc::json::Json;
use std::sync::{Arc, Mutex};
use std::collections::VecDeque;

/// PAO voice board: SSD1306 on I2C0 SDA41/SCL42, status LED on GPIO48.
#[derive(Default)]
pub struct Pao {
    display: Arc<Mutex<Ssd1306State>>,
    led: [[u8; 3]; 1], updates: u64, edges: u64,
    pub trace: Arc<Mutex<Trace>>,
    trigger: Option<u64>,
    echo: bool,
    pending: VecDeque<BoardEdge>,
    ready: Vec<BoardEdge>,
}
impl BoardModel for Pao {
    fn name(&self) -> &'static str { "pao" }
    fn set_input(&mut self, input: &Json) -> Result<(), &'static str> {
        let distance = match input.get("distance_cm") {
            Some(Json::Null) => None,
            Some(Json::Int(value)) if (2..=400).contains(value) => Some(*value as f64),
            _ => return Err("invalid ultrasonic distance"),
        };
        self.trace.lock().unwrap().world.distance_override_cm = distance;
        Ok(())
    }
    fn gpio_changes(&mut self, changes: &[(u8, bool)]) {
        self.edges += changes.len() as u64;
        let mut trace = self.trace.lock().unwrap();
        for &(pin, high) in changes {
            trace.gpio(pin, high);
            if pin == 48 { self.led[0] = [if high { 255 } else { 0 }; 3]; self.updates += 1; }
        }
    }
    fn gpio_events(&self) -> u64 { self.edges }
    fn gpio_output_at(&mut self, cycle: u64, changes: &[(u8, bool)], enabled: u64, _output: u64) {
        self.trace.lock().unwrap().advance(cycle as f64 / 240_000_000.0);
        for &(pin, high) in changes {
            if pin != 8 || enabled & (1 << 8) == 0 { continue; }
            if high { self.trigger = Some(cycle); }
            else if let Some(start) = self.trigger.take() {
                if cycle.saturating_sub(start) < 2400 || !self.pending.is_empty() { continue; }
                let distance = self.trace.lock().unwrap().world.distance_cm();
                if !(2.0..=400.0).contains(&distance) { continue; }
                let begin = cycle + 200 * 240;
                let end = begin + (distance * 58.0).round() as u64 * 240;
                self.pending.extend([BoardEdge { cycle: begin, pin: 9, level: true }, BoardEdge { cycle: end, pin: 9, level: false }]);
            }
        }
        self.gpio_changes(changes);
    }
    fn input_levels(&self) -> Vec<(u8, bool)> { vec![(9, self.echo)] }
    fn next_deadline(&self) -> Option<u64> { self.pending.front().map(|edge| edge.cycle) }
    fn advance_to(&mut self, cycle: u64) {
        while self.pending.front().is_some_and(|edge| edge.cycle <= cycle) {
            let edge = self.pending.pop_front().unwrap();
            self.echo = edge.level;
            self.trace.lock().unwrap().gpio(edge.pin, edge.level);
            self.ready.push(edge);
        }
    }
    fn take_edges(&mut self) -> Vec<BoardEdge> { std::mem::take(&mut self.ready) }
    fn i2c_devices(&mut self) -> Vec<(u8, u8, Box<dyn esp_periph::i2c::I2cDevice>)> {
        vec![(0, 0x3c, Box::new(TracedI2c::new(Ssd1306::new(self.display.clone(), (41, 42)), 0x3c, self.trace.clone())))]
    }
    fn display(&self) -> Option<(u32, u32, Vec<u16>, u64)> {
        let state = self.display.lock().unwrap();
        // The module's visible origin is opposite the controller's SEG0/COM0 origin.
        Some((128, 64, state.pixels().into_iter().rev().collect(), state.version))
    }
    fn display_version(&self) -> u64 { self.display.lock().unwrap().version }
    fn display_frames(&self) -> u64 { self.display.lock().unwrap().frames }
    fn leds(&self) -> Option<(&[[u8; 3]], u64)> { Some((&self.led, self.updates)) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn trigger_generates_timed_echo_for_front_wall() {
        let mut board = Pao::default();
        board.gpio_output_at(100, &[(8, true)], 1 << 8, 1 << 8);
        board.gpio_output_at(2500, &[(8, false)], 1 << 8, 0);
        assert_eq!(board.next_deadline(), Some(2500 + 200 * 240));
        board.advance_to(2500 + 200 * 240);
        assert_eq!(board.take_edges(), vec![BoardEdge { cycle: 50500, pin: 9, level: true }]);
        let end = 50500 + 10991 * 240;
        board.advance_to(end);
        assert_eq!(board.take_edges(), vec![BoardEdge { cycle: end, pin: 9, level: false }]);
        assert_eq!(board.next_deadline(), None);
        board.gpio_output_at(end + 1, &[(8, true)], 1 << 8, 1 << 8);
        board.gpio_output_at(end + 2, &[(8, false)], 1 << 8, 0);
        assert_eq!(board.next_deadline(), None, "a short Trig pulse cannot produce an echo");
    }
    #[test]
    fn browser_distance_stimulus_changes_echo_and_can_restore_wall_distance() {
        let mut board = Pao::default();
        board.set_input(&esp_soc::json::parse_json(r#"{"distance_cm":10}"#).unwrap()).unwrap();
        assert_eq!(board.trace.lock().unwrap().world.distance_cm(), 10.0);
        board.gpio_output_at(100, &[(8, true)], 1 << 8, 1 << 8);
        board.gpio_output_at(2500, &[(8, false)], 1 << 8, 0);
        let begin = 2500 + 200 * 240;
        board.advance_to(begin + 10 * 58 * 240);
        assert_eq!(board.take_edges(), vec![
            BoardEdge { cycle: begin, pin: 9, level: true },
            BoardEdge { cycle: begin + 10 * 58 * 240, pin: 9, level: false },
        ]);
        assert!(board.set_input(&esp_soc::json::parse_json(r#"{"distance_cm":1}"#).unwrap()).is_err());
        assert_eq!(board.trace.lock().unwrap().world.distance_cm(), 10.0);
        board.set_input(&esp_soc::json::parse_json(r#"{"distance_cm":null}"#).unwrap()).unwrap();
        assert_eq!(board.trace.lock().unwrap().world.distance_cm(), 189.5);
    }
    #[test]
    fn oled_writes_reach_the_glass_and_gpio48_drives_the_status_led() {
        let mut board = Pao::default();
        let mut device = board.i2c_devices().remove(0).2;
        assert!(device.start(false));
        for byte in [0, 0xaf, 0xa1, 0xc8] { assert!(device.write(byte)); } device.stop();
        assert!(device.start(false));
        for byte in [0x40, 1] { assert!(device.write(byte)); } device.stop();
        let (_, _, pixels, _) = board.display().unwrap();
        assert_eq!(pixels[0], 0xffff);
        assert_eq!(pixels.iter().filter(|&&p| p != 0).count(), 1);
        assert_eq!(board.display_frames(), 1);
        board.gpio_changes(&[(48, true), (21, true)]);
        assert_eq!(board.leds().unwrap().0, &[[255; 3]]);
        board.gpio_changes(&[(48, false)]);
        assert_eq!(board.leds().unwrap().0, &[[0; 3]]);
    }
}
