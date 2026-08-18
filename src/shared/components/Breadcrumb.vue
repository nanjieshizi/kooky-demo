<template>
  <div class="breadcrumb-bar">
    <button class="back-btn" @click="handleBack" @mouseenter="isBackHover = true" @mouseleave="isBackHover = false">
      <span class="back-icon" />
      <!-- <span class="back-text">返回</span> -->
    </button>
    <!-- <div class="breadcrumb-line"></div> -->
    <div ref="pathRef" class="breadcrumb-path">
      <template v-for="(item, vIdx) in foldResult.visible" :key="item._key">
        <!-- 省略号：紧跟第一项之后 -->
        <template v-if="vIdx === 1 && foldResult.showEllipsis">
          <img src="@/assets/icons/slash.svg" alt="/" class="breadcrumb-separator" />
          <el-tooltip placement="bottom" effect="dark" :show-after="200">
            <template #content>
              <div class="breadcrumb-folded-list">
                <template v-for="(fi, fIdx) in foldResult.folded" :key="fi._key">
                  <span
                    class="breadcrumb-folded-item"
                    :class="{ clickable: !!fi.to }"
                    @click="fi.to && router.push(fi.to)"
                  >{{ fi.label }}</span>
                  <span v-if="fIdx < foldResult.folded.length - 1" class="breadcrumb-folded-separator">/</span>
                </template>
              </div>
            </template>
            <span class="breadcrumb-ellipsis">
              <span class="breadcrumb-dot"></span>
              <span class="breadcrumb-dot"></span>
              <span class="breadcrumb-dot"></span>
            </span>
          </el-tooltip>
          <img src="@/assets/icons/slash.svg" alt="/" class="breadcrumb-separator" />
        </template>
        <!-- 分隔符 -->
        <img
          v-if="vIdx > 0 && !(vIdx === 1 && foldResult.showEllipsis)"
          src="@/assets/icons/slash.svg" alt="/" class="breadcrumb-separator"
        />
        <!-- 面包屑项 -->
        <el-tooltip
          v-if="itemMaxWidths[vIdx] && itemMaxWidths[vIdx] < itemNaturalWidths[vIdx]"
          :content="item.label"
          placement="bottom"
          :show-after="300"
        >
          <span
            class="breadcrumb-item"
            :class="{
              active: item._isLast,
              clickable: !item._isLast && !!item.to,
              disabled: !item._isLast && !item.to
            }"
            :style="itemMaxWidths[vIdx] ? { maxWidth: itemMaxWidths[vIdx] + 'px' } : {}"
            @click="handleItemClick(item)"
          >{{ item.label }}</span>
        </el-tooltip>
        <span
          v-else
          class="breadcrumb-item"
          :class="{
            active: item._isLast,
            clickable: !item._isLast && !!item.to,
            disabled: !item._isLast && !item.to
          }"
          :style="itemMaxWidths[vIdx] ? { maxWidth: itemMaxWidths[vIdx] + 'px' } : {}"
          @click="handleItemClick(item)"
        >{{ item.label }}</span>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
  backUrl: {
    type: String,
    default: null,
  },
})

const router = useRouter()
const pathRef = ref(null)
const containerWidth = ref(1080)
const extraFoldCount = ref(0)
const itemMaxWidths = ref({})
const itemNaturalWidths = ref({})
const isBackHover = ref(false)
// 用于测量文字宽度的 canvas
let measureCanvas = null
function getTextWidth(text) {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas')
  }
  const ctx = measureCanvas.getContext('2d')
  ctx.font = '14px "PingFang SC", sans-serif'
  return ctx.measureText(text).width
}

// 给每个 item 加上内部标记
const taggedItems = computed(() =>
  props.items.map((item, i) => ({
    ...item,
    _key: `${i}-${item.label}`,
    _origIndex: i,
    _isLast: i === props.items.length - 1,
  })),
)

// 折叠逻辑
const foldResult = computed(() => {
  const all = taggedItems.value
  const len = all.length

  if (len <= 4 && extraFoldCount.value === 0) {
    return { visible: all, folded: [], showEllipsis: false }
  }

  // 基础折叠：超过4级时，保留第一级 + 最后三级
  let visible = [...all]
  let folded = []

  if (len > 4) {
    const first = all[0]
    const foldEnd = len - 3
    folded = all.slice(1, foldEnd)
    visible = [first, ...all.slice(foldEnd)]
  }

  // 极窄宽度下的渐进折叠
  if (extraFoldCount.value > 0 && visible.length > 1) {
    const extra = Math.min(extraFoldCount.value, visible.length - 1)
    // 从 visible 中（排除最后一项/当前页）按倒数第三 → 倒数第二 → 第一的顺序折叠
    for (let i = 0; i < extra; i++) {
      if (visible.length <= 1) break
      // 找到要折叠的项：从倒数第二项开始往前
      const removeIdx = Math.max(0, visible.length - 2)
      const removed = visible.splice(removeIdx, 1)
      folded.push(...removed)
    }
  }

  // 按原始顺序排列 folded
  folded.sort((a, b) => a._origIndex - b._origIndex)

  return {
    visible,
    folded,
    showEllipsis: folded.length > 0,
  }
})

// 截断算法
function recalcTruncation() {
  const visible = foldResult.value.visible
  if (!visible.length) return

  const availableWidth = Math.min(containerWidth.value, 1080)

  // 固定开销：分隔符数量 × 24px + 省略号 24px
  const separatorCount = visible.length - 1 + (foldResult.value.showEllipsis ? 1 : 0)
  const ellipsisCost = foldResult.value.showEllipsis ? 32 : 0
  const fixedCost = separatorCount * 24 + ellipsisCost

  const usable = availableWidth - fixedCost
  if (usable <= 0) return

  // 测量每项自然宽度（文字宽度 + 左右 padding 各 4px）
  const padding = 8
  const naturalWidths = visible.map((item) => getTextWidth(item.label) + padding)
  const newNaturalWidths = {}
  naturalWidths.forEach((w, i) => { newNaturalWidths[i] = w })
  itemNaturalWidths.value = newNaturalWidths

  const totalNatural = naturalWidths.reduce((s, w) => s + w, 0)

  // 不需要截断
  if (totalNatural <= usable) {
    itemMaxWidths.value = {}
    return
  }

  const minWidth = 56 // 约4个字
  const newMaxWidths = {}
  const lastIdx = visible.length - 1

  // 阶段1：截断父级项（除最后一项）
  let saved = 0
  for (let i = 0; i < lastIdx; i++) {
    if (naturalWidths[i] > minWidth) {
      const canSave = naturalWidths[i] - minWidth
      saved += canSave
    }
  }

  const overflow = totalNatural - usable

  if (overflow <= saved) {
    // 按比例截断父级
    let remaining = overflow
    for (let i = 0; i < lastIdx; i++) {
      if (naturalWidths[i] > minWidth) {
        const canSave = naturalWidths[i] - minWidth
        const ratio = canSave / saved
        const cut = Math.min(canSave, Math.ceil(overflow * ratio))
        newMaxWidths[i] = naturalWidths[i] - cut
        remaining -= cut
      }
    }
    itemMaxWidths.value = newMaxWidths
    return
  }

  // 阶段2：父级全部截到最小，再截当前页
  for (let i = 0; i < lastIdx; i++) {
    if (naturalWidths[i] > minWidth) {
      newMaxWidths[i] = minWidth
    }
  }

  const afterParentTrunc = naturalWidths.reduce((s, w, i) => {
    return s + (i < lastIdx ? Math.min(w, minWidth) : w)
  }, 0)

  const stillOver = afterParentTrunc - usable
  if (stillOver > 0 && naturalWidths[lastIdx] > minWidth) {
    newMaxWidths[lastIdx] = Math.max(minWidth, naturalWidths[lastIdx] - stillOver)
  }

  // 检查是否仍然溢出，需要渐进折叠
  const finalTotal = visible.reduce((s, _, i) => {
    const w = newMaxWidths[i] !== undefined ? newMaxWidths[i] : naturalWidths[i]
    return s + w
  }, 0)

  if (finalTotal > usable && extraFoldCount.value < 3 && visible.length > 1) {
    extraFoldCount.value++
    nextTick(() => recalcTruncation())
    return
  }

  itemMaxWidths.value = newMaxWidths
}

// ResizeObserver
let resizeObserver = null

onMounted(() => {
  if (pathRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width
      }
      recalcTruncation()
    })
    resizeObserver.observe(pathRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

// watch items 变化重置
watch(
  () => props.items,
  () => {
    extraFoldCount.value = 0
    itemMaxWidths.value = {}
    nextTick(() => recalcTruncation())
  },
  { deep: true },
)

// watch foldResult 变化后重新计算
watch(foldResult, () => {
  nextTick(() => recalcTruncation())
})

function handleBack() {
  if (props.backUrl) {
    router.push(props.backUrl)
  } else if (props.items.length > 1 && props.items[props.items.length - 2].to) {
    router.push(props.items[props.items.length - 2].to)
  } else {
    router.back()
  }
}

function handleItemClick(item) {
  if (!item._isLast && item.to) {
    router.push(item.to)
  }
}
</script>

<style lang="scss" scoped>
.breadcrumb-bar {
  display: flex;
  align-items: center;
  height: 48px;
  padding-left: 16px;
  padding-right: 16px;
  background: #fff;
  border-bottom: 1px solid #ECEEF3;
  overflow: hidden;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  // padding: 0px 4px;
  margin-right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: #F5F6F9;
  }
}

.back-icon {
  display: inline-block;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  background-color: #91949E;
  -webkit-mask: url('@/assets/icons/back-arrow.svg') no-repeat center;
  mask: url('@/assets/icons/back-arrow.svg') no-repeat center;
  -webkit-mask-size: contain;
  mask-size: contain;
  transition: background-color 0.2s;
}

.back-btn:hover .back-icon {
  background-color: #FF684E;
}

.back-text {
  font-family: PingFang SC, sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  color: #606572;
  transition: color 0.2s;
}

.back-btn:hover .back-text {
  color: #FF684E;
}

.breadcrumb-line {
  width: 1px;
  height: 14px;
  background: #DFE2EA;
  margin: 0 12px;
  flex-shrink: 0;
}

.breadcrumb-path {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 1080px;
}

.breadcrumb-item {
  display: block;
  font-family: PingFang SC, sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  color: #91949E;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  transition: all 0.2s;
  // padding: 1px 4px;
  border-radius: 4px;

  &.clickable {
    cursor: pointer;

    &:hover {
      color: #FF684E;
      // background: #F5F6F9;
    }
  }

  &.disabled {
    color: #C0C4CC;
    cursor: default;
  }

  &.active {
    color: #2F3547;
    font-family: PingFang SC, sans-serif;
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
    // display: flex;
    align-items: center;
    letter-spacing: normal;
    flex-shrink: 1;
    min-width: 56px;
  }
}

.breadcrumb-separator {
  width: 16px;
  height: 16px;
  display: block;
  flex-shrink: 0;
  margin: 0 4px;
}

.breadcrumb-ellipsis {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  padding: 1px 4px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: #F5F6F9;
    padding: 11px 4px;
    .breadcrumb-dot {
      background: #FF684E;
    }
  }
}

.breadcrumb-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #91949E;
  transition: background 0.2s;
  flex-shrink: 0;
}

.breadcrumb-folded-list {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
}

.breadcrumb-folded-item {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 22px;
  white-space: nowrap;

  &.clickable {
    cursor: pointer;

    &:hover {
      color: #fff;
    }
  }
}

.breadcrumb-folded-separator {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
  user-select: none;
}
</style>
