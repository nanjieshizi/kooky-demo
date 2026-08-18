<template>
  <div class="status-filter-wrap">
    <div
      ref="tagsRef"
      class="status-filter"
      :class="{ 'is-expanded': expanded }"
    >
      <span
        v-for="item in options"
        :key="item.value"
        class="status-filter__tag"
        :class="{ 'is-active': modelValue === item.value }"
        @click="$emit('update:modelValue', item.value)"
      >
        {{ item.label }}
      </span>
    </div>
    <button
      v-if="hasOverflow"
      type="button"
      class="status-filter__expand-btn"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收起' : '更多' }}
      <img
        class="status-filter__expand-arrow"
        :src="expanded ? upIcon : downIcon"
        alt=""
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { StatusFilter } from '../types'
// @ts-ignore
import upIcon from '../../avatar/components/images/up.svg'
// @ts-ignore
import downIcon from '../../avatar/components/images/down.svg'

defineProps<{
  modelValue: StatusFilter
}>()

defineEmits<{
  'update:modelValue': [value: StatusFilter]
}>()

const options: { label: string; value: StatusFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '已发布', value: 'active' },
  { label: '审核中', value: 'online_review' },
  { label: '未发布', value: 'draft' },
  { label: '已驳回', value: 'rejected' },
  { label: '已下架', value: 'offline' },
]

const tagsRef = ref<HTMLElement | null>(null)
const hasOverflow = ref(false)
const expanded = ref(false)

const SINGLE_ROW_HEIGHT = 34

function checkOverflow() {
  const el = tagsRef.value
  if (!el) {
    hasOverflow.value = false
    return
  }
  if (expanded.value) {
    hasOverflow.value = true
    return
  }
  const prev = el.style.maxHeight
  el.style.maxHeight = `${SINGLE_ROW_HEIGHT}px`
  const overflows = el.scrollHeight - el.clientHeight > 1
  el.style.maxHeight = prev
  hasOverflow.value = overflows
}

let ro: ResizeObserver | null = null

onMounted(() => {
  checkOverflow()
  if (typeof ResizeObserver !== 'undefined' && tagsRef.value) {
    ro = new ResizeObserver(checkOverflow)
    ro.observe(tagsRef.value)
  }
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})
</script>

<style lang="scss" scoped>
.status-filter-wrap {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.status-filter {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  overflow: hidden;
  max-height: 34px;
  transition: max-height 0.25s ease;

  &.is-expanded {
    max-height: 200px;
  }
}

.status-filter__tag {
  box-sizing: border-box;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 12px;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  color: #2f3547;
  background: transparent;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;

  &.is-active {
    color: #ff6d40;
    background: #ffeeeb;
    font-weight: 600;
  }
}

.status-filter__expand-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 8px;
  font-size: 13px;
  color: #606572;
  background: transparent;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s;

  &:hover {
    color: #2f3547;
  }
}

.status-filter__expand-arrow {
  width: 14px;
  height: 14px;
}
</style>
