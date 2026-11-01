<script setup lang="ts">
import { ref } from 'vue'
import { useNav } from '@slidev/client'

defineProps<{ id: string; title: string }>()
const failed = ref(false)
const started = ref(false)
const container = ref<HTMLDivElement>()
const { isPrintMode } = useNav()

async function play() {
  try {
    await container.value?.querySelector('video')?.play()
  }
  catch {
    failed.value = true
  }
}

function pauseOtherVideos(event: Event) {
  started.value = true
  for (const video of document.querySelectorAll('video')) {
    if (video !== event.target)
      video.pause()
  }
}
</script>

<template>
  <div ref="container" class="demo-video" @click.stop @keydown.stop>
    <SlidevVideo
      :src="`/videos/${id}.mp4`"
      :poster="`/videos/${id}.png`"
      :aria-label="title"
      :data-video-id="id"
      :controls="true"
      preload="metadata"
      playsinline
      @play="pauseOtherVideos"
      @error="failed = true"
    />
    <button v-if="!isPrintMode && !started && !failed" class="demo-video-start" :aria-label="`播放${title}`" @click="play">▶ 播放视频</button>
    <p v-if="failed" class="demo-video-error" role="alert">视频暂时无法加载，请刷新后重试。</p>
  </div>
</template>
