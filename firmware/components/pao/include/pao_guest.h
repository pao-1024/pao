#pragma once

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    // Returns the latest distance in centimetres, or a negative value on failure.
    int (*distance_cm)(void);
    // action: 0 stop, 1 forward, 2 backward, 3 turn left, 4 turn right.
    void (*move)(int action, int duration_ms);
    void (*move_sequence)(int action, int duration_ms);
    void (*fire)(void);
    void (*show_distance)(int distance_cm);
    void (*show_state)(int state);
    void (*show_wake)(void);
    void (*show_text)(const char* text);
    int (*device_state)(void);
} pao_guest_hooks_t;

void pao_guest_set_hooks(const pao_guest_hooks_t* hooks);
void pao_guest_start(void);

// Sends one command to the guest and waits for its reply. Returns the guest
// result, or a negative value when the guest is unavailable or times out.
int pao_guest_command(int type, int arg0, int arg1);

// Queues a fire-and-forget event for the guest. Returns 0 when queued.
int pao_guest_post_event(int type, int arg0, int arg1);
int pao_guest_post_text_event(int type, const char* text);
int pao_guest_command_text(int type, const char* text);

#ifdef __cplusplus
}
#endif
