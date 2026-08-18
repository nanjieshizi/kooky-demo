<template>
  <div class="skill-one-click-install-wrapper">
    <!-- 下拉卡片模式 -->
    <el-dropdown
      v-if="mode === 'dropdown'"
      ref="dropdownRef"
      trigger="click"
      popper-class="skill-install-dropdown__popper"
      :hide-on-click="false"
      @visible-change="onDropdownVisibleChange"
    >
      <MarketCustomButton
        class="skill-one-click-install"
        :class="{
          'is-installing': installInProgress,
        }"
        variant="dark"
        :disabled="disabled"
        :size="size"
      >
        <span class="skill-one-click-install__inner">
          <img
            v-if="installInProgress"
            class="skill-one-click-install__spinner-img"
            :src="anzhuangzhong"
            width="14"
            height="14"
            alt=""
          />
          <span>{{ buttonText }}</span>
          <img
            v-if="!installInProgress"
            class="skill-one-click-install__arrow"
            :class="{ 'is-open': dropdownVisible }"
            :src="skillAzUrl"
            alt=""
          />
        </span>
      </MarketCustomButton>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            command="__title__"
            disabled
            class="skill-install-dropdown__title-item"
          >
            <span class="skill-install-dropdown__title-text">请选择安装目标</span>
          </el-dropdown-item>
          <el-dropdown-item
            v-if="loading"
            command="__loading__"
            disabled
            class="skill-install-dropdown__loading-item"
          >
            <div class="skill-install-dropdown__loading-row">
              <img class="skill-install-dropdown__loading-spin" :src="skillZhuanquanUrl" alt="" />
              <span class="skill-install-dropdown__loading-text">请稍候...</span>
            </div>
          </el-dropdown-item>

          <el-dropdown-item
            v-for="opt in agentOptions"
            :key="opt.id"
            command="__noop__"
            :disabled="false"
            class="skill-install-dropdown__item"
          >
            <div
              class="skill-install-dropdown__row"
              :class="{ 'is-installing': installingAgentIds.includes(opt.id) }"
              @click.stop="handleDropdownInstall(opt)"
            >
              <!-- 三类目标的图标：persona 紫色圆 / kode 黑色圆 / digital-human 原头像 -->
              <span
                v-if="opt.kind === 'persona'"
                class="skill-install-dropdown__icon skill-install-dropdown__icon--persona"
              >👤</span>
              <span
                v-else-if="opt.kind === 'kode'"
                class="skill-install-dropdown__icon skill-install-dropdown__icon--kode"
              >⌘_</span>
              <img
                v-else
                class="skill-install-dropdown__avatar"
                :src="opt.avatar"
                :alt="opt.name"
                @error="onAvatarError"
              />

              <div class="skill-install-dropdown__name-wrap">
                <span class="skill-install-dropdown__name">{{ opt.name }}</span>
                <template v-if="opt.rowStatus === 'done' && !opt.isLatest">
                  <img class="skill-install-dropdown__update-prompt-icon" :src="updatePromptIconUrl" alt="" />
                  <span class="skill-install-dropdown__update-label">体验新版</span>
                </template>
              </div>
              <img
                v-if="installingAgentIds.includes(opt.id) || opt.rowStatus === 'installing'"
                class="skill-install-dropdown__status-img skill-install-dropdown__status-img--spin"
                :src="skillZhuanquanUrl"
                alt=""
              />
              <img
                v-else-if="opt.rowStatus === 'idle'"
                class="skill-install-dropdown__status-img skill-install-dropdown__status-img--clickable"
                :src="skillDownloadUrl"
                alt=""
              />
              <img
                v-else-if="opt.rowStatus === 'done' && !opt.isLatest"
                class="skill-install-dropdown__status-img skill-install-dropdown__status-img--clickable"
                :src="switchIconUrl"
                width="14"
                height="14"
                alt=""
                @click.stop="handleUpdate(opt)"
              />
              <img
                v-else
                class="skill-install-dropdown__status-img"
                :src="skillDuihaoUrl"
                alt=""
              />
            </div>
          </el-dropdown-item>

          <el-dropdown-item
            v-if="!agentOptions.length && !loading"
            command="__empty__"
            disabled
          >
            暂无可用安装目标
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 弹窗模式 -->
    <template v-else-if="mode === 'dialog'">
      <MarketCustomButton
        class="skill-one-click-install"
        :class="{
          'is-installing': installInProgress,
        }"
        variant="dark"
        :disabled="disabled"
        :size="size"
        @click.stop="onButtonClick"
      >
        <span class="skill-one-click-install__inner">
          <img
            v-if="installInProgress"
            class="skill-one-click-install__spinner-img"
            :src="skillZhuanquanUrl"
            width="14"
            height="14"
            alt=""
          />
          <span>{{ buttonText }}</span>
        </span>
      </MarketCustomButton>

      <el-dialog
        v-model="dialogVisible"
        class="skill-install-dialog"
        width="450px"
        align-center
        destroy-on-close
        :show-close="false"
        append-to-body
      >
      <template #header>
        <div class="skill-install-dialog__header">
          <span class="skill-install-dialog__title">请选择安装目标</span>
          <button class="skill-install-dialog__close" @click="dialogVisible = false">
            <img :src="closeIconUrl" width="16" height="16" alt="关闭" />
          </button>
        </div>
      </template>

      <div class="skill-install-dialog__list-wrap">
        <div
          v-if="loading"
          class="skill-install-dialog__loading-overlay"
        >
          <img class="skill-install-dialog__loading-gif" :src="skillLoadingGifUrl" alt="加载中" />
          <span class="skill-install-dialog__loading-text">请稍候...</span>
        </div>
        <ul
          v-if="agentOptions.length"
          class="skill-install-dialog__list"
        >
          <li
            v-for="opt in agentOptions"
            :key="opt.id"
            class="skill-install-dialog__row"
            @click="onDialogRowClick(opt)"
          >
            <!-- 我的分身：紫色小圆 + 👤；Kode：黑色小圆 + ⌘_；数字员工：原头像 -->
            <span
              v-if="opt.kind === 'persona'"
              class="skill-install-dialog__icon skill-install-dialog__icon--persona"
            >👤</span>
            <span
              v-else-if="opt.kind === 'kode'"
              class="skill-install-dialog__icon skill-install-dialog__icon--kode"
            >⌘_</span>
            <img
              v-else
              class="skill-install-dialog__avatar"
              :src="opt.avatar"
              :alt="opt.name"
              @error="onAvatarError"
            />

            <div class="skill-install-dialog__name-wrap">
              <span class="skill-install-dialog__name">{{ opt.name }}</span>
              <template v-if="opt.rowStatus === 'done' && !opt.isLatest">
                <img class="skill-install-dialog__update-prompt-icon" :src="updatePromptIconUrl" alt="" />
                <span class="skill-install-dialog__update-label">体验新版</span>
              </template>
            </div>
            <div class="skill-install-dialog__status">
              <img
                v-if="installingAgentIds.includes(opt.id) || opt.rowStatus === 'installing'"
                class="skill-install-dialog__status-img skill-install-dialog__status-img--spin"
                :src="skillZhuanquanUrl"
                alt=""
              />
              <img
                v-else-if="opt.rowStatus === 'idle'"
                class="skill-install-dialog__status-img skill-install-dialog__status-img--clickable"
                :src="skillDownloadUrl"
                alt=""
              />
              <img
                v-else-if="opt.rowStatus === 'done' && !opt.isLatest"
                class="skill-install-dialog__status-img skill-install-dialog__status-img--clickable"
                :src="switchIconUrl"
                width="14"
                height="14"
                alt=""
                @click.stop="handleUpdate(opt)"
              />
              <img
                v-else
                class="skill-install-dialog__status-img"
                :src="skillDuihaoUrl"
                alt=""
              />
            </div>
          </li>
        </ul>
        <p
          v-else-if="!loading"
          class="skill-install-dialog__empty"
        >
          暂无可用安装目标
        </p>
      </div>

      <template #footer>
        <div class="skill-install-dialog__footer">
          <MarketCustomButton @click="dialogVisible = false">取消</MarketCustomButton>
          <MarketCustomButton variant="dark" @click="dialogVisible = false">确定</MarketCustomButton>
        </div>
      </template>
    </el-dialog>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MarketCustomButton from './MarketCustomButton.vue'
import skillAzUrl from '@/assets/skill/skill-az.svg?url'
import skillDownloadUrl from '@/assets/skill/skill-xiazai.svg?url'
import skillDuihaoUrl from '@/assets/skill/skill-duihao.svg?url'
import skillZhuanquanUrl from '@/assets/skill/skill-zhuanquan.png'
import anzhuangzhong from "@/assets/skill/loading-anzhuang.png"
import skillLoadingGifUrl from '@/assets/skill/skill-loading.gif'
import skillManDefaultSrc from '@/assets/skill/skill-man.png'
import updatePromptIconUrl from '@/assets/market/update-prompt-icon .png'
import switchIconUrl from '@/assets/market/switch.svg'
import closeIconUrl from '@/assets/home/close.svg'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import { fetchSkillBindingStatus, installSkillToAgent } from '@/modules/market/skill/skillMarketApi.js'

const props = defineProps({
  /** Skill 标识 */
  skillSlug: { type: String, default: '' },
  /** 父级控制禁用 */
  disabled: { type: Boolean, default: false },
  /** 按钮尺寸 */
  size: {
    type: String,
    default: 'default',
    validator: (v) => v === 'default' || v === 'small',
  },
  /** 展示模式：dropdown 下拉卡片 | dialog 弹窗 */
  mode: {
    type: String,
    default: 'dropdown',
    validator: (v) => v === 'dropdown' || v === 'dialog',
  },
})

const emit = defineEmits(['installed', 'dialog-open', 'dialog-close'])

const skillSlugTrim = computed(() => String(props.skillSlug ?? '').trim())

// 状态管理
const loading = ref(false)
const agentOptions = ref([])
const installingAgentIds = ref([])
const installInProgress = ref(false)
const latestVersion = ref('')
const selectedId = ref(null)

// 弹窗的显示状态
const dialogVisible = ref(false)

watch(dialogVisible, (val) => {
  emit(val ? 'dialog-open' : 'dialog-close')
})

// 按钮文本
const buttonText = computed(() => {
  if (installInProgress.value) return '安装中'
  return '安装'
})

/** 头像 URL 解析 */
function resolveAgentAvatarUrl(path) {
  const raw = String(path ?? '').trim()
  if (!raw) return skillManDefaultSrc
  if (/^data:/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (/default-avatar\.png/i.test(raw)) return skillManDefaultSrc
  const base = getOneBaseUrl().replace(/\/$/, '')
  if (!base) return skillManDefaultSrc
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

/** 映射 Agent 选项 */
function mapBindingAgentToOption(item, index) {
  const id = item?.agentId ?? item?.agentName ?? `agent-${index}`
  const name = String(item?.displayName ?? item?.agentName ?? item?.name ?? '').trim() || String(id) || '未命名'
  const boundVersion = item?.boundVersion || null
  const isLatest = boundVersion ? (item?.isLatest ?? true) : false
  return {
    id,
    name,
    avatar: resolveAgentAvatarUrl(item?.avatar),
    rowStatus: boundVersion ? 'done' : 'idle',
    boundVersion,
    isLatest,
    // 新增：kind 区分三类安装目标
    kind: item?.kind || 'digital-human',
    description: item?.description || '',
    raw: item,
  }
}

// 三类目标分组：我的分身（唯一）/ 数字员工（多个）/ Kode 终端（唯一）
const personaOpt = computed(() => agentOptions.value.find((o) => o.kind === 'persona') || null)
const kodeOpt = computed(() => agentOptions.value.find((o) => o.kind === 'kode') || null)
const digitalOpts = computed(() => agentOptions.value.filter((o) => o.kind === 'digital-human'))

/** 加载 Agent 列表 */
async function loadAgentOptions() {
  const slug = skillSlugTrim.value
  if (!slug) {
    agentOptions.value = []
    latestVersion.value = ''
    return
  }
  loading.value = true
  try {
    const { agents, latestVersion: lv } = await fetchSkillBindingStatus(slug)
    agentOptions.value = agents.map(mapBindingAgentToOption)
    latestVersion.value = lv || ''
  } catch (e) {
    console.error('加载 Agent 列表失败:', e)
    agentOptions.value = []
    latestVersion.value = ''
  } finally {
    loading.value = false
  }
}

/** 按钮点击（仅弹窗模式使用） */
function onButtonClick() {
  if (props.disabled || installInProgress.value) return

  dialogVisible.value = true
  loadAgentOptions()
}

/** 下拉显示状态变化 */
const dropdownVisible = ref(false)
function onDropdownVisibleChange(visible) {
  dropdownVisible.value = visible
  if (visible) {
    loadAgentOptions()
  }
}

/** 头像加载失败 */
function onAvatarError(ev) {
  const el = ev?.target
  if (el && 'src' in el) el.src = skillManDefaultSrc
}

/** 下拉模式：点击下载图标触发安装 */
async function handleDropdownInstall(opt) {
  const slug = skillSlugTrim.value
  if (!slug) {
    ElMessage.warning('缺少 Skill 标识')
    return
  }
  await handleInstall(opt.id, slug)
}

/** 处理安装 */
async function handleInstall(agentId, slug) {
  const agent = agentOptions.value.find((opt) => opt.id === agentId)
  if (agent?.rowStatus === 'done') {
    ElMessage.info('该数字人已安装此 Skill')
    return
  }

  // 前端限制：安装中时不允许安装第二个
  if (installInProgress.value) {
    ElMessage.warning('请等待上一个操作完成')
    return
  }

  installInProgress.value = true
  installingAgentIds.value = [...installingAgentIds.value, agentId]

  try {
    await installSkillToAgent(slug, agentId)
    ElMessage.success('安装成功')
    emit('installed', { skillSlug: slug, agentId, action: 'install' })

    agentOptions.value = agentOptions.value.map((opt) =>
      opt.id === agentId ? { ...opt, rowStatus: 'done', isLatest: true, boundVersion: latestVersion.value } : opt,
    )
  } catch (e) {
    const msg = (typeof e === 'object' && e != null && (e.message || e.msg)) ||
      (typeof e === 'string' ? e : '') ||
      '安装失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    installingAgentIds.value = installingAgentIds.value.filter((id) => id !== agentId)
    installInProgress.value = false
  }
}

/** 处理更新 */
async function handleUpdate(opt) {
  const agentId = opt.id
  const slug = skillSlugTrim.value
  if (!slug) {
    ElMessage.warning('缺少 Skill 标识')
    return
  }

  // 前端限制：安装中时不允许更新
  if (installInProgress.value) {
    ElMessage.warning('请等待上一个操作完成')
    return
  }

  installInProgress.value = true
  installingAgentIds.value = [...installingAgentIds.value, agentId]

  try {
    await installSkillToAgent(slug, agentId, { version: latestVersion.value })
    ElMessage.success('更新成功')
    emit('installed', { skillSlug: slug, agentId, action: 'update' })

    agentOptions.value = agentOptions.value.map((item) =>
      item.id === agentId
        ? { ...item, rowStatus: 'done', isLatest: true, boundVersion: latestVersion.value }
        : item,
    )
  } catch (e) {
    const msg = (typeof e === 'object' && e != null && (e.message || e.msg)) ||
      (typeof e === 'string' ? e : '') ||
      '更新失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    installingAgentIds.value = installingAgentIds.value.filter((id) => id !== agentId)
    installInProgress.value = false
  }
}

/** 弹窗行点击 */
async function onDialogRowClick(opt) {
  if (loading.value || installingAgentIds.value.includes(opt.id)) return

  // 前端限制：安装中时不允许点击其他项
  if (installInProgress.value) {
    ElMessage.warning('请等待上一个操作完成')
    return
  }

  if (opt.rowStatus === 'done') {
    ElMessage.info('该数字人已安装此 Skill，无需重复安装')
    return
  }

  if (opt.rowStatus === 'installing') {
    ElMessage.warning('该数字人正在安装中，请稍候')
    return
  }

  selectedId.value = opt.id
  await handleInstall(opt.id, skillSlugTrim.value)
}

// 监听 slug 变化重置状态
watch(skillSlugTrim, () => {
  agentOptions.value = []
  installingAgentIds.value = []
  installInProgress.value = false
  latestVersion.value = ''
  selectedId.value = null
})
</script>

<style lang="scss" scoped>
.skill-one-click-install-wrapper {
  display: inline-block;
  position: relative;
}

.skill-one-click-install.market-custom-button--dark {
  min-width: 64px;
  --mcb-dark-hover-bg: #2b3142;
  --mcb-dark-hover-border: #2b3142;
  --mcb-dark-active-bg: #10131c;
  --mcb-dark-active-border: #10131c;
}

.skill-one-click-install__inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  line-height: 1;
}

.skill-one-click-install__spinner-img {
  display: block;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  object-fit: contain;
  animation: skill-install-spin 0.9s linear infinite;
}

.skill-one-click-install__arrow {
  width: 12px;
  height: 12px;
  transition: transform 0.3s;

  &.is-open {
    transform: rotate(180deg);
  }
}

.skill-one-click-install__arrow.is-spinning {
  animation: skill-install-spin 0.9s linear infinite;
}

@keyframes skill-install-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 弹窗样式 */
.skill-install-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.skill-install-dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.skill-install-dialog__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
  flex-shrink: 0;
  padding: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.skill-install-dialog__list-wrap {
  position: relative;
  height: 100%;
  min-height: 0;
}

.skill-install-dialog__loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  // background: rgba(255, 255, 255, 0.7);
}

.skill-install-dialog__loading-gif {
  width: 28px;
  height: 28px;
  display: block;
  object-fit: contain;
}

.skill-install-dialog__loading-text {
  font-size: 14px;
  line-height: 22px;
  color: #606572;
}

.skill-install-dialog__empty {
  margin: 24px 0;
  text-align: center;
  font-size: 14px;
  color: #6b7280;
}

.skill-install-dialog__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.skill-install-dialog__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin: 0 -4px;
  border-radius: 8px;
  cursor: default;
  transition: background 0.15s;

  &:hover {
    background: #F5F6F9;
  }

  &.is-selected {
    background: #f3f4f6;
  }
}

.skill-install-dialog__avatar {
  width: 24px;
  height: 24px;
  border-radius: 24px;
  object-fit: cover;
  flex-shrink: 0;
}

.skill-install-dialog__name-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.skill-install-dialog__name {
  font-size: 14px;
  color: #2F3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-install-dialog__update-prompt-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}

.skill-install-dialog__update-label {
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  display: flex;
  align-items: center;
  letter-spacing: normal;
  color: #FF621F;
  flex-shrink: 0;
  white-space: nowrap;
}

.skill-install-dialog__status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.skill-install-dialog__status-img {
  width: 18px;
  height: 18px;
  display: block;
  object-fit: contain;
}

.skill-install-dialog__status-img--clickable {
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.7;
  }
}

.skill-install-dialog__status-img--spin {
  animation: skill-dialog-spin 0.9s linear infinite;
}

@keyframes skill-dialog-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.skill-install-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* dialog 行的 icon（替代 avatar 的位置），尺寸跟 .skill-install-dialog__avatar 一致 */
.skill-install-dialog__icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}
.skill-install-dialog__icon--persona {
  background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
  color: #ffffff;
}
.skill-install-dialog__icon--kode {
  background: #111827;
  color: #4ade80;
  font-family: 'SFMono-Regular', 'Menlo', monospace;
  font-size: 10px;
  letter-spacing: -0.5px;
}
</style>

<style lang="scss">
/* 下拉菜单样式（全局，因为 popper 挂在 body） */
.skill-install-dropdown__popper {
  padding: 0 !important;
  border: none !important;
  width: 280px !important;
  min-width: 280px !important;
  max-width: 280px !important;
  border-radius: 12px !important;
  background: #ffffff !important;
  box-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.1) !important;
  overflow: hidden !important;
}

.skill-install-dropdown__popper.el-popper {
  width: 280px !important;
  min-width: 280px !important;
  max-width: 280px !important;
}

.skill-install-dropdown__popper .el-dropdown-menu {
  width: 100% !important;
  min-width: 100% !important;
  max-width: 100% !important;
  max-height: 40vh !important;
  overflow-y: auto !important;
  padding: 12px !important;
  background: #fff !important;
  border-radius: 12px !important;
}

.skill-install-dropdown__popper .el-dropdown-menu__item.skill-install-dropdown__title-item {
  height: auto !important;
  padding: 8px 12px 14px !important;
  cursor: default !important;
}

.skill-install-dropdown__popper .el-dropdown-menu__item.skill-install-dropdown__loading-item {
  height: auto !important;
  padding: 4px 12px 12px !important;
  cursor: default !important;
}

.skill-install-dropdown__loading-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.skill-install-dropdown__loading-spin {
  width: 16px;
  height: 16px;
  display: block;
  object-fit: contain;
  flex-shrink: 0;
  animation: skill-dropdown-spin 0.9s linear infinite;
}

.skill-install-dropdown__loading-text {
  font-size: 13px;
  color: #606572;
  line-height: 20px;
}

.skill-install-dropdown__popper .skill-install-dropdown__title-text {
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: #2f3547 !important;
}

.skill-install-dropdown__popper .el-dropdown-menu__item.skill-install-dropdown__item {
  height: auto !important;
  line-height: normal !important;
  padding: 0 !important;
  margin: 4px 0 !important;
  border-radius: 8px !important;
  cursor: default !important;
}

.skill-install-dropdown__popper .el-dropdown-menu__item.skill-install-dropdown__item:hover,
.skill-install-dropdown__popper .el-dropdown-menu__item.skill-install-dropdown__item:focus {
  background: transparent !important;
}

.skill-install-dropdown__popper .el-dropdown-menu__item.is-disabled.skill-install-dropdown__item {
  opacity: 1 !important;
}

/* dropdown 行 persona/kode 的 icon（替代 avatar），尺寸跟 .skill-install-dropdown__avatar 一致 */
.skill-install-dropdown__popper .skill-install-dropdown__icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}
.skill-install-dropdown__popper .skill-install-dropdown__icon--persona {
  background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
  color: #ffffff;
}
.skill-install-dropdown__popper .skill-install-dropdown__icon--kode {
  background: #111827;
  color: #4ade80;
  font-family: 'SFMono-Regular', 'Menlo', monospace;
  font-size: 10px;
  letter-spacing: -0.5px;
}

.skill-install-dropdown__row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 40px;
  box-sizing: border-box;
  padding: 0 12px;
  border-radius: 8px;
  background: transparent;
  transition: background 0.15s;
}

.skill-install-dropdown__row:hover {
  background: #F5F6F9;
}

.skill-install-dropdown__row.is-installing {
  background: #f7f8fa;
}

.skill-install-dropdown__avatar {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  background: #e5e7eb;
}

.skill-install-dropdown__name-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.skill-install-dropdown__name {
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: #2f3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-install-dropdown__update-prompt-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}

.skill-install-dropdown__update-label {
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  display: flex;
  align-items: center;
  letter-spacing: normal;
  color: #FF621F;
  flex-shrink: 0;
  white-space: nowrap;
}

.skill-install-dropdown__version {
  font-size: 12px;
  color: #91949e;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.skill-install-dropdown__update-badge {
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 500;
  color: #ff684e;
  background: #fff0ed;
  border-radius: 4px;
}

.skill-install-dropdown__update-btn {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #ffffff;
  background: #ff684e;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;

  &:hover {
    background: #e55a42;
  }
}

.skill-install-dropdown__status-img {
  width: 18px;
  height: 18px;
  display: block;
  object-fit: contain;
  flex-shrink: 0;
}

.skill-install-dropdown__status-img--clickable {
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.7;
  }
}

.skill-install-dropdown__status-img--spin {
  animation: skill-dropdown-spin 0.9s linear infinite;
}

@keyframes skill-dropdown-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 弹窗全局样式 */
.skill-install-dialog.el-dialog {
  width: 450px;
  height: 382px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
  background-color: #ffffff;
  background-image: url('@/assets/team-dialog-bg.png');
  background-repeat: no-repeat;
  background-position: top center;
  background-size: 100% auto;

  .el-dialog__header {
    padding: 16px 20px 8px;
    margin: 0;
    background: transparent;
    flex-shrink: 0;
  }

  .el-dialog__body {
    padding: 8px 20px 16px;
    flex: 1;
    min-height: 0;
    max-height: none;
    overflow-y: auto;
    background: transparent;
  }

  .el-dialog__footer {
    padding: 12px 20px 16px;
    background: transparent;
    flex-shrink: 0;
  }
}
</style>

