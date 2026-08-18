<template>
  <div class="upload-view">
    <!-- 编辑阶段：隐藏上传页面的面包屑，由编辑组件自己渲染面包屑 -->
    <template v-if="uploadState === 'editing'">
      <SkillEditView
        v-if="uploadType === 'skill'"
        :uploaded-file="uploadedFile"
        :upload-query-data="uploadQueryData"
        @save-success="handleSaveSuccess"
        @back="handleBackToUpload"
      />
      <AvatarEditView
        v-else
        :uploaded-file="uploadedFile"
        :upload-query-data="uploadQueryData"
        @save-success="handleSaveSuccess"
        @back="handleBackToUpload"
      />
    </template>

    <!-- 上传阶段 -->
    <template v-else>
      <Breadcrumb :items="breadcrumbItems" />
      <div class="upload-view__body">
        <img :src="uploadBgIcon" class="upload-bg">
        <div class="main-title">上传 {{ typeLabel }} 工程包</div>

        <!-- 初始上传界面 -->
        <div v-if="uploadState === 'idle'" class="upload-initial">
          <!-- <div class="sub-title">支持上传压缩包或选择本地文件夹</div> -->
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
              :accept="fileAccept"
              class="visually-hidden"
              @change="handleFileChange"
            />
            <div class="upload-area__text">
              <div class="upload-area__primary">
                <img class="upload-btn" :src="uploadBtn">点击/拖拽文件或压缩包到此区域
              </div>
              <div class="upload-area__secondary">{{ fileFormatHint }}</div>
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
                <img v-else-if="item.status === 'error'" :src="errorIcon" class="error-icon" />
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
            <div class="result-subtitle">{{ (validateResult as any)?.message || '请修正后重新上传' }}</div>
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
            <MarketCustomButton @click="handleCancel">取消上传</MarketCustomButton>
            <MarketCustomButton variant="dark" @click="resetUpload">重新上传</MarketCustomButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleClose, Loading } from '@element-plus/icons-vue'
import Breadcrumb from '@/shared/components/Breadcrumb.vue'
import MarketCustomButton from '../../components/MarketCustomButton.vue'
import SkillEditView from './SkillEditView.vue'
import AvatarEditView from './AvatarEditView.vue'
import { uploadAndValidatePackage } from '../services/myUploadsApi'
import type { AgentValidateResult, SkillValidateResult } from '../types'
import uploadBgIcon from '@/assets/market/myupload/upload-bg.svg'
import uploadBtn from '@/assets/market/myupload/upload-btn.svg'
import errorIcon from '@/assets/market/myupload/error.svg'

const router = useRouter()
const route = useRoute()

const uploadType = computed(() => (route.meta?.uploadType as string) || 'skill')
const typeLabel = computed(() => uploadType.value === 'agent' ? '数字人' : 'Skill')

const breadcrumbItems = computed(() => [
  // { label: '我的上传', to: '/market/my-uploads' },
  { label: `创建${typeLabel.value}` },
])

const isAgentUpload = computed(() => uploadType.value === 'agent')
const fileAccept = computed(() => isAgentUpload.value ? '.zip,.gz' : '.zip')
const fileFormatHint = computed(() =>
  isAgentUpload.value ? '支持 .zip、.tar.gz 格式文件（最大50MB）' : '支持 .zip 格式'
)
const MAX_AGENT_FILE_SIZE = 50 * 1024 * 1024

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragover = ref(false)
const uploadState = ref<'idle' | 'uploading' | 'validating' | 'result' | 'editing'>('idle')
const progressPercent = ref(0)
const validateResult = ref<AgentValidateResult | SkillValidateResult | null>(null)

// 校验成功后保存的文件引用，传给编辑组件用于保存时提交
const uploadedFile = ref<File | null>(null)
// 校验结果中解析出的表单初始数据，传给编辑组件
const uploadQueryData = ref<Record<string, any>>({})

const STEP_NAMES = ['文件格式检测', '目录结构检测', '配置文件检测', '依赖项检测', '安全扫描', '完整性校验']

interface ProgressItem {
  name: string
  status: 'pending' | 'loading' | 'success' | 'error'
  message?: string
}

const progressItems = ref<ProgressItem[]>([])

// 版本编辑模式：携带 editSlug 参数时直接进入编辑表单，跳过上传阶段
onMounted(() => {
  if (route.query.editSlug) {
    uploadState.value = 'editing'
  }
})

function isValidFile(file: File): boolean {
  const name = file.name.toLowerCase()
  if (isAgentUpload.value) {
    if (!name.endsWith('.zip') && !name.endsWith('.tar.gz')) {
      ElMessage.warning('数字人工程包仅支持 .zip、.tar.gz 格式')
      return false
    }
    if (file.size > MAX_AGENT_FILE_SIZE) {
      ElMessage.warning('文件大小不能超过 50MB')
      return false
    }
  } else {
    if (!name.endsWith('.zip')) {
      ElMessage.warning('仅支持 .zip 格式')
      return false
    }
  }
  return true
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file && isValidFile(file)) {
    selectedFile.value = file
    startUpload()
  }
  ;(e.target as HTMLInputElement).value = ''
}

function handleDrop(e: DragEvent) {
  isDragover.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && isValidFile(file)) {
    selectedFile.value = file
    startUpload()
  }
}

async function startUpload() {
  if (!selectedFile.value) return

  progressItems.value = STEP_NAMES.map(name => ({ name, status: 'pending' as const }))
  uploadState.value = 'uploading'
  progressPercent.value = 0

  let uploadInterval: ReturnType<typeof setInterval> | null = null

  try {
    progressItems.value[0].status = 'loading'
    uploadInterval = setInterval(() => {
      if (progressPercent.value < 90) progressPercent.value += 10
    }, 200)

    const result = await uploadAndValidatePackage(selectedFile.value, uploadType.value as 'agent' | 'skill')
    clearInterval(uploadInterval)
    progressPercent.value = 100

    const validate = result.validate
    validateResult.value = validate
    progressItems.value.forEach(item => { item.status = 'success' })

    if (validate.success) {
      // 保存文件引用和解析出的表单数据，传给编辑组件
      uploadedFile.value = selectedFile.value
      uploadQueryData.value = {
        packageName: validate.packageName || '',
        displayName: validate.displayName || '',
        version: validate.version || '',
        description: validate.description || '',
        tags: validate.tags?.join(',') || '',
        existingSlug: (validate as any).packageName || '',
        skills: (validate as any).skills || [],
        skillsInfo: (validate as any).skillsInfo || [],
        skillId: route.query.skillId || '',
        // 如果路由中有 slug 参数（从详情页跳转），优先使用它作为 Skill ID
        slug: route.query.slug || '',
        // 从详情页「上传新版本」跳转时携带，用于回填默认值
        latestVersionId: route.query.latestVersionId || '',
        prevAvatar: route.query.prevAvatar || '',
        prevTags: route.query.prevTags || '',
        prevVersion: route.query.prevVersion || '',
        // 数字人上传新版本时携带，用于加载历史版本做冲突校验
        agentId: route.query.agentId || '',
      }
      ElMessage.success('检测通过')
      uploadState.value = 'editing'
    } else {
      uploadState.value = 'result'
    }
  } catch (error: any) {
    if (uploadInterval) clearInterval(uploadInterval)
    progressPercent.value = 100
    const responseData = error.response?.data
    if (error.response?.status === 400 && responseData) {
      validateResult.value = responseData
      progressItems.value.forEach(item => { item.status = 'error' })
      uploadState.value = 'result'
    } else {
      // 优先从 detail 字段获取错误消息，兼容 message/msg/error 字段
      const errMsg = responseData?.detail || responseData?.message || responseData?.msg || responseData?.error || error.message || '上传失败，请稍后重试'
      ElMessage.error(errMsg)
      uploadState.value = 'idle'
    }
  }
}

function resetUpload() {
  uploadState.value = 'idle'
  selectedFile.value = null
  validateResult.value = null
  uploadedFile.value = null
  uploadQueryData.value = {}
  progressPercent.value = 0
}

function handleBackToUpload() {
  resetUpload()
}

function handleSaveSuccess() {
  router.push(route.meta?.uploadType === 'agent' ? '/market/avatar' : '/market/skill')
}

function handleCancel() {
  router.push(route.meta?.uploadType === 'agent' ? '/market/avatar' : '/market/skill')
}
</script>

<style lang="scss" scoped>
.el-button {
  margin: 0;
  border-radius: 6px;
}
.re-upload {
  background-color: #171B26;
  border-color: #171B26;
}
.upload-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.upload-view__body {
  flex: 1;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.upload-initial {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 600px;
}

.upload-bg {
  width: 112px;
  height: 106px;
}

.main-title {
  margin-top: 16px;
  font-size: 24px;
  font-weight: 500;
  color: #2F3547;
  margin-bottom: 32px;
}

.sub-title {
  font-size: 14px;
  color: #606572;
  margin-bottom: 32px;
}

.upload-area {
  cursor: pointer;
  width: 576px;
  height: 140px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #FFFFFF;
  border: 1px dashed #DFE2EA;
  transition: all 0.2s;

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
  font-size: 15px;
  font-weight: 500;
  color: #2F3547;
  display: flex;
  align-items: center;

  .upload-btn {
    width: 16px;
    height: 16px;
    margin-right: 8px;
  }
}

.upload-area__secondary {
  font-size: 13px;
  color: #8F959E;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 400px;
}

.progress-title {
  font-size: 20px;
  font-weight: 500;
  color: #2F3547;
  margin-bottom: 8px;
}

.progress-subtitle {
  font-size: 14px;
  color: #8F959E;
  margin-bottom: 24px;
}

.progress-bar {
  width: 100%;
}

.progress-items {
  width: 576px;
  margin-top: 24px;
  padding: 16px 20px;
  border-radius: 12px;
  background: #F7F8FA;
  border: 1px solid #DFE2EA;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #8F959E;
  transition: color 0.3s;

  &.is-success { color: #2F3547; }
  &.is-loading { color: #FF5233; }
  &.is-error { color: #FF684E; }
}

.progress-item__icon {
  font-size: 18px;
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
  width: 576px;
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
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: #ED4543;
  display: flex;
  align-items: center;
}

.result-subtitle {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #ED4543;
}

.validation-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

.validation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
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
  font-size: 20px;
  flex-shrink: 0;

  .is-success & { color: #52C41A; }
}

.error-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #ED4543;
  margin-right: 8px;
}

.validation-item__name {
  font-size: 14px;
  font-weight: 500;
  color: #2F3547;
  flex-shrink: 0;
}

.validation-item__message {
  font-size: 13px;
  color: #FF684E;
  flex: 1;
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}

.visually-hidden {
  display: none;
}
</style>
