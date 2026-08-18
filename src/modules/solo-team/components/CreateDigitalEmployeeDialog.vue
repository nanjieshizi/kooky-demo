<template>
  <el-dialog
    :model-value="props.visible"
    title="新建数字员工"
    width="960px"
    align-center
    append-to-body
    :close-on-click-modal="false"
    modal-class="create-digital-employee-dialog-overlay"
    class="create-digital-employee-dialog"
    @close="handleClose"
  >
    <div class="digital-employee-form">
      <div class="form-row form-row--modes">
        <label class="form-label">创建方式</label>
        <div class="mode-list">
          <button
            v-for="item in createModes"
            :key="item.value"
            type="button"
            class="mode-card"
            :class="{ active: createMode === item.value }"
            @click="changeCreateMode(item.value)"
          >
            <span class="mode-icon" :class="`mode-icon--${item.value}`">
              <img v-if="item.icon" :src="item.icon" alt="" />
            </span>
            <span class="mode-copy">
              <span class="mode-title">{{ item.title }}</span>
              <span class="mode-desc">{{ item.desc }}</span>
            </span>
            <img
              v-if="createMode === item.value"
              class="mode-check"
              :src="activeIcon"
              alt=""
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <template v-if="createMode === 'manual'">
        <div class="form-row form-row--avatar">
          <label class="form-label required">头像</label>
          <div class="avatar-field" v-loading="avatarIconsLoading">
            <div class="avatar-field__track">
              <button
                v-for="avatar in avatarOptions"
                :key="avatar.id"
                type="button"
                class="avatar-option"
                :class="{ active: manualSelectedAvatar === avatar.src }"
                @click="manualSelectedAvatar = avatar.src"
              >
                <img :src="avatar.src" :alt="avatar.name" />
              </button>
            </div>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label required">员工名称</label>
          <div class="text-field">
            <input
              v-model="manualEmployeeName"
              class="text-input"
              type="text"
              maxlength="64"
              placeholder="请输入名称，例如：客户支持专家"
            />
            <span class="text-count">{{ manualEmployeeName.length }}/64</span>
          </div>
        </div>

        <div class="form-row form-row--textarea">
          <label class="form-label required">描述</label>
          <div class="textarea-field">
            <textarea
              v-model="manualDescription"
              class="description-input"
              maxlength="1024"
              placeholder="说明这个员工擅长什么，什么时候调用他，有哪些工作风格偏好..."
            />
            <span class="textarea-count">{{ manualDescription.length }}/1024</span>
          </div>
        </div>
      </template>

      <div v-else-if="createMode === 'upload'" class="create-mode-panel upload-panel">
        <template v-if="uploadState === 'editing'">
          <div class="upload-edit-form">
            <div class="form-row">
              <label class="form-label required">数字人工程包</label>
              <div class="upload-file-field">
                <span class="upload-file-status">已选文件</span>
                <div class="upload-file-card">
                  <span class="upload-file-icon">{{ packageFileBadge }}</span>
                  <span class="upload-file-name">{{ uploadedFile?.name || '已上传文件' }}</span>
                  <span class="upload-file-size">{{ formatUploadFileSize(uploadedFile?.size) }}</span>
                  <button type="button" class="upload-file-remove" @click="handleBackToUpload">×</button>
                </div>
              </div>
            </div>

            <div class="form-row form-row--avatar">
              <label class="form-label required">头像</label>
              <div class="avatar-field" v-loading="avatarIconsLoading">
                <div class="avatar-field__track">
                  <button
                    v-for="avatar in avatarOptions"
                    :key="avatar.id"
                    type="button"
                    class="avatar-option"
                    :class="{ active: uploadSelectedAvatar === avatar.src }"
                    @click="uploadSelectedAvatar = avatar.src"
                  >
                    <img :src="avatar.src" :alt="avatar.name" />
                  </button>
                </div>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label required">员工名称</label>
              <div class="text-field">
                <input
                  v-model="uploadEmployeeName"
                  class="text-input"
                  type="text"
                  maxlength="64"
                  placeholder="请输入名称，例如：客户支持专家"
                />
                <span class="text-count">{{ uploadEmployeeName.length }}/64</span>
              </div>
            </div>

            <div class="form-row form-row--textarea">
              <label class="form-label required">描述</label>
              <div class="textarea-field">
                <textarea
                  v-model="uploadDescription"
                  class="description-input"
                  maxlength="1024"
                  placeholder="说明这个员工擅长什么，什么时候调用他，有哪些工作风格偏好..."
                />
                <span class="textarea-count">{{ uploadDescription.length }}/1024</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="upload-view__body">
            <img :src="uploadBgIcon" class="upload-bg" alt="" />
            <div class="main-title">上传数字人工程包</div>

            <div v-if="uploadState === 'idle'" class="upload-initial">
              <div
                class="upload-area"
                :class="{ 'is-dragover': isDragover }"
                @dragover.prevent="isDragover = true"
                @dragleave.prevent="isDragover = false"
                @drop.prevent="handleDrop"
                @click="triggerPackageInput"
              >
                <input
                  ref="packageInputRef"
                  type="file"
                  accept=".zip,.gz"
                  class="visually-hidden"
                  @change="handlePackageChange"
                />
                <div class="upload-area__text">
                  <div class="upload-area__primary">
                    <img class="upload-btn" :src="uploadBtn" alt="" />
                    点击/拖拽文件或压缩包到此区域
                  </div>
                  <div class="upload-area__secondary">{{ AGENT_PACKAGE_FORMAT_HINT }}</div>
                </div>
              </div>
            </div>

            <div v-else-if="uploadState === 'uploading' || uploadState === 'validating'" class="upload-progress">
              <div class="progress-title">{{ uploadState === 'uploading' ? '上传中...' : '检测中...' }}</div>
              <div class="progress-subtitle">
                {{ uploadState === 'uploading' ? '正在上传文件到服务器' : '正在检测工程包规范' }}
              </div>
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
                    <img v-else-if="item.status === 'error'" :src="errorIcon" class="error-icon" alt="" />
                    <LoadingIcon v-else-if="item.status === 'loading'" class="rotating" />
                    <span v-else class="circle-pending"></span>
                  </el-icon>
                  <span class="progress-item__name">{{ item.name }}</span>
                </div>
              </div>
            </div>

            <div v-else-if="uploadState === 'result'" class="upload-result">
              <div class="box">
                <div class="result-title">
                  <img :src="errorIcon" class="error-icon" alt="" />
                  检测失败
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
                      <LoadingIcon v-else />
                    </el-icon>
                    <span class="validation-item__name">{{ item.name }}</span>
                    <span v-if="item.message" class="validation-item__message">{{ item.message }}</span>
                  </div>
                </div>
              </div>
              <div class="result-actions">
                <MarketCustomButton @click="resetUpload">取消上传</MarketCustomButton>
                <MarketCustomButton variant="dark" @click="resetUpload">重新上传</MarketCustomButton>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-else class="create-mode-panel market-panel">
        <div class="market-panel__search-row">
          <label class="form-label required">选择员工</label>
          <MarketSpecSearchInput
            v-model="searchKeyword"
            class="market-panel__search"
            placeholder="搜索数字人"
            @search="onSearch"
          />
        </div>

        <div v-if="avatars.length > 0" class="avatar-market-view__category-section">
          <div
            ref="categoryTagsRef"
            class="avatar-market-view__category-tags"
            :class="{ 'is-expanded': showAllCategories }"
          >
            <span
              v-for="category in categories"
              :key="category.id"
              :data-cat-id="category.id"
              class="avatar-market-view__cat avatar-market-view__cat--chip"
              :class="{
                'is-active': selectedCategory === category.id,
                'avatar-market-view__cat--all': category.id === 'all',
              }"
              @click="selectedCategory = category.id"
            >
              {{ formatCategoryLabel(category) }}
            </span>
          </div>
          <button
            v-if="hasOverflow"
            type="button"
            class="avatar-market-view__category-expand-btn"
            :aria-expanded="showAllCategories"
            @click="toggleCategoryExpand"
          >
            {{ showAllCategories ? '收起' : '更多' }}
            <img class="avatar-market-view__expand-arrow-icon" :src="showAllCategories ? upIcon : downIcon" alt="" />
          </button>
        </div>

        <div ref="scrollRoot" class="avatar-market-view__scroll" @scroll.passive="onListScroll">
          <div class="avatar-market-view__toolbar">
            <div class="avatar-market-view__sort">
              <button
                type="button"
                class="avatar-market-view__sort-btn avatar-market-view__sort-btn--popular"
                :class="{ 'is-active': selectedSort === 'installed' }"
                @click="selectedSort = 'installed'"
              >
                <span class="avatar-market-view__flame" aria-hidden="true">🔥</span>
                安装量
              </button>
              <button
                type="button"
                class="avatar-market-view__sort-btn avatar-market-view__sort-btn--plain"
                :class="{ 'is-active': selectedSort === 'favorites' }"
                @click="selectedSort = 'favorites'"
              >
                关注量
              </button>
              <button
                type="button"
                class="avatar-market-view__sort-btn avatar-market-view__sort-btn--plain"
                :class="{ 'is-active': selectedSort === 'latest' }"
                @click="selectedSort = 'latest'"
              >
                最新
              </button>
            </div>
            <span class="avatar-market-view__toolbar-divider" aria-hidden="true" />
            <el-checkbox v-model="favoritesOnly" class="avatar-market-view__only-fav">
              仅看收藏
            </el-checkbox>
          </div>

          <div v-if="!listLoading && avatars.length === 0" class="avatar-market-view__empty-state">
            <img class="avatar-market-view__empty-state-img" :src="emptyIllustration" alt="" width="100" height="100" />
            <p class="avatar-market-view__empty-state-text">暂无数据，看看其他的吧~</p>
          </div>
          <div v-else class="avatar-market-view__grid">
            <article
              v-for="avatar in avatars"
              :key="avatar.id"
              class="market-agent-card"
              :class="{ 'is-hired': avatar.isHired }"
            >
              <div class="market-agent-card__top">
                <div class="market-agent-card__media">
                  <img class="market-agent-card__avatar" :src="avatar.avatar || defaultAvatar" :alt="avatar.name" />
                  <img v-if="avatar.isHired" :src="isHiredIcon" class="market-agent-card__hired-badge" alt="" />
                </div>
                <div class="market-agent-card__meta">
                  <div class="market-agent-card__title-row">
                    <span class="market-agent-card__name">{{ avatar.name }}</span>
                    <span v-if="avatar.version" class="market-agent-card__version">{{ avatar.version }}</span>
                  </div>
                  <div class="market-agent-card__tag-row">
                    <span v-if="avatar.qualityLevel" class="market-agent-card__tag">{{ avatar.qualityLevel }}</span>
                    <span v-if="avatar.extraTagCount" class="market-agent-card__tag">+{{ avatar.extraTagCount }}</span>
                    <span v-if="avatar.sourceOrg" class="market-agent-card__org">@{{ avatar.sourceOrg }}</span>
                  </div>
                </div>
              </div>
              <p class="market-agent-card__desc">{{ avatar.description || '-' }}</p>
              <div class="market-agent-card__footer">
                <div class="market-agent-card__stats">
                  <span class="market-agent-card__stat">
                    <img
                      class="market-agent-card__stat-icon"
                      :src="downloadIcon"
                      alt=""
                      width="14"
                      height="14"
                    />
                    <span class="market-agent-card__stat-num">{{ formatCount(avatar.installed) }}</span>
                  </span>
                  <CollectButton
                    type="avatar"
                    :resource-id="avatar.id"
                    :initial-collected="avatar.isCollected"
                    :initial-count="avatar.favorites"
                    @collect-change="(payload) => onCollectChange({ id: avatar.id, ...payload })"
                  />
                </div>
                <button
                  type="button"
                  class="market-agent-card__hire"
                  :disabled="hiringAgentId === avatar.id"
                  @click.stop="handleHireMarketAgent(avatar)"
                >
                  <span v-if="hiringAgentId === avatar.id" class="market-agent-card__hire-inner">
                    <img
                      class="market-agent-card__hire-spinner"
                      :src="hireLoadingIconUrl"
                      width="14"
                      height="14"
                      alt=""
                    />
                    聘用中
                  </span>
                  <span v-else>聘用</span>
                </button>
              </div>
            </article>
          </div>
          <p v-if="loadMoreLoading" class="avatar-market-view__list-footer avatar-market-view__list-footer--loading">
            加载中…
          </p>
          <p
            v-else-if="!hasMore && avatars.length > 0"
            class="avatar-market-view__list-footer avatar-market-view__list-footer--end"
          >
            已经到底啦，换个方向逛逛吧～
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <button type="button" class="btn-cancel" @click="handleClose">取消</button>
        <button v-if="createMode === 'manual'" type="button" class="btn-confirm" :disabled="!canConfirm" @click="handleConfirm">
          {{ createLoading ? '创建中' : '确定' }}
        </button>
        <button
          v-else-if="createMode === 'upload'"
          type="button"
          class="btn-confirm"
          :disabled="isUploadFooterConfirmDisabled"
          @click="handleUploadFooterConfirm"
        >
          {{ uploadFooterConfirmLabel }}
        </button>
        <button v-else-if="createMode === 'market'" type="button" class="btn-confirm" @click="handleClose">确定</button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
defineOptions({ name: 'CreateDigitalEmployeeDialog' })

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleClose, Loading as LoadingIcon } from '@element-plus/icons-vue'
import MarketSpecSearchInput from '@/shared/components/MarketSpecSearchInput.vue'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import CollectButton from '@/modules/market/components/CollectButton.vue'
import {
  createAgentMultipart,
  fetchAgentAvatars,
  uploadAndValidatePackage,
} from '@/modules/market/my-uploads/services/myUploadsApi'
import { createPrivateAgent, fetchMarketAgents, hireMarketAgent } from '../service'
import { soloTeamApiErrorMessage } from '../utils/apiErrorMessage'
import { useSoloTeamStore } from '../store'
import { useUIStore } from '@/modules/space/uiStore'
import { useFileStore } from '@/modules/file/store'
import defaultAvatar from '@/modules/market/my-uploads/assets/agent/m05.png'
import emptyIllustration from '@/assets/home/flie-preview.png'
import activeIcon from '@/assets/soloTeam/active_icon.svg'
import createIcon from '@/assets/soloTeam/create_icon.png'
import uploadIcon from '@/assets/soloTeam/upload_icon.png'
import marketIcon from '@/assets/soloTeam/market_icon.png'
import uploadBgIcon from '@/assets/soloTeam/upload_agent_icon.png'
import uploadBtn from '@/assets/market/myupload/upload-btn.svg'
import errorIcon from '@/assets/market/myupload/error.svg'
import upIcon from '@/modules/market/avatar/components/images/up.svg'
import downIcon from '@/modules/market/avatar/components/images/down.svg'
import downloadIcon from '@/modules/market/avatar/components/images/download.svg'
import hireLoadingIconUrl from '@/assets/skill/skill-one-click-install-loading.png'
import isHiredIcon from '@/modules/market/avatar/components/images/isHired.png'

/** 来自 GET /api/admin/v1/public-biz-avatar/list?biz_type=agent_icon（封装见 fetchAgentAvatars） */
const avatarOptions = ref([{ id: 'default', name: 'default', src: defaultAvatar }])
const avatarIconsLoading = ref(false)

const props = defineProps({
  visible: { type: Boolean, required: true },
})

const emit = defineEmits(['close'])
const soloTeamStore = useSoloTeamStore()
const uiStore = useUIStore()
const fileStore = useFileStore()

const createModes = Object.freeze([
  {
    value: 'manual',
    title: '手写创建员工',
    desc: '自己填写名称、职位、描述与配置',
    icon: createIcon,
  },
  {
    value: 'upload',
    title: '通过压缩包上传',
    desc: '上传数字人压缩包',
    icon: uploadIcon,
  },
  {
    value: 'market',
    title: '从市场聘用',
    desc: '从数字人市场挑选并安装为我的员工',
    icon: marketIcon,
  },
])

const createMode = ref('manual')
/** 手写创建：与压缩包上传表单隔离，切换创建方式互不覆盖 */
const manualSelectedAvatar = ref(defaultAvatar)
const manualEmployeeName = ref('')
const manualDescription = ref('')
/** 压缩包上传编辑阶段：独立名称 / 描述 / 头像 */
const uploadSelectedAvatar = ref(defaultAvatar)
const uploadEmployeeName = ref('')
const uploadDescription = ref('')
const createLoading = ref(false)
const uploadCreateLoading = ref(false)

const PAGE_SIZE = 40
const SCROLL_LOAD_THRESHOLD_PX = 200
const STEP_NAMES = ['文件格式检测', '目录结构检测', '配置文件检测', '依赖项检测', '安全扫描', '完整性校验']
/** 与市场「上传数字人工程包」一致：前端校验上限 */
const MAX_AGENT_FILE_SIZE = 50 * 1024 * 1024
const AGENT_PACKAGE_FORMAT_HINT = '支持 .zip、.tar.gz 格式文件（最大50MB）'

const packageInputRef = ref(null)
const selectedFile = ref(null)
const isDragover = ref(false)
const uploadState = ref('idle')
const progressPercent = ref(0)
const validateResult = ref(null)
const uploadedFile = ref(null)
const uploadQueryData = ref({})
const progressItems = ref([])

const searchKeyword = ref('')
const selectedCategory = ref('all')
const selectedSort = ref('installed')
const favoritesOnly = ref(false)
const showAllCategories = ref(false)
const categories = ref([{ id: 'all', name: '全部' }])
const avatars = ref([])
const listPage = ref(1)
const hasMore = ref(true)
const listLoading = ref(false)
const loadMoreLoading = ref(false)
const scrollRoot = ref(null)
const categoryTagsRef = ref(null)
const hasOverflow = ref(false)
const marketInitialized = ref(false)
const hiringAgentId = ref('')
/** 列表请求后自动切回「全部」时跳过 watch，避免重复请求 */
const syncingMarketCategoryFromFetch = ref(false)
let resizeObserver = null
let uploadTimer = null
let uploadRunId = 0

const canConfirm = computed(() => {
  if (createMode.value === 'manual') {
    return (
      manualEmployeeName.value.trim().length > 0 &&
      manualDescription.value.trim().length > 0 &&
      !createLoading.value
    )
  }
  return true
})
const canUploadConfirm = computed(() => {
  return uploadState.value === 'editing' &&
    !!uploadedFile.value &&
    uploadEmployeeName.value.trim().length > 0 &&
    uploadDescription.value.trim().length > 0 &&
    !uploadCreateLoading.value
})

/** 压缩包上传：未选文件等场景底部「确定」置灰 */
const isUploadFooterConfirmDisabled = computed(() => {
  const state = uploadState.value
  if (state === 'idle') return true
  if (state === 'uploading' || state === 'validating') return true
  if (state === 'editing') return !canUploadConfirm.value
  if (state === 'result') return false
  return true
})

const uploadFooterConfirmLabel = computed(() => {
  if (uploadState.value === 'editing' && uploadCreateLoading.value) return '创建中'
  return '确定'
})

function handleUploadFooterConfirm() {
  const state = uploadState.value
  if (state === 'editing') {
    void handleUploadConfirm()
    return
  }
  if (state === 'result') {
    resetUpload()
  }
}

const packageFileBadge = computed(() => {
  const name = String(uploadedFile.value?.name || '').toLowerCase()
  if (name.endsWith('.tar.gz')) return 'TGZ'
  if (name.endsWith('.zip')) return 'ZIP'
  return 'PKG'
})

function changeCreateMode(mode) {
  createMode.value = mode
  if (mode === 'market') {
    void ensureMarketLoaded()
  }
}

function resetForm() {
  createMode.value = 'manual'
  const first = avatarOptions.value[0]?.src || defaultAvatar
  manualSelectedAvatar.value = first
  manualEmployeeName.value = ''
  manualDescription.value = ''
  uploadSelectedAvatar.value = first
  uploadEmployeeName.value = ''
  uploadDescription.value = ''
  resetUpload()
}

async function loadAgentIcons() {
  avatarIconsLoading.value = true
  try {
    const urls = await fetchAgentAvatars()
    const list = (Array.isArray(urls) ? urls : [])
      .map((src, i) => ({
        id: `agent-icon-${i}`,
        name: `agent-icon-${i}`,
        src: String(src || '').trim(),
      }))
      .filter((x) => x.src)
    avatarOptions.value = list.length
      ? list
      : [{ id: 'default', name: 'default', src: defaultAvatar }]
  } catch (error) {
    console.error('[CreateDigitalEmployeeDialog] fetchAgentAvatars failed:', error)
    avatarOptions.value = [{ id: 'default', name: 'default', src: defaultAvatar }]
  } finally {
    avatarIconsLoading.value = false
  }
  const first = avatarOptions.value[0]?.src || defaultAvatar
  const syncAvatar = (r) => {
    if (!r.value || !avatarOptions.value.some((a) => a.src === r.value)) {
      r.value = first
    }
  }
  syncAvatar(manualSelectedAvatar)
  syncAvatar(uploadSelectedAvatar)
}

function handleClose() {
  resetForm()
  emit('close')
}

function isValidAgentPackageFile(file) {
  const name = String(file?.name || '').toLowerCase()
  if (!name.endsWith('.zip') && !name.endsWith('.tar.gz')) {
    ElMessage.warning('数字人工程包仅支持 .zip、.tar.gz 格式')
    return false
  }
  if (file.size > MAX_AGENT_FILE_SIZE) {
    ElMessage.warning('文件大小不能超过 50MB')
    return false
  }
  return true
}

function triggerPackageInput() {
  packageInputRef.value?.click()
}

function handlePackageChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file && isValidAgentPackageFile(file)) {
    selectedFile.value = file
    void startUpload()
  }
}

function handleDrop(event) {
  isDragover.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file && isValidAgentPackageFile(file)) {
    selectedFile.value = file
    void startUpload()
  }
}

async function startUpload() {
  if (!selectedFile.value) return

  const currentRunId = ++uploadRunId
  progressItems.value = STEP_NAMES.map(name => ({ name, status: 'pending' }))
  uploadState.value = 'uploading'
  progressPercent.value = 0

  try {
    progressItems.value[0].status = 'loading'
    uploadTimer = window.setInterval(() => {
      if (progressPercent.value < 90) {
        progressPercent.value += 10
      } else if (uploadState.value === 'uploading') {
        uploadState.value = 'validating'
      }
    }, 200)

    const result = await uploadAndValidatePackage(selectedFile.value, 'agent')
    clearUploadTimer()
    if (currentRunId !== uploadRunId) return
    progressPercent.value = 100

    const validate = result.validate
    validateResult.value = validate
    progressItems.value.forEach(item => { item.status = 'success' })

    if (validate.success) {
      uploadedFile.value = selectedFile.value
      uploadQueryData.value = {
        packageName: validate.packageName || '',
        displayName: validate.displayName || '',
        version: validate.version || '',
        description: validate.description || '',
        tags: Array.isArray(validate.tags) ? validate.tags.join(',') : '',
        existingSlug: validate.packageName || '',
      }
      uploadEmployeeName.value = validate.name || validate.packageName || ''
      uploadDescription.value = validate.description || ''
      ElMessage.success('检测通过')
      uploadState.value = 'editing'
    } else {
      uploadState.value = 'result'
    }
  } catch (error) {
    clearUploadTimer()
    if (currentRunId !== uploadRunId) return
    progressPercent.value = 100
    const responseData = error?.response?.data
    if (error?.response?.status === 400 && responseData) {
      validateResult.value = responseData
      progressItems.value.forEach(item => { item.status = 'error' })
      uploadState.value = 'result'
    } else {
      ElMessage.error(soloTeamApiErrorMessage(error, '上传失败，请稍后重试'))
      uploadState.value = 'idle'
    }
  }
}

function clearUploadTimer() {
  if (uploadTimer) {
    window.clearInterval(uploadTimer)
    uploadTimer = null
  }
}

function resetUpload() {
  uploadRunId += 1
  clearUploadTimer()
  selectedFile.value = null
  isDragover.value = false
  uploadState.value = 'idle'
  progressPercent.value = 0
  validateResult.value = null
  uploadedFile.value = null
  uploadQueryData.value = {}
  progressItems.value = []
  uploadCreateLoading.value = false
}

function handleBackToUpload() {
  resetUpload()
}

function parseCreatedAgentId(body) {
  if (body == null || typeof body !== 'object') return ''
  const nested = body.data && typeof body.data === 'object' ? body.data : null
  return String(
    body.id
    ?? body.agent_id
    ?? body.agentId
    ?? nested?.id
    ?? nested?.agent_id
    ?? body.installed_agent_id
    ?? body.private_agent_id
    ?? body.agent?.id
    ?? '',
  ).trim()
}

/** 新建成功后：进入「我的员工」对话并切导航，引导页随之隐藏 */
async function enterCreatedEmployeeChat({ agentIdHint = '', nameHint = '' } = {}) {
  await soloTeamStore.loadEmployeeItems({ force: true })
  const list = soloTeamStore.employeeChatEmployees || []
  if (!list.length) return
  const hid = String(agentIdHint || '').trim()
  const name = String(nameHint || '').trim()
  let employee = null
  if (hid) {
    employee = list.find((x) => String(x.id) === hid) || null
  }
  if (!employee && name) {
    employee = list.find((x) => String(x.name || '').trim() === name) || null
  }
  if (!employee) {
    employee = [...list].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0]
  }
  if (!employee?.id) return
  await soloTeamStore.selectEmployeeThread(employee.id, null)
  const tid = soloTeamStore.currentEmployeeThreadId
  if (!tid) return
  uiStore.setActiveNavigation('solo-team', `employee:${employee.id}:${tid}`)
  uiStore.expandSidebar()
  // 刷新文件树
  fileStore.invalidateCloudNode('category_opt')
  window.dispatchEvent(new CustomEvent('files-uploaded-to-tree', {
    detail: { spaceId: employee.id, roomType: 'super_person_chat' },
  }))
}

async function handleUploadSaveSuccess(createResponse) {
  await enterCreatedEmployeeChat({
    agentIdHint: parseCreatedAgentId(createResponse),
    nameHint: uploadEmployeeName.value.trim(),
  })
  resetUpload()
  handleClose()
}

function formatUploadFileSize(bytes) {
  const value = Number(bytes) || 0
  if (!value) return ''
  if (value < 1024) return `${value}B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`
  return `${(value / 1024 / 1024).toFixed(1)}MB`
}

function parseUploadTags(tags) {
  if (Array.isArray(tags)) return tags
  return String(tags || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

async function handleUploadConfirm() {
  if (!uploadedFile.value) {
    ElMessage.warning('缺少包文件信息，请重新上传')
    return
  }
  if (!uploadEmployeeName.value.trim()) {
    ElMessage.warning('请输入员工名称')
    return
  }
  if (!uploadDescription.value.trim()) {
    ElMessage.warning('请输入描述')
    return
  }

  uploadCreateLoading.value = true
  try {
    const createRes = await createAgentMultipart(uploadedFile.value, {
      name: uploadQueryData.value.name || uploadEmployeeName.value.trim(),
      displayName: uploadEmployeeName.value.trim(),
      description: uploadDescription.value.trim(),
      version: uploadQueryData.value.version || '1.0.0',
      image: uploadSelectedAvatar.value,
      tags: parseUploadTags(uploadQueryData.value.tags),
      skills: [],
      changelog: '',
      scope: 'private',
      category: 'myEmployeeUpload'
    })
    await handleUploadSaveSuccess(createRes)
    ElMessage.success('创建成功')
  } catch (error) {
    console.error('[CreateDigitalEmployeeDialog] create agent from package failed:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '创建失败，请稍后重试'))
  } finally {
    uploadCreateLoading.value = false
  }
}

function disconnectCategoryResizeObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
}

function connectCategoryResizeObserver() {
  disconnectCategoryResizeObserver()
  if (typeof ResizeObserver === 'undefined') return
  if (!categoryTagsRef.value) return

  resizeObserver = new ResizeObserver(() => {
    updateCategoryOverflow()
  })
  resizeObserver.observe(categoryTagsRef.value)
}

function updateCategoryOverflow() {
  const el = categoryTagsRef.value
  if (!el) {
    hasOverflow.value = false
    return
  }

  if (showAllCategories.value) {
    hasOverflow.value = true
    return
  }

  const prevMaxHeight = el.style.maxHeight
  const prevOverflowY = el.style.overflowY

  el.style.maxHeight = '34px'
  el.style.overflowY = 'hidden'

  const collapsedNeedsMore = el.scrollHeight - el.clientHeight > 1

  el.style.maxHeight = prevMaxHeight
  el.style.overflowY = prevOverflowY

  hasOverflow.value = collapsedNeedsMore
}

function handleWindowResize() {
  updateCategoryOverflow()
}

function toggleCategoryExpand() {
  showAllCategories.value = !showAllCategories.value
}

function mapTagLabel(tag) {
  if (tag == null) return ''
  if (typeof tag === 'string') return tag
  if (typeof tag === 'object') {
    return String(tag.name ?? tag.title ?? tag.label ?? tag.displayName ?? tag.id ?? '').trim()
  }
  return String(tag)
}

function formatCategoryLabel(category) {
  const name = String(category?.name ?? '').trim()
  return name
}

function buildCategoriesFromAgentItems(items) {
  const countMap = new Map()
  for (const item of items || []) {
    const tags = Array.isArray(item?.tags) ? item.tags : []
    for (const tag of tags) {
      const name = mapTagLabel(tag)
      if (!name) continue
      countMap.set(name, (countMap.get(name) || 0) + 1)
    }
  }
  return Array.from(countMap.entries())
    .map(([name, count]) => ({
      id: name,
      name,
      count,
    }))
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)))
}

function loadCategories() {
  categories.value = [{ id: 'all', name: '全部' }]
}

function computeHasMore(pagination, batchLength, page) {
  if (batchLength === 0) return false
  if (batchLength < PAGE_SIZE) return false
  const total = Number(pagination?.total)
  if (Number.isFinite(total) && total >= 0) return page * PAGE_SIZE < total
  return batchLength >= PAGE_SIZE
}

async function loadAgents(reset = true, opts = {}) {
  const silent = Boolean(opts.silent)
  const skipScrollReset = Boolean(opts.skipScrollReset)

  if (!reset && (!hasMore.value || loadMoreLoading.value || listLoading.value)) return

  const nextPage = reset ? 1 : listPage.value + 1

  if (reset) {
    if (!silent) listLoading.value = true
    else loadMoreLoading.value = true
    hasMore.value = true
  } else {
    loadMoreLoading.value = true
  }

  const sortMap = {
    installed: 'popular',
    favorites: 'popular',
    latest: 'latest',
  }

  const params = {
    page: nextPage,
    pageSize: PAGE_SIZE,
    sort: sortMap[selectedSort.value] || 'popular',
    favoritesOnly: favoritesOnly.value,
  }

  const keyword = searchKeyword.value.trim()
  if (keyword) params.search = keyword

  try {
    const { items, pagination } = await fetchMarketAgents(params)
    const total = Number(pagination?.total)

    // 标签随当前筛选（搜索 / 排序 / 仅收藏）结果变化：基于本页 items 聚合；「全部」数量用接口 total
    if (reset) {
      const tagCats = buildCategoriesFromAgentItems(items)
      const allCount = Number.isFinite(total) ? total : items.length
      categories.value = [{ id: 'all', name: '全部', count: allCount }, ...tagCats]

      let effectiveCategory = selectedCategory.value
      if (effectiveCategory !== 'all' && !tagCats.some((c) => c.id === effectiveCategory)) {
        syncingMarketCategoryFromFetch.value = true
        effectiveCategory = 'all'
        selectedCategory.value = 'all'
        nextTick(() => {
          syncingMarketCategoryFromFetch.value = false
        })
      }

      const rows = effectiveCategory === 'all'
        ? items
        : items.filter(item => (item.tags || []).map(mapTagLabel).includes(effectiveCategory))

      avatars.value = rows
      listPage.value = 1
      if (!skipScrollReset && scrollRoot.value) scrollRoot.value.scrollTop = 0
      hasMore.value = computeHasMore(pagination, rows.length, nextPage)
    } else {
      const rows = selectedCategory.value === 'all'
        ? items
        : items.filter(item => (item.tags || []).map(mapTagLabel).includes(selectedCategory.value))

      if (rows.length === 0) {
        hasMore.value = false
      } else {
        avatars.value = [...avatars.value, ...rows]
        listPage.value = nextPage
        hasMore.value = computeHasMore(pagination, rows.length, nextPage)
      }
    }
  } catch (error) {
    console.error('[CreateDigitalEmployeeDialog] fetchMarketAgents failed:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '加载市场数字人失败'))
    if (reset) {
      avatars.value = []
      hasMore.value = false
    }
  } finally {
    listLoading.value = false
    loadMoreLoading.value = false
  }
}

async function ensureMarketLoaded() {
  await nextTick()
  connectCategoryResizeObserver()
  updateCategoryOverflow()
  // 首次进入市场：初始化分类；再次切回「从市场聘用」须重新拉列表（已聘用状态等会变化）
  if (!marketInitialized.value) {
    marketInitialized.value = true
    loadCategories()
  }
  await loadAgents(true)
  await nextTick()
  connectCategoryResizeObserver()
  updateCategoryOverflow()
}

function onListScroll() {
  const el = scrollRoot.value
  if (!el || !hasMore.value || listLoading.value || loadMoreLoading.value) return
  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollHeight - scrollTop - clientHeight < SCROLL_LOAD_THRESHOLD_PX) {
    void loadAgents(false)
  }
}

function onCollectChange({ id, collected, count }) {
  const avatar = avatars.value.find(a => a.id === id)
  if (avatar) {
    avatar.isCollected = collected
    avatar.favorites = count
  }
}

async function handleHireMarketAgent(avatar) {
  if (!avatar || hiringAgentId.value) return
  hiringAgentId.value = avatar.id
  try {
    const hireRes = await hireMarketAgent(avatar.id, { name: avatar.name })
    avatar.isHired = true
    await enterCreatedEmployeeChat({
      agentIdHint: parseCreatedAgentId(hireRes),
      nameHint: String(avatar?.name || '').trim(),
    })
    ElMessage.success('聘用成功')
    // 从市场聘用：不自动关弹框，由用户点底部「确定」再关闭（与手动创建等一致由用户结束流程）
  } catch (error) {
    console.error('[CreateDigitalEmployeeDialog] hireMarketAgent failed:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '聘用失败，请稍后重试'))
  } finally {
    hiringAgentId.value = ''
  }
}

function formatCount(num) {
  const value = Number(num) || 0
  if (value >= 10000) return `${(value / 10000).toFixed(1)}w`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

function onSearch() {
  void loadAgents(true)
}

async function handleConfirm() {
  if (!manualEmployeeName.value.trim()) {
    ElMessage.warning('请输入员工名称')
    return
  }
  if (!manualDescription.value.trim()) {
    ElMessage.warning('请输入描述')
    return
  }

  createLoading.value = true
  try {
    const body = await createPrivateAgent({
      name: manualEmployeeName.value.trim(),
      description: manualDescription.value.trim(),
      avatarUrl: manualSelectedAvatar.value,
      stateful: true,
    })
    await enterCreatedEmployeeChat({
      agentIdHint: parseCreatedAgentId(body),
      nameHint: manualEmployeeName.value.trim(),
    })
    ElMessage.success('创建成功')
    handleClose()
  } catch (error) {
    console.error('[CreateDigitalEmployeeDialog] createPrivateAgent failed:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '创建失败，请稍后重试'))
  } finally {
    createLoading.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  disconnectCategoryResizeObserver()
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  void loadAgentIcons()
  if (createMode.value === 'market') {
    void ensureMarketLoaded()
  }
})

watch([selectedCategory, selectedSort, favoritesOnly], () => {
  if (syncingMarketCategoryFromFetch.value) return
  if (createMode.value === 'market' && marketInitialized.value) {
    void loadAgents(true)
  }
})

watch(categories, async () => {
  await nextTick()
  connectCategoryResizeObserver()
  updateCategoryOverflow()
})
</script>

<style lang="scss" scoped>
@use '../styles/cancel-button.scss' as cancel-btn;

.digital-employee-form {
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
  width: 80px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
  color: #2F3547;
  text-align: left;
  white-space: nowrap;
}

.form-row > :not(.form-label) {
  flex: 1;
  min-width: 0;
}

.form-row--modes,
.form-row--textarea {
  align-items: center;
}

.form-row--avatar {
  align-items: flex-start;
}

.form-row--textarea {
  align-items: start;
}

.form-row--avatar .form-label {
  padding-top: 33px;
}

.form-row--textarea .form-label {
  padding-top: 10px;
}

.form-label.required::after {
  content: '*';
  margin-left: 2px;
  color: #F56C6C;
}

.mode-list {
  display: flex;
  gap: 8px;
}

.mode-card {
  flex: none;
  width: calc((100% - 16px) / 3);
  position: relative;
  min-height: 40px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #DFE2EA;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.mode-card:hover {
  border: 1px solid transparent;
  background-clip: padding-box;

  &::before {
    content: '';
    position: absolute;
    inset: 0px -1px -1px 0px;
    border-radius: 12px;
    padding: 1px;
    background: linear-gradient(270deg, #FF8670 23%, #C69FED 75%, #81BEFC 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    pointer-events: none;
  }
}

.mode-card.active {
  border: 1px solid transparent;
  background-clip: padding-box;

  &::before {
    content: '';
    position: absolute;
    inset: 0px -1px -1px 0px;
    border-radius: 12px;
    padding: 1px;
    background: linear-gradient(270deg, #FF8670 23%, #C69FED 75%, #81BEFC 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    pointer-events: none;
  }
}

.mode-icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  // background: rgba(47, 53, 71, 0.06);
  color: #606572;
  font-size: 24px;
  font-weight: 600;
  overflow: hidden;
}

.mode-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mode-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mode-title {
  font-family: PingFang SC;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: #3D3D3D;
}

.mode-desc {
  font-size: 12px;
  line-height: 16px;
  color: rgba(47, 53, 71, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mode-check {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 16px;
  height: 16px;
}

.avatar-field {
  width: 100%;
  min-width: 0;
  min-height: 84px;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 8px;
  background: #F7F8FB;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  /* 始终占用细滚动条槽位，避免悬停时条出现导致高度变化抖动 */
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

.avatar-field::-webkit-scrollbar-track {
  background: transparent;
}

.avatar-field__track {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 16px;
  width: max-content;
  min-height: 54px;
}

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
  background: linear-gradient(#fff, #fff) padding-box,
              linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
}

.avatar-option img {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
}

.visually-hidden {
  display: none;
}

.field-tip {
  font-size: 11px;
  line-height: 16px;
  color: rgba(47, 53, 71, 0.35);
}

.text-field,
.textarea-field {
  position: relative;
}

.text-input,
.description-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #E5E5E5;
  border-radius: 8px;
  outline: none;
  color: #0A0E23;
  background: #fff;
  transition: all 0.2s;
}

.text-input {
  height: 32px;
  padding: 0 54px 0 16px;
  font-size: 14px;
}

.description-input {
  min-height: 136px;
  resize: none;
  padding: 10px 16px 28px;
  font-size: 14px;
  line-height: 20px;
}

.text-input:focus,
.description-input:focus {
  border-color: #FF9566;
  background: #fff;
}

.text-input::placeholder,
.description-input::placeholder {
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  color: rgba(10, 14, 35, 0.2);
  opacity: 1;
}

.text-count,
.textarea-count {
  position: absolute;
  right: 10px;
  color: rgba(47, 53, 71, 0.28);
  font-size: 10px;
  pointer-events: none;
}

.text-count {
  top: 8px;
}

.textarea-count {
  right: 12px;
  bottom: 8px;
}

.create-mode-panel {
  min-height: 420px;
  border-radius: 12px;
  background: #fff;
}

.upload-panel {
  height: 520px;
  min-height: 520px;
  overflow: auto;

  :deep(.avatar-edit) {
    min-height: 520px;
    padding: 0;
    border: none;
    background: #fff;
  }
}

.upload-edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0;
}

.upload-file-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-file-status {
  color: rgba(47, 53, 71, 0.45);
  font-size: 12px;
  line-height: 16px;
}

.upload-file-card {
  width: 100%;
  height: 48px;
  box-sizing: border-box;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
  background: #F7F8FB;
  color: #2F3547;
}

.upload-file-icon {
  width: 30px;
  height: 22px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: #23C36B;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.upload-file-name {
  min-width: 0;
  flex: 0 1 auto;
  color: #2F3547;
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.upload-file-size {
  flex-shrink: 0;
  color: rgba(47, 53, 71, 0.45);
  font-size: 12px;
}

.upload-file-remove {
  width: 18px;
  height: 18px;
  margin-left: auto;
  border: none;
  border-radius: 50%;
  background: rgba(47, 53, 71, 0.18);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
}

.upload-view__body {
  min-height: 420px;
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
  margin-bottom: 32px;
  font-size: 24px;
  font-weight: 500;
  color: #2F3547;
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
  margin-bottom: 8px;
  font-size: 20px;
  font-weight: 500;
  color: #2F3547;
}

.progress-subtitle {
  margin-bottom: 24px;
  font-size: 14px;
  color: #8F959E;
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
  box-sizing: border-box;
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

.market-panel {
  height: 382px;
  min-height: 382px;
  display: flex;
  flex-direction: column;
  /* 勿 overflow:hidden，否则会裁切搜索框右上圆角 */
}

.market-panel__search-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
  flex-shrink: 0;

  .form-label {
    width: 72px;
    font-weight: 600;
    color: #2F3547;
  }
}

.market-panel__search {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;

  :deep(.market-spec-search) {
    width: 100%;
  }

  :deep(.el-input__wrapper) {
    width: 100%;
  }
}

.avatar-market-view__category-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 88px;
  padding-bottom: 10px;
  border-bottom: none;
}

.avatar-market-view__category-tags {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  min-width: 0;
  overflow: hidden;
  max-height: 34px;
  transition: max-height 0.1s ease;

  &.is-expanded {
    max-height: 120px;
  }
}

.avatar-market-view__cat {
  box-sizing: border-box;
  height: 28px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 1px 12px;
  border: none;
  border-radius: 16px;
  background: transparent;
  color: #606572;
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &--chip:not(.avatar-market-view__cat--all) {
    max-width: min(240px, 100%);
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &--all:not(.is-active) {
    min-width: 52px;
    flex: 0 0 auto;
  }

  &.is-active {
    color: #ff6d40;
    background: #ffeeeb;
    font-weight: 600;
  }
}

.avatar-market-view__category-expand-btn {
  width: 50px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  border: none;
  border-radius: 16px;
  background: transparent;
  color: #91949e;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
  align-self: flex-start;
  margin-top: 3px;
}

.avatar-market-view__expand-arrow-icon {
  width: 12px;
  height: 12px;
  margin-left: 2px;
  flex-shrink: 0;
  display: block;
}

.avatar-market-view__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-left: 88px;
  padding-right: 2px;
}

.avatar-market-view__toolbar {
  display: none;
  align-items: center;
  gap: 0;
  margin-bottom: 16px;
  padding-top: 12px;
  flex-wrap: wrap;
}

.avatar-market-view__sort {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-market-view__toolbar-divider {
  width: 1px;
  height: 14px;
  margin: 0 16px 0 20px;
  flex-shrink: 0;
  background: #dfe2ea;
}

.avatar-market-view__only-fav {
  :deep(.el-checkbox__label) {
    padding-left: 8px;
    font-size: 14px;
    line-height: 22px;
    color: #606572;
  }

  :deep(.el-checkbox__inner) {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border-color: #dfe2ea;
  }

  :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
    background-color: #ff684e;
    border-color: #ff684e;
  }
}

.avatar-market-view__sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #606572;
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &.is-active {
    font-weight: 600;
    color: #ff684e;
    background: #ffeeeb;
  }
}

.avatar-market-view__flame {
  font-size: 14px;
  line-height: 1;
}

.avatar-market-view__grid {
  display: grid;
  row-gap: 24px;
  column-gap: 14px;
  align-items: stretch;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-top: 20px;
  padding-bottom: 8px;
}

.market-agent-card {
  box-sizing: border-box;
  position: relative;
  min-height: 140px;
  padding: 14px 12px 10px 16px;
  border: 1px solid #eceef3;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  overflow: visible;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: transparent;
    background:
      linear-gradient(#fff, #fff) padding-box,
      linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
  }

  &.is-hired {
    border-color: rgba(99, 179, 237, 0.3);
  }
}

.market-agent-card__top {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.market-agent-card__media {
  width: 72px;
  height: 72px;
  margin-top: -26px;
  flex: 0 0 72px;
  overflow: visible;
  position: relative;
  z-index: 1;
}

.market-agent-card__avatar {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.market-agent-card__meta {
  min-width: 0;
  flex: 1;
}

.market-agent-card__title-row,
.market-agent-card__tag-row,
.market-agent-card__footer,
.market-agent-card__stats {
  display: flex;
  align-items: center;
}

.market-agent-card__title-row {
  gap: 6px;
  margin-bottom: 2px;
}

.market-agent-card__name {
  max-width: 118px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: #2f3547;
}

.market-agent-card__version {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 18px;
  color: #91949e;
}

.market-agent-card__tag-row {
  gap: 4px;
  margin-top: 2px;
}

.market-agent-card__tag {
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  background: #eceef3;
  color: #606572;
  font-size: 12px;
  line-height: 20px;
}

.market-agent-card__org {
  max-width: 78px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #91949e;
  font-size: 12px;
}

.market-agent-card__desc {
  margin: 8px 0 10px;
  min-height: 40px;
  overflow: hidden;
  color: #8f959e;
  font-size: 12px;
  line-height: 20px;
  line-clamp: 2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.market-agent-card__footer {
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
}

.market-agent-card__stats {
  gap: 12px;
  color: #606572;
  font-size: 12px;
}

.market-agent-card__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #606572;
  line-height: 1;
}

.market-agent-card__stat-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  display: block;
  object-fit: contain;
}

.market-agent-card__stat-num {
  display: inline-flex;
  align-items: center;
  min-height: 14px;
  line-height: 14px;
  font-size: inherit;
}

.market-agent-card__hire {
  min-width: 52px;
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: #171b26;
  color: #fff;
  font-size: 12px;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.market-agent-card__hire-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.market-agent-card__hire-spinner {
  animation: marketHireSpin 1s linear infinite;
}

@keyframes marketHireSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.market-agent-card__hired-badge {
  position: absolute;
  left: -8px;
  bottom: -8px;
  width: 51px;
  height: 30px;
  z-index: 2;
}

.avatar-market-view__empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 48px 24px;
  margin-top: 8px;
  text-align: center;
}

.avatar-market-view__empty-state-img {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
  object-fit: contain;
  display: block;
  margin-bottom: 12px;
}

.avatar-market-view__empty-state-text {
  margin: 0;
  font-size: 14px;
  line-height: 24px;
  color: #2f3547;
}

.avatar-market-view__list-footer {
  margin: 8px 0 0;
  padding: 12px 0 8px;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
  color: #91949e;

  &--loading {
    color: #606572;
  }

  &--end {
    color: #5e6672;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
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
  @include cancel-btn.solo-team-cancel-button;
}

.btn-confirm {
  background: #1C1A21;
  color: #fff;
}

.btn-confirm:not(:disabled):hover {
  background: #2E323C;
}

.btn-confirm:disabled {
  cursor: not-allowed;
  opacity: 0.3;
  background: #0C1018;
}
</style>

<style lang="scss">
@use '@/shared/styles/delete-confirm-dialog.scss' as delete-confirm;

/* 遮罩层 flex 居中，配合 align-center 与固定高度 626px */
.create-digital-employee-dialog-overlay.el-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
}

.create-digital-employee-dialog-overlay .el-overlay-dialog {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0;
  padding: 0;
  max-height: 100%;
  overflow: hidden;
}

.el-dialog.create-digital-employee-dialog {
  box-sizing: border-box;
  height: 626px;
  max-height: 626px;
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

  @include delete-confirm.el-dialog-header-row;

  .el-dialog__header {
    flex-shrink: 0;
  }

  .el-dialog__title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: normal;
    color: #2F3547;
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
    padding: 0 16px;
    padding-left: 0;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-gutter: stable;
    display: flex;
    flex-direction: column;
  }

  .el-dialog__footer {
    flex-shrink: 0;
    padding: 0 16px 14px;
  }
}
</style>
