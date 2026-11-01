package main

//go:wasmimport pao distance_cm
func distanceCm() int32

//go:wasmimport pao delay_ms
func delayMs(ms int32)

//go:wasmimport pao log_int
func logInt(value int32)

//go:wasmimport pao move
func move(action, durationMs int32)

//go:wasmimport pao fire
func fire()

//go:wasmimport pao show_distance
func showDistance(distanceCm int32)
