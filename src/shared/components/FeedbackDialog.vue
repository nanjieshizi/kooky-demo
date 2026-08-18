<template>
  <el-dialog
    v-model="visible"
    width="380px"
    :show-close="false"
    :close-on-click-modal="true"
    :modal="true"
    :append-to-body="true"
    :lock-scroll="false"
    class="feedback-dialog feedback-dialog-bg"
    @close="handleClose"
  >
    <button
      type="button"
      class="close-dialog-icon"
      aria-label="关闭"
      @click="handleClose"
    >
      <el-icon :size="18"><Close /></el-icon>
    </button>
    <div class="feedback-header">
      <div class="header-title">
        <div class="header-icon" aria-hidden="true">✍️</div>
        <span class="header-title-text">反馈给Kooky团队</span>
      </div>
      <div class="header-subtitle">遇到问题或有想法，直接告诉我们，也可以顺手拍一张截图</div>
    </div>

    <div class="feedback-content">
      <!-- 反馈类型选择 -->
      <div class="type-buttons">
        <button
          class="type-btn"
          :class="{ active: form.feedbackType === 'bug' }"
          @click="form.feedbackType = 'bug'"
        >
          问题
        </button>
        <button
          class="type-btn"
          :class="{ active: form.feedbackType === 'feature' }"
          @click="form.feedbackType = 'feature'"
        >
          建议
        </button>
      </div>

      <!-- 输入 + 图片 + 底栏（与稿一致：单卡片） -->
      <div class="feedback-input-panel">
        <textarea
          v-model="form.content"
          class="feedback-textarea"
          :placeholder="feedbackInputPlaceholder"
          maxlength="500"
          rows="4"
        />

        <div v-if="imageList.length" class="image-strip">
          <div
            v-for="(img, idx) in imageList"
            :key="idx"
            class="image-item"
          >
            <div class="image-item__inner">
              <img v-if="img.previewUrl" :src="img.previewUrl" alt="" />
              <div v-if="!img.previewUrl" class="image-placeholder" />
              <div v-if="img.loading" class="image-loading-overlay" aria-hidden="true">
                <span class="image-spinner" />
              </div>
            </div>
            <button
              v-if="!img.loading"
              type="button"
              class="image-close"
              aria-label="删除图片"
              @click="removeImage(idx)"
            >
              <img
                class="image-close__icon"
                :src="feedbackImageDeleteIcon"
                alt=""
                width="13"
                height="13"
                draggable="false"
              />
            </button>
          </div>

          <!-- 超过5M提示 -->
          <div v-if="oversizeWarning" class="oversize-tip">
            <img :src="feedbackOversizeWarningIcon" alt="" width="16" height="16" draggable="false" />
            <span>图片最大不能超过5M</span>
          </div>
        </div>

        <!-- 无图片时的超过5M提示 -->
        <div v-else-if="oversizeWarning" class="oversize-tip oversize-tip--standalone">
          <img :src="feedbackOversizeWarningIcon" alt="" width="16" height="16" draggable="false" />
          <span>图片最大不能超过5M</span>
        </div>

        <div class="panel-footer">
          <button
            type="button"
            class="panel-upload-btn"
            :disabled="uploading || imageList.length >= MAX_FEEDBACK_IMAGES"
            @click="triggerUpload"
          >
            <span class="panel-upload-btn__icon" aria-hidden="true">
              <img :src="feedbackUploadIcon" alt="" width="16" height="16" draggable="false" />
            </span>
            <span class="panel-upload-btn__text">上传图片({{ imageList.length }}/{{ MAX_FEEDBACK_IMAGES }})</span>
          </button>
          <span class="panel-char-count"><span class="panel-char-current">{{ form.content.length }}</span><span class="panel-char-total">/500</span></span>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          multiple
          class="visually-hidden-file"
          @change="handleFileChange"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="submit-btn"
        :class="{ active: canSubmit, submitting: submitting }"
        :disabled="!canSubmit || submitting || uploading"
        @click="handleSubmit"
      >
        <span v-if="!submitting">提交</span>
        <span v-else>提交中...</span>
      </button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { uploadFeedbackImages, submitFeedback } from '@/shared/services/feedbackService'
import feedbackImageDeleteIcon from '@/assets/home/feedback_image_delete.svg'
import feedbackOversizeWarningIcon from '@/assets/home/feedback_oversize_warning.svg'
import feedbackUploadIcon from '@/assets/home/feedback_upload_icon.svg'

const visible = defineModel('visible', { type: Boolean, default: false })

const fileInputRef = ref(null)
const submitting = ref(false)
const uploading = ref(false)

const form = reactive({
  feedbackType: 'bug',
  content: ''
})

const imageList = ref([])
const oversizeWarning = ref(false)

/** 反馈附件图片上限（与接口约定一致） */
const MAX_FEEDBACK_IMAGES = 5

const feedbackInputPlaceholder =
  '比如：这个入口位置还不错，但我希望反馈时能默认截取当前页面。'

const canSubmit = computed(() => {
  return form.content.trim().length > 0
})

function triggerUpload() {
  if (uploading.value || imageList.value.length >= MAX_FEEDBACK_IMAGES) return
  fileInputRef.value?.click()
}

async function handleFileChange(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return

  // 校验文件格式
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  const invalidFiles = files.filter(f => !allowedTypes.includes(f.type))
  if (invalidFiles.length > 0) {
    ElMessage.warning('仅支持 JPG、JPEG、PNG、WebP、GIF 格式')
    e.target.value = ''
    return
  }

  const remaining = MAX_FEEDBACK_IMAGES - imageList.value.length
  if (files.length > remaining) {
    ElMessage.warning(
      `最多只能上传 ${MAX_FEEDBACK_IMAGES} 张图片，当前还可上传 ${remaining} 张`
    )
    e.target.value = ''
    return
  }

  const validFiles = []
  const oversizedFiles = []

  for (const file of files) {
    // 大于等于5MB就阻断
    if (file.size >= 5 * 1024 * 1024) {
      oversizedFiles.push(file)
    } else {
      validFiles.push(file)
    }
  }

  console.log(`有效文件: ${validFiles.length}, 超大文件: ${oversizedFiles.length}`)

  // 如果有任何文件超过5M，全部阻断，不上传任何文件
  if (oversizedFiles.length > 0) {
    console.log('检测到超大文件，阻断上传')
    oversizeWarning.value = true
    setTimeout(() => {
      oversizeWarning.value = false
    }, 3000)
    e.target.value = ''
    return
  }

  // 只上传符合大小要求的文件（≤5MB）
  uploading.value = true
  let anySuccess = false
  try {
    for (const file of validFiles) {
      const objectUrl = URL.createObjectURL(file)
      const idx = imageList.value.length
      imageList.value.push({
        url: '',
        previewUrl: objectUrl,
        size: 0,
        error: false,
        loading: true
      })
      try {
        const res = await uploadFeedbackImages([file])
        const item = (res.data || [])[0]
        if (!item?.url) {
          throw new Error('上传返回异常')
        }
        const prev = imageList.value[idx]
        if (prev?.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(prev.previewUrl)
        }
        imageList.value[idx] = {
          url: item.url,
          previewUrl: item.url,
          size: item.size ?? file.size,
          error: false,
          loading: false
        }
        anySuccess = true
      } catch (err) {
        const prev = imageList.value[idx]
        if (prev?.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(prev.previewUrl)
        }
        imageList.value.splice(idx, 1)
        ElMessage.error(err.message || '图片上传失败')
      }
    }
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

function removeImage(idx) {
  const item = imageList.value[idx]
  if (item?.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(item.previewUrl)
  }
  imageList.value.splice(idx, 1)
}

async function getArch() {
  if (window.electronAPI?.getArch) {
    const arch = await window.electronAPI.getArch()
    console.log('[反馈] 获取 CPU 架构:', arch)
    return arch === 'x64' ? 'x86_64' : arch
  }
  return 'universal'
}

async function handleSubmit() {
  if (!canSubmit.value || submitting.value || uploading.value) return

  submitting.value = true
  try {
    const validImages = imageList.value.filter(
      (item) => !item.error && !item.loading && item.url
    )
    const imagesData = validImages.map(item => ({
      url: item.url,
      size: item.size
    }))

    // 获取客户端版本信息
    let clientVersion = ''
    let osVersion = ''
    let deviceModel = ''

    if (window.electronAPI?.updater) {
      try {
        clientVersion = await window.electronAPI.updater.getVersion()
      } catch (e) {
        console.warn('获取客户端版本失败:', e)
      }
    }

    // 获取架构信息
    const arch = await getArch()

    // 从 userAgent 解析操作系统版本
    const ua = navigator.userAgent
    if (ua.includes('Mac OS X')) {
      const match = ua.match(/Mac OS X ([\d_]+)/)
      osVersion = match ? match[1].replace(/_/g, '.') : ''
      deviceModel = arch ? `Mac (${arch})` : 'Mac'
    } else if (ua.includes('Windows NT')) {
      const match = ua.match(/Windows NT ([\d.]+)/)
      osVersion = match ? `Windows ${match[1]}` : 'Windows'
      deviceModel = arch ? `PC (${arch})` : 'PC'
    }

    await submitFeedback({
      feedback_type: form.feedbackType === 'bug' ? 1 : 2,
      content: form.content,
      images: imagesData,
      clientType: 'PC',
      clientInfo: {
        clientVersion: clientVersion || '',
        osVersion: osVersion || '',
        deviceModel: deviceModel || '',
        userAgent: navigator.userAgent,
        // ipAddress 由后端自动获取，前端不传
      }
    })

    ElMessage.success('反馈提交成功，感谢您的反馈！')
    handleClose()
  } catch (err) {
    ElMessage.error(err.message || '提交失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  visible.value = false
  form.feedbackType = 'bug'
  form.content = ''
  oversizeWarning.value = false
  imageList.value.forEach((item) => {
    if (item?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(item.previewUrl)
    }
  })
  imageList.value = []
}
</script>

<style lang="scss" scoped>
/* 确保内容在背景图之上 */
.feedback-dialog :deep(.el-dialog__header),
.feedback-dialog :deep(.el-dialog__body),
.feedback-dialog :deep(.el-dialog__footer) {
  position: relative;
  z-index: 1;
}

.feedback-dialog :deep(.el-dialog__header) {
  padding: 20px 20px 12px;
  margin: 0;
}

.feedback-dialog :deep(.el-dialog__body) {
  position: relative;
  padding: 0 20px 12px;
}

.feedback-dialog :deep(.el-dialog__footer) {
  padding: 0 20px 20px;
  display: flex;
  justify-content: flex-end;
}

.feedback-dialog :deep(.el-dialog__headerbtn) {
  top: 16px;
  right: 16px;
  width: 20px;
  height: 20px;
  font-size: 14px;
}

.close-dialog-icon {
  position: absolute;
  top: 18px;
  right: 20px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #606572;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}


.feedback-header {
  padding: 16px 40px 12px 16px;
  text-align: left;
}

.header-icon {
  margin-right: 6px;
  flex-shrink: 0;
  font-size: 16px;
  line-height: 22px;
  color: #2f3547;
}

.header-title {
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: normal;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
}

.header-title-text {
  color: #13151d;
}

.header-subtitle {
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  display: flex;
  align-items: center;
  letter-spacing: normal;
  color: #606572;
}

.feedback-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 20px 12px 20px;
}

.type-buttons {
  display: flex;
  gap: 10px;
}

.type-btn {
  box-sizing: border-box;
  flex: 1;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  background: #fff;
  font-size: 13px;
  color: #4e5969;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 400;
}



.type-btn.active {
  background: #f0f6ff;
  border: 1px solid #bfd6ff;
  color: #165dff;
  font-weight: 500;
}

/* 输入区 + 缩略图 + 底栏：单卡片 */
.feedback-input-panel {
  position: relative;
  box-sizing: border-box;
  padding: 12px;
  border-radius: 12px;
  background: #F7F8FA;
  transition: border-color 0.2s, background 0.2s;
}



.feedback-textarea {
  display: block;
  width: 100%;
  min-height: 88px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 0;
  font-size: 14px;
  line-height: 22px;
  color: #13151d;
  resize: none;
  outline: none;
  box-sizing: border-box;
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  background: transparent;
}

.feedback-textarea::placeholder {
  color: #C2C3C9;
}

.image-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.image-item {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  overflow: visible;
}

/* 超过5M提示 */
.oversize-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 8px;
}

.oversize-tip--standalone {
  margin-top: 12px;
  height: auto;
  padding: 0;
}

.oversize-tip img {
  flex-shrink: 0;
}

.oversize-tip span {
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 12px;
  line-height: 18px;
  color: #ed4543;
  white-space: nowrap;
}

/* 内层裁剪圆角，外层 overflow:visible 以便删除角标露出 */
.image-item__inner {
  position: relative;
  z-index: 0;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  background: #e8eaef;
  box-sizing: border-box;
}

.image-item__inner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  background: #e8eaef;
}

.image-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 8px;
}

.image-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: feedback-spin 0.75s linear infinite;
}

@keyframes feedback-spin {
  to {
    transform: rotate(360deg);
  }
}

.image-close {
  position: absolute;
  /* 相对右上角再向外移图标尺寸的一半 */
  top: calc(-10px / 2);
  right: calc(-10px / 2);
  z-index: 2;
  width: 13px;
  height: 13px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.2s;
  line-height: 0;
}

.image-close__icon {
  display: block;
  width: 13px;
  height: 13px;
  pointer-events: none;
}

.image-close:hover {
  opacity: 0.85;
}

.panel-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.panel-upload-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 121px;
  height: 30px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid #eceef3;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
}

.panel-upload-btn:hover:not(:disabled) {
  border-color: #bfd6ff;
  background: #ffffff;
}

.panel-upload-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.panel-upload-btn__icon {
  display: flex;
  flex-shrink: 0;
  color: #2f3547;
}

.panel-upload-btn__text {
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 12px;
  line-height: 22px;
  font-weight: normal;
  color: #2F3547;
  letter-spacing: normal;
  white-space: nowrap;
}

.panel-char-count {
  margin-left: auto;
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  line-height: 22px;
  font-weight: normal;
  letter-spacing: normal;
}

.panel-char-current {
  color: #606572;
}

.panel-char-total {
  color: #C2C3C9;
}

.visually-hidden-file {
  display: none;
}

.submit-btn {
  width: 77px;
  height: 32px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  background: #2F3547;
  color: #fff;
  transition: all 0.2s;
  cursor: pointer;
  margin: 0 20px 20px 0;
}

.submit-btn:hover:not(:disabled) {
  background: #3d4152;
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.submit-btn.submitting {
  background: #C2C3C9;
  opacity: 1;
}

</style>

<style lang="scss">
/* Dialog Teleport 到 body：scoped 选不中内部 .el-dialog__*，用双类收窄到本弹窗 */
.el-dialog.feedback-dialog-bg {
  position: fixed !important;
  top: 63px !important;
  right: 10px !important;
  width: 380px;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box;
  border: 1px solid #ECEEF3 !important;
  box-shadow: 0px 6px 10px 0px rgba(221, 225, 228, 0.6) !important;
  z-index: 250 !important;
  border-radius: 12px !important;
  overflow: hidden;
}

/* 覆盖 Element Plus 自动生成的容器 z-index */
.el-modal-dialog:has(.feedback-dialog-bg) {
  z-index: 250 !important;
}

/* 隐藏反馈弹窗的遮罩层 */
.el-overlay:has(.feedback-dialog-bg) {
  background-color: transparent !important;
  pointer-events: auto !important;
  z-index: 249 !important;
}

/* 弹窗本身可以交互 */
.el-dialog.feedback-dialog-bg {
  pointer-events: auto !important;
}

.el-dialog.feedback-dialog-bg .el-dialog__header  {
  display: none;
}

/* 与认证弹窗一致可隐藏整块 header；当前反馈弹窗使用 #header 槽，勿开启 */
/* .el-dialog.feedback-dialog-bg .el-dialog__header { display: none !important; } */

.el-dialog.feedback-dialog-bg .el-dialog__body {
  position: relative;
  border-radius: 12px !important;
  // background-image: url('@/assets/home/feedback_bg.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
}


</style>
