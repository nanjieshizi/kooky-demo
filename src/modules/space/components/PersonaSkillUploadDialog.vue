<template>
  <el-dialog
    v-model="visible"
    title="创建Skill"
    :width="dialogWidth"
    :append-to-body="true"
    :destroy-on-close="true"
    :close-on-click-modal="uploadState === 'idle'"
    class="persona-skill-upload-dialog"
  >
    <div class="upload-dialog__body" :class="{ 'is-editing': uploadState === 'editing' }">
      <!-- 初始上传界面 -->
      <div v-if="uploadState === 'idle'" class="upload-initial">
        <img :src="uploadBgIcon" class="upload-bg">
        <div class="main-title">上传 Skill 工程包</div>
        <div class="sub-title">支持上传压缩包或选择本地文件夹</div>
        <div
          class="upload-area"
          :class="{ 'is-dragover': isDragover }"
          @dragover.prevent="isDragover = true"
          @dragleave.prevent="isDragover = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <input
            ref="fileInputRef"
            type="file"
            accept=".zip"
            class="visually-hidden"
            @change="handleFileChange"
          />
          <div class="upload-area__text">
            <div class="upload-area__primary">
              <img class="upload-btn-icon" :src="uploadBtn">点击或拖拽文件到此区域上传
            </div>
            <div class="upload-area__secondary">支持 .zip 格式</div>
          </div>
        </div>
      </div>

      <!-- 上传/检测中 -->
      <div v-else-if="uploadState === 'uploading' || uploadState === 'validating'" class="upload-progress">
        <div class="progress-title">{{ uploadState === 'uploading' ? '上传中...' : '检测中...' }}</div>
        <div class="progress-subtitle">{{ uploadState === 'uploading' ? '正在上传文件到服务器' : '正在检测工程包规范' }}</div>
        <el-progress :percentage="progressPercent" :show-text="false" class="progress-bar" />
        <div class="progress-items">
          <div
            v-for="item in progressItems"
            :key="item.name"
            class="progress-item"
            :class="`is-${item.status}`"
          >
            <el-icon class="progress-item__icon">
              <CircleCheck v-if="item.status === 'success'" />
              <img v-else-if="item.status === 'error'" :src="errorIcon" class="error-icon-sm" />
              <Loading v-else-if="item.status === 'loading'" class="rotating" />
              <span v-else class="circle-pending"></span>
            </el-icon>
            <span class="progress-item__name">{{ item.name }}</span>
          </div>
        </div>
      </div>

      <!-- 检测失败结果 -->
      <div v-else-if="uploadState === 'result'" class="upload-result">
        <div class="box">
          <div class="result-title">
            <img :src="errorIcon" class="error-icon">检测失败
          </div>
          <div class="result-subtitle">{{ validateResult?.message || '请修正后重新上传' }}</div>
          <div class="validation-list">
            <div
              v-for="item in progressItems"
              :key="item.name"
              class="validation-item"
              :class="{ 'is-success': item.status === 'success', 'is-error': item.status === 'error' }"
            >
              <el-icon class="validation-item__icon">
                <CircleCheck v-if="item.status === 'success'" />
                <CircleClose v-else-if="item.status === 'error'" />
                <Loading v-else />
              </el-icon>
              <span class="validation-item__name">{{ item.name }}</span>
              <span v-if="item.message" class="validation-item__message">{{ item.message }}</span>
            </div>
          </div>
        </div>
        <div class="result-actions">
          <el-button @click="visible = false">取消上传</el-button>
          <el-button class="re-upload" type="primary" @click="resetUpload">重新上传</el-button>
        </div>
      </div>

      <!-- 校验通过：进入编辑表单 -->
      <PersonaSkillEditForm
        v-else-if="uploadState === 'editing'"
        class="upload-dialog__edit"
        :file="uploadedFile"
        :initial-data="uploadQueryData"
        :agent-id="agentId"
        @cancel="visible = false"
        @remove="resetUpload"
        @success="handleEditSaveSuccess"
      />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleClose, Loading } from '@element-plus/icons-vue'
import { validateSkill } from '@/modules/market/my-uploads/services/myUploadsApi'
import PersonaSkillEditForm from './PersonaSkillEditForm.vue'
import uploadBgIcon from '@/assets/market/myupload/upload-bg.svg'
import uploadBtn from '@/assets/market/myupload/upload-btn.svg'
import errorIcon from '@/assets/market/myupload/error.svg'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agentId: { type: [Number, String], default: null },
})
const emit = defineEmits(['update:modelValue', 'skill-uploaded'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const fileInputRef = ref(null)
const isDragover = ref(false)
const uploadState = ref('idle')
const progressPercent = ref(0)
const validateResult = ref(null)
const uploadedFile = ref(null)
const uploadQueryData = ref({})

const dialogWidth = computed(() => uploadState.value === 'editing' ? '600px' : '560px')

const STEP_NAMES = ['文件格式检测', '目录结构检测', '配置文件检测', '依赖项检测', '安全扫描', '完整性校验']
const progressItems = ref([])

function isValidFile(file) {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    ElMessage.warning('仅支持 .zip 格式')
    return false
  }
  return true
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (file && isValidFile(file)) startUpload(file)
  e.target.value = ''
}

function handleDrop(e) {
  isDragover.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && isValidFile(file)) startUpload(file)
}

async function startUpload(file) {
  progressItems.value = STEP_NAMES.map(name => ({ name, status: 'pending' }))
  uploadState.value = 'uploading'
  progressPercent.value = 0

  let uploadInterval = null
  try {
    progressItems.value[0].status = 'loading'
    uploadInterval = setInterval(() => {
      if (progressPercent.value < 90) progressPercent.value += 10
    }, 200)

    const result = await validateSkill(file)
    clearInterval(uploadInterval)
    progressPercent.value = 100

    validateResult.value = result
    progressItems.value.forEach(item => { item.status = 'success' })

    if (result.success) {
      // 校验通过：保留文件与解析结果，切换到编辑表单
      uploadedFile.value = file
      uploadQueryData.value = {
        packageName: result.packageName || '',
        displayName: result.displayName || '',
        version: result.version || '',
        description: result.description || '',
        tags: Array.isArray(result.tags) ? result.tags.join(',') : '',
        existingSlug: result.packageName || '',
      }
      ElMessage.success('检测通过')
      uploadState.value = 'editing'
    } else {
      uploadState.value = 'result'
    }
  } catch (error) {
    if (uploadInterval) clearInterval(uploadInterval)
    progressPercent.value = 100
    const responseData = error.response?.data
    if (error.response?.status === 400 && responseData) {
      validateResult.value = responseData
      progressItems.value.forEach(item => { item.status = 'error' })
      uploadState.value = 'result'
    } else {
      // 优先从 detail 字段获取错误消息，兼容 message/msg/error 字段
      const responseData = error.response?.data
      const errMsg = responseData?.detail || responseData?.message || responseData?.msg || responseData?.error || error.message || '上传失败，请稍后重试'
      ElMessage.error(errMsg)
      uploadState.value = 'idle'
    }
  }
}

async function handleEditSaveSuccess(payload) {
  emit('skill-uploaded', payload)
  visible.value = false
  resetUpload()
}

function resetUpload() {
  uploadState.value = 'idle'
  validateResult.value = null
  progressPercent.value = 0
  progressItems.value = []
  uploadedFile.value = null
  uploadQueryData.value = {}
}

watch(visible, (v) => {
  if (!v) resetUpload()
})
</script>

<style lang="scss" scoped>
.upload-dialog__body {
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0 16px;

  &.is-editing {
    min-height: 0;
    padding: 0;
    align-items: stretch;
    justify-content: flex-start;
  }
}

.upload-dialog__edit {
  width: 100%;
}

.upload-initial {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.upload-bg {
  width: 112px;
  height: 106px;
}

.main-title {
  margin-top: 16px;
  font-size: 20px;
  font-weight: 500;
  color: #2F3547;
  margin-bottom: 8px;
}

.sub-title {
  font-size: 13px;
  color: #606572;
  margin-bottom: 24px;
}

.upload-area {
  cursor: pointer;
  width: 100%;
  height: 130px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #FFFFFF;
  border: 1px dashed #DFE2EA;
  transition: all 0.2s;
  box-sizing: border-box;

  &:hover,
  &.is-dragover {
    border-color: #436FF6;
    background: rgba(67, 111, 246, 0.04);
  }
}

.upload-area__text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.upload-area__primary {
  font-size: 14px;
  font-weight: 500;
  color: #2F3547;
  display: flex;
  align-items: center;

  .upload-btn-icon {
    width: 16px;
    height: 16px;
    margin-right: 8px;
  }
}

.upload-area__secondary {
  font-size: 12px;
  color: #8F959E;
}

.visually-hidden {
  display: none;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.progress-title {
  font-size: 18px;
  font-weight: 500;
  color: #2F3547;
  margin-bottom: 8px;
}

.progress-subtitle {
  font-size: 13px;
  color: #8F959E;
  margin-bottom: 20px;
}

.progress-bar {
  width: 100%;
}

.progress-items {
  width: 100%;
  margin-top: 20px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #F7F8FA;
  border: 1px solid #DFE2EA;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
}

.progress-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #8F959E;
  transition: color 0.3s;

  &.is-success { color: #2F3547; }
  &.is-loading { color: #FF5233; }
  &.is-error { color: #FF684E; }
}

.progress-item__icon {
  font-size: 16px;
  flex-shrink: 0;

  .is-success & { color: #52C41A; }
  .is-loading & { color: #FF5233; }
  .is-error & { color: #FF684E; }
  .is-pending & { color: #C2C3C9; }
}

.circle-pending {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.3px solid #C2C3C9;
}

.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.upload-result {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 16px;
  gap: 12px;
  border-radius: 12px;
  background: #FFFAF9;
  box-sizing: border-box;
  border: 1px solid #FFC9C2;
  overflow: hidden;

  .box {
    width: 100%;
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

.result-title {
  font-size: 15px;
  font-weight: 600;
  color: #ED4543;
  display: flex;
  align-items: center;
}

.error-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-right: 8px;
}

.error-icon-sm {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.result-subtitle {
  font-size: 13px;
  font-weight: 500;
  color: #ED4543;
}

.validation-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.validation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #F7F8FA;
  border: 1px solid #ECEEF3;

  &.is-success {
    background: #F0F9F4;
    border-color: #D4EDDA;
  }

  &.is-error {
    background: #FEF5F5;
    border-color: #FECACA;
  }
}

.validation-item__icon {
  font-size: 18px;
  flex-shrink: 0;

  .is-success & { color: #52C41A; }
  .is-error & { color: #ED4543; }
}

.validation-item__name {
  font-size: 13px;
  font-weight: 500;
  color: #2F3547;
  flex-shrink: 0;
}

.validation-item__message {
  font-size: 12px;
  color: #FF684E;
  flex: 1;
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;

  .el-button {
    margin: 0;
    border-radius: 6px;
  }

  .re-upload {
    background-color: #171B26;
    border-color: #171B26;
  }
}
</style>

<style>
.persona-skill-upload-dialog .el-dialog__body {
  padding: 0 24px 24px;
}
</style>
