<template>
  <div v-if="voteResult" class="flow-vote-result">
    <div v-for="option in voteResult.options" :key="option.key" class="flow-vote-result__option">
      <OverflowTooltipText
        :text="`${option.label}（${option.count}）`"
        custom-class="flow-vote-result__label"
        flex
      />
      <div class="flow-vote-result__track">
        <span class="flow-vote-result__bar" :style="{ width: `${option.percent}%` }"></span>
      </div>
      <span v-if="option.resolved" class="flow-vote-result__check">✓</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import OverflowTooltipText from '@/shared/components/OverflowTooltipText.vue'
import { getNodeVoteResult } from '../utils/flowNodePayload.mjs'

defineOptions({ name: 'FlowVoteResult' })

const props = defineProps({
  node: { type: Object, required: true },
})

const voteResult = computed(() => getNodeVoteResult(props.node))
</script>

<style scoped>
.flow-vote-result {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 8px;
  background: #F5F6FA;
  padding: 12px 18px;
  margin: 4px 0 8px;
  box-sizing: border-box;
}

.flow-vote-result__option {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 20px 5px;
  row-gap: 4px;
  padding-right: 28px;
}

.flow-vote-result :deep(.flow-vote-result__label) {
  grid-column: 1;
  grid-row: 1;
  font-size: 13px;
  line-height: 20px;
  color: #606572;
}

.flow-vote-result__check {
  position: absolute;
  right: 0;
  top: 13px;
  flex-shrink: 0;
  color: #FF5A14;
  font-size: 22px;
  line-height: 20px;
  font-weight: 600;
}

.flow-vote-result__track {
  grid-column: 1;
  grid-row: 2;
  width: 100%;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #ECEFF5;
}

.flow-vote-result__bar {
  display: block;
  height: 100%;
  min-width: 0;
  border-radius: inherit;
  background: #9198A8;
}
</style>
