#pragma once

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    // Returns the latest distance in centimetres, or a negative value on failure.
    int (*distance_cm)(void);
    // action: 0 stop, 1 forward, 2 backward, 3 turn left, 4 turn right.
    void (*move)(int action, int duration_ms);
    void (*fire)(void);
    void (*show_distance)(int distance_cm);
} pao_guest_hooks_t;

void pao_guest_set_hooks(const pao_guest_hooks_t* hooks);
void pao_guest_start(void);

#ifdef __cplusplus
}
#endif
