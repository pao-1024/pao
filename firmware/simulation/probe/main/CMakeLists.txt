idf_component_register(SRCS "probe.c" "motors.cc" REQUIRES pao esp_driver_gpio esp_timer esp_driver_i2c esp_driver_i2s esp_driver_rmt esp_lcd nvs_flash)
