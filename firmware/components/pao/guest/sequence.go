package main

import (
	"strconv"
	"strings"
)

var seqActions [20]int32
var seqDurations [20]int32
var seqCount int32
var seqActive bool
var seqIndex int32
var seqStepStarted bool
var seqStepEndMs int32

func readText() string {
	n := int(textLen())
	if n <= 0 {
		return ""
	}
	buf := make([]byte, n)
	for i := 0; i < n; i++ {
		buf[i] = byte(textByte(int32(i)))
	}
	return string(buf)
}

func parseSequence(text string) int32 {
	seqCount = 0
	if len(text) == 0 {
		return -1
	}
	if text[len(text)-1] == ',' {
		return -1
	}
	parts := strings.Split(text, ",")
	if len(parts) > 20 {
		return -6
	}
	total := 0
	for _, item := range parts {
		if len(item) == 0 {
			return -1
		}
		kv := strings.Split(item, ":")
		if len(kv) != 2 {
			return -1
		}
		act := int32(0)
		switch kv[0] {
		case "forward":
			act = 1
		case "backward":
			act = 2
		case "turn_left":
			act = 3
		case "turn_right":
			act = 4
		case "fire":
			act = 5
		default:
			return -2
		}
		dur, err := strconv.Atoi(kv[1])
		if err != nil || dur < 100 || dur > 15000 {
			return -3
		}
		if act == 5 && dur != 300 {
			return -4
		}
		total += dur
		if total > 60000 {
			return -5
		}
		seqActions[seqCount] = act
		seqDurations[seqCount] = int32(dur)
		seqCount++
	}
	return 0
}
