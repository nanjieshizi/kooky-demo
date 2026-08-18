<template>
  <div class="one-person-thinking" role="status" aria-live="polite">
    <div class="one-person-thinking__dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    <span class="one-person-thinking__text">正在思考...</span>
  </div>
</template>

<script setup>
defineOptions({ name: 'OnePersonThinkingIndicator' })
</script>

<style scoped>
.one-person-thinking {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 18px 0 26px 44px;
  color: #9aa1b2;
  animation: onePersonThinkingFadeIn 0.24s ease 0.2s both;
}

.one-person-thinking__dots {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 48px;
}

.one-person-thinking__dots span {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: linear-gradient(180deg, #ffc49d 0%, #ff9a54 100%);
  animation: onePersonThinkingBounce 1.4s ease-in-out infinite;
}

.one-person-thinking__dots span:nth-child(2) {
  animation-delay: 0.18s;
}

.one-person-thinking__dots span:nth-child(3) {
  animation-delay: 0.36s;
}

.one-person-thinking__text {
  font-size: 14px;
  line-height: 22px;
  font-style: italic;
  color: #9aa1b2;
}

@keyframes onePersonThinkingBounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.45;
  }

  30% {
    transform: translateY(-6px);
    opacity: 1;
  }
}

@keyframes onePersonThinkingFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
