<template>
  <!-- standalone stub: 简化附件展示,避免拉 markdown / katex / mermaid 等大依赖 -->
  <div v-if="attachments && attachments.length" class="maac-stub">
    <div v-for="(a, i) in attachments" :key="i" class="att">
      <span class="ico">📄</span>
      <span class="name">{{ a?.name || a?.url || a?.title || '附件' }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({ attachments: { type: Array, default: () => [] } })
</script>

<style scoped>
.maac-stub {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}
.att {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  font-size: 12px;
  color: #4e5969;
  width: fit-content;
}
.ico { font-size: 13px; }
</style>
