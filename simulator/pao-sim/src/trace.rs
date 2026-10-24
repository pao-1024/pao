//! Pin and bus activity for the web page. The board and its I2C devices record into `Trace`;
//! `Publisher` decodes MCPWM register writes and sends one `{"t":"pao"}` message per 50 ms of
//! emulated time with the current pin state and the events since the previous message.
use esp_periph::i2c::I2cDevice;
use esp_soc::{web::WebServer, Ctx, Observer, Soc, Wants};
use std::collections::BTreeMap;
use std::fmt::Write;
use std::sync::{Arc, Mutex};

/// Events kept between two messages; later ones are only counted so a busy bus cannot flood the page.
const EVENTS: usize = 256;
/// Bytes of each I2C transaction kept for the page; the length is always exact.
const I2C_BYTES: usize = 32;

#[derive(Default)]
pub struct Trace {
    events: Vec<String>, dropped: u64,
    levels: u64, known: u64,
    pwm: BTreeMap<u8, u32>,
    i2c: (u64, u64),
}
impl Trace {
    fn event(&mut self, event: String) {
        if self.events.len() < EVENTS { self.events.push(event); } else { self.dropped += 1; }
    }
    pub fn gpio(&mut self, pin: u8, high: bool) {
        let bit = 1u64 << pin;
        if self.known & bit != 0 && (self.levels & bit != 0) == high { return; }
        self.known |= bit;
        if high { self.levels |= bit; } else { self.levels &= !bit; }
        self.event(format!("{{\"k\":\"gpio\",\"pin\":{pin},\"v\":{}}}", high as u8));
    }
    fn i2c(&mut self, address: u8, read: bool, bytes: &[u8], len: usize) {
        self.i2c.0 += 1; self.i2c.1 += len as u64;
        let mut hex = String::with_capacity(bytes.len() * 2);
        for byte in bytes { let _ = write!(hex, "{byte:02x}"); }
        self.event(format!("{{\"k\":\"i2c\",\"addr\":{address},\"read\":{read},\"len\":{len},\"data\":\"{hex}\"}}"));
    }
    /// Duty in permille, or `None` once the pin leaves MCPWM.
    fn pwm(&mut self, pin: u8, duty: Option<u32>) {
        if self.pwm.get(&pin).copied() == duty { return; }
        match duty { Some(d) => { self.pwm.insert(pin, d); } None => { self.pwm.remove(&pin); } }
        self.event(format!("{{\"k\":\"pwm\",\"pin\":{pin},\"duty\":{}}}", duty.map_or(-1, |d| d as i64)));
    }
    fn message(&mut self, seconds: f64) -> String {
        let pwm: Vec<String> = self.pwm.iter().map(|(pin, duty)| format!("[{pin},{duty}]")).collect();
        let message = format!(
            "{{\"t\":\"pao\",\"time\":{seconds:.3},\"levels\":\"{:x}\",\"known\":\"{:x}\",\"pwm\":[{}],\"i2c\":[{},{}],\"dropped\":{},\"events\":[{}]}}",
            self.levels, self.known, pwm.join(","), self.i2c.0, self.i2c.1, self.dropped, self.events.join(","));
        self.events.clear(); self.dropped = 0;
        message
    }
}

/// Records every transaction of the wrapped device; the device itself is unchanged.
pub struct TracedI2c<D> { inner: D, trace: Arc<Mutex<Trace>>, address: u8, read: bool, bytes: Vec<u8>, len: usize }
impl<D> TracedI2c<D> {
    pub fn new(inner: D, address: u8, trace: Arc<Mutex<Trace>>) -> Self {
        Self { inner, trace, address, read: false, bytes: Vec::new(), len: 0 }
    }
    fn byte(&mut self, byte: u8) { self.len += 1; if self.bytes.len() < I2C_BYTES { self.bytes.push(byte); } }
    fn finish(&mut self) {
        if self.len == 0 { return; }
        self.trace.lock().unwrap().i2c(self.address, self.read, &self.bytes, self.len);
        self.bytes.clear(); self.len = 0;
    }
}
impl<D: I2cDevice> I2cDevice for TracedI2c<D> {
    fn pins(&self) -> Option<(u8, u8)> { self.inner.pins() }
    // A repeated start ends the previous transfer as far as the page is concerned.
    fn start(&mut self, read: bool) -> bool { self.finish(); self.read = read; self.inner.start(read) }
    fn write(&mut self, byte: u8) -> bool { self.byte(byte); self.inner.write(byte) }
    fn read(&mut self) -> u8 { let byte = self.inner.read(); self.byte(byte); byte }
    fn stop(&mut self) { self.inner.stop(); self.finish(); }
}

const GPIO_OUT_SEL: u32 = 0x6000_4554;
const MCPWM0: u32 = 0x6001_e000;
/// PWM0_OUT0A; the six generators of MCPWM0 follow in order (ESP32-S3 GPIO matrix).
const MCPWM0_SIGNAL: u32 = 160;
const PINS: usize = 49;

/// Decodes the MCPWM0 setup the motor driver uses: up-counting timers, generators high on
/// timer empty and low on comparator A, or a continuous forced level.
// ponytail: MCPWM1, comparator B and dead time are not decoded; add them when a driver uses them.
pub struct Publisher {
    trace: Arc<Mutex<Trace>>, web: WebServer, next: u64,
    out_sel: [u32; PINS], period: [u32; 3], timer_of: u32, compare: [u32; 3], force: [u32; 3],
}
impl Publisher {
    pub fn new(trace: Arc<Mutex<Trace>>, web: WebServer) -> Self {
        Self { trace, web, next: 0, out_sel: [0; PINS], period: [256; 3], timer_of: 0, compare: [0; 3], force: [0; 3] }
    }
    fn register(&mut self, addr: u32, value: u32) {
        if (GPIO_OUT_SEL..GPIO_OUT_SEL + PINS as u32 * 4).contains(&addr) {
            self.out_sel[((addr - GPIO_OUT_SEL) / 4) as usize] = value & 0x1ff;
        } else if (MCPWM0..MCPWM0 + 0x1000).contains(&addr) {
            match addr - MCPWM0 {
                off @ (4 | 20 | 36) => self.period[(off / 16) as usize] = ((value >> 8) & 0xffff) + 1,
                0x38 => self.timer_of = value,
                off => for op in 0..3 {
                    let base = 0x3c + op as u32 * 0x38;
                    if off == base + 4 { self.compare[op] = value & 0xffff; }
                    if off == base + 0x10 { self.force[op] = value; }
                },
            }
        } else { return; }
        let mut trace = self.trace.lock().unwrap();
        for pin in 0..PINS {
            let Some(channel) = self.out_sel[pin].checked_sub(MCPWM0_SIGNAL).filter(|&c| c < 6) else {
                trace.pwm(pin as u8, None); continue;
            };
            let (op, generator) = (channel as usize / 2, channel % 2);
            let period = self.period[((self.timer_of >> (op * 2)) & 3).min(2) as usize];
            let duty = match (self.force[op] >> (6 + generator * 2)) & 3 {
                1 => 0,
                2 => 1000,
                _ => (self.compare[op].min(period) * 1000 + period / 2) / period,
            };
            trace.pwm(pin as u8, Some(duty));
        }
    }
    fn publish(&mut self, cx: &Ctx) {
        if cx.cycles < self.next { return; }
        self.next = cx.cycles + cx.cpu_hz / 20;
        let message = self.trace.lock().unwrap().message(cx.seconds());
        self.web.send_text(&message);
    }
}
impl<S: Soc> Observer<S> for Publisher {
    fn name(&self) -> &'static str { "pao-trace" }
    fn wants(&self) -> Wants { Wants::MMIO | Wants::ROUND }
    fn on_mmio(&mut self, _cx: &Ctx, _pc: u32, addr: u32, value: u32, write: bool) {
        if write { self.register(addr, value); }
    }
    fn on_round(&mut self, cx: &Ctx) { self.publish(cx); }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    struct Sink;
    impl I2cDevice for Sink { fn write(&mut self, _: u8) -> bool { true } fn read(&mut self) -> u8 { 0xff } }

    #[test]
    fn motor_duty_i2c_bytes_and_gpio_edges_reach_one_message() {
        let trace = Arc::new(Mutex::new(Trace::default()));
        let web = WebServer::queued();
        let mut publisher = Publisher::new(trace.clone(), web.clone());
        // Right motor as motor.cc sets it up: IN1/IN2 on generators 0A/0B, 1 MHz / 1000 ticks.
        publisher.register(GPIO_OUT_SEL + 11 * 4, 160);
        publisher.register(GPIO_OUT_SEL + 12 * 4, 161);
        publisher.register(MCPWM0 + 4, 999 << 8);
        publisher.register(MCPWM0 + 0x3c + 4, 300);
        publisher.register(MCPWM0 + 0x3c + 0x10, 1 << 8);
        assert_eq!(trace.lock().unwrap().pwm, BTreeMap::from([(11, 300), (12, 0)]));
        publisher.register(MCPWM0 + 0x3c + 0x10, 2 << 6 | 1 << 8);
        assert_eq!(trace.lock().unwrap().pwm[&11], 1000);
        publisher.register(GPIO_OUT_SEL + 11 * 4, 256);
        assert!(!trace.lock().unwrap().pwm.contains_key(&11));

        let mut device = TracedI2c::new(Sink, 0x3c, trace.clone());
        assert!(device.start(false));
        for byte in [0, 0xaf] { assert!(device.write(byte)); }
        device.stop();
        { let mut t = trace.lock().unwrap(); t.gpio(17, false); t.gpio(17, false); t.gpio(48, true); }

        let cx = Ctx { symbols: &BTreeMap::new(), cycles: 240_000_000, cpu_hz: 240_000_000 };
        publisher.publish(&cx);
        let (_, message) = web.take_outbox().pop().unwrap();
        let message = String::from_utf8(message).unwrap();
        assert!(message.starts_with(r#"{"t":"pao","time":1.000,"levels":"1000000000000","known":"1000000020000","pwm":[[12,0]],"i2c":[1,2]"#), "{message}");
        assert!(message.contains(r#"{"k":"i2c","addr":60,"read":false,"len":2,"data":"00af"}"#), "{message}");
        assert_eq!(message.matches(r#""pin":17"#).count(), 1, "{message}");
        assert!(message.contains(r#"{"k":"pwm","pin":11,"duty":-1}"#), "{message}");
    }
}
