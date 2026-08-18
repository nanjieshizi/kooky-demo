<template>
  <div class="factory-context-hint" :class="`hint-${type}`">
    <span class="hint-emoji">{{ typeMeta.emoji }}</span>
    <span class="hint-message">{{ message }}</span>
    <button class="hint-close" type="button" aria-label="关闭" @click="handleDismiss">
      ✕
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactoryContextHint' })

const props = defineProps({
  id: { type: String, required: true },
  type: { type: String, default: 'default' },
  message: { type: String, default: '' },
})

const factoryStore = useFactoryStore()

// 类型映射：emoji + 左侧色条
const TYPE_MAP = {
  agent_ready: { emoji: '✅', accent: '#10b981' },   // 绿
  db_created: { emoji: '🗄️', accent: '#3b82f6' },   // 蓝
  skill_added: { emoji: '🧩', accent: '#8b5cf6' },  // 紫
  knowledge_done: { emoji: '📚', accent: '#f59e0b' }, // 橙
  default: { emoji: '💡', accent: '#9ca3af' },        // 灰
}

const typeMeta = computed(() => TYPE_MAP[props.type] || TYPE_MAP.default)

function handleDismiss() {
  factoryStore.dismissContextHint(props.id)
}
</script>

<style scoped lang="scss">
.factory-context-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-left: 3px solid v-bind('typeMeta.accent');
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #2f3547;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.hint-emoji {
  flex: 0 0 auto;
  font-size: 14px;
  line-height: 1;
}

.hint-message {
  flex: 1 1 auto;
  word-break: break-word;
  font-size: 13px;
}

.hint-close {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: #91949e;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: #2f3547;
  }
}
</style>
