mod board;
mod ssd1306;
mod trace;
mod world;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mut options = esp32sim::parse(&args, "s3");
    if !matches!(options.chip.as_str(), "s3" | "esp32s3")
        || !matches!(options.board.as_str(), "atech14" | "pao") {
        eprintln!("pao-sim supports the ESP32-S3 PAO board only");
        std::process::exit(2);
    }
    options.board = "none".into();
    let mut machine = esp32sim::setup_s3(&options);
    machine.bus.clear_i2c_devices();
    let board = board::Pao::default();
    // The kernel starts its web server inside `run`; start it here instead so the pin trace
    // shares the page's WebSocket. Runs without a page skip the trace and its MMIO observer.
    if let Some(port) = options.web_port.take() {
        let Some(dir) = options.web_dir.clone() else {
            eprintln!("pao-sim --web requires --web-dir");
            std::process::exit(2);
        };
        let web = esp_soc::web::WebServer::start(port, dir).expect("web server");
        machine.web = Some(web);
        machine.rt.enabled = true;
    }
    // Motion decoding and echo geometry also run without a browser attached.
    machine.add_observer(Box::new(trace::Publisher::new(board.trace.clone(), machine.web.clone())));
    machine.bus.board = Box::new(board);
    machine.bus.attach_board_devices();
    esp32sim::run(machine, &options);
}
