idf_component_register(
    SRCS "pao.c" "motor.cc"
    INCLUDE_DIRS "include"
    REQUIRES esp_driver_gpio esp_driver_mcpwm
    PRIV_REQUIRES log
)
