idf_component_register(
    SRCS "pao.c" "motor.cc" "chassis.cc" "forward_distance_mover.cc" "launcher.cc" "hc_sr04.cc"
    INCLUDE_DIRS "include"
    REQUIRES esp_driver_gpio esp_driver_mcpwm esp_driver_rmt freertos
    PRIV_REQUIRES log esp_timer esp_rom
    EMBED_FILES "sounds/pao_launch.ogg" "sounds/pao_alarm.ogg" "sounds/pao_explore.ogg"
)
