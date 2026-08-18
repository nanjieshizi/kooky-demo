<template>
  <img
    v-if="previewUrl"
    :src="previewUrl"
    :alt="file?.name || ''"
    class="matrix-attachment-preview-img"
    loading="lazy"
  />
  <img
    v-else-if="fallbackSrc"
    :src="fallbackSrc"
    class="matrix-attachment-preview-fallback"
    alt=""
  />
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useMatrixAttachmentDownload } from '@/modules/chat/useMatrixAttachmentDownload'

const props = defineProps({
  file: { type: Object, default: null },
  /** 无预览或加载失败时显示的类型图标 */
  fallbackSrc: { type: String, default: '' },
})

const { fetchAttachmentPreviewObjectUrl, revokeAttachmentPreviewUrl } =
  useMatrixAttachmentDownload()

const previewUrl = ref('')
let activeBlobUrl = ''
let loadGen = 0

async function loadPreview() {
  const gen = ++loadGen
  revokeAttachmentPreviewUrl(activeBlobUrl)
  activeBlobUrl = ''
  previewUrl.value = ''

  const url = props.file?.url
  if (!url) return

  const blobUrl = await fetchAttachmentPreviewObjectUrl(props.file)
  if (gen !== loadGen) {
    revokeAttachmentPreviewUrl(blobUrl)
    return
  }
  if (blobUrl) {
    activeBlobUrl = blobUrl
    previewUrl.value = blobUrl
  }
}

watch(
  () => [props.file?.url, props.file?.name],
  () => {
    void loadPreview()
  },
  { immediate: true },
)

onUnmounted(() => {
  loadGen += 1
  revokeAttachmentPreviewUrl(activeBlobUrl)
  activeBlobUrl = ''
})
</script>

<style scoped>
.matrix-attachment-preview-img {
  display: block;
  max-width: 100%;
  max-height: 220px;
  width: auto;
  height: auto;
  object-fit: contain;
}

.matrix-attachment-preview-fallback {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
</style>
