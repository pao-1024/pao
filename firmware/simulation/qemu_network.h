#pragma once

#include "wifi_board.h"
#include "system_info.h"
#include <cassert>
#include <cJSON.h>
#include <esp_eth.h>
#include <esp_eth_mac_openeth.h>
#include <esp_event.h>
#include <esp_netif.h>
#include <material_symbols.h>

// shortcut: QEMU lacks S3 WiFi; replace only transport until its WiFi model exists.
class QemuNetworkBoard : public WifiBoard {
    bool connected_ = false;

    static void NetworkEventHandler(void* arg, esp_event_base_t base,
                                    int32_t event, void*) {
        auto* board = static_cast<QemuNetworkBoard*>(arg);
        if (base == IP_EVENT && event == IP_EVENT_ETH_GOT_IP) {
            board->connected_ = true;
            board->OnNetworkEvent(NetworkEvent::Connected, "OpenETH");
        } else if (base == ETH_EVENT && event == ETHERNET_EVENT_DISCONNECTED) {
            board->connected_ = false;
            board->OnNetworkEvent(NetworkEvent::Disconnected);
        }
    }

public:
    std::string GetBoardType() override { return "ethernet"; }
    const char* GetNetworkStateIcon() override { return MATERIAL_SYMBOLS_WIFI; }
    void SetPowerSaveLevel(PowerSaveLevel) override {}
    void EnterWifiConfigMode() { ESP_ERROR_CHECK(ESP_ERR_NOT_SUPPORTED); }
    std::string GetBoardJson() override {
        return "{\"type\":\"pao\",\"name\":\"pao\",\"mac\":\"" + SystemInfo::GetMacAddress() + "\"}";
    }
    std::string GetDeviceStatusJson() override {
        auto* status = cJSON_Parse(WifiBoard::GetDeviceStatusJson().c_str());
        assert(status);
        auto* network = cJSON_CreateObject();
        cJSON_AddStringToObject(network, "type", "ethernet");
        cJSON_AddStringToObject(network, "state", connected_ ? "connected" : "disconnected");
        cJSON_ReplaceItemInObject(status, "network", network);
        char* json = cJSON_PrintUnformatted(status);
        assert(json);
        std::string result(json);
        cJSON_free(json);
        cJSON_Delete(status);
        return result;
    }
    void StartNetwork() override {
        ESP_ERROR_CHECK(esp_netif_init());
        ESP_ERROR_CHECK(esp_event_loop_create_default());
        esp_netif_config_t config = ESP_NETIF_DEFAULT_ETH();
        esp_netif_t* netif = esp_netif_new(&config);
        assert(netif);
        eth_mac_config_t mac_config = ETH_MAC_DEFAULT_CONFIG();
        eth_phy_config_t phy_config = ETH_PHY_DEFAULT_CONFIG();
        phy_config.phy_addr = 1;
        phy_config.reset_gpio_num = -1;
        esp_eth_mac_t* mac = esp_eth_mac_new_openeth(&mac_config);
        esp_eth_phy_t* phy = esp_eth_phy_new_generic(&phy_config);
        assert(mac && phy);
        esp_eth_config_t eth_config = ETH_DEFAULT_CONFIG(mac, phy);
        esp_eth_handle_t handle;
        ESP_ERROR_CHECK(esp_eth_driver_install(&eth_config, &handle));
        ESP_ERROR_CHECK(esp_netif_attach(netif, esp_eth_new_netif_glue(handle)));
        ESP_ERROR_CHECK(esp_event_handler_register(ETH_EVENT, ESP_EVENT_ANY_ID, NetworkEventHandler, this));
        ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_ETH_GOT_IP, NetworkEventHandler, this));
        OnNetworkEvent(NetworkEvent::Connecting, "OpenETH");
        ESP_ERROR_CHECK(esp_eth_start(handle));
    }
};
