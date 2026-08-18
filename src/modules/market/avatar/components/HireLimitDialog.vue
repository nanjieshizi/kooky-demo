<template>
  <el-dialog
    class="hire-limit-el-dialog"
    :model-value="modelValue"
    width="480px"
    align-center
    :show-close="true"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="hire-limit-header">
        <div class="hire-limit-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="10" fill="#FA8C16" />
            <path
              d="M10 5.5V11M10 14H10.01"
              stroke="white"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h3 class="hire-limit-title">数字人安装数量已达上限</h3>
      </div>
    </template>

    <div class="hire-limit-body">
      <p class="hire-limit-message">
        您最多可安装 {{ maxCount }} 个数字人。请前往「我的数字人」管理卸载不再使用的数字人后，即可继续添加。
      </p>
    </div>

    <template #footer>
      <div class="hire-limit-footer">
        <el-button class="hire-limit-btn hire-limit-btn--cancel" @click="handleCancel">取消</el-button>
        <el-button class="hire-limit-btn hire-limit-btn--primary" @click="handleConfirm">去管理</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { useRouter } from 'vue-router'

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  maxCount: {
    type: Number,
    default: 20,
  },
})

const emit = defineEmits(['update:modelValue'])

const router = useRouter()

function handleCancel() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  emit('update:modelValue', false)
  router.push({ name: 'MyHired' })
}
</script>

<style lang="scss" scoped>
.hire-limit-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 36px;
}

.hire-limit-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;

  svg {
    display: block;
  }
}

.hire-limit-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  display: flex;
  align-items: center;
  letter-spacing: normal;
  /* 文本色&图标色/--color-text-primary */
  /* 样式描述：一级文本色 */
  color: #2F3547;
  text-align: left;
}

.hire-limit-body {
  padding: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-start;
}

.hire-limit-message {
  margin-left: 36px;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  display: flex;
  align-items: center;
  letter-spacing: normal;
  /* 文本色&图标色/--color-text-secondary */
  /* 样式描述：二级文本色 */
  color: #606572;
  text-align: left;
}

.hire-limit-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.hire-limit-btn {
  min-width: 72px;
  height: 34px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 14px;
}

.hire-limit-btn--cancel {
  background: #ffffff;
  border: 1px solid #eceef3;
  color: #606572;

  &:hover {
    border-color: rgba(47, 53, 71, 0.18);
    color: #2f3547;
    background: #fafbfc;
  }
}

.hire-limit-btn--primary {
  background: #202534;
  border-color: #202534;
  color: #ffffff;

  &:hover {
    background: #2f3547;
    border-color: #2f3547;
    color: #ffffff;
  }
}
</style>

<style lang="scss">
.hire-limit-el-dialog.el-dialog {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 480px !important;
  max-width: 480px;
  height: 172px;
  padding: 20px 24px 24px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(47, 53, 71, 0.12);
}

.hire-limit-el-dialog .el-dialog__header {
  position: relative;
  margin: 0;
  padding: 0;
  flex: 0 0 auto;
  border-bottom: none;
}

.hire-limit-el-dialog .el-dialog__headerbtn {
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
}

.hire-limit-el-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #91949e;
  font-size: 18px;

  &:hover {
    color: #606572;
  }
}

.hire-limit-el-dialog .el-dialog__body {
  margin: 0;
  padding: 12px 0 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hire-limit-el-dialog .el-dialog__footer {
  margin: 0;
  padding: 16px 0 0;
  flex: 0 0 auto;
}
</style>
