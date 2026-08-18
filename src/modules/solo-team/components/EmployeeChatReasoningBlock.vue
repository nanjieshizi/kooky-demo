<template>
  <div class="reasoning-block">
    <button
      type="button"
      class="reasoning-block__toggle"
      :class="{ 'is-open': expanded }"
      @click="expanded = !expanded"
    >
      <SvgIcon name="icon-Skill" :size="14" color="#8b8fa0" class="reasoning-block__icon" />
      <span class="reasoning-block__label">
        {{ isStreaming ? '思考中…' : '已深度思考' }}
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
      <MarkdownContent :content="content" :is-streaming="isStreaming" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import MarkdownContent from '@/shared/components/MarkdownContent.vue'

const props = defineProps({
  content: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
  /** 默认是否展开；流式思考时默认展开，流式结束后折叠 */
  defaultOpen: { type: Boolean, default: false },
})

const expanded = ref(props.defaultOpen || props.isStreaming)

// 流式思考结束后自动折叠（与 deer-flow 对齐体验）
watch(
  () => props.isStreaming,
  (streaming, prevStreaming) => {
    if (prevStreaming && !streaming) {
      expanded.value = false
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

  &__icon {
    flex-shrink: 0;
  }

  &__label {
    flex: 1;
    text-align: left;
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
    color: #5a6072;
    font-size: 13px;
    line-height: 1.7;
    background: #FAFBFC;

    :deep(p) {
      margin: 0 0 6px;
    }
    :deep(p:last-child) {
      margin-bottom: 0;
    }
  }
}
</style>
