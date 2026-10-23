#include "wifi_board.h"
#include "audio_codec.h"
#include <algorithm>
#include <cstring>
#include <esp_log.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// shortcut: silent codec for WiFi tests; use QEMU for real I2S and WakeNet.
class WifiTestCodec : public AudioCodec {
    int Read(int16_t* data, int samples) override {
        memset(data, 0, samples * sizeof(*data));
        vTaskDelay(pdMS_TO_TICKS(std::max(10, samples * 1000 / input_sample_rate_)));
        return samples;
    }
    int Write(const int16_t*, int samples) override {
        vTaskDelay(pdMS_TO_TICKS(std::max(10, samples * 1000 / output_sample_rate_)));
        return samples;
    }
public:
    WifiTestCodec() { input_sample_rate_ = 16000; output_sample_rate_ = 24000; }
};

class PaoEspEmuBoard : public WifiBoard {
public:
    PaoEspEmuBoard() {
        ESP_LOGW("PaoEspEmu", "WiFi-only simulation; audio is verified in QEMU");
    }
    AudioCodec* GetAudioCodec() override { static WifiTestCodec codec; return &codec; }
};
DECLARE_BOARD(PaoEspEmuBoard);
