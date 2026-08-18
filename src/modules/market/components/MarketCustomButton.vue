<template>
  <div
    class="market-custom-button"
    :class="[variantClass, sizeClass, { 'is-disabled': disabled }]"
    @click="handleClick"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * 市场区自定义按钮：div 包裹，双主题、两种高度（默认 32 / small 28）；
 * 悬停/按下色通过根节点 CSS 变量覆盖（见 <style> 注释）
 */
defineOptions({ name: 'MarketCustomButton' })

const props = defineProps({
  /** 默认：白底描边；dark：深色主题；danger：危险操作红色主题 */
  variant: {
    type: String,
    default: 'default',
    validator: (v) => v === 'default' || v === 'dark' || v === 'danger',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  /** 默认 32px 高；`small` 为 28px 高 */
  size: {
    type: String,
    default: 'default',
    validator: (v) => v === 'default' || v === 'small',
  },
})

const emit = defineEmits(['click'])

const variantClass = computed(() => {
  if (props.variant === 'dark') return 'market-custom-button--dark'
  if (props.variant === 'danger') return 'market-custom-button--danger'
  return 'market-custom-button--default'
})

const sizeClass = computed(() =>
  props.size === 'small' ? 'market-custom-button--sm' : 'market-custom-button--md',
)

function handleClick(e) {
  if (props.disabled) {
    e.preventDefault()
    return
  }
  emit('click', e)
}

</script>

<style lang="scss" scoped>
/* 外层可在根节点设 CSS 变量，覆盖单页色；命名见各变体内 var() */
.market-custom-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;

  &:focus-visible {
    outline: none;
    outline-offset: 1px;
  }

  &.is-disabled {
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.5;
  }

  &--md {
    min-height: 32px;
    height: 32px;
  }

  &--sm {
    min-height: 28px;
    height: 28px;
  }

  /* 白底描边 */
  &--default {
    background: #ffffff;
    border: 1px solid #dfe2ea;
    color: #2F3547;

    &:hover:not(.is-disabled) {
      background: var(--mcb-default-hover-bg, #f5f6f9);
      border: 1px solid var(--mcb-default-hover-border, #dfe2ea);
      color: var(--mcb-default-hover-color, #2f3574);
    }

    &:active:not(.is-disabled) {
      background: var(--mcb-default-active-bg, #f5f6f9);
      border: 1px solid var(--mcb-default-active-border, #dfe2ea);
      color: var(--mcb-default-active-color, #2f3574);
    }
  }

  /* 主题黑：常态 / 无描边；悬停 #2E323C；按下 #171B26 */
  &--dark {
    background: #171b26;
    border: none;
    color: #ffffff;

    &:hover:not(.is-disabled) {
      background: var(--mcb-dark-hover-bg, #2e323c);
      border: none;
      color: var(--mcb-dark-hover-color, #ffffff);
    }

    &:active:not(.is-disabled) {
      background: var(--mcb-dark-active-bg, #171b26);
      border: none;
      color: var(--mcb-dark-active-color, #ffffff);
    }
  }

  /* 危险操作：红色背景白字 */
  &--danger {
    background: #ed4543;
    border: none;
    color: #ffffff;

    &:hover:not(.is-disabled) {
      background: var(--mcb-danger-hover-bg, #d93c3a);
      border: none;
      color: var(--mcb-danger-hover-color, #ffffff);
    }

    &:active:not(.is-disabled) {
      background: var(--mcb-danger-active-bg, #c23533);
      border: none;
      color: var(--mcb-danger-active-color, #ffffff);
    }
  }
}
</style>
