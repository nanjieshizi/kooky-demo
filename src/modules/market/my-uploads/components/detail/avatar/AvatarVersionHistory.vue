<template>
  <div class="version-history">
    <div class="version-history__header">
      <h3 class="version-history__title">版本历史</h3>
      <el-button class="upload-new-version" link size="small" @click="handleUploadVersion">上传新版本</el-button>
    </div>
    <div class="version-history__list">
      <div
        v-for="item in versions"
        :key="item.id ?? item.version"
        class="version-card"
        :class="{ 'version-card--current': item.isCurrent }"
      >
        <div class="version-card__header">
          <div class="version-card__left">
            <span class="version-card__version">v{{ item.version }}</span>
          </div>
          <el-tooltip
            v-if="item.reviewStatus === 'rejected'"
            :content="item.rejectReason || '审核未通过'"
            placement="top"
          >
            <span
              class="version-card__status-tag"
              :style="getVersionStatusStyle(item)"
            >
              {{ getVersionStatusText(item) }}
            </span>
          </el-tooltip>
          <span
            v-else
            class="version-card__status-tag"
            :style="getVersionStatusStyle(item)"
          >
            {{ getVersionStatusText(item) }}
          </span>
        </div>
        <div class="version-card__meta">
          <span class="version-card__user">{{ item.ownerName || '—' }}</span>
          <span class="version-card__meta-sep" aria-hidden="true">|</span>
          <span class="version-card__meta-date">{{ item.releaseDate || '—' }}</span>
        </div>
        <p v-if="item.changelog" class="version-card__changelog">{{ item.changelog }}</p>
        <div class="version-card__footer">
          <span class="version-card__hire-count">当前聘用数: {{ item.hireCount ?? 0 }} 次</span>
          <div class="version-card__actions">
            <div class="version-card__stat-icons">
              <!-- <el-tooltip :content="publishTooltipContent(item)" placement="top" effect="dark" :show-after="200">
                <span v-if="item.reviewStatus === 'draft' || item.reviewStatus === 'rejected'" class="icon-stat-tooltip-host">
                  <button
                    type="button"
                    class="icon-stat"
                    aria-label="发布"
                    :disabled="isPublishDisabled(item)"
                    @click.stop="handlePublish(item)"
                  >
                    <img :src="shelfUpIcon" class="icon-stat__img" width="14" height="14" alt="" />
                  </button>
                </span>
              </el-tooltip> -->
              <!-- <el-tooltip :content="unpublishTooltipContent(item)" placement="top" effect="dark" :show-after="200">
                <span v-if="item.reviewStatus === 'published' || item.reviewStatus === 'reviewing'" class="icon-stat-tooltip-host">
                  <button
                    type="button"
                    class="icon-stat"
                    aria-label="下架"
                    :disabled="isUnpublishDisabled(item)"
                    @click.stop="handleUnpublish(item)"
                  >
                    <img :src="shelfDownIcon" class="icon-stat__img" width="14" height="14" alt="" />
                  </button>
                </span>
              </el-tooltip> -->
              <el-tooltip :content="deleteTooltipContent(item)" placement="top" effect="dark" :show-after="200">
                <span class="icon-stat-tooltip-host">
                  <button
                    type="button"
                    class="icon-stat"
                    aria-label="删除"
                    :disabled="isDeleteDisabled(item)"
                    @click.stop="handleDelete(item)"
                  >
                    <img :src="deleteBinIcon" class="icon-stat__img" width="14" height="14" alt="" />
                  </button>
                </span>
              </el-tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import shelfUpIcon from '@/assets/market/myupload/skill-version-shelf-up.svg'
import shelfDownIcon from '@/assets/market/myupload/skill-version-shelf-down.svg'
import deleteBinIcon from '@/assets/market/myupload/skill-version-delete.svg'

const props = defineProps({
  versions: {
    type: Array,
    default: () => [],
  },
  agentId: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['uploadVersion', 'publishVersion', 'unpublishVersion', 'deleteVersion'])
const router = useRouter()

function handleUploadVersion() {
  router.push({ name: 'AvatarCreate' })
}

function getReviewStatusType(status) {
  const map = {
    published: 'success',
    reviewing: 'primary',
    rejected: 'danger',
    draft: 'warning',
  }
  return map[status] || 'info'
}

function getReviewStatusText(status) {
  const map = {
    published: '已发布',
    reviewing: '审核中',
    rejected: '审核未通过',
    draft: '未发布',
  }
  return map[status] || status
}

/** 获取版本状态文本，优先使用接口返回的 statusLabel */
function getVersionStatusText(item) {
  if (item.statusLabel) {
    return item.statusLabel
  }
  if (item.status === 'active') return '已发布'
  if (item.status === 'draft') return '未发布'
  return getReviewStatusText(item.reviewStatus)
}

/** 获取版本状态样式，优先使用接口返回的 statusColor/statusBgColor */
function getVersionStatusStyle(item) {
  if (item.statusColor || item.statusBgColor) {
    return {
      color: item.statusColor || undefined,
      backgroundColor: item.statusBgColor || undefined,
    }
  }
  // 回退到默认颜色映射
  const type = getReviewStatusType(item.reviewStatus || item.status)
  const colorMap = {
    success: { color: '#24bcad', backgroundColor: '#eefcfa' },
    warning: { color: '#f5b400', backgroundColor: '#fffaeb' },
    primary: { color: '#00b4e0', backgroundColor: '#ebfbff' },
    danger: { color: '#ed4543', backgroundColor: '#fef0f0' },
    info: { color: '#606572', backgroundColor: '#eceef3' },
  }
  return colorMap[type] || colorMap.info
}

function isPublishDisabled(item) {
  return item.reviewStatus === 'reviewing' || item.reviewStatus === 'rejected'
}

function isUnpublishDisabled(item) {
  return item.reviewStatus === 'reviewing' || item.reviewStatus === 'rejected'
}

function publishTooltipContent(item) {
  if (item.reviewStatus === 'reviewing') return '审核中，暂不可发布'
  if (item.reviewStatus === 'rejected') return '审核未通过，请修改后重新提交'
  return '发布'
}

function unpublishTooltipContent(item) {
  if (item.reviewStatus === 'reviewing') return '审核中，暂不可下架'
  if (item.reviewStatus === 'rejected') return '审核未通过，请修改后重新提交'
  return '下架'
}

function deleteTooltipContent(item) {
  if (item.reviewStatus === 'reviewing') return '审核中，暂不可删除'
  if (item.id == null) return '缺少版本 ID，无法删除'
  return '删除'
}

function isDeleteDisabled(item) {
  if (item.reviewStatus === 'reviewing') return true
  if (item.id == null) return true
  return false
}

function handlePublish(item) {
  if (isPublishDisabled(item)) {
    if (item.reviewStatus === 'reviewing') ElMessage.warning('已经在审核中啦~')
    if (item.reviewStatus === 'rejected') ElMessage.warning('当前审核未通过，请重新提交发布')
    return
  }
  ElMessageBox.confirm('发布并审核成功后将在广场可见。', `确认发布 v${item.version}吗`, {
    confirmButtonText: '确认发布',
    cancelButtonText: '取消',
    type: 'warning',
    customClass: 'publish-confirm-dialog',
  })
    .then(() => emit('publishVersion', item))
    .catch(() => {})
}

function handleUnpublish(item) {
  if (isUnpublishDisabled(item)) {
    if (item.reviewStatus === 'reviewing') ElMessage.warning('已经在审核中啦~')
    if (item.reviewStatus === 'rejected') ElMessage.warning('当前审核未通过，请重新提交发布')
    return
  }
  ElMessageBox.confirm('下架后，广场不可见（不影响个人使用）。', `确认下架版本号 v${item.version}吗？`, {
    confirmButtonText: '确认下架',
    cancelButtonText: '取消',
    type: 'warning',
    customClass: 'danger-confirm-dialog',
  })
    .then(() => emit('unpublishVersion', item))
    .catch(() => {})
}

function handleDelete(item) {
  if (item.reviewStatus === 'reviewing') {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  if (item.id == null) {
    ElMessage.warning('缺少版本 ID，无法移除')
    return
  }
  const isLastVersion = props.versions.length === 1
  const message = isLastVersion
    ? '移除后不可恢复；当前为唯一版本，移除后将返回「我的上传」（不影响已安装实例）。'
    : '移除后不可恢复（不影响已安装实例）。'
  ElMessageBox.confirm(message, `确认移除版本 v${item.version}吗？`, {
    confirmButtonText: '确认移除',
    cancelButtonText: '取消',
    type: 'warning',
    customClass: 'danger-confirm-dialog',
  })
    .then(() => emit('deleteVersion', item))
    .catch(() => {})
}
</script>

<style lang="scss" scoped>
.version-history {
  padding: 0 20px 20px;
  background: transparent;
  height: 100%;
}

.version-history__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.version-history__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.upload-new-version {
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 24px;
  letter-spacing: 0;
  font-variation-settings: 'opsz' auto;
  color: #436ff6;
}

.version-history__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-card {
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid #eceef3;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;

  &--current {
    border-color: rgba(255, 104, 78, 0.45);
    box-shadow: 0 0 0 1px rgba(255, 104, 78, 0.08);
  }
}

.version-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.version-card__left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.version-card__version {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.version-card__status {
  flex-shrink: 0;
  border-radius: 4px;
}

.version-card__status-tag {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  flex-shrink: 0;
  white-space: nowrap;
}

.version-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  font-size: 12px;
  line-height: 20px;
  color: #8f959e;
}

.version-card__meta-sep {
  color: #c9cdd4;
  user-select: none;
}

.version-card__changelog {
  margin: 8px 0 0;
  font-size: 13px;
  color: #646a73;
  line-height: 1.5;
}

.version-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.version-card__hire-count {
  font-family: PingFang SC;
  font-size: 12px;
  line-height: 20px;
  letter-spacing: 0;
  font-variation-settings: 'opsz' auto;
  color: #ff684e;
  flex-shrink: 0;
}

.version-card__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.version-card__stat-icons {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-stat-tooltip-host {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.icon-stat {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #8f959e;
  line-height: 0;
  transition: opacity 0.15s;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.icon-stat__img {
  display: block;
  width: 14px;
  height: 14px;
  object-fit: contain;
}
</style>

<style lang="scss">
/* 勿对 .el-message-box 根节点使用 display:flex，会覆盖 EP 的 inline-block 居中方案，导致弹窗贴左上 */
.publish-confirm-dialog.el-message-box {
  padding: 20px 24px 24px;
  border-radius: 12px;
  background: #ffffff;
}

.danger-confirm-dialog {
  .el-button--primary {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 5px 16px;
    border-radius: 6px;
    background: #ed4543;
    border-color: #ed4543;

    &:hover,
    &:focus {
      background: #ed4543;
      border-color: #ed4543;
    }
  }
}
</style>
