idf_component_register(
    SRCS "pao.c" "motor.cc" "chassis.cc" "forward_distance_mover.cc" "launcher.cc" "hc_sr04.cc" "pao_guest.cc"
    INCLUDE_DIRS "include"
    REQUIRES esp_driver_gpio esp_driver_mcpwm esp_driver_rmt freertos wasm-micro-runtime pthread
    PRIV_REQUIRES log esp_timer esp_rom
    EMBED_FILES "sounds/pao_launch.ogg" "sounds/pao_alarm.ogg" "sounds/pao_explore.ogg" "guest/guest.wasm"
)
