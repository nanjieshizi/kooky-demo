<template>
  <div class="skill-header">
    <div class="skill-header__left">
      <div class="skill-header__icon">
        <img v-if="displayImageSrc" :src="displayImageSrc" alt="" />
        <div v-else class="skill-header__placeholder">{{ skill.displayName?.charAt(0) }}</div>
      </div>
    </div>
    <div class="skill-header__right">
      <div class="skill-header__row1">
        <div class="skill-header__name-col">
          <h1 class="skill-header__name">{{ skill.displayName }}</h1>
          <span class="skill-header__version">v{{ skill.version }}</span>
        </div>
        <div class="skill-header__actions">
          <div class="skill-header__stats">
            <span class="skill-header__stat">
              <img :src="statDownloadIcon" class="skill-header__stat-icon" width="14" height="14" alt=""
                aria-hidden="true" />
              {{ formatNumber(skill.downloads) }}
            </span>
            <span class="skill-header__stat skill-header__stat--fav">
              <span class="skill-header__star-icon" aria-hidden="true" :style="starIconMaskStyle" />
              {{ formatNumber(skill.stars ?? 0) }}
            </span>
          </div>
          <el-button type="primary" class="skill-header__install-btn" size="small" @click.stop="openInstallDialog">
            <span class="skill-header__btn-install-inner">
              <span>{{ installing ? '安装中' : '安装' }}</span>
              <img class="skill-header__btn-install-az" :class="{ 'is-spinning': installing }" :src="skillAzUrl" alt=""
                width="14" height="14" decoding="async" />
            </span>
          </el-button>
        </div>
      </div>
      <div class="skill-header__row2">
        <el-tag v-for="tag in skill.tags || []" :key="tag" size="small" effect="plain" class="skill-header__tag">
          {{ tag }}
        </el-tag>
        <span class="skill-header__author">由 {{ skill.author }} 上传 · 更新于 {{ skill.updatedAt }}</span>
        <!-- <p class="skill-header__desc">更新于 {{ skill.updatedAt }}</p> -->

      </div>
    </div>

    <InstallDigitalHumanDialog v-model="installDialogVisible" :skill-slug="skill.name"
      @confirm="onInstallDialogConfirm" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import defaultAvatarSrc from '@/assets/default-avatar.svg'
import statDownloadIcon from '@/assets/market/myupload/stat-download.svg'
import statStarIcon from '@/assets/market/myupload/stat-star.svg'
import skillAzUrl from '@/assets/skill/skill-az.svg?url'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import InstallDigitalHumanDialog from '../../InstallDigitalHumanDialog.vue'

const starIconMaskStyle = computed(() => ({
  WebkitMaskImage: `url(${statStarIcon})`,
  maskImage: `url(${statStarIcon})`,
}))

const props = defineProps({
  skill: { type: Object, required: true },
  /** 安装流程中：文案「安装中」+ AZ 图标旋转（与技能市场卡片一致） */
  installing: { type: Boolean, default: false },
})
const emit = defineEmits(['install'])
const router = useRouter()
const installDialogVisible = ref(false)

function openInstallDialog() {
  installDialogVisible.value = true
}

function onInstallDialogConfirm(payload) {
  emit('install', payload)
}

function handleEdit() {
  router.push(`/market/my-uploads/skill/${props.skill.id}/edit`)
}

function formatNumber(num) {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return String(num)
}


/**
 * 解析封面图地址：
 * - `data:image/...` 等内联图原样返回
 * - `http(s)://` 完整地址原样返回
 * - 含 `default-avatar.png` 的占位路径改为本地资源
 * - 其它相对路径与 one 网关 base 拼接
 */
function handleImageUrl(item) {
  const raw = String(
    item.image ?? item.avatar ?? item.coverUrl ?? item.avatarUrl ?? '',
  ).trim()
  if (!raw) return ''
  if (/^data:/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (/default-avatar\.png/i.test(raw)) return defaultAvatarSrc
  const base = getOneBaseUrl().replace(/\/$/, '')
  if (!base) return raw
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

const displayImageSrc = computed(() => handleImageUrl(props.skill))

</script>

<style lang="scss" scoped>
.tag-item {
  border-radius: 4px;
  background: #f2f3f5;
  border-color: transparent;
  color: #646a73;
  margin-right: 4px;
}

.skill-header {
  display: flex;
  gap: 12px;
  // padding: 20px;
  background: #fff;
  border-radius: 12px;
  // border: 1px solid rgba(0, 0, 0, 0.06);
}

.skill-header__icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  // background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.skill-header__placeholder {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  color: #fff;
}

.skill-header__right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-header__row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.skill-header__name-col {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.skill-header__name {
  margin: 0;
  font-family: PingFang SC;
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}

.skill-header__version {
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  letter-spacing: normal;
  /* 文本色&图标色/三级文本色 */
  color: #91949E;
}

.skill-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.skill-header__stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.skill-header__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #8f959e;
}

.skill-header__stat-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}

.skill-header__stat--fav {
  color: #8f959e;
  font-size: 12px;
}

.skill-header__star-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

.skill-header__edit-btn {
  border-radius: 6px;
  padding: 5px 16px;
  height: 28px;
}

.skill-header__install-btn {
  height: 28px;
  border-radius: 6px;
  padding: 5px 16px;
  --el-button-bg-color: #171b26;
  --el-button-border-color: #171b26;
  --el-button-hover-bg-color: #2e323c;
  --el-button-hover-border-color: #2e323c;
  --el-button-text-color: #ffffff;
  --el-button-hover-text-color: #ffffff;
  /* 点击 / 聚焦时与常态同色，避免 Element Plus 默认 active 变浅或变色 */
  --el-button-active-bg-color: #171b26;
  --el-button-active-border-color: #171b26;
  --el-button-active-text-color: #ffffff;
  --el-button-disabled-text-color: rgba(255, 255, 255, 0.65);
  --el-button-disabled-bg-color: #c9cdd4;
  --el-button-disabled-border-color: #c9cdd4;

  &:focus,
  &:focus-visible {
    outline: none;
  }

  &:not(.is-disabled):active,
  &:not(.is-disabled):focus {
    background-color: #171b26;
    border-color: #171b26;
    color: #ffffff;
    box-shadow: none;
  }

  :deep(.el-button__inner) {
    display: inline-flex;
    align-items: center;
  }
}

.skill-header__btn-install-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.skill-header__btn-install-az {
  flex-shrink: 0;
  display: block;
  width: 14px;
  height: 14px;
  object-fit: contain;

  &.is-spinning {
    animation: skill-header-az-spin 0.9s linear infinite;
  }
}

@keyframes skill-header-az-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.skill-header__row2 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
}

.skill-header__tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.skill-header__tag {
  border-radius: 4px;
  background: #f2f3f5;
  border-color: transparent;
  color: #646a73;
  height: 24px;
  border: none;
  padding: 2px 6px;
  box-sizing: border-box;
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  /* 文本色&图标色/二级文本色 */
  color: #606572;
}

.skill-header__author {
  font-family: PingFang SC;
  font-size: 13px;
  font-weight: normal;
  line-height: 21px;
  text-align: justify;
  /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/三级文本色 */
  color: #91949E;
  margin-left: 12px;
}

.skill-header__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #646a73;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  width: 100%;
}
</style>
