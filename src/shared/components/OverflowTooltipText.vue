<template>
  <el-tooltip
    class="overflow-tooltip"
    :class="{ 'overflow-tooltip--flex': flex }"
    :content="text"
    placement="top"
    effect="dark"
    :show-after="300"
    :disabled="!isOverflowing"
    append-to="#app"
  >
    <component :is="tag" ref="elRef" class="overflow-tooltip-text" :class="customClass">
      <slot>{{ text }}</slot>
    </component>
  </el-tooltip>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useOverflowDetect } from '@/composables/useOverflowDetect'

defineOptions({ name: 'OverflowTooltipText' })

const props = defineProps({
  text: { type: String, default: '' },
  tag: { type: String, default: 'span' },
  customClass: { type: [String, Object, Array], default: '' },
  /** 置于 flex 行内时占满剩余宽度，省略号才能生效 */
  flex: { type: Boolean, default: false },
})

const elRef = ref(null)
const textDep = computed(() => props.text)
const { isOverflowing } = useOverflowDetect(elRef, textDep)
</script>

<style scoped>
.overflow-tooltip {
  display: inline-block;
  max-width: 100%;
  min-width: 0;
  vertical-align: bottom;
  overflow: hidden;
}

.overflow-tooltip--flex {
  display: block;
  flex: 1 1 0;
  min-width: 0;
  max-width: 100%;
}

.overflow-tooltip :deep(.el-tooltip__trigger) {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.overflow-tooltip-text {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
