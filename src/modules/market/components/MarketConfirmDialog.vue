<template>
  <el-dialog
    v-model="visible"
    width="420px"
    :show-close="false"
    align-center
    append-to-body
    class="market-confirm-dialog"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header-left">
          <el-icon class="warning-icon"><WarningFilled /></el-icon>
          <span class="dialog-title">{{ title }}</span>
        </div>
        <button class="dialog-close" @click="handleClose">
          <img :src="closeIcon" width="16" height="16" alt="关闭" />
        </button>
      </div>
    </template>
    <div class="dialog-content">
      {{ content }}
    </div>
    <template #footer>
      <div class="dialog-footer">
        <MarketCustomButton @click="handleClose">
          取消
        </MarketCustomButton>
        <MarketCustomButton :variant="confirmVariant" @click="handleConfirm">
          {{ confirmText }}
        </MarketCustomButton>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'
import MarketCustomButton from './MarketCustomButton.vue'
import closeIcon from '@/assets/home/close.svg'

defineOptions({ name: 'MarketConfirmDialog' })

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  confirmText: {
    type: String,
    default: '确定',
  },
  confirmVariant: {
    type: String,
    default: 'dark',
    validator: (v) => v === 'default' || v === 'dark' || v === 'danger',
  },
})

const emit = defineEmits(['confirm'])

const visible = ref(false)

function open() {
  visible.value = true
}

function close() {
  visible.value = false
}

function handleClose() {
  close()
}

function handleConfirm() {
  emit('confirm')
  close()
}

defineExpose({
  open,
  close,
})
</script>

<style lang="scss" scoped>

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;

  &-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.warning-icon {
  font-size: 20px;
  color: #ff7d00;
  flex-shrink: 0;
}

.dialog-title {
  font-family: 苹方-简;
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  letter-spacing: normal;
  /* 文本色&图标色/--color-text-primary */
  /* 样式描述：一级文本色 */
  color: #2F3547;
}

.dialog-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.dialog-content { 
  padding-left: 32px;
  font-family: 苹方-简;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  display: flex;
  align-items: center;
  letter-spacing: normal;
  /* 文本色&图标色/--color-text-secondary */
  /* 样式描述：二级文本色 */
  color: #606572;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

<style>

.market-confirm-dialog {
  padding: 20px 24px 24px 24px;
  border-radius: 12px;

  /* .el-dialog__header {
    padding: 24px 24px 16px;
  }

  .el-dialog__body {
    padding: 0 24px 24px;
  }

  .el-dialog__footer {
    padding: 0 24px 24px;
  } */
}

</style>
