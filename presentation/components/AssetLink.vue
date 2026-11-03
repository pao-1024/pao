<script setup lang="ts">
defineProps<{ path: string }>()
const base = import.meta.env.BASE_URL
</script>

<template>
  <a :href="`${base}${path}`" target="_blank" rel="noopener noreferrer"><slot /></a>
</template>
