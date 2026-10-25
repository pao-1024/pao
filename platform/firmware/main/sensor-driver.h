#pragma once
// Register transactions follow MCP9808 DS20001955, ROHM BH1750FVI and Sensirion SHT3x-DIS.
struct StudioSensor { bool valid; float temperatureC, humidityPercent, lux; };
static i2c_master_bus_handle_t studio_buses[I2C_BUS_COUNT ? I2C_BUS_COUNT : 1] = {};
static i2c_master_dev_handle_t studio_sensor_devices[SENSOR_COUNT ? SENSOR_COUNT : 1] = {};
static StudioSensor studio_sensor_values[SENSOR_COUNT ? SENSOR_COUNT : 1] = {};
[[maybe_unused]] static StudioSensor studio_sensor(int id) {
    for (int i = 0; i < SENSOR_COUNT; ++i) if (studio_sensor_configs[i].id == id) return studio_sensor_values[i];
    return {false, NAN, NAN, NAN};
}
static uint8_t studio_crc(const uint8_t *p, int size) {
    uint8_t crc = 0xff;
    for (int i = 0; i < size; ++i) { crc ^= p[i]; for (int b = 0; b < 8; ++b) crc = crc & 0x80 ? (crc << 1) ^ 0x31 : crc << 1; }
    return crc;
}
static void init_studio_buses() {
    for (int i = 0; i < I2C_BUS_COUNT; ++i) {
        i2c_master_bus_config_t cfg = {};
        cfg.i2c_port = (i2c_port_num_t)i; cfg.sda_io_num = (gpio_num_t)studio_i2c_routes[i].sda;
        cfg.scl_io_num = (gpio_num_t)studio_i2c_routes[i].scl; cfg.clk_source = I2C_CLK_SRC_DEFAULT; cfg.glitch_ignore_cnt = 7;
        ESP_ERROR_CHECK(i2c_new_master_bus(&cfg, &studio_buses[i]));
    }
}
static void init_studio_sensors() {
    for (int i = 0; i < SENSOR_COUNT; ++i) {
        auto &s = studio_sensor_configs[i];
        i2c_device_config_t cfg = {}; cfg.dev_addr_length = I2C_ADDR_BIT_LEN_7; cfg.device_address = s.address; cfg.scl_speed_hz = 100000;
        ESP_ERROR_CHECK(i2c_master_bus_add_device(studio_buses[s.bus], &cfg, &studio_sensor_devices[i]));
        auto dev = studio_sensor_devices[i];
        if (s.kind == 1) {
            uint8_t reg = 6, data[2];
            ESP_ERROR_CHECK(i2c_master_transmit_receive(dev,&reg,1,data,2,1000));
            if (data[0] != 0 || data[1] != 0x54) abort();
            reg = 7; ESP_ERROR_CHECK(i2c_master_transmit_receive(dev,&reg,1,data,2,1000));
            if (data[0] != 4 || data[1] != 0) abort();
            const uint8_t config[] = {1,0,0}, resolution[] = {8,3};
            ESP_ERROR_CHECK(i2c_master_transmit(dev,config,3,1000));
            ESP_ERROR_CHECK(i2c_master_transmit(dev,resolution,2,1000));
        } else if (s.kind == 2) {
            for (uint8_t command : {0x01,0x07,0x10}) ESP_ERROR_CHECK(i2c_master_transmit(dev,&command,1,1000));
        } else {
            const uint8_t reset[] = {0x30,0xa2}, status[] = {0xf3,0x2d}; uint8_t data[3];
            ESP_ERROR_CHECK(i2c_master_transmit(dev,reset,2,1000)); vTaskDelay(pdMS_TO_TICKS(10));
            ESP_ERROR_CHECK(i2c_master_transmit_receive(dev,status,2,data,3,1000));
            if (studio_crc(data,2) != data[2]) abort();
        }
        printf("STUDIO SENSOR INIT id=%d kind=%d bus=%d addr=%d SDA=%d SCL=%d\n",s.id,s.kind,s.bus,s.address,studio_i2c_routes[s.bus].sda,studio_i2c_routes[s.bus].scl);
    }
    if (SENSOR_COUNT) vTaskDelay(pdMS_TO_TICKS(300));
}
static void sample_studio_sensors() {
    for (int i = 0; i < SENSOR_COUNT; ++i) {
        const auto &s = studio_sensor_configs[i]; auto dev = studio_sensor_devices[i];
        StudioSensor value{true,NAN,NAN,NAN}; uint8_t data[6];
        if (s.kind == 1) {
            uint8_t reg = 5; ESP_ERROR_CHECK(i2c_master_transmit_receive(dev,&reg,1,data,2,1000));
            const uint16_t raw = (data[0] << 8) | data[1]; value.temperatureC = (raw & 0xfff) / 16.0f - (raw & 0x1000 ? 256.0f : 0.0f);
        } else if (s.kind == 2) {
            ESP_ERROR_CHECK(i2c_master_receive(dev,data,2,1000)); value.lux = ((data[0] << 8) | data[1]) / 1.2f;
        } else {
            const uint8_t measure[] = {0x24,0x00}; ESP_ERROR_CHECK(i2c_master_transmit(dev,measure,2,1000)); vTaskDelay(pdMS_TO_TICKS(20));
            ESP_ERROR_CHECK(i2c_master_receive(dev,data,6,1000));
            value.valid = studio_crc(data,2) == data[2] && studio_crc(data+3,2) == data[5];
            if (value.valid) { value.temperatureC = ((data[0] << 8) | data[1]) * 175.0f / 65535.0f - 45.0f; value.humidityPercent = ((data[3] << 8) | data[4]) * 100.0f / 65535.0f; }
        }
        studio_sensor_values[i] = value;
        const auto milli = [](float v) { return std::isfinite(v) ? (int)std::lround(v*1000) : 0; };
        printf("STUDIO SENSOR id=%d valid=%d temperature_milli=%d humidity_milli=%d lux_milli=%d\n",s.id,(int)value.valid,milli(value.temperatureC),milli(value.humidityPercent),milli(value.lux));
    }
}
