<script setup>
import { inject, ref, reactive, computed, nextTick, watch } from 'vue'
import { KODE_STATE_KEY } from '../composables/useKodeState.js'

const state = inject(KODE_STATE_KEY)
const {
  showNewTaskModal,
  newTaskPrefill,
  closeNewTaskModal,
  createTask,
  workspaces,
  selectedTask,
} = state

const draft = reactive({
  name: '',
  type: '需求',
  mode: 'kode',   // 执行模式：kode / ide
  desc: '',
  attachments: [],
  wsId: '',
})

// 打开时重置；如果带 prefill（从其它模块转发过来），优先用 prefill 值
watch(showNewTaskModal, (v) => {
  if (v) {
    const pre = newTaskPrefill?.value || null
    draft.name = ''
    draft.type = pre?.taskType || '需求'
    draft.mode = pre?.mode || 'kode'
    draft.desc = pre?.prefilledDesc || ''
    draft.attachments = pre?.sourceMeta
      ? [{ id: `src-${Date.now()}`, icon: '↗', name: pre.sourceMeta, source: '转发来源' }]
      : []
    draft.wsId = pre?.preferredWsId
      || selectedTask.value?.wsId
      || workspaces.value[0]?.id
      || ''
    nextTick(() => nameInputEl.value?.focus())
  }
})

// 任务类型：预设 4 个,用户可新增/删除
const PRESET_TYPES = ['需求', '用例', '研发任务', '缺陷']
const typeOptions = ref([...PRESET_TYPES])
const addingType = ref(false)
const newTypeName = ref('')
const newTypeInputEl = ref(null)

function startAddType() {
  addingType.value = true
  nextTick(() => newTypeInputEl.value?.focus())
}
function confirmAddType() {
  const n = newTypeName.value.trim()
  if (n && !typeOptions.value.includes(n)) {
    typeOptions.value.push(n)
    draft.type = n  // 新增即选中
  }
  newTypeName.value = ''
  addingType.value = false
}
function cancelAddType() {
  newTypeName.value = ''
  addingType.value = false
}
function removeType(t) {
  if (typeOptions.value.length <= 1) return  // 至少保留一个
  typeOptions.value = typeOptions.value.filter((x) => x !== t)
  if (draft.type === t) draft.type = typeOptions.value[0] || ''
}

// 执行模式：kode(任务助手拆 + CC 跑) / ide(IDE+CLI 自己做)
const MODES = ['kode', 'ide']
const MODE_HINTS = {
  kode: 'kode = 任务助手拆 todolist + CC 自动跑（可批量）',
  ide: 'ide = 你在 IDE + CLI 自己做，CC 辅助',
}
const modeHint = computed(() => MODE_HINTS[draft.mode] || '')

// 「落到项目」候选 = 全部工作区
const projectWorkspaces = computed(() => workspaces.value)

function selectMode(m) {
  draft.mode = m
}

const canSubmit = computed(() => draft.name.trim() && draft.wsId)

const nameInputEl = ref(null)
const fileInputEl = ref(null)

// 文件上传:点击 / 拖拽两种触发
function triggerFileInput() {
  fileInputEl.value?.click()
}
function onFileSelect(e) {
  const files = Array.from(e.target.files || [])
  addFiles(files)
  e.target.value = ''  // 允许重选同一文件
}
function onDropFiles(e) {
  const files = Array.from(e.dataTransfer?.files || [])
  addFiles(files)
}
function addFiles(files) {
  for (const f of files) {
    draft.attachments.push({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      icon: '📄',
      name: f.name,
      size: f.size,
      source: '本地上传',
    })
  }
}
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

function removeAttachment(id) {
  draft.attachments = draft.attachments.filter((a) => a.id !== id)
}

function onSubmit() {
  if (!canSubmit.value) return
  createTask({ ...draft, attachments: [...draft.attachments] })
}

function onOverlayClick() {
  closeNewTaskModal()
}
</script>

<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="showNewTaskModal" class="modal-overlay" @click.self="onOverlayClick">
        <div class="modal-card">
          <header class="modal-head">
            <h3>+ 新建任务</h3>
            <button class="close" type="button" @click="closeNewTaskModal">✕</button>
          </header>

          <div class="modal-body">
            <div class="field">
              <label>任务名称 <span class="required">*</span></label>
              <input
                ref="nameInputEl"
                v-model="draft.name"
                placeholder="一句话说清做什么"
                @keydown.enter.prevent="onSubmit"
              />
            </div>

            <div class="field">
              <label>任务类型 <span class="required">*</span></label>
              <div class="type-picker">
                <span
                  v-for="t in typeOptions"
                  :key="t"
                  class="type-opt"
                  :class="[`pill-${t}`, { active: draft.type === t, custom: !PRESET_TYPES.includes(t) }]"
                  @click="draft.type = t"
                >
                  {{ t }}
                  <span
                    v-if="typeOptions.length > 1"
                    class="del"
                    title="删除此类型"
                    @click.stop="removeType(t)"
                  >✕</span>
                </span>
                <input
                  v-if="addingType"
                  ref="newTypeInputEl"
                  v-model="newTypeName"
                  class="type-input"
                  placeholder="类型名"
                  maxlength="6"
                  @keydown.enter.prevent="confirmAddType"
                  @keydown.esc.prevent="cancelAddType"
                  @blur="confirmAddType"
                />
                <button
                  v-else
                  type="button"
                  class="type-add"
                  @click="startAddType"
                >+ 新增</button>
              </div>
            </div>

            <div class="field">
              <label>任务描述</label>
              <textarea
                v-model="draft.desc"
                rows="3"
                placeholder="任务背景、目标、验收标准等，描述地越详细，任务助手拆解地越精准"
              ></textarea>
            </div>

            <div class="field">
              <label>附件</label>
              <!-- 文件上传区：点击 / 拖拽 -->
              <div
                class="upload-zone"
                @click="triggerFileInput"
                @dragover.prevent
                @drop.prevent="onDropFiles"
              >
                <input
                  ref="fileInputEl"
                  type="file"
                  multiple
                  hidden
                  @change="onFileSelect"
                />
                <span class="upload-ico">📎</span>
                <span class="upload-text">
                  <b>点击上传</b> 或拖拽文件到此处 · 支持多文件
                </span>
              </div>
              <ul v-if="draft.attachments.length" class="attach-list">
                <li v-for="a in draft.attachments" :key="a.id">
                  <span class="ico">{{ a.icon }}</span>
                  <span class="name">{{ a.name }}</span>
                  <span v-if="a.size != null" class="size">{{ formatSize(a.size) }}</span>
                  <span class="remove" @click="removeAttachment(a.id)">✕</span>
                </li>
              </ul>
            </div>

            <div class="field">
              <label>落到项目 <span class="required">*</span></label>
              <div class="ws-picker">
                <button
                  v-for="w in projectWorkspaces"
                  :key="w.id"
                  type="button"
                  class="ws-opt"
                  :class="{ active: draft.wsId === w.id }"
                  @click="draft.wsId = w.id"
                >
                  <span class="ws-dot" :style="{ background: w.color }"></span>
                  <span>{{ w.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <footer class="modal-foot">
            <button class="btn ghost" type="button" @click="closeNewTaskModal">取消</button>
            <button class="btn primary" type="button" :disabled="!canSubmit" @click="onSubmit">
              创建任务
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style lang="scss" scoped>
@use '../styles.scss' as *;

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(31, 35, 41, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  width: 560px;
  max-width: 100%;
  max-height: 90vh;
  background: $bg-primary;
  border-radius: $radius-2xl;
  box-shadow: $shadow-lg;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-head {
  padding: 18px 22px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid $border-light;

  h3 {
    margin: 0;
    font-size: $fs-xl;
    font-weight: $fw-semibold;
    color: $text-display;
  }

  .close {
    border: 0;
    background: transparent;
    color: $text-muted;
    font-size: $fs-md;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: inherit;

    &:hover { background: $bg-secondary; color: $text-display; }
  }
}

.modal-body {
  padding: 18px 22px;
  overflow-y: auto;
  flex: 1;
}

.field {
  margin-bottom: 16px;

  label {
    display: block;
    font-size: $fs-base;
    color: $text-secondary;
    font-weight: $fw-medium;
    margin-bottom: 6px;

    .required {
      color: $danger;
      margin-left: 2px;
    }
  }

  input, textarea {
    width: 100%;
    border: 1px solid $border;
    border-radius: $radius-md;
    padding: 8px 12px;
    font-size: $fs-md;
    font-family: inherit;
    outline: 0;
    background: $bg-primary;
    color: $text-display;
    transition: border-color $anim-fast;

    &:focus { border-color: $aurora-purple; }
    &::placeholder { color: $text-faint; }
  }

  textarea {
    resize: vertical;
    min-height: 60px;
    line-height: 1.5;
  }
}

.type-picker {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;

  .type-opt {
    padding: 5px 12px;
    border-radius: 14px;
    border: 1.5px solid $border;
    background: $bg-primary;
    cursor: pointer;
    font-size: $fs-base;
    font-family: inherit;
    font-weight: $fw-medium;
    transition: all $anim-fast;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    position: relative;
    user-select: none;

    &.pill-用例 { color: $pill-uc-text; }
    &.pill-需求 { color: $pill-req-text; }
    &.pill-研发任务 { color: $pill-dev-text; }
    &.pill-缺陷 { color: $pill-bug-text; }
    &.custom { color: $text-secondary; }

    &.disabled { opacity: 0.4; cursor: not-allowed; }

    &.active.pill-用例 { background: $pill-uc-bg; border-color: $pill-uc-text; }
    &.active.pill-需求 { background: $pill-req-bg; border-color: $pill-req-text; }
    &.active.pill-研发任务 { background: $pill-dev-bg; border-color: $pill-dev-text; }
    &.active.pill-缺陷 { background: $pill-bug-bg; border-color: $pill-bug-text; }
    &.active.custom {
      background: rgba(132, 120, 250, 0.10);
      border-color: $aurora-purple;
      color: $aurora-purple;
    }

    // hover 时显示删除 ✕
    .del {
      opacity: 0;
      color: $text-faint;
      font-size: 10px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all $anim-fast;
    }
    &:hover .del { opacity: 1; }
    .del:hover {
      background: rgba(239, 68, 68, 0.10);
      color: $danger;
    }
  }

  // 「+ 新增」按钮
  .type-add {
    padding: 5px 12px;
    border-radius: 14px;
    border: 1.5px dashed $border-strong;
    background: $bg-primary;
    cursor: pointer;
    font-size: $fs-base;
    font-family: inherit;
    font-weight: $fw-medium;
    color: $text-muted;
    transition: all $anim-fast;

    &:hover {
      border-color: $aurora-purple;
      color: $aurora-purple;
    }
  }

  // 新增时的输入框
  .type-input {
    padding: 5px 10px;
    border-radius: 14px;
    border: 1.5px solid $aurora-purple;
    background: $bg-primary;
    font-size: $fs-base;
    font-family: inherit;
    width: 90px;
    outline: 0;
    color: $text-display;
  }
}

.mode-hint {
  margin: 8px 0 0;
  font-size: $fs-xs;
  color: $text-muted;
  line-height: 1.5;

  .mode-hint-lock { color: $aurora-purple; margin-left: 4px; }
}

// 文件上传区
.upload-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 12px;
  border: 1.5px dashed $border-strong;
  border-radius: $radius-md;
  background: $bg-secondary;
  cursor: pointer;
  color: $text-muted;
  font-size: $fs-base;
  transition: all $anim-fast;
  margin-bottom: 8px;

  &:hover {
    border-color: $aurora-purple;
    background: rgba(132, 120, 250, 0.04);
    color: $aurora-purple;
  }

  .upload-ico { font-size: 18px; }
  .upload-text { line-height: 1.5; }
  .upload-text b { color: $aurora-purple; font-weight: $fw-semibold; }
}

.attach-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: $bg-secondary;
    border-radius: $radius-sm;
    font-size: $fs-base;

    .ico { font-size: $fs-md; }
    .name { flex: 1; color: $text-display; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .size { color: $text-muted; font-size: $fs-xs; flex-shrink: 0; }
    .remove {
      color: $text-faint;
      cursor: pointer;
      font-size: $fs-sm;
      padding: 2px 6px;
      border-radius: 4px;
      flex-shrink: 0;

      &:hover { color: $danger; background: rgba(239, 68, 68, 0.06); }
    }
  }
}

.ws-picker {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;

  .ws-opt {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: $bg-primary;
    border: 1.5px solid $border;
    border-radius: 16px;
    cursor: pointer;
    font-size: $fs-base;
    font-family: inherit;
    color: $text-display;
    transition: all $anim-fast;

    .ws-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    &:hover { border-color: rgba(132, 120, 250, 0.3); }

    &.active {
      border-color: $aurora-purple;
      background: rgba(132, 120, 250, 0.05);
    }
  }
}

.modal-foot {
  padding: 14px 22px;
  background: $bg-secondary;
  border-top: 1px solid $border-light;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;

  .btn {
    padding: 8px 18px;
    border-radius: $radius-md;
    font-size: $fs-md;
    cursor: pointer;
    font-weight: $fw-medium;
    border: 0;
    font-family: inherit;
    transition: all $anim-fast;

    &.ghost {
      background: transparent;
      color: $text-muted;
      &:hover { background: $bg-tertiary; color: $text-display; }
    }

    &.primary {
      background: $gradient-aurora;
      color: #fff;
      box-shadow: 0 2px 8px rgba(132, 120, 250, 0.25);

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(132, 120, 250, 0.35);
      }

      &:disabled {
        background: $bg-tertiary;
        color: $text-faint;
        box-shadow: none;
        cursor: not-allowed;
      }
    }
  }
}

/* transition */
.modal-enter-active, .modal-leave-active {
  transition: opacity $anim-base;

  .modal-card {
    transition: transform $anim-base;
  }
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
  .modal-card { transform: translateY(8px) scale(0.98); }
}
</style>
