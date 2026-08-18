<template>
  <div v-if="show" class="messages-wrapper remote-typing-block">
    <div class="message-item assistant remote-typing-row">
      <div class="assistant-block">
        <div class="assistant-aside">
          <div class="assistant-avatar is-thinking">
            <div class="avatar-ring" aria-hidden="true" />
            <img
              :src="avatarSrc"
              alt=""
              :class="['avatar-img', isDigital ? 'avatar-img--digital' : 'avatar-img--human']"
              @error="$emit('avatar-error', $event)"
            />
            <span class="avatar-name">{{ avatarName }}</span>
          </div>
          <div class="loading-indicator">
            <div class="loading-dots">
              <span /><span /><span />
            </div>
            <span class="loading-text">正在思考....</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
  avatarSrc: { type: String, default: '' },
  avatarName: { type: String, default: '' },
  isDigital: { type: Boolean, default: false },
})
defineEmits(['avatar-error'])
</script>

<style lang="scss" scoped>
.messages-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px;
  box-sizing: border-box;
}

.remote-typing-block {
  margin-top: 24px;
  margin-bottom: 24px;
}

.remote-typing-row {
  display: flex;
  gap: 10px;
  animation: remoteTypingAppear 0.3s ease-out;
  align-items: flex-start;
}

@keyframes remoteTypingAppear {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.assistant-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
  margin-top: 2px;
}

.assistant-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-shrink: 0;
  gap: 16px;
}

.assistant-avatar {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
}

.avatar-name {
  margin-left: 10px;
  line-height: 1.2;
  white-space: nowrap;
  font-family: PingFang SC, sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #3d3d3d;
}

.avatar-ring {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 25px;
  height: 25px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    #f386be 25%,
    #8478fa 50%,
    #77c9fb 75%,
    transparent 100%
  );
  -webkit-mask: radial-gradient(transparent 10.5px, #000 10.75px, #000 12px, transparent 12.25px);
  mask: radial-gradient(transparent 10.5px, #000 10.75px, #000 12px, transparent 12.25px);
}

.assistant-avatar.is-thinking .avatar-ring {
  opacity: 1;
  animation: avatarSpin 1.2s linear infinite;
}

@keyframes avatarSpin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

.avatar-img {
  position: relative;
  // z-index: 1;
  flex-shrink: 0;
  object-fit: cover;
}

.avatar-img--digital {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 0;
}

.avatar-img--human {
  width: 34px;
  height: 34px;
  border-radius: 50%;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(180deg, #ff7809 0%, #ff9e43 99%);
  animation: loadingBounce 1.4s ease-in-out infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes loadingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}

.loading-text {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
