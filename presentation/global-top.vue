<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useNav } from '@slidev/client'
// shortcut: reuse Slidev's internal timer state until it exposes a clamped slide-level component.
import { useTimer } from '@slidev/client/composables/useTimer.ts'

const { isPrintMode } = useNav()
const { status, mode, duration, passed, reset, resume, pause } = useTimer()

const remaining = computed(() => Math.max(0, duration.value - passed.value))
const display = computed(() => {
  const total = Math.ceil(remaining.value)
  const h = Math.floor(total / 3600)
  const m = Math.floor(total % 3600 / 60)
  const s = total % 60
  return `${h ? `${h}:` : ''}${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`
})
const tone = computed(() => {
  if (remaining.value === 0)
    return 'is-done'
  if (status.value === 'paused')
    return 'is-paused'
  if (status.value === 'stopped')
    return 'is-stopped'
  if (remaining.value <= duration.value * 0.2)
    return 'is-warning'
  return ''
})

function toggleCountdown() {
  if (status.value === 'running') {
    pause()
    return
  }
  if (remaining.value === 0)
    reset()
  resume()
}

onMounted(() => {
  if (status.value !== 'running')
    resume()
})

watch(remaining, (value) => {
  if (value === 0 && status.value === 'running')
    pause()
}, { immediate: true })
</script>

<template>
  <div v-if="!isPrintMode" class="global-countdown" :class="tone">
    <span class="global-countdown-icon" :class="mode === 'countdown' ? 'i-carbon:timer' : 'i-carbon:time'" />
    <span class="global-countdown-time">{{ display }}</span>
    <button type="button" class="global-countdown-button" @click="toggleCountdown">
      {{ status === 'running' ? '暂停' : '开始' }}
    </button>
    <button type="button" class="global-countdown-button" @click="reset">重置</button>
  </div>
</template>
