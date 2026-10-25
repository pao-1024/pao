//! A Studio board is wired from the same generated manifest as the guest firmware.
use crate::ssd1306::{Ssd1306, Ssd1306State};
use crate::trace::{Trace, TracedI2c};
use esp_periph::i2s::{PcmPins, PcmSource};
use esp_soc::{board::BoardModel, json::{parse_json, Json}, Soc, SocBus};
use std::sync::{Arc, Mutex};

pub struct Project {
    display: Arc<Mutex<Ssd1306State>>,
    oled: Option<(u8, u8, u8)>,
    oled_bus: u8,
    sensors: Vec<crate::sensors::Sensor>,
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
            mic.get("channel").and_then(Json::as_i64).filter(|c| (0..2).contains(c)).ok_or("invalid microphone channel")?;
            let source = PcmSource::new(48000, PcmPins::I2s { bclk: pin(mic, "bclk")?, ws: pin(mic, "ws")?, data: pin(mic, "data")? })?;
            machine.bus.attach_pcm_sources().ok_or("PCM sources unavailable")?.inputs.push(Some(source));
        },
        None => return Err("missing microphone definition".into()),
    }
    let oled_bus = spec.get("oled").and_then(|o| o.get("bus")).and_then(Json::as_i64).unwrap_or(0);
    if !(0..=1).contains(&oled_bus) { return Err("invalid OLED bus".into()); }
    let mut sensors = Vec::new();
    if let Some(items) = spec.get("sensors") {
        let Json::Arr(items) = items else { return Err("invalid sensors".into()); };
        if items.len() > 12 { return Err("too many sensors".into()); }
        for item in items {
            let integer = |key| match item.get(key) { Some(Json::Int(v)) => Ok(*v), _ => Err(format!("invalid sensor {key}")) };
            let id = u32::try_from(integer("id")?).map_err(|_| "invalid sensor ID")?;
            let bus = u8::try_from(integer("bus")?).map_err(|_| "invalid sensor bus")?;
            let address = u8::try_from(integer("address")?).map_err(|_| "invalid sensor address")?;
            let kind = item.get("type").and_then(Json::as_str).ok_or("invalid sensor type")?.to_owned();
            let sensor = crate::sensors::Sensor::new(id,kind,bus,address,(pin(item,"sda")?,pin(item,"scl")?))?;
            if sensors.iter().any(|s: &crate::sensors::Sensor| s.id == id || (s.bus == bus && s.address == address)) { return Err("duplicate sensor ID or address".into()); }
            sensors.push(sensor);
        }
    }
    Ok(Project { display: Arc::default(), oled, oled_bus: oled_bus as u8, sensors, reset: Arc::default(), trace: Arc::default() })
}
impl BoardModel for Project {
    fn name(&self) -> &'static str { "studio" }
    fn set_input(&mut self, input: &Json) -> Result<(), &'static str> {
        let id = match input.get("id") { Some(Json::Int(v)) => u32::try_from(*v).map_err(|_| "invalid sensor ID")?, _ => return Err("invalid sensor ID") };
        self.sensors.iter_mut().find(|s| s.id == id).ok_or("unknown sensor ID")?.set_input(input)
    }
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
        let mut devices = self.oled.map_or_else(Vec::new, |(sda, scl, _)| vec![(self.oled_bus, 0x3c,
            Box::new(TracedI2c::new(Ssd1306::new(self.display.clone(), (sda, scl)).with_reset(self.reset.clone()), 0x3c, self.trace.clone())) as Box<dyn esp_periph::i2c::I2cDevice>)]);
        for sensor in &self.sensors { devices.push((sensor.bus,sensor.address,Box::new(TracedI2c::new(sensor.clone(),sensor.address,self.trace.clone())))); }
        devices
    }
    fn display(&self) -> Option<(u32, u32, Vec<u16>, u64)> {
        // The breakout glass origin is opposite SEG0/COM0, as on the PAO reference display.
        self.oled.map(|_| { let state = self.display.lock().unwrap(); (128, 32, state.pixels_for(32).into_iter().rev().collect(), state.version) })
    }
    fn display_version(&self) -> u64 { self.display.lock().unwrap().version }
    fn display_frames(&self) -> u64 { self.display.lock().unwrap().frames }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn oled_uses_generated_pins_dimensions_and_active_low_reset() {
        let mut board = Project { display: Arc::default(), oled: Some((40, 42, 8)), oled_bus: 0, sensors: Vec::new(), reset: Arc::default(), trace: Arc::default() };
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
        assert!(oled.start(false));
        for byte in [0, 0xa4, 0xa1, 0xc8, 0x20, 0, 0x21, 0, 127, 0x22, 0, 3] { assert!(oled.write(byte)); }
        oled.stop();
        assert!(oled.start(false));
        for byte in [0x40, 1] { assert!(oled.write(byte)); }
        oled.stop();
        let pixels = board.display().unwrap().2;
        assert_eq!(pixels[0], 0xffff);
        assert_eq!(pixels.iter().filter(|&&p| p != 0).count(), 1);
        board.gpio_changes(&[(8, false)]);
        assert!(!oled.start(false));
        assert!(board.display().unwrap().2.iter().all(|&p| p == 0));
    }
}
