<template>
  <el-dropdown
    trigger="click"
    popper-class="skill-install-dropdown__popper"
    @visible-change="onDropdownVisibleChange"
    @command="onCommand"
    @click.stop
  >
    <el-button
      type="primary"
      class="skill-install-dropdown__trigger"
      :class="`skill-install-dropdown__trigger--${size}`"
      :disabled="disabled"
      @click.stop
    >
      <span class="skill-install-dropdown__inner">
        <img
          v-if="installInProgress"
          class="skill-install-dropdown__spinner"
          :src="skillZhuanquanUrl"
          alt=""
        />
        <span>{{ installInProgress ? '安装中' : '安装' }}</span>
        <img
          class="skill-install-dropdown__arrow"
          :class="{ 'is-spinning': installInProgress }"
          :src="skillAzUrl"
          alt=""
        />
      </span>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          command="__title__"
          disabled
          class="skill-install-dropdown__title-item"
        >
          <span class="skill-install-dropdown__title-text">请选择安装目标</span>
        </el-dropdown-item>

        <!-- 三类目标统一行渲染，仅靠 icon 视觉区分 -->
        <el-dropdown-item
          v-for="opt in agentOptions"
          :key="opt.id"
          :command="getCommand(opt)"
          :disabled="isItemDisabled(opt)"
          class="skill-install-dropdown__item"
        >
          <div
            class="skill-install-dropdown__row"
            :class="{ 'is-installing': installingAgentIds.includes(opt.id) }"
          >
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
            <span class="skill-install-dropdown__name">{{ opt.name }}</span>
            <span v-if="opt.rowStatus === 'done'" class="skill-install-dropdown__version">
              v{{ opt.boundVersion }}
              <span v-if="!opt.isLatest" class="skill-install-dropdown__update-badge">可更新</span>
            </span>
            <img
              v-if="installingAgentIds.includes(opt.id) || opt.rowStatus === 'installing'"
              class="skill-install-dropdown__status-img skill-install-dropdown__status-img--spin"
              :src="skillZhuanquanUrl"
              alt=""
            />
            <img
              v-else-if="opt.rowStatus === 'idle'"
              class="skill-install-dropdown__status-img"
              :src="skillDownloadUrl"
              alt=""
            />
            <img
              v-else-if="opt.isLatest"
              class="skill-install-dropdown__status-img"
              :src="skillDuihaoUrl"
              alt=""
            />
            <span v-else class="skill-install-dropdown__update-btn" @click.stop="handleUpdate(opt)">更新</span>
          </div>
        </el-dropdown-item>

        <el-dropdown-item
          v-if="!agentOptions.length && !loading"
          command="__empty__"
          disabled
        >
          暂无可安装目标
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import skillAzUrl from '@/assets/skill/skill-az.svg?url'
import skillDownloadUrl from '@/assets/skill/skill-xiazai.svg?url'
import skillDuihaoUrl from '@/assets/skill/skill-duihao.svg?url'
import skillZhuanquanUrl from '@/assets/skill/skill-zhuanquan.png'
import skillManDefaultSrc from '@/assets/skill/skill-man.png'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import { fetchSkillBindingStatus, installSkillToAgent } from '../skillMarketApi.js'

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
})

const emit = defineEmits(['installed'])

const skillSlugTrim = computed(() => String(props.skillSlug ?? '').trim())

const loading = ref(false)
const agentOptions = ref([])
const installingAgentIds = ref([])
const installInProgress = ref(false)
const latestVersion = ref('')

/** 状态映射：idle / installing / done */
function mapApiStatusToRowStatus(apiStatus) {
  const s = String(apiStatus ?? '').trim().toLowerCase()
  if (s === 'installing' || s === 'uninstalling' || s === '安装中' || s === '卸载中') {
    return 'installing'
  }
  if (s === 'active' || s === 'installed' || s === 'success') return 'done'
  return 'idle'
}

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

/** 从 binding-status 接口映射 Agent 选项 */
function mapBindingAgentToOption(item, index) {
  // agentId 保持原始类型（数字/字符串），用于 bind-agents 接口
  const id = item?.agentId ?? item?.agentName ?? `agent-${index}`
  const name = String(item?.displayName ?? item?.agentName ?? item?.name ?? '').trim() || String(id) || '未命名'
  return {
    id,
    name,
    avatar: resolveAgentAvatarUrl(item?.avatar),
    rowStatus: mapApiStatusToRowStatus(item?.status),
    boundVersion: item?.boundVersion || '',
    isLatest: item?.isLatest ?? true,
    // 新增：kind 区分三类目标（'persona' | 'digital-human' | 'kode'）
    kind: item?.kind || 'digital-human',
    description: item?.description || '',
    raw: item,
  }
}

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

function onDropdownVisibleChange(visible) {
  if (visible) {
    loadAgentOptions()
  }
}

function onAvatarError(ev) {
  const el = ev?.target
  if (el && 'src' in el) el.src = skillManDefaultSrc
}

/** 获取下拉项命令 */
function getCommand(opt) {
  if (opt.rowStatus === 'idle') return `install:${opt.id}`
  if (opt.rowStatus === 'done' && !opt.isLatest) return `update:${opt.id}`
  return '__noop__'
}

/** 判断下拉项是否禁用 */
function isItemDisabled(opt) {
  if (opt.rowStatus === 'done' && opt.isLatest) return true // 已是最新，禁用
  return installingAgentIds.value.includes(opt.id)
}

/** 处理安装 */
async function handleInstall(agentId, slug) {
  const agent = agentOptions.value.find((opt) => opt.id === agentId)
  if (agent?.rowStatus === 'done') {
    ElMessage.info('该数字人已安装此 Skill')
    return
  }

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

    // 更新状态为已安装
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

  if (installInProgress.value) {
    ElMessage.warning('请等待上一个操作完成')
    return
  }

  installInProgress.value = true
  installingAgentIds.value = [...installingAgentIds.value, agentId]

  try {
    // 调用安装接口，传递最新版本号
    await installSkillToAgent(slug, agentId, { version: latestVersion.value })
    ElMessage.success('更新成功')
    emit('installed', { skillSlug: slug, agentId, action: 'update' })

    // 更新本地状态
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

async function onCommand(cmd) {
  if (!cmd || cmd === '__title__' || cmd === '__empty__' || cmd === '__noop__') return

  const [action, agentId] = cmd.split(':')
  if (!agentId) return

  const slug = skillSlugTrim.value
  if (!slug) {
    ElMessage.warning('缺少 Skill 标识')
    return
  }

  if (action === 'install') {
    await handleInstall(agentId, slug)
  } else if (action === 'update') {
    const opt = agentOptions.value.find((item) => item.id === agentId)
    if (opt) await handleUpdate(opt)
  }
}

// 当 slug 变化时重置状态
watch(skillSlugTrim, () => {
  agentOptions.value = []
  installingAgentIds.value = []
  installInProgress.value = false
  latestVersion.value = ''
})
</script>

<style lang="scss" scoped>
.skill-install-dropdown__trigger {
  padding: 6px 14px;
  border-radius: 6px;
  --el-button-text-color: #ffffff;
  --el-button-bg-color: #171b26;
  --el-button-border-color: #171b26;
  --el-button-hover-text-color: #ffffff;
  --el-button-hover-bg-color: #2b3142;
  --el-button-hover-border-color: #2b3142;
  --el-button-active-text-color: #ffffff;
  --el-button-active-bg-color: #10131c;
  --el-button-active-border-color: #10131c;
  min-width: 64px;
}

.skill-install-dropdown__trigger--small {
  padding: 4px 10px;
  min-width: 56px;
  font-size: 13px;
}

.skill-install-dropdown__inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  line-height: 1;
}

.skill-install-dropdown__trigger--small .skill-install-dropdown__inner {
  font-size: 13px;
  gap: 4px;
}

.skill-install-dropdown__spinner {
  width: 14px;
  height: 14px;
  animation: skill-install-spin 0.9s linear infinite;
}

.skill-install-dropdown__trigger--small .skill-install-dropdown__spinner {
  width: 12px;
  height: 12px;
}

.skill-install-dropdown__arrow {
  width: 14px;
  height: 14px;
  transition: transform 0.3s;
}

.skill-install-dropdown__trigger--small .skill-install-dropdown__arrow {
  width: 12px;
  height: 12px;
}

.skill-install-dropdown__arrow.is-spinning {
  animation: skill-install-spin 0.9s linear infinite;
}

@keyframes skill-install-spin {
  to {
    transform: rotate(360deg);
  }
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
}

.skill-install-dropdown__popper .el-dropdown-menu__item.skill-install-dropdown__item:not(.is-disabled):hover {
  background: #f7f8fa !important;
}

.skill-install-dropdown__popper .el-dropdown-menu__item.is-disabled.skill-install-dropdown__item {
  opacity: 1 !important;
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

.skill-install-dropdown__name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: #2f3547;
  overflow: hidden;
  text-overflow: ellipsis;
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

.skill-install-dropdown__status-img--spin {
  animation: skill-install-dropdown-spin 0.9s linear infinite;
}

@keyframes skill-install-dropdown-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 三类目标统一行：用 icon 圆替代 avatar 区分 persona / kode，尺寸跟 .skill-install-dropdown__avatar 对齐 */
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
</style>
