<template>
  <el-dialog
    v-model="visible"
    title="更新确认"
    width="500px"
    :close-on-click-modal="false"
    class="update-confirm-dialog"
    @close="handleClose"
    append-to-body
  >
    <div class="confirm-content">
      <!-- 背景图 -->
      <div class="confirm-bg"></div>

      <!-- 警告提示 -->
      <div class="custom-alert">
        <img src="../assets/warn-icon.svg" class="alert-icon" alt="" />
        <span class="alert-text">更新后，你手动修改的提示词和风格设置将被覆盖，仅保留名称，请确认后进行更新</span>
      </div>

      <!-- 基本信息卡片 -->
      <div class="info-card">
        <div class="card-header">
          <div class="avatar-wrapper">
            <img :src="data.avatar || defaultAvatarIcon" class="avatar" alt="" @error="e => e.target.src = defaultAvatarIcon" />
          </div>
          <div class="card-info">
            <h3 class="card-title">{{ data?.name }}</h3>
            <p class="description" v-if="data.fromAgentName">来自 @{{ data.source }} 发布的 <span class="from-agent-link" @click="goToAgentDetail">{{ data.fromAgentName }}</span></p>
          </div>
        </div>
      </div>

      <!-- 更新日志 -->
      <div v-if="data?.changelog" class="update-log-section">
        <h3 class="log-title">更新日志</h3>
        <p class="log-content">{{ data.changelog }}</p>
      </div>

    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">暂不更新</el-button>
        <el-button type="primary" @click="handleConfirm">确认更新</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { ElDialog, ElButton } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import defaultAvatarIcon from '../assets/ava/m01@2x.png'
const router = useRouter()
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  data: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

function handleClose() {
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('cancel')
  handleClose()
}

function handleConfirm() {
  emit('confirm')
  handleClose()
}

function goToAgentDetail() {
  if (!props.data.fromAgentSlug  || props.data.isBuiltin) return
  if (props.data.type === 'selfBuilt') {
    router.push({ name: 'MyAvatarDetail', params: { id: props.data.fromAgentSlug }, query: { from: 'my-uploads' } })
  } else {
    router.push({ name: 'AvatarDetail', params: { id: props.data.fromAgentSlug } })
  }
}
</script>

<style lang="scss" scoped>
.confirm-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.confirm-bg {
  display: none;
}

.custom-alert,
.info-card,
.update-log-section {
  position: relative;
  z-index: 1;
}

.custom-alert {
  display: flex;
  align-items: center;
  padding: 9px 16px;
  gap: 8px;
  border-radius: 12px;
  background: rgba(255, 104, 78, 0.08);
  box-sizing: border-box;
  border: 1px solid #FFBAAD;
}

.alert-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.alert-text {
  font-family: 苹方-简;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  letter-spacing: normal;
  /* 文本色&图标色/--color-text-primary */
  /* 样式描述：一级文本色 */
  color: #2F3547;
}

.info-card {
  
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-wrapper {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-title {
  margin: 0 0 4px;
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}

.card-from {
  margin: 0;
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  /* 来自 @技术中心运营 发布的 */
  color: #91949E
}

.update-log-section {
  .log-title {
    margin: 0 0 8px;
    font-family: PingFang SC;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    text-align: justify; /* 浏览器可能不支持 */
    letter-spacing: normal;
    /* 文本色&图标色/三级文本色 */
    color: #91949E;
  }
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-item {
  padding: 12px;
  background: #f5f6f8;
  border-radius: 6px;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.log-version {
  font-size: 13px;
  font-weight: 600;
  color: #436ff6;
}

.log-time {
  font-size: 12px;
  color: #91949e;
}

.log-content {
  margin: 0;
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  text-align: justify; /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}
.description {
  margin: 0;
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  color: #91949E;

  .from-agent-link {
    color: #436FF6;
    cursor: pointer;

    &:hover {
      text-decoration: none;
    }
  }
}
.empty-log {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: #91949e;
  background: #f5f6f8;
  border-radius: 6px;
}

.skills-section {
  .skills-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: #141517;
  }
}

.skill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f6f8;
  border-radius: 6px;
}

.skill-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.skill-content {
  flex: 1;
  min-width: 0;
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.skill-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #141517;
}

.skill-version {
  font-size: 12px;
  color: #91949e;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 2px 8px;
  background: #e8eaed;
  border-radius: 4px;
  font-size: 11px;
  color: #5f6573;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;

  :deep(.el-button:not(.el-button--primary)) {
    color: #2F3547;

    &:hover {
      background: #F5F6F9;
      border-color: #dcdfe6;
      color: #2F3547;
    }
  }

  :deep(.el-button--primary) {
    background: #141517;
    border-color: #141517;

    &:hover {
      background: #2e323c;
      border-color: #2e323c;
    }
  }
}

</style>

<style lang="scss">
// 非 scoped：覆盖 el-dialog 样式，让背景覆盖标题区域
.update-confirm-dialog.el-dialog {
  position: relative;
  overflow: hidden;

  .el-dialog__header {
    position: relative;
    z-index: 1;
  }

  .el-dialog__title {
    position: relative;
  }

  .el-dialog__body {
    position: relative;
    z-index: 1;
    min-height: 150px;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 220px;
    background: url('../assets/confirm-bg.png') no-repeat top center / cover;
    pointer-events: none;
    z-index: 0;
  }
}
</style>
