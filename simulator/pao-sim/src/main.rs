mod board;
mod ssd1306;
mod trace;
mod project;
mod sensors;
mod world;

fn main() {
    let mut args: Vec<String> = std::env::args().collect();
    let board_file = args.iter().position(|a| a == "--board-file").map(|i| {
        args.remove(i);
        if i >= args.len() { eprintln!("--board-file needs a manifest"); std::process::exit(2); }
        args.remove(i)
    });
    let mut options = esp32sim::parse(&args, "s3");
    if !matches!(options.chip.as_str(), "s3" | "esp32s3")
        || !matches!(options.board.as_str(), "atech14" | "pao") {
        eprintln!("pao-sim supports the ESP32-S3 PAO board only");
        std::process::exit(2);
    }
    options.board = "none".into();
    let mut machine = esp32sim::setup_s3(&options);
    machine.bus.clear_i2c_devices();
    let (board, trace): (Box<dyn esp_soc::board::BoardModel>, _) = if let Some(path) = board_file {
        let result = std::fs::read_to_string(path).map_err(|e| e.to_string()).and_then(|text| project::configure(&text, &mut machine));
        let board = result.unwrap_or_else(|error| { eprintln!("Studio board: {error}"); std::process::exit(2); });
        let trace = board.trace.clone();
        (Box::new(board), trace)
    } else {
        let board = board::Pao::default(); let trace = board.trace.clone(); (Box::new(board), trace)
    };
    // Start the web server here so board traces share the page's WebSocket.
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
    machine.add_observer(Box::new(trace::Publisher::new(trace, machine.web.clone())));
    machine.bus.board = board;
    machine.bus.attach_board_devices();
    esp32sim::run(machine, &options);
}
