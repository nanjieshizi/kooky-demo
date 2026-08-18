<template>
  <div class="onboarding-page">
    <div class="onboarding-content">
      <!-- Title image -->
      <img src="@/assets/home/guide_title.png" alt="title" class="intro-title-img" />

      <!-- Guide image -->
      <img src="@/assets/home/guide.png" alt="guide" class="guide-img" />

      <!-- AI message bubble -->
      <div class="ai-message">
        <img src="@/assets/home/heade_icon.svg" alt="crab" class="ai-avatar" />
        <div class="ai-bubble">
          你好，你可以叫我小king，也可以给我起一个心仪的名字；你希望我是什么样的合作者？
        </div>
      </div>

      <!-- Input area -->
      <div class="input-area">
        <div class="input-wrapper" :class="{ focused: inputFocused, 'has-content': inputValue.length > 0 }">
          <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="intro-input"
            placeholder="我的个性由你定义～"
            @focus="inputFocused = true"
            @blur="inputFocused = false"
            @keydown.enter="handleSubmit"
          />
          <button
            class="send-btn"
            :class="{ active: inputValue.trim().length > 0 }"
            @click="handleSubmit"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/modules/auth/store'

const router = useRouter()
const userStore = useUserStore()

const inputValue = ref('')
const inputFocused = ref(false)
const inputRef = ref(null)

function handleSubmit() {
  const value = inputValue.value.trim()
  // 允许不输入直接提交，使用默认角色
  const role = value || '多面手'
  userStore.completeOnboarding(role)
  // 保存助手名称（如果用户输入了名字相关内容）
  if (value) {
    localStorage.setItem('assistantIntro', value)
  }
  router.replace({ name: 'Home' })
}
</script>

<style scoped>
.onboarding-page {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  overflow-y: auto;
}

.onboarding-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 800px;
  padding: 0 20px 40px;
}

/* Title image (2x: 1050×164) */
.intro-title-img {
  width: 525px;
  height: 82px;
  max-width: 100%;
  margin-top: 144px;
  margin-bottom: 73px;
}

/* Guide image (2x: 1082×262) */
.guide-img {
  width: 541px;
  height: 131px;
  max-width: 100%;
  margin-bottom: 32px;
}

/* AI message */
.ai-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  max-width: 620px;
  margin-bottom: 32px;
}

.ai-avatar {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
}

.ai-bubble {
  background: #f5f5f5;
  border-radius: 0 16px 16px 16px;
  padding: 14px 18px;
  font-size: 15px;
  color: #333333;
  line-height: 1.6;
}

/* Input area */
.input-area {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 620px;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  border-radius: 28px;
  border: 1px solid #e5e7eb;
  background: #f9f9f9;
  padding: 4px 4px 4px 0;
  transition: all 0.3s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.input-wrapper.focused,
.input-wrapper.has-content {
  border-color: #d5d5d5;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.intro-input {
  flex: 1;
  height: 48px;
  padding: 0 20px;
  border: none;
  border-radius: 28px;
  background: transparent;
  font-size: 15px;
  color: #1a1a1a;
  outline: none;
  box-sizing: border-box;
}

.intro-input::placeholder {
  color: #999999;
}

/* Send button */
.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #1a1a1a;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
  opacity: 0.5;
}

.send-btn.active {
  opacity: 1;
}

.send-btn:hover {
  transform: scale(1.05);
}
</style>
