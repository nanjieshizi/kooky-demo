<template>
  <!-- 新建 Agent 开发项目弹窗：头像 + 名称 + 版本 -->
  <el-dialog
    :model-value="showCreateModal"
    title="新建智能体"
    width="520px"
    align-center
    append-to-body
    :close-on-click-modal="true"
    modal-class="factory-create-modal-overlay"
    class="factory-create-modal"
    @close="handleClose"
  >
    <div class="factory-create-form">
      <!-- 头像选择：内置头像库，横向滚动 -->
      <div class="form-row form-row--avatar">
        <label class="form-label">头像</label>
        <div class="avatar-field">
          <div class="avatar-field__track">
            <button
              v-for="item in builtinAvatars"
              :key="item.id"
              type="button"
              class="avatar-option"
              :class="{ active: selectedAvatar === item.src }"
              @click="selectedAvatar = item.src"
            >
              <img :src="item.src" class="avatar-option__img" alt="" />
            </button>
          </div>
        </div>
      </div>

      <!-- 项目名称：必填 + 字数计数 -->
      <div class="form-row">
        <label class="form-label required">智能体名称</label>
        <div class="text-field">
          <input
            v-model="projectName"
            class="text-input"
            type="text"
            maxlength="32"
            placeholder="请输入智能体名称，例如：请假智能体"
          />
          <span class="text-count">{{ projectName.length }}/32</span>
        </div>
      </div>

      <!-- 版本：输入框，默认 V1.0.0 -->
      <div class="form-row">
        <label class="form-label required">版本</label>
        <div class="text-field">
          <input
            v-model="version"
            class="text-input"
            type="text"
            maxlength="16"
            placeholder="V1.0.0"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <button type="button" class="btn-cancel" @click="handleClose">取消</button>
        <button
          type="button"
          class="btn-confirm"
          :disabled="!canConfirm"
          @click="handleConfirm"
        >
          创建
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactoryCreateModal' })

const factoryStore = useFactoryStore()
const { showCreateModal } = storeToRefs(factoryStore)

// 内置头像库
const builtinAvatars = factoryStore.builtinAvatars
const DEFAULT_VERSION = 'V1.0.0'

// 表单状态
const projectName = ref('')
const selectedAvatar = ref(builtinAvatars[0]?.src || null)
const version = ref(DEFAULT_VERSION)

// 名称必填：去除首尾空白后非空才允许提交
const canConfirm = computed(() => projectName.value.trim().length > 0)

// 重置表单到初始状态
function resetForm() {
  projectName.value = ''
  selectedAvatar.value = builtinAvatars[0]?.src || null
  version.value = DEFAULT_VERSION
}

// 关闭弹窗（取消、遮罩、关闭按钮统一走这里）
function handleClose() {
  factoryStore.closeCreateModal()
}

// 确认创建：调用 store 创建项目并关闭弹窗
function handleConfirm() {
  if (!canConfirm.value) return
  factoryStore.createProject({
    name: projectName.value.trim(),
    avatar: selectedAvatar.value,
    version: version.value.trim() || DEFAULT_VERSION,
  })
  factoryStore.closeCreateModal()
}

// 弹窗关闭后重置表单，避免下次打开时残留上次输入
watch(showCreateModal, (visible) => {
  if (!visible) resetForm()
})
</script>

<style scoped lang="scss">
.factory-create-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.form-row .form-label {
  width: 72px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
  color: #2f3547;
  text-align: left;
  white-space: nowrap;
}

.form-row > :not(.form-label) {
  flex: 1;
  min-width: 0;
}

.form-row--avatar {
  align-items: flex-start;
}

.form-row--avatar .form-label {
  padding-top: 33px;
}

.form-label.required::after {
  content: '*';
  margin-left: 2px;
  color: #f56c6c;
}

/* 头像选择：横向滚动 */
.avatar-field {
  width: 100%;
  min-width: 0;
  min-height: 84px;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 8px;
  background: #f7f8fb;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(47, 53, 71, 0) transparent;
}

.avatar-field:hover {
  scrollbar-color: rgba(47, 53, 71, 0.28) transparent;
}

.avatar-field::-webkit-scrollbar {
  height: 6px;
}

.avatar-field::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: transparent;
}

.avatar-field:hover::-webkit-scrollbar-thumb {
  background: rgba(47, 53, 71, 0.22);
}

.avatar-field__track {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 16px;
  width: max-content;
  min-height: 54px;
}

/* 54x54 圆形按钮，激活态用渐变描边 */
.avatar-option {
  width: 54px;
  height: 54px;
  flex: 0 0 54px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.avatar-option:hover {
  background: #fff;
}

.avatar-option.active {
  border: 1px solid transparent;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
}

.avatar-option__img {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #fff;
  object-fit: cover;
  display: block;
}

/* 名称输入框 */
.text-field {
  position: relative;
}

.text-input {
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  padding: 0 54px 0 16px;
  font-size: 14px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  outline: none;
  color: #0a0e23;
  background: #fff;
  transition: all 0.2s;
}

.text-input:focus {
  border-color: #ff9566;
  background: #fff;
}

.text-input::placeholder {
  font-size: 14px;
  color: rgba(10, 14, 35, 0.2);
}

.text-count {
  position: absolute;
  right: 10px;
  top: 8px;
  color: rgba(47, 53, 71, 0.28);
  font-size: 10px;
  pointer-events: none;
}

/* 版本卡片 */
.version-list {
  display: flex;
  gap: 8px;
}

.version-card {
  flex: 1;
  min-width: 0;
  position: relative;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid #dfe2ea;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.version-card:hover {
  border-color: transparent;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(270deg, #ff8670 23%, #c69fed 75%, #81befc 100%) border-box;
}

.version-card.active {
  border-color: transparent;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(270deg, #ff8670 23%, #c69fed 75%, #81befc 100%) border-box;
}

.version-name {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
  line-height: 20px;
}

.version-desc {
  font-size: 12px;
  color: rgba(47, 53, 71, 0.5);
  line-height: 16px;
}

/* 底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}

.btn-cancel,
.btn-confirm {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f2f3f5;
  color: #2f3547;
}

.btn-cancel:hover {
  background: #e6e8eb;
}

.btn-confirm {
  background: #1c1a21;
  color: #fff;
}

.btn-confirm:not(:disabled):hover {
  background: #2e323c;
}

.btn-confirm:disabled {
  cursor: not-allowed;
  opacity: 0.3;
  background: #0c1018;
}
</style>

<style lang="scss">
/* 弹窗整体样式覆盖：与 CreateDigitalEmployeeDialog 风格一致 */
.factory-create-modal-overlay.el-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
}

.factory-create-modal-overlay .el-overlay-dialog {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0;
  padding: 0;
  max-height: 100%;
  overflow: hidden;
}

.el-dialog.factory-create-modal {
  box-sizing: border-box;
  border-radius: 10px;
  margin: 0 auto !important;
  position: relative;
  top: auto !important;
  transform: none !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  padding: 24px;

  .el-dialog__header {
    flex-shrink: 0;
    margin-right: 0;
    padding-bottom: 16px;
  }

  .el-dialog__title {
    font-size: 16px;
    font-weight: 600;
    color: #2f3547;
  }

  .el-dialog__headerbtn {
    pointer-events: auto;
    cursor: pointer;
    z-index: 10;
  }

  .el-dialog__headerbtn:hover {
    background: rgba(23, 27, 38, 0.06);
    border-radius: 6px;
  }

  .el-dialog__headerbtn .el-dialog__close {
    color: #606572;
    font-size: 18px;
  }

  .el-dialog__body {
    flex: 1;
    min-height: 0;
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .el-dialog__footer {
    flex-shrink: 0;
    padding: 16px 0 0;
  }
}
</style>
