<script setup>
/**
 * 市场/列表规范搜索框：背景、描边、占位与图标按设计稿；值变更防抖触发 search，回车立即搜索
 */
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import SvgIcon from './SvgIcon.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '搜索' },
  /** 输入防抖，毫秒 */
  debounceMs: { type: Number, default: 400 },
  /**
   * 输入框宽度；传数字时单位为 px，也可传 CSS 字符串如 `100%`、`12rem`
   * @type {string | number}
   */
  width: { type: [String, Number], default: 256 },
})

const emit = defineEmits(['update:modelValue', 'search'])

const local = ref(props.modelValue)
const isFocused = ref(false)

let debounceTimer = null

watch(
  () => props.modelValue,
  (v) => {
    if (v !== local.value) {
      local.value = v
    }
  },
)

const showClear = computed(
  () => isFocused.value && String(local.value ?? '').length > 0,
)

const rootStyle = computed(() => {
  const w = props.width
  const width =
    w == null || w === ''
      ? '256px'
      : typeof w === 'number'
        ? `${w}px`
        : String(w)
  return {
    width,
    maxWidth: '100%',
    boxSizing: 'border-box',
  }
})

function sync() {
  emit('update:modelValue', local.value)
}

function scheduleSearch() {
  sync()
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    emit('search', local.value)
  }, props.debounceMs)
}

function flushSearch() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  sync()
  emit('search', local.value)
}

function onInput() {
  scheduleSearch()
}

function onEnter() {
  flushSearch()
}

function onClear() {
  local.value = ''
  flushSearch()
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <el-input
    v-model="local"
    :placeholder="placeholder"
    class="market-spec-search"
    :style="rootStyle"
    clearable
    @input="onInput"
    @keydown.enter="onEnter"
    @focus="isFocused = true"
    @blur="isFocused = false"
  >
    <template #prefix>
      <span class="market-spec-search__icon-wrap" aria-hidden="true">
        <SvgIcon
          name="icon-sousuo"
          :size="14"
          color="currentColor"
        />
      </span>
    </template>
    <!-- <template #suffix>
      <button
        v-if="showClear"
        type="button"
        class="market-spec-search__clear"
        aria-label="清除"
        @mousedown.prevent
        @click="onClear"
      >
        <SvgIcon
          name="icon-qingchu"
          :size="14"
          color="currentColor"
        />
      </button>
    </template> -->
  </el-input>
</template>

<style lang="scss" scoped>
$bg: #f7f8fa;
// $bd: #dfe2ea;
$bd: #FF9566;
$ph: #c2c3c9;
$fg: #2f3547;

/* 与规范：圆角 6、浅底、hover/focus 时描边；完成编辑后仅保留文案无描边由「未 focus 且未 hover」复现 */
.market-spec-search {
  /* 宽度由 :style / width prop 控制 */
  /* 图标用规范灰，不随字色时单独控制 */
  --search-icon: #606572;
}

:deep(.el-input__wrapper) {
  box-sizing: border-box;
  width: 100%;
  min-height: 32px;
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  background: $bg;
  border: 1px solid transparent;
  box-shadow: none;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    border-color: $bd;
  }

  &.is-focus,
  &:focus-within {
    border-color: $bd;
  }
}

:deep(.el-input__inner) {
  height: 30px;
  line-height: 30px;
  font-size: 14px;
  color: $fg;

  &::placeholder {
    color: $ph;
  }
}

.market-spec-search__icon-wrap {
  display: inline-flex;
  color: var(--search-icon, #8f959e);
  align-items: center;
  justify-content: center;
  margin-right: 6px;
}

.market-spec-search__clear {
  display: inline-flex;
  margin: 0;
  margin-left: 2px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--search-icon, #c2c3c9);
  border-radius: 4px;
  line-height: 0;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    color: $fg;
  }
}
</style>
