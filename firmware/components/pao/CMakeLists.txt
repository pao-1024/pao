idf_component_register(
    SRCS "pao.c" "motor.cc" "chassis.cc" "launcher.cc" "hc_sr04.cc"
    INCLUDE_DIRS "include"
    REQUIRES esp_driver_gpio esp_driver_mcpwm esp_driver_rmt
    PRIV_REQUIRES log esp_timer esp_rom
)
