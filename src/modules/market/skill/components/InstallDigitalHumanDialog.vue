<template>
  <el-dialog
    :model-value="modelValue"
    class="install-dh-dialog"
    width="450px"
    align-center
    destroy-on-close
    :show-close="true"
    append-to-body
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header>
      <span class="install-dh-dialog__title">请选择安装目标</span>
    </template>

    <div class="install-dh-dialog__list-wrap">
      <div
        v-if="listLoading"
        class="install-dh-dialog__loading-overlay"
        aria-live="polite"
        aria-busy="true"
      >
        <img class="install-dh-dialog__loading-gif" :src="skillLoadingGifUrl" alt="加载中" />
        <span class="install-dh-dialog__loading-text">请稍候...</span>
      </div>

      <ul
        v-if="rows.length"
        class="install-dh-list"
        role="listbox"
      >
        <li
          v-for="row in rows"
          :key="row.id"
          role="option"
          class="install-dh-row"
          :class="{ 'is-selected': selectedId === row.id }"
          :aria-selected="selectedId === row.id"
          @click="onSelectRow(row)"
        >
          <!-- 三类目标统一行：用 icon 区分 persona / kode，数字员工保留头像 -->
          <span
            v-if="row.kind === 'persona'"
            class="install-dh-row__icon install-dh-row__icon--persona"
          >👤</span>
          <span
            v-else-if="row.kind === 'kode'"
            class="install-dh-row__icon install-dh-row__icon--kode"
          >⌘_</span>
          <img
            v-else
            class="install-dh-row__avatar"
            :class="{ 'install-dh-row__avatar--main': row.avatar === skillMainIconUrl }"
            :src="row.avatar"
            :alt="row.name"
            loading="lazy"
            @error="onAvatarImgError"
          />
          <span class="install-dh-row__name">{{ row.name }}</span>
          <div class="install-dh-row__status" aria-hidden="true">
            <img v-if="submittingRowIds.includes(row.id) || row.rowStatus === 'installing'"
              class="install-dh-row__status-img install-dh-row__status-img--spin" :src="skillZhuanquanUrl" alt="" />
            <img v-else-if="row.rowStatus === 'idle'" class="install-dh-row__status-img" :src="skillDownloadStatUrl" alt="" />
            <img v-else class="install-dh-row__status-img" :src="skillDuihaoUrl" alt="" />
          </div>
        </li>
      </ul>

      <p
        v-else-if="!listLoading"
        class="install-dh-dialog__empty"
      >
        暂无可用安装目标
      </p>
    </div>

    <template #footer>
      <div class="install-dh-dialog__footer">
        <el-button class="install-dh-dialog__cancel" @click="onCancel">取消</el-button>
        <el-button
          type="primary"
          class="install-dh-dialog__confirm"
          @click="onConfirm"
        >
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import skillDownloadStatUrl from '@/assets/skill/skill-xiazai.svg?url'
import skillDuihaoUrl from '@/assets/skill/skill-duihao.svg?url'
import skillLoadingGifUrl from '@/assets/skill/skill-loading.gif'
import skillMainIconUrl from '@/assets/skill/skill-main.png?url'
import skillZhuanquanUrl from '@/assets/skill/skill-zhuanquan.png'
import skillManDefaultSrc from '@/assets/skill/skill-man.png'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import { fetchSkillBindingStatus, installSkillToAgent } from '../skillMarketApi.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** Skill 标识，对应安装接口 body.skill_ids */
  skillSlug: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const skillSlugTrim = computed(() => String(props.skillSlug ?? '').trim())

/**
 * 接口 `status` → 与原先数字人安装状态列一致：`idle` 下载图、`installing` 转圈、`done` 对勾
 */
function mapApiStatusToRowStatus(apiStatus) {
  const s = String(apiStatus ?? '').trim().toLowerCase()
  if (s === 'installing' || s === 'uninstalling' || s === '安装中' || s === '卸载中') {
    return 'installing'
  }
  /** 仅根据「当前 Skill 在该 Agent 上」的状态出对勾，勿用 isInstalled（表示 Agent 是否存在，易全为 true） */
  if (s === 'active' || s === 'installed' || s === 'success') return 'done'
  return 'idle'
}

/**
 * 内联图 / 绝对 URL 原样；占位 default-avatar 或空、无 base 时用本弹框默认图 skill-man.png；相对路径拼 one base
 */
function normalizeImageDataUri(raw) {
  const s = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!/^data:/i.test(s)) return s
  const comma = s.indexOf(',')
  if (comma < 0) return s
  const meta = s.slice(0, comma)
  const body = s.slice(comma + 1)
  if (/;base64$/i.test(meta)) {
    return `${meta},${body.replace(/\s/g, '')}`
  }
  return s
}

function resolveAgentAvatarUrl(path) {
  const raw = String(path ?? '').trim()
  if (!raw) return skillManDefaultSrc
  if (/^data:/i.test(raw)) return normalizeImageDataUri(raw)
  if (/^https?:\/\//i.test(raw)) return raw
  if (/default-avatar\.png/i.test(raw)) return skillManDefaultSrc
  const base = getOneBaseUrl().replace(/\/$/, '')
  if (!base) return skillManDefaultSrc
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

function rowStatusFromItem(item) {
  return mapApiStatusToRowStatus(item?.targetSkillStatus || item?.status)
}

function mapInstalledAgentToRow(item, index) {
  // 优先 agentId（fetchSkillBindingStatus 返回字段），其次 ocAgentId（旧接口兼容）
  const idRaw =
    item?.agentId ??
    (item?.ocAgentId != null && String(item.ocAgentId).trim() !== '' ? item.ocAgentId : '') ??
    item?.agentName
  const id = idRaw != null && String(idRaw).trim() !== '' ? idRaw : `agent-${index}`
  const name =
    String(item?.displayName ?? '').trim() ||
    String(item?.name ?? '').trim() ||
    String(item?.agentName ?? '').trim() ||
    '未命名'
  const kind = item?.kind || 'digital-human'
  return {
    id,
    name,
    description: item?.description || '',
    kind,
    avatar: kind === 'digital-human' ? resolveAgentAvatarUrl(item?.avatar) : skillMainIconUrl,
    rowStatus: rowStatusFromItem(item),
    raw: item,
  }
}

function buildRowsFromInstalled(items) {
  return Array.isArray(items) ? items.map(mapInstalledAgentToRow) : []
}

const rows = ref([])
const listLoading = ref(false)
const submittingRowIds = ref([])
const selectedId = ref(null)
/** 任意一行安装请求进行中，需等本次返回后才能再点其它行安装 */
const installRequestInFlight = ref(false)

const personaRow = computed(() => rows.value.find((r) => r.kind === 'persona') || null)
const kodeRow = computed(() => rows.value.find((r) => r.kind === 'kode') || null)
const digitalRows = computed(() => rows.value.filter((r) => r.kind === 'digital-human'))

async function loadAgents() {
  const slug = skillSlugTrim.value
  listLoading.value = true
  try {
    const { agents } = await fetchSkillBindingStatus(slug)
    rows.value = buildRowsFromInstalled(agents)
    selectedId.value = null
  } catch (e) {
    const msg =
      (typeof e === 'object' && e != null && (e.message || e.msg)) ||
      (typeof e === 'string' ? e : '') ||
      '加载失败，请稍后再试'
    ElMessage.error(msg)
    rows.value = []
    selectedId.value = null
  } finally {
    listLoading.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      rows.value = []
      selectedId.value = null
      submittingRowIds.value = []
      installRequestInFlight.value = false
      return
    }
    loadAgents()
  },
)

function onAvatarImgError(ev) {
  const el = ev?.target
  if (el && 'src' in el) el.src = skillManDefaultSrc
}

function onCancel() {
  emit('update:modelValue', false)
}

async function onSelectRow(row) {
  if (!row || listLoading.value) return
  if (submittingRowIds.value.includes(row.id)) return
  if (installRequestInFlight.value) {
    ElMessage.warning('请先等上一个安装完成后操作')
    return
  }
  if (row.rowStatus === 'done') {
    ElMessage.info('该数字人已安装此 Skill，无需重复安装')
    return
  }
  if (row.rowStatus === 'installing') {
    ElMessage.warning('该数字人正在安装中，请稍候')
    return
  }
  selectedId.value = row.id
  installByRowId(row.id)
}

/**
 * 安装技能到指定 Agent（新接口）
 */
async function installByRowId(rowId) {
  const slug = skillSlugTrim.value
  if (!slug) {
    ElMessage.warning('缺少 Skill 标识，无法安装')
    return
  }
  const agentId = String(rowId ?? '').trim()
  if (!agentId) {
    ElMessage.warning('请选择数字人')
    return
  }
  const rowKey = agentId
  if (installRequestInFlight.value) {
    ElMessage.warning('请先等上一个安装完成后操作')
    return
  }
  installRequestInFlight.value = true
  submittingRowIds.value = [...submittingRowIds.value, rowKey]
  try {
    const data = await installSkillToAgent(slug, agentId)
    ElMessage.success('安装成功')
    emit('confirm', {
      skillSlug: slug,
      agentId,
      digitalHumanId: agentId,
      data,
    })
    rows.value = rows.value.map((row) =>
      row.id === rowKey ? { ...row, rowStatus: 'done' } : row,
    )
  } catch (e) {
    const msg =
      (typeof e === 'object' && e != null && (e.message || e.msg)) ||
      (typeof e === 'string' ? e : '') ||
      '安装失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    submittingRowIds.value = submittingRowIds.value.filter((id) => id !== rowKey)
    installRequestInFlight.value = false
  }
}

function onConfirm() {
  emit('update:modelValue', false)
}

</script>

<style lang="scss" scoped>
.install-dh-dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.install-dh-dialog__list-wrap {
  position: relative;
  height: 100%;
  min-height: 0;
}

.install-dh-dialog__loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.7);
}

.install-dh-dialog__loading-gif {
  width: 28px;
  height: 28px;
  display: block;
  object-fit: contain;
}

.install-dh-dialog__loading-text {
  font-size: 14px;
  line-height: 22px;
  color: #606572;
}

.install-dh-dialog__empty {
  margin: 24px 0;
  text-align: center;
  font-size: 14px;
  color: #6b7280;
}

.install-dh-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 三类目标统一行：persona/kode 用 icon 圆替代 avatar，尺寸跟 .install-dh-row__avatar 一致 */
.install-dh-row__icon {
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
.install-dh-row__icon--persona {
  background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
  color: #ffffff;
}
.install-dh-row__icon--kode {
  background: #111827;
  color: #4ade80;
  font-family: 'SFMono-Regular', 'Menlo', monospace;
  font-size: 10px;
  letter-spacing: -0.5px;
}

.install-dh-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin: 0 -4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f9fafb;
  }

  &.is-selected {
    background: #f3f4f6;
  }
}

.install-dh-row__avatar {
  width: 24px;
  height: 24px;
  border-radius: 24px;
  object-fit: cover;
  flex-shrink: 0;
}

/* skill-main.svg 在 40×40 画布上图形偏中，cover 压到 24px 会显得很小 */
.install-dh-row__avatar--main {
  object-fit: contain;
  object-position: center;
  transform-origin: center center;
}

.install-dh-row__name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: #2F3547;
}

.install-dh-row__status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.install-dh-row__status-img {
  width: 18px;
  height: 18px;
  display: block;
  object-fit: contain;
}

.install-dh-row__status-img--spin {
  animation: install-dh-row-spin 0.9s linear infinite;
}

@keyframes install-dh-row-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.install-dh-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  :deep(.el-button) {
    border-radius: 6px;
    padding: 8px 20px;
    font-size: 14px;
    font-weight: 500;
  }
}

.install-dh-dialog__cancel {
  --el-button-bg-color: #ffffff;
  --el-button-text-color: #4e5969;
  --el-button-border-color: #e5e6eb;
  --el-button-hover-bg-color: #f7f8fa;
  --el-button-hover-text-color: #4e5969;
  --el-button-hover-border-color: #dcdfe6;
  --el-button-active-bg-color: #f2f3f5;
  --el-button-active-text-color: #272e3b;
  --el-button-active-border-color: #c9cdd4;
}

.install-dh-dialog__confirm {
  --el-button-text-color: #ffffff;
  --el-button-bg-color: #171b26;
  --el-button-border-color: #171b26;
  --el-button-hover-text-color: #ffffff;
  --el-button-hover-bg-color: #2b3142;
  --el-button-hover-border-color: #2b3142;
  --el-button-active-text-color: #ffffff;
  --el-button-active-bg-color: #10131c;
  --el-button-active-border-color: #10131c;
  --el-button-disabled-text-color: rgba(255, 255, 255, 0.65);
  --el-button-disabled-bg-color: #c9cdd4;
  --el-button-disabled-border-color: #c9cdd4;
}
</style>

<style lang="scss">
.install-dh-dialog.el-dialog {
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
