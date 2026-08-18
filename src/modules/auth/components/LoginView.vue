<template>
  <div class="login-page" :class="{ 'is-visible': visible }">
    <div class="login-container">
      <!-- Left: Branding -->
      <div class="login-branding">
        <div class="branding-content">
          <h1 class="brand-title">Kooky</h1>
          <p class="brand-tagline">
            极简智能工作空间，将 AI 深度融入你的日常工作流
          </p>

          <div class="feature-list">
            <div class="feature-item">
              <span class="feature-icon">🔒</span>
              <div class="feature-text">
                <strong>个人与团队的完美隔离</strong>
                <span>私有空间与协作空间独立管理，数据安全有保障</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🤖</span>
              <div class="feature-text">
                <strong>丰富的 Agent 生态</strong>
                <span>海量智能体开箱即用，覆盖研发、设计、运营等场景</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">💬</span>
              <div class="feature-text">
                <strong>自然语言驱动一切</strong>
                <span>用对话的方式完成复杂任务，无需学习成本</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Login Card -->
      <div class="login-card">
        <div class="card-inner">
          <h2 class="card-title">欢迎回来</h2>
          <p class="card-subtitle">登录以继续使用 Kooky</p>

          <button class="btn-sso" @click="handleSsoLogin">
            <svg class="btn-sso-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            集团账号登录
          </button>

          <div class="divider">
            <span class="divider-text">或</span>
          </div>

          <button class="btn-guest" @click="handleGuestLogin">
            访客体验
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ssoLogin, getTicket, getServiceUrl, cleanTicketFromUrl } from '@/modules/auth/sso'
import { exchangeTicket } from '@/modules/auth/service'
import { useUserStore } from '@/modules/auth/store'

const router = useRouter()
const userStore = useUserStore()
const visible = ref(false)

function handleSsoLogin() {
  ssoLogin()
}

function handleGuestLogin() {
  userStore.setUserInfo({
    name: '访客用户',
    userName: 'guest',
    avatar: '',
    role: 'guest',
  })
  router.push({ name: 'Home' })
}

async function handleTicketLogin(ticket) {
  try {
    const service = getServiceUrl()
    const res = await exchangeTicket(service)
    cleanTicketFromUrl()

    if (res?.data) {
      userStore.setUserInfo(res.data)
      router.replace({ name: 'Home' })
    }
  } catch (err) {
    console.error('[LoginView] Ticket exchange failed:', err)
    cleanTicketFromUrl()
  }
}

onMounted(() => {
  requestAnimationFrame(() => {
    visible.value = true
  })

  const ticket = getTicket()
  if (ticket) {
    handleTicketLogin(ticket)
  }
})
</script>

<style scoped>
.login-page {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.8s ease;
}

.login-page.is-visible {
  opacity: 1;
}

/* Layout */
.login-container {
  display: flex;
  width: 960px;
  max-width: 95vw;
  min-height: 540px;
  border-radius: var(--radius-lg, 16px);
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
  animation: card-enter 0.6s ease 0.2s both;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Branding (Left) */
.login-branding {
  flex: 1.2;
  display: flex;
  align-items: center;
  padding: 48px;
  background: linear-gradient(160deg, #ffffff 0%, #f8fafc 100%);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

.branding-content {
  animation: slide-up 0.7s ease 0.4s both;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.brand-title {
  font-size: 36px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 12px 0;
  letter-spacing: 1px;
  background: linear-gradient(135deg, #1a1a1a 0%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-tagline {
  font-size: 15px;
  color: #666;
  margin: 0 0 40px 0;
  line-height: 1.6;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: background 0.3s ease, border-color 0.3s ease;
}

.feature-item:hover {
  background: rgba(99, 102, 241, 0.04);
  border-color: rgba(99, 102, 241, 0.1);
}

.feature-icon {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.feature-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feature-text strong {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.feature-text span {
  font-size: 12px;
  color: #999;
  line-height: 1.5;
}

/* Login Card (Right) */
.login-card {
  flex: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  background: #ffffff;
}

.card-inner {
  width: 100%;
  max-width: 300px;
  animation: slide-up 0.7s ease 0.5s both;
}

.card-title {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.card-subtitle {
  font-size: 14px;
  color: #666;
  margin: 0 0 36px 0;
}

.btn-sso {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 10px;
  background: #6366f1;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
}

.btn-sso:hover {
  background: #4f46e5;
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.35);
}

.btn-sso:active {
  transform: translateY(0);
}

.btn-sso-icon {
  flex-shrink: 0;
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 28px 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.divider-text {
  font-size: 12px;
  color: #999;
}

/* Guest button */
.btn-guest {
  display: block;
  width: 100%;
  height: 42px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  background: transparent;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.btn-guest:hover {
  color: #1a1a1a;
  border-color: rgba(0, 0, 0, 0.2);
  background: rgba(0, 0, 0, 0.02);
}

/* Responsive */
@media (max-width: 768px) {
  .login-container {
    flex-direction: column;
    min-height: auto;
  }

  .login-branding {
    padding: 32px 24px;
    border-right: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .login-card {
    padding: 32px 24px;
  }

  .brand-title {
    font-size: 28px;
  }

  .feature-list {
    gap: 12px;
  }
}
</style>
