<template>
  <div class="reasoning-block">
    <button
      type="button"
      class="reasoning-block__toggle"
      :class="{ 'is-open': expanded }"
      @click="expanded = !expanded"
    >
      <svg class="reasoning-block__brain-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5.8 4 7 4 9c0 1.2.5 2.2 1.3 3C4.5 12.8 4 14 4 15c0 2.2 1.8 4 4 4h.5c.5 1.2 1.7 2 3 2h1c1.3 0 2.5-.8 3-2H16c2.2 0 4-1.8 4-4 0-1-.5-2.2-1.3-3 .8-.8 1.3-1.8 1.3-3 0-2-1.5-3.2-3-3.5C16.5 3.5 14.5 2 12 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="reasoning-block__label" :class="{ 'is-shimmer': isStreaming }">
        {{ labelText }}
      </span>
      <svg
        class="reasoning-block__chevron"
        :class="{ 'is-rotated': expanded }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <div v-show="expanded" class="reasoning-block__body">
      <EmployeeReasoningMarkdownContent :content="content" :is-streaming="isStreaming" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import EmployeeReasoningMarkdownContent from './EmployeeReasoningMarkdownContent.vue'

const props = defineProps({
  content: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
  defaultOpen: { type: Boolean, default: false },
  duration: { type: Number, default: 0 },
})

const expanded = ref(props.defaultOpen || props.isStreaming)

const labelText = computed(() => {
  if (props.isStreaming) return '思考中…'
  if (props.duration > 0) return `已深度思考（${props.duration} 秒）`
  return '已深度思考'
})

watch(
  () => props.isStreaming,
  (streaming, prevStreaming) => {
    if (prevStreaming && !streaming) {
      setTimeout(() => {
        expanded.value = false
      }, 1000)
    }
    if (streaming) {
      expanded.value = true
    }
  }
)
</script>

<style lang="scss" scoped>
.reasoning-block {
  margin-bottom: 8px;
  border-radius: 8px;
  background: #F7F8FA;
  border: 1px solid #ECEEF3;
  overflow: hidden;

  &__toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: #606572;
    transition: background 0.15s;

    &:hover {
      background: #EEF0F4;
    }

    &.is-open {
      border-bottom: 1px solid #ECEEF3;
    }
  }

  &__brain-icon {
    flex-shrink: 0;
    color: #8b8fa0;
  }

  &__label {
    flex: 1;
    text-align: left;

    &.is-shimmer {
      background: linear-gradient(90deg, #606572 25%, #a0a4b0 50%, #606572 75%);
      background-size: 200% 100%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: shimmer 1.5s infinite linear;
    }
  }

  &__chevron {
    color: #8b8fa0;
    transition: transform 0.2s ease;

    &.is-rotated {
      transform: rotate(180deg);
    }
  }

  &__body {
    padding: 10px 14px;
    background: #FAFBFC;
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
