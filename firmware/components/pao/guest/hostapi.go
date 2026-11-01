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

//go:wasmimport pao show_state
func showState(state int32)

//go:wasmimport pao show_wake
func showWake()

//go:wasmimport pao device_state
func deviceState() int32

//go:wasmimport pao uptime_ms
func uptimeMs() int32

//go:wasmimport pao event_next
func eventNext(timeoutMs int32) int32

//go:wasmimport pao event_id
func eventId() int32

//go:wasmimport pao event_arg0
func eventArg0() int32

//go:wasmimport pao event_arg1
func eventArg1() int32

//go:wasmimport pao event_reply
func eventReply(id, result int32)
