<template>
  <IframeContainer :src="iframeUrl" />
</template>

<script setup>
import { computed } from 'vue'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import IframeContainer from '@/shared/components/IframeContainer/IframeContainer.vue'

const iframeUrl = computed(() => `${getOneBaseUrl()}/fe-super-assistant-web/community`)
</script>
