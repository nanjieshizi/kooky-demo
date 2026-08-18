<template>
  <div class="builtin-tag-picker">
    <p v-if="showHint" class="builtin-tag-picker__hint">
      从下方选择标签，可多选
    </p>
    <div class="builtin-tag-picker__chips" role="group" aria-label="标签选项">
      <span
        v-for="label in BUILTIN_CATEGORY_TAGS"
        :key="label"
        class="builtin-tag-picker__chip"
        :class="{ 'is-active': isSelected(label) }"
        role="button"
        tabindex="0"
        :aria-pressed="isSelected(label) ? 'true' : 'false'"
        @click="toggle(label)"
        @keydown.enter.prevent="toggle(label)"
        @keydown.space.prevent="toggle(label)"
      >
        {{ label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BUILTIN_CATEGORY_TAGS } from '../constants/builtinCategoryTags'

const { showHint = false } = defineProps<{
  /** 为 false 时隐藏顶部说明 */
  showHint?: boolean
}>()

const model = defineModel<string[]>({ default: () => [] })

const selected = computed(() => (Array.isArray(model.value) ? model.value : []))

function isSelected(label: string) {
  return selected.value.includes(label)
}

function toggle(label: string) {
  const cur = [...selected.value]
  const i = cur.indexOf(label)
  if (i >= 0) {
    cur.splice(i, 1)
  } else {
    cur.push(label)
  }
  model.value = cur
}
</script>

<style lang="scss" scoped>
.builtin-tag-picker {
  // max-width: 588px;
  max-width: 949px;
}

.builtin-tag-picker__hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 18px;
  color: #8f959e;
}

.builtin-tag-picker__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.builtin-tag-picker__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 28px;
  color: #2f3547;
  background: #f7f8fa;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s, color 0.15s;
  vertical-align: middle;

  /* 未选中时悬停：与选中态同款视觉，便于感知可点与结果 */
  &:not(.is-active):hover {
    color: #ff684e;
    background: #ffeeeb;
  }

  &:focus-visible {
    outline: 2px solid #436ff6;
    outline-offset: 2px;
  }

  &.is-active {
    color: #ff684e;
    background: #ffeeeb;
  }
}
</style>
