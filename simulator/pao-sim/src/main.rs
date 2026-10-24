mod board;
mod ssd1306;

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
    machine.bus.board = Box::new(board::Pao::default());
    machine.bus.attach_board_devices();
    esp32sim::run(machine, &options);
}
