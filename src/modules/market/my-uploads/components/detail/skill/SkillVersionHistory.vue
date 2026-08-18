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
        :class="{ 'version-card--current': isVersionActive(item), 'version-card--selectable': true }"
        role="button"
        tabindex="0"
        @click="onVersionCardClick(item)"
        @keydown.enter.prevent="onVersionCardClick(item)"
        @keydown.space.prevent="onVersionCardClick(item)"
      >
        <div class="version-card__header">
          <div class="version-card__left">
            <span class="version-card__version">v{{ item.version }}</span>
          </div>
          <el-tooltip
            v-if="item.reviewStatus === 'rejected'"
            :content="item.reviewComment || '审核未通过'"
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
          <span class="version-card__meta-date">{{ item.version || '—' }}</span>
        </div>
        <p v-if="item.changelog" class="version-card__changelog">{{ item.changelog }}</p>
        <div class="version-card__footer">
          <span v-if="item.hireCount" class="version-card__hire-count">
            关联数字人: {{ item.hireCount }}
          </span>
          <div class="version-card__actions">
            <div class="version-card__stat-icons">
              <!-- <el-tooltip
                v-if="canToggleShelf(item)"
                :content="shelfTooltipContent(item)"
                placement="top"
                effect="dark"
                :show-after="200"
              >
                <span class="icon-stat-tooltip-host">
                  <button
                    type="button"
                    class="icon-stat"
                    :aria-label="versionIsPublished(item) ? '下架' : '发布'"
                    :disabled="isShelfActionDisabled(item)"
                    @click.stop="handleShelfToggle(item)"
                  >
                    <img
                      v-if="!versionIsPublished(item)"
                      :src="shelfUpIcon"
                      class="icon-stat__img"
                      width="14"
                      height="14"
                      alt=""
                    />
                    <img
                      v-else
                      :src="shelfDownIcon"
                      class="icon-stat__img"
                      width="14"
                      height="14"
                      alt=""
                    />
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
            <!-- <el-dropdown
              v-if="showVersionManageMenu(item)"
              trigger="click"
              @command="(cmd) => onManageCommand(cmd, item)"
            >
              <button type="button" class="version-card__more" aria-label="更多操作" @click.stop>
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-if="item.reviewStatus === 'draft' || item.reviewStatus === 'rejected'"
                    command="publish"
                    :disabled="isPublishDisabled(item)"
                  >
                    提交发布
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="item.reviewStatus === 'published' || item.reviewStatus === 'reviewing'"
                    command="unpublish"
                    :disabled="isUnpublishDisabled(item)"
                  >
                    下架
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown> -->
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
  versions: { type: Array, default: () => [] },
  skillId: { type: Number, required: true },
  /** 父级当前选中的版本号（与 item.version 对齐）；为空时回退用 item.isCurrent */
  activeVersion: { type: String, default: '' },
})

const emit = defineEmits([
  'uploadVersion',
  'publishVersion',
  'unpublishVersion',
  'deleteVersion',
  'selectVersion',
])

const router = useRouter()

function isVersionActive(item) {
  if (props.activeVersion != null && props.activeVersion !== '') {
    return String(item.version) === String(props.activeVersion)
  }
  return !!item.isCurrent
}

function onVersionCardClick(item) {
  if (isVersionActive(item)) return
  emit('selectVersion', item)
}

function showVersionManageMenu(item) {
  const s = item.reviewStatus
  return s === 'draft' || s === 'rejected' || s === 'published' || s === 'reviewing'
}

function handleUploadVersion() {
  // router.push({ name: 'SkillEdit', params: { id: props.skillId } })
  router.push({ name: 'SkillCreate' })
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

/** API: status `active` 已发布，`draft` 未发布；兼容 reviewStatus */
function versionIsPublished(item) {
  if (item.status === 'active') return true
  if (item.status === 'draft') return false
  return item.reviewStatus === 'published'
}

function canToggleShelf(item) {
  if (item.status === 'active' || item.status === 'draft') return true
  if (item.reviewStatus === 'published' || item.reviewStatus === 'draft') return true
  return false
}

function isShelfActionDisabled(item) {
  return item.reviewStatus === 'reviewing'
}

/** 悬停提示：与设计稿一致；禁用时说明原因 */
function shelfTooltipContent(item) {
  if (isShelfActionDisabled(item)) return '审核中，暂不可上下架'
  return versionIsPublished(item) ? '下架' : '发布'
}

function deleteTooltipContent(item) {
  if (item.reviewStatus === 'reviewing') return '审核中，暂不可删除'
  if (item.id == null) return '缺少版本 ID，无法删除'
  return '删除'
}

function handleShelfToggle(item) {
  if (isShelfActionDisabled(item)) {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  if (versionIsPublished(item)) {
    handleUnpublish(item)
  } else {
    handlePublish(item)
  }
}

function isDeleteDisabled(item) {
  if (item.reviewStatus === 'reviewing') return true
  if (item.id == null) return true
  return false
}

function onManageCommand(cmd, item) {
  if (cmd === 'publish') handlePublish(item)
  else if (cmd === 'unpublish') handleUnpublish(item)
}

function handlePublish(item) {
  if (item.reviewStatus === 'reviewing') {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  if (item.reviewStatus === 'rejected') {
    ElMessage.warning('当前审核未通过，请重新提交发布')
    return
  }
  ElMessageBox.confirm('上架后将对Skill市场可见。', `确认上架版本 v${item.version}吗`, {
    confirmButtonText: '确认上架',
    cancelButtonText: '取消',
    type: 'warning',
    customClass: 'publish-confirm-dialog',
  })
    .then(() => emit('publishVersion', item))
    .catch(() => {})
}

function handleUnpublish(item) {
  if (item.reviewStatus === 'reviewing') {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  if (item.reviewStatus === 'rejected') {
    ElMessage.warning('当前审核未通过，请重新提交发布')
    return
  }
  ElMessageBox.confirm('下架后Skill市场不可见。', `确认下架版本 v${item.version}吗？`, {
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
  ElMessageBox.confirm(message, `确认移除版本 v${item.version}吗`, {
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

  &--selectable {
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid rgba(67, 111, 246, 0.45);
      outline-offset: 2px;
    }
  }

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
  // padding-top: 10px;
  // border-top: 1px solid rgba(0, 0, 0, 0.04);
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

.version-card__more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #8f959e;
  font-size: 16px;
  line-height: 1;

  &:hover {
    color: #606572;
  }
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
