<template>
  <div class="auth-callback">
    <div v-if="status === 'loading'" class="message">登录中...</div>
    <div v-else-if="status === 'success'" class="message success">登录成功，正在跳转...</div>
    <div v-else-if="status === 'error'" class="message error">
      {{ errorMsg }}
      <p><router-link to="/">返回首页</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/modules/auth/store'
import { post } from '@/shared/utils/request'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const status = ref('loading')
const errorMsg = ref('')

onMounted(async () => {
  const code = route.query.code
  const state = route.query.state

  if (!code) {
    status.value = 'error'
    errorMsg.value = '未收到授权码，请重新扫码登录。'
    return
  }

  // 在 iframe 中打开（无跳转无弹窗方案）：把 code 回传给父窗口，由父窗口兑换并登录
  if (typeof window !== 'undefined' && window.self !== window.top) {
    try {
      window.parent.postMessage(
        { type: 'xfchat-oauth-code', code, state },
        window.location.origin
      )
      status.value = 'success'
      errorMsg.value = ''
    } catch (e) {
      status.value = 'error'
      errorMsg.value = '回传授权码失败，请重试。'
    }
    return
  }

  // 弹窗模式：把 code 回传给 opener 并关闭
  if (typeof window !== 'undefined' && window.opener) {
    try {
      window.opener.postMessage(
        { type: 'xfchat-oauth-code', code, state },
        window.location.origin
      )
      window.close()
    } catch (e) {
      status.value = 'error'
      errorMsg.value = '回传授权码失败，请重试。'
    }
    return
  }

  // 整页跳转：用 request 调本域后端换用户信息（避免 CORS），再存 store 并跳转首页
  const baseConfig = typeof window !== 'undefined' && window.BASEDB ? window.BASEDB : {}
  const exchangeUrl = baseConfig.VITE_XFCHAT_EXCHANGE_URL

  if (exchangeUrl) {
    try {
      const res = await post(exchangeUrl, { code, state })
      const data = res?.data ?? res
      const name = data.name || data.userName || ''
      const userName = data.userName || data.name || data.open_id || name
      if (!name && !userName) throw new Error(data.message || data.msg || '获取用户信息失败')
      userStore.setUserInfo({
        name,
        userName,
        avatar: data.avatar ?? data.avatar_url ?? data.headUrl ?? '',
        role: data.role ?? 'user',
        ...(data.open_id && { open_id: data.open_id }),
        ...(data.union_id && { union_id: data.union_id })
      })
      status.value = 'success'
      setTimeout(() => router.replace('/'), 800)
    } catch (e) {
      status.value = 'error'
      const isCors = e?.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('CORS'))
      errorMsg.value = isCors
        ? '请求被拒绝（CORS）：请将 VITE_XFCHAT_EXCHANGE_URL 配置为本域后端相对路径（如 /apis/auth/xfchat-exchange）。'
        : (e?.message || e?.msg || '登录失败，请重试。')
    }
  } else {
    status.value = 'error'
    errorMsg.value = '请配置 VITE_XFCHAT_EXCHANGE_URL 为本域后端接口（相对路径），避免 CORS。'
  }
})
</script>

<style scoped>
.auth-callback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}
.message {
  font-size: 16px;
  color: #333;
}
.message.success { color: #67c23a; }
.message.error { color: #f56c6c; }
.message a { color: var(--el-color-primary); }
</style>
