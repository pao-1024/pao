package main

//go:wasmimport pao distance_cm
func distanceCm() int32

//go:wasmimport pao delay_ms
func delayMs(ms int32)

//go:wasmimport pao log_int
func logInt(value int32)
