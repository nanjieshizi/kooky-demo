<template>
  <div class="changelog">
    <div class="section-title">
      <div class="belt"></div>更新日志
    </div>
    <div class="basic-info__field">
      <span class="basic-info__label">描述</span>
      <span class="basic-info__value">{{ changelog || '-' }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  changelog: {
    type: String,
    default: '',
  },
})
</script>

<style lang="scss" scoped>

.basic-info__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.basic-info__label {
  font-size: 13px;
  color: #8f959e;
}

.basic-info__value {
  font-size: 14px;
  color: #1f2329;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
.section-title {
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  display: flex;
  align-items: center;
  letter-spacing: 0px;
  font-variation-settings: "opsz" auto;
  color: #2F3547;
  margin-bottom: 24px;

  .belt {
    background: #FF684E;
    margin-top: 2px;
    width: 3px;
    height: 14px;
    border-radius: 0px 4px 4px 0px;
    margin-right: 8px;
  }
}

.changelog__content {
  font-size: 14px;
  color: #333;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.changelog__empty {
  font-size: 14px;
  color: #8f959e;
}
</style>
