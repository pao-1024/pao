#pragma once

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    // Returns the latest distance in centimetres, or a negative value on failure.
    int (*distance_cm)(void);
} pao_guest_hooks_t;

void pao_guest_set_hooks(const pao_guest_hooks_t* hooks);
void pao_guest_start(void);

#ifdef __cplusplus
}
#endif
