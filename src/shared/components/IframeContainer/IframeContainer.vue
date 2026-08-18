<template>
  <div class="iframe-container">
    <iframe
      ref="iframeRef"
      :src="src"
      class="iframe-content"
      frameborder="0"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { getSsoToken } from '@/shared/services/api'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'

const props = defineProps({
  /** iframe 页面地址 */
  src: { type: String, required: true },
  /** 是否自动注入 SSO token（默认开启） */
  auth: { type: Boolean, default: true },
})

const iframeRef = ref(null)

// 启用 Electron 主进程的请求拦截器
async function enableAuthInjector() {
  if (!props.auth) return
  const token = getSsoToken()
  if (!token) return

  if (window.electronAPI?.iframe) {
    try {
      // 每次都更新 token，确保环境切换后使用最新的 token
      await window.electronAPI.iframe.updateToken(token)
      await window.electronAPI.iframe.enableAuthInjector(token)
    } catch (error) {
      console.error('[IframeContainer] 启用拦截器异常:', error)
    }
  }
}

// 通过 postMessage 向 iframe 传递 token
function sendTokenToIframe() {
  if (!props.auth || !iframeRef.value?.contentWindow) return
  const token = getSsoToken()
  if (token) {
    const targetOrigin = getOneBaseUrl()
    iframeRef.value.contentWindow.postMessage(
      { type: 'AUTH_TOKEN', token },
      targetOrigin
    )
  }
}

function onIframeLoad() {
  sendTokenToIframe()
}

onMounted(() => {
  enableAuthInjector()
  if (iframeRef.value) {
    iframeRef.value.addEventListener('load', onIframeLoad)
  }
})

onBeforeUnmount(() => {
  if (iframeRef.value) {
    iframeRef.value.removeEventListener('load', onIframeLoad)
  }
})

// src 变化时重新注入 token
watch(() => props.src, () => {
  enableAuthInjector()
})

// 监听环境切换（localStorage 变化不会触发 computed，需要监听 src）
// src 是 computed 的，会在环境切换后自动更新，所以上面的 watch 已经覆盖了
</script>

<style lang="scss" scoped>
.iframe-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.iframe-content {
  flex: 1;
  width: 100%;
  border: none;
}
</style>
