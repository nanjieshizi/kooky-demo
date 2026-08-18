<template>
  <el-dialog
    :model-value="modelValue"
    title="开源协议说明"
    width="480px"
    :before-close="handleClose"
    class="license-dialog"
    :show-close="false"
    append-to-body
  >
    <!-- <template #close-icon>
      <img :src="closeIcon" class="dialog-close-icon" alt="close" />
    </template> -->
    <template #header="{ close, titleId, titleClass }">
      <div class="my-header">
        <div class="dialog-title">开源协议说明</div>
        <img :src="closeIcon" class="dialog-close-icon" alt="close" @click="close"/>
      </div>
    </template>

    <div class="license-content">
      <img :src="mitLicenseIcon" class="license-icon" alt="MIT License" />
      <p class="license-text">
        所有在平台上发布的 Agent 均采用 MIT-0 协议。可免费使用、修改和重新分发。无需署名。
      </p>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <MarketCustomButton 
          @click="handleClose"
        >取消</MarketCustomButton>
        <MarketCustomButton 
          variant="dark"
          @click="handleClose"
        >确定</MarketCustomButton>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElDialog } from 'element-plus'
import mitLicenseIcon from '@/assets/market/myupload/mit-license.svg'
import closeIcon from '@/assets/market/myupload/close.svg'
import mitBg from '@/assets/market/myupload/mit-bg.png'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function handleClose() {
  emit('update:modelValue', false)
}
</script>

<style lang="scss" scoped>
.license-dialog {
  :deep(.el-dialog) {
    border-radius: 12px;
    position: relative;
    overflow: hidden;
  }

  :deep(.el-dialog__header) {
    padding: 20px 24px;
    border-bottom: 1px solid #eceef3;
    position: relative;
    z-index: 1;
  }

  :deep(.el-dialog__title) {
    font-family: 苹方;
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
    text-align: justify; /* 浏览器可能不支持 */
    letter-spacing: normal;
    /* 文本色&图标色/--color-text-primary */
    /* 样式描述：一级文本色 */
    color: #2F3547;
  }

  :deep(.el-dialog__body) {
    padding: 32px 24px;
    position: relative;
    z-index: 1;
  }

  :deep(.el-dialog__footer) {
    padding: 16px 24px;
    border-top: 1px solid #eceef3;
    position: relative;
    z-index: 1;
  }

  :deep(.el-dialog__headerbtn) {
    width: 24px;
    height: 24px;
  }

  .my-header {
    display: flex;
    justify-content: space-between;
  }

  .dialog-title {
    font-family: 苹方;
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
    text-align: justify; /* 浏览器可能不支持 */
    letter-spacing: normal;
    /* 文本色&图标色/--color-text-primary */
    /* 样式描述：一级文本色 */
    color: #2F3547;
  }
  .dialog-close-icon {
    width: 12px;
    height: 12px;
  }

  .license-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .cancel-btn {
    width: 58px;
    height: 32px;
    border-radius: 6px;
    box-sizing: border-box;
    border: 1px solid #E6E6E6;
    font-family: 苹方;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    text-align: justify; /* 浏览器可能不支持 */
    letter-spacing: normal;
    /* 文本色&图标色/--color-text-primary */
    /* 样式描述：一级文本色 */
    color: #2F3547;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }

  .confirm-btn {
    width: 58px;
    height: 32px;
    border-radius: 6px;
    /* 图标色 */
    background: #171B26;
    font-family: 苹方;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    text-align: justify; /* 浏览器可能不支持 */
    letter-spacing: normal;
    color: #FFFFFF;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }

  .license-icon {
    width: 82px;
    height: 56px;
    margin-bottom: 24px;
  }

  .license-text {
    font-size: 14px;
    line-height: 22px;
    color: #606572;
    margin: 0;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  :deep(.el-button--primary) {
    background: #171B26 !important;
    border-color: #171B26 !important;
    border-radius: 6px !important;

    &:hover {
      background: #2e323c !important;
      border-color: #2e323c !important;
    }
  }
}
</style>

<style lang="scss">
.license-dialog.el-dialog {
  position: relative;
  overflow: hidden;
  background: url('@/assets/market/myupload/mit-bg.png') no-repeat center / cover;
  background-color: #FFFFFF;
}
</style>
