<template>
  <div class="empty-state">
    <div class="empty-icon">
      <img
        :src="emptyState"
        alt=""
        width="100"
        height="100"
      />
    </div>
    <p class="empty-text">{{ emptyText }}</p>
    <!-- <div>
      <el-button   @click="showUploadGuide">
        上传指引
      </el-button>
      <el-button class="upload-button" type="primary" @click="handleUploadClick">
        {{ type === 'agent' ? '上传数字人' : '上传 Skill' }}
      </el-button>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TabType } from '../types'
import emptyState from '@/assets/home/flie-preview.png'
import { useRouter } from 'vue-router'

const props = defineProps<{
  type: TabType
}>()

defineEmits<{
  upload: []
}>()

const router = useRouter()
function handleUpload(type: TabType) {
  if (type === 'agent') {
    router.push({ name: 'AvatarCreate' })
  } else {
    router.push({ name: 'SkillCreate' })
  }
}

function handleUploadClick() {
  handleUpload(props.type)
}
function showUploadGuide() {
  window.open('https://yf2ljykclb.xfchat.iflytek.com/docx/doxrzTrNXecm6I9BWB6Ir0Qajxe', '_blank', 'noopener,noreferrer')
}

const emptyText = computed(() => {
  return props.type === 'agent'
    ? '暂无上传的数字人，快来创建你的第一个数字人吧'
    : '暂无上传的 Skill，快来创建你的第一个 Skill 吧'
})
</script>

<style lang="scss" scoped>
.upload-button {
  background-color: #171B26;
  border-color: #171B26;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}

.empty-icon {
  margin-bottom: 8px;
  width: 100px;
  height: 100px;
}

.empty-text {
  margin: 0 0 24px;
  font-size: 14px;
  color: rgba(47, 53, 71, 0.5);
  text-align: center;
}

.empty-action {
  border-radius: 8px;
}
</style>
