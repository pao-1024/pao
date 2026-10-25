//! Register-level models for the three selected Adafruit breakouts. Environmental stimuli
//! enter the device; only real guest I2C transactions expose them to the firmware.
use esp_periph::i2c::I2cDevice;
use esp_soc::json::Json;
use std::sync::{Arc,Mutex};

#[derive(Clone)]
pub struct Sensor {
    pub id: u32, pub kind: String, pub bus: u8, pub address: u8, route: (u8,u8),
    values: Arc<Mutex<[i64;3]>>, written: Vec<u8>, data: Vec<u8>, offset: usize,
    pointer: u8, config: u16, resolution: u8, powered: bool, measuring: bool, command: u16,
}
pub fn crc(bytes: &[u8]) -> u8 {
    let mut crc = 0xffu8;
    for &byte in bytes { crc ^= byte; for _ in 0..8 { crc = if crc & 0x80 != 0 { (crc << 1) ^ 0x31 } else { crc << 1 }; } }
    crc
}
impl Sensor {
    pub fn new(id: u32, kind: String, bus: u8, address: u8, route: (u8,u8)) -> Result<Self,String> {
        let valid = match kind.as_str() { "mcp9808" => (0x18..=0x1f).contains(&address), "bh1750" => [0x23,0x5c].contains(&address), "sht31" => [0x44,0x45].contains(&address), _ => false };
        if !valid || id == 0 || bus > 1 || route.0 == route.1 { return Err("invalid I2C sensor manifest".into()); }
        Ok(Self { id,kind,bus,address,route,values: Arc::new(Mutex::new([25000,50000,100000])),written: Vec::new(),data: Vec::new(),offset: 0,pointer: 0,config: 0,resolution: 3,powered: false,measuring: false,command: 0 })
    }
    pub fn set_input(&mut self, input: &Json) -> Result<(), &'static str> {
        let Json::Obj(entries) = input else { return Err("sensor input must be an object") };
        let mut values = *self.values.lock().unwrap(); let mut count = 0;
        for (key,value) in entries {
            if key == "t" || key == "id" { continue; }
            let (index,min,max,allowed) = match key.as_str() {
                "temperatureC" => (0,-40000,125000,self.kind != "bh1750"),
                "humidityPercent" => (1,0,100000,self.kind == "sht31"),
                "lux" => (2,0,50000000,self.kind == "bh1750"), _ => return Err("unknown sensor quantity"),
            };
            let Json::Int(v) = value else { return Err("sensor values must be integer milli-units") };
            if !allowed || !(min..=max).contains(v) { return Err("sensor input outside device capability"); }
            values[index] = *v; count += 1;
        }
        if count == 0 { return Err("sensor input is empty"); }
        *self.values.lock().unwrap() = values; Ok(())
    }
}
impl I2cDevice for Sensor {
    fn pins(&self) -> Option<(u8,u8)> { Some(self.route) }
    fn start(&mut self, read: bool) -> bool {
        self.offset = 0;
        if !read { self.written.clear(); return true; }
        let values = *self.values.lock().unwrap();
        self.data = match self.kind.as_str() {
            "mcp9808" => {
                let raw = match self.pointer { 1 => self.config, 5 => { let t = (values[0] as f64 * 16.0 / 1000.0).round() as i32; (t & 0xfff) as u16 | if t < 0 { 0x1000 } else { 0 } }, 6 => 0x54, 7 => 0x400, 8 => self.resolution as u16, _ => 0 };
                if self.pointer == 8 { vec![raw as u8] } else { raw.to_be_bytes().to_vec() }
            },
            "bh1750" if self.powered && self.measuring => ((values[2] as f64 * 1.2 / 1000.0).round() as u16).to_be_bytes().to_vec(),
            "sht31" if self.command == 0xf32d => { let mut bytes = vec![0x80,0x10]; bytes.push(crc(&bytes)); bytes },
            "sht31" if self.command == 0x2400 => {
                let t = (((values[0] + 45000) as f64 * 65535.0 / 175000.0).round() as u16).to_be_bytes();
                let h = ((values[1] as f64 * 65535.0 / 100000.0).round() as u16).to_be_bytes();
                vec![t[0],t[1],crc(&t),h[0],h[1],crc(&h)]
            }, _ => return false,
        }; true
    }
    fn write(&mut self, byte: u8) -> bool {
        if self.written.len() == 3 { return false; } self.written.push(byte);
        match self.kind.as_str() {
            "mcp9808" => {
                if self.written.len() == 1 { self.pointer = byte; return byte <= 8; }
                if self.pointer == 1 && self.written.len() == 3 { self.config = u16::from_be_bytes([self.written[1],self.written[2]]); }
                if self.pointer == 8 && self.written.len() == 2 { self.resolution = byte & 3; }
                true
            },
            "bh1750" => match byte { 0 => { self.powered=false; true }, 1 => { self.powered=true; true }, 7 => self.powered, 0x10 => { self.measuring=true; self.powered }, _ => false },
            _ => {
                if self.written.len() == 2 { self.command = u16::from_be_bytes([self.written[0],byte]); return [0x30a2,0xf32d,0x2400].contains(&self.command); }
                self.written.len() == 1
            }
        }
    }
    fn read(&mut self) -> u8 { let value = self.data.get(self.offset).copied().unwrap_or(0xff); self.offset += 1; value }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn tx(s: &mut Sensor, data: &[u8]) { assert!(s.start(false)); for &b in data { assert!(s.write(b)); } s.stop(); }
    #[test]
    fn registers_commands_crc_negative_temperature_and_input_validation() {
        assert_eq!(crc(&[0xbe,0xef]),0x92);
        let mut s = Sensor::new(1,"mcp9808".into(),1,0x19,(40,42)).unwrap();
        assert_eq!(s.pins(),Some((40,42))); tx(&mut s,&[6]); assert!(s.start(true)); assert_eq!([s.read(),s.read()],[0,0x54]);
        s.set_input(&esp_soc::json::parse_json(r#"{"t":"board-input","id":1,"temperatureC":-10000}"#).unwrap()).unwrap();
        tx(&mut s,&[5]); assert!(s.start(true)); assert_eq!([s.read(),s.read()],[0x1f,0x60]);
        s.set_input(&esp_soc::json::parse_json(r#"{"temperatureC":-1}"#).unwrap()).unwrap();
        tx(&mut s,&[5]); assert!(s.start(true)); assert_eq!([s.read(),s.read()],[0,0]);
        assert!(s.set_input(&esp_soc::json::parse_json(r#"{"lux":1000}"#).unwrap()).is_err());
        let mut light = Sensor::new(2,"bh1750".into(),0,0x23,(41,42)).unwrap();
        assert!(!light.start(true)); tx(&mut light,&[1]); tx(&mut light,&[0x10]); assert!(light.start(true)); assert_eq!([light.read(),light.read()],[0,120]);
        let mut sht = Sensor::new(3,"sht31".into(),0,0x44,(41,42)).unwrap(); tx(&mut sht,&[0x24,0]); assert!(sht.start(true));
        let bytes: Vec<u8> = (0..6).map(|_| sht.read()).collect(); assert_eq!(crc(&bytes[..2]),bytes[2]); assert_eq!(crc(&bytes[3..5]),bytes[5]);
        assert!(sht.set_input(&esp_soc::json::parse_json(r#"{"temperatureC":200000}"#).unwrap()).is_err());
    }
}
