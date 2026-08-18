<template>
  <div class="collab-thinking">
    <div class="dots">
      <span class="dot" />
      <span class="dot" />
      <span class="dot" />
    </div>
    <span class="text">{{ text }}</span>
  </div>
</template>

<script setup>
defineOptions({ name: 'CollabThinkingIndicator' })

defineProps({
  text: { type: String, default: '团队助手正在思考…' },
})
</script>

<style scoped>
.collab-thinking {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: linear-gradient(90deg, #F7F9FF 0%, #EEF3FE 50%, #F7F9FF 100%);
  background-size: 200% 100%;
  animation: shimmer 2s ease-in-out infinite;
  border-radius: 8px;
  color: #4E5969;
  font-size: 13px;
}

.dots {
  display: inline-flex;
  gap: 3px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #436FF6;
  animation: bounce 1.2s infinite ease-in-out;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

@keyframes shimmer {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
</style>
