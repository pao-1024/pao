//! A Studio board is wired from the same generated manifest as the guest firmware.
use crate::ssd1306::{Ssd1306, Ssd1306State};
use crate::trace::{Trace, TracedI2c};
use esp_periph::i2s::{PcmPins, PcmSource};
use esp_soc::{board::BoardModel, json::{parse_json, Json}, Soc, SocBus};
use std::sync::{Arc, Mutex};

pub struct Project {
    display: Arc<Mutex<Ssd1306State>>,
    oled: Option<(u8, u8, u8)>,
    reset: Arc<Mutex<bool>>,
    pub trace: Arc<Mutex<Trace>>,
}
fn pin(value: &Json, name: &str) -> Result<u8, String> {
    value.get(name).and_then(Json::as_i64).filter(|v| (0..49).contains(v)).map(|v| v as u8)
        .ok_or_else(|| format!("invalid board GPIO {name}"))
}
pub fn configure<S: Soc>(text: &str, machine: &mut esp_soc::Machine<S>) -> Result<Project, String> {
    let spec = parse_json(text)?;
    if spec.get("version").and_then(Json::as_i64) != Some(1) { return Err("unsupported Studio board version".into()); }
    let oled = match spec.get("oled") {
        Some(Json::Null) => None,
        Some(o) if o.get("width").and_then(Json::as_i64) == Some(128) && o.get("height").and_then(Json::as_i64) == Some(32) =>
            Some((pin(o, "sda")?, pin(o, "scl")?, pin(o, "reset")?)),
        _ => return Err("invalid Studio OLED".into()),
    };
    match spec.get("mic") {
        Some(Json::Null) => {},
        Some(mic) => {
            let channel = mic.get("channel").and_then(Json::as_i64).filter(|c| (0..2).contains(c)).ok_or("invalid microphone channel")? as usize;
            let mut source = PcmSource::new(48000, PcmPins::I2s { bclk: pin(mic, "bclk")?, ws: pin(mic, "ws")?, data: pin(mic, "data")? })?;
            // Deterministic startup stimulus, not a host-microphone or acoustic model.
            let samples: Vec<_> = (0..96000).map(|i| {
                let mut frame = [0; 2];
                frame[channel] = ((i as f64 * std::f64::consts::TAU * 1000.0 / 48000.0).sin() * 8192.0) as i16;
                frame
            }).collect();
            source.push(&samples);
            machine.bus.attach_pcm_sources().ok_or("PCM sources unavailable")?.inputs.push(Some(source));
        },
        None => return Err("missing microphone definition".into()),
    }
    Ok(Project { display: Arc::default(), oled, reset: Arc::default(), trace: Arc::default() })
}
impl BoardModel for Project {
    fn name(&self) -> &'static str { "studio" }
    fn gpio_changes(&mut self, changes: &[(u8, bool)]) {
        for &(pin, high) in changes {
            self.trace.lock().unwrap().gpio(pin, high);
            if self.oled.is_some_and(|(_, _, reset)| reset == pin) {
                *self.reset.lock().unwrap() = high;
                if !high { *self.display.lock().unwrap() = Ssd1306State::default(); }
            }
        }
    }
    fn i2c_devices(&mut self) -> Vec<(u8, u8, Box<dyn esp_periph::i2c::I2cDevice>)> {
        self.oled.map_or_else(Vec::new, |(sda, scl, _)| vec![(0, 0x3c,
            Box::new(TracedI2c::new(Ssd1306::new(self.display.clone(), (sda, scl)).with_reset(self.reset.clone()), 0x3c, self.trace.clone())) as Box<dyn esp_periph::i2c::I2cDevice>)])
    }
    fn display(&self) -> Option<(u32, u32, Vec<u16>, u64)> {
        self.oled.map(|_| { let state = self.display.lock().unwrap(); (128, 32, state.pixels_for(32), state.version) })
    }
    fn display_version(&self) -> u64 { self.display.lock().unwrap().version }
    fn display_frames(&self) -> u64 { self.display.lock().unwrap().frames }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn oled_uses_generated_pins_dimensions_and_active_low_reset() {
        let mut board = Project { display: Arc::default(), oled: Some((40, 42, 8)), reset: Arc::default(), trace: Arc::default() };
        let mut oled = board.i2c_devices().remove(0).2;
        assert_eq!(oled.pins(), Some((40, 42)));
        assert!(!oled.start(false));
        board.gpio_changes(&[(8, true)]);
        assert!(oled.start(false));
        for byte in [0, 0xaf, 0xa8, 31, 0xa5] { assert!(oled.write(byte)); }
        oled.stop();
        let (width, height, pixels, _) = board.display().unwrap();
        assert_eq!((width, height, pixels.len()), (128, 32, 4096));
        assert!(pixels.iter().all(|&p| p == 0xffff));
        board.gpio_changes(&[(8, false)]);
        assert!(!oled.start(false));
        assert!(board.display().unwrap().2.iter().all(|&p| p == 0));
    }
}
