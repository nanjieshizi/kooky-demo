<template>
  <el-dialog
    :model-value="modelValue"
    title="选择头像"
    width="560px"
    append-to-body
    :close-icon="DialogCloseIcon"
    :before-close="handleCancel"
    class="avatar-upload-dialog"
  >
    <!-- 头像预览区域 -->
    <div class="preview-area">
      <div class="avatar-preview">
        <img v-if="selectedAvatar" :src="selectedAvatar" alt="头像预览" />
        <div v-else class="avatar-placeholder">选择头像</div>
      </div>
    </div>

    <!-- 上传区域 -->
    <div class="upload-area">
      <div class="upload-text-btn">
        <p class="upload-hint">{{ type === 'skill' ? '请选择 Skill 头像' : '请选择数字人头像' }}</p>
        <!-- <p class="upload-hint">推荐使用下方默认头像，也可上传自定义头像（比例 1:1）</p> -->
        <!-- <div class="upload-area-btn" @click="triggerFileInput">
          <img src="../assets/camera.svg" alt="上传" class="camera-icon" />
          <span class="upload-text">上传头像</span>
        </div> -->
      </div>
      <el-scrollbar>
        <div class="avatar-list">
          <div
            v-for="(avatar, index) in defaultAvatars"
            :key="index"
            class="avatar-item"
            :class="{ agale: type !=='skill' , active: selectedAvatar === avatar }"
            @click="selectDefaultAvatar(avatar)"
          >
            <img :src="avatar" alt="默认头像" />
          </div>
        </div>
      </el-scrollbar>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/png,image/jpg,image/jpeg"
        style="display: none"
        @change="handleFileChange"
      />
      
    </div>
    <!-- 底部按钮 -->
    <template #footer>
      <div class="dialog-footer">
        <MarketCustomButton @click="handleCancel">取消</MarketCustomButton>
        <MarketCustomButton variant="dark" @click="handleConfirm">
          确定
        </MarketCustomButton>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { h, ref, watch, onMounted } from 'vue'
import { ElDialog, ElButton, ElScrollbar, ElMessage } from 'element-plus'
import { generateDefaultAvatars } from '../utils/avatarGenerator'
import { fetchAgentAvatars, fetchSkillIcons } from '../services/myUploadsApi'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import dialogCloseUrl from '../assets/dialog-close.svg?url'

/** 与设计稿一致：12×12，hover 不变色（使用固定 fill 的 img，见样式覆盖 headerbtn） */
const DialogCloseIcon = {
  name: 'AvatarUploadDialogCloseIcon',
  render() {
    return h('img', {
      class: 'avatar-upload-dialog__close-icon',
      src: dialogCloseUrl,
      width: 12,
      height: 12,
      alt: '',
      draggable: false,
    })
  },
}

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  currentAvatar: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'skill'
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

// 状态
const fileInputRef = ref(null)
const selectedAvatar = ref(null)
const defaultAvatars = ref([])

// 触发文件选择
const triggerFileInput = () => {
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileChange = (event) => {
  const target = event.target
  const file = target.files?.[0]

  if (!file) return

  // 校验文件格式
  const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg']
  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('只支持 PNG、JPG、JPEG 格式的图片')
    return
  }

  // 校验文件大小（2MB）
  const maxSize = 2 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('图片大小不能超过 2MB')
    return
  }

  // 读取为 base64 并预览
  const reader = new FileReader()
  reader.onload = (e) => {
    selectedAvatar.value = e.target?.result
  }
  reader.readAsDataURL(file)

  // 清空 input 值，以便同一文件可以重复选择
  target.value = ''
}

// 选择默认头像
const selectDefaultAvatar = (avatarUrl) => {
  selectedAvatar.value = avatarUrl
}

// 确认 - 直接将 base64 或默认头像 URL 暴露给外部
const handleConfirm = () => {
  if (!selectedAvatar.value) {
    ElMessage.warning('请选择头像')
    return
  }

  emit('confirm', selectedAvatar.value)
  emit('update:modelValue', false)
}

// 取消
const handleCancel = () => {
  emit('update:modelValue', false)
}

// 监听弹框打开，初始化选中状态
watch(() => props.modelValue, (visible) => {
  if (visible) {
    selectedAvatar.value = props.currentAvatar || null
  }
})

// 加载头像列表
async function loadAvatars() {
  try {
    if (props.type === 'agent') {
      const avatars = await fetchAgentAvatars()
      defaultAvatars.value = avatars
    } else if (props.type === 'skill') {
      const icons = await fetchSkillIcons()
      defaultAvatars.value = icons.length ? icons : generateDefaultAvatars(props.type)
    } else {
      defaultAvatars.value = generateDefaultAvatars(props.type)
    }
  } catch (error) {
    console.error('加载头像列表失败:', error)
    defaultAvatars.value = generateDefaultAvatars(props.type)
  }
}

// 组件挂载时加载头像
onMounted(() => {
  loadAvatars()
})
</script>

<style lang="scss" scoped>
.avatar-upload-dialog {

 

  :deep(.el-dialog__body) {
    padding: 24px;
  }

  :deep(.el-dialog__footer) {
    padding: 16px 24px;
    border-top: 1px solid #eceef3;
  }

  .preview-area {
    display: flex;
    justify-content: center;
    margin-bottom: 24px;

    .avatar-preview {
      width: 100px;
      height: 100px;
      // border-radius: 8px;
      overflow: hidden;
      // border: 1px solid #eceef3;
      // border-radius: 50%;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .avatar-placeholder {
      width: 100%;
      height: 100%;
      background: #f5f6f9;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #c0c4cc;
      font-size: 14px;
    }
  }

  .upload-area {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px 16px 4px 16px;
    border-radius: 12px;
    background: #f5f6f9;
    

    .upload-text-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .upload-hint {
        margin: 0;
        font-family: 苹方-简;
        font-size: 14px;
        font-weight: normal;
        line-height: 22px;
        display: flex;
        align-items: center;
        letter-spacing: normal;
        /* 文本色&图标色/三级文本色 */
        color: #91949E;
        /* 推荐使用下方默认头像，也可上传自定义头像 */
        font-family: 苹方-简;
        font-weight: 400;
        font-size: 14px;
      }
      .upload-area-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
      }
      .camera-icon {
        width: 14px;
        height: 14px;
      }

      .upload-text {
        font-family: PingFang SC;
        font-size: 12px;
        font-weight: 500;
        line-height: normal;
        text-align: center;
        letter-spacing: normal;
        /* 文字按钮/蓝色默认态 */
        color: #436FF6;
      }
    }

    
    :deep(.el-scrollbar__wrap) {
      overflow-x: auto;
      padding-bottom: 12px;
    }

    .avatar-list {
      display: flex;
      gap: 12px;
      padding: 8px 0;
      min-width: min-content;

      .avatar-item {
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;

        &.active {
          // outline: 2px solid transparent;
          box-shadow: 0 0 0 2px transparent;
          background: url('../assets/avater-active-skill.png') center / cover no-repeat;
          // padding: 2px;
          overflow: visible;

          img {
            border-radius: 50%;
          }
        }
        &.agale.active {
          background: url('../assets/avater-active.png') center / cover no-repeat;
        }

        img {
          width: 38px;
          height: 38px;
          object-fit: cover;
        }
      }
    }
    
  }



  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  // 统一按钮样式
  :deep(.el-button:not(.el-button--primary)) {
    color: #2f3547;

    &:hover {
      background: #f5f6f9;
      border-color: #dcdfe6;
      color: #2f3547;
    }
  }

  .el-button {
    padding: 5px 16px;
    border-radius: 8px;
    margin: 0;
    
  }

  /* 与 SkillEditView 保存按钮（save-publish-btn）一致，主按钮圆角 8px */
  .save-publish-btn {
    height: 32px;
    min-height: 32px;
    display: inline-flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    background: #171b26;
    border: none;
    border-color: #171b26;

    &:hover,
    &:focus {
      background: #2e323c;
      border-color: #2e323c;
      color: #fff;
    }
  }
}
</style>
<style lang="scss">
// 非 scoped：覆盖 el-dialog 样式，让背景覆盖标题区域
.avatar-upload-dialog.el-dialog {
  position: relative;
  overflow: hidden;

  .el-dialog__header {
    position: relative;
    z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-right: 0px;
    .el-dialog__title{
      font-size: 16px;
      font-weight: 600;
      color: #2f3547;
    }
    .el-dialog__headerbtn{
      width: 12px;
      height: 12px;
      position: initial;
      .el-dialog__close {
      width: 12px;
      height: 12px;
      color: #91949e;
      }
    }

  }

  

  .el-dialog__body {
    position: relative;
    z-index: 1;
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
