<script setup>
import { inject, ref, reactive, computed, nextTick, watch } from 'vue'
import { KODE_STATE_KEY } from '../composables/useKodeState.js'

const state = inject(KODE_STATE_KEY)
const {
  showAddWorkspaceModal,
  closeAddWorkspaceModal,
  addWorkspace,
} = state

const draft = reactive({
  name: '',
  path: '',
  color: '',
})

// 色块从池里随机分配（不让用户选,降低决策成本）
const colorPool = ['#22c55e', '#8478FA', '#F67C43', '#57CFDE', '#E9628B', '#659EFF']
function pickRandomColor() {
  return colorPool[Math.floor(Math.random() * colorPool.length)]
}

watch(showAddWorkspaceModal, (v) => {
  if (v) {
    draft.name = ''
    draft.path = ''
    draft.color = pickRandomColor()
    nextTick(() => nameInputEl.value?.focus())
  }
})

const nameInputEl = ref(null)

const canSubmit = computed(() => draft.name.trim() && draft.path.trim())

function onSubmit() {
  if (!canSubmit.value) return
  addWorkspace({ ...draft })
}

function onPickPath() {
  // 浏览器版没法真选目录，直接 mock 一下提示
  const fake = prompt('粘贴目录路径（生产里这里会调 Electron 选择对话框）:', '~/projects/')
  if (fake) draft.path = fake
}
</script>

<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="showAddWorkspaceModal" class="modal-overlay" @click.self="closeAddWorkspaceModal">
        <div class="modal-card">
          <header class="modal-head">
            <h3>+ 添加 workspace</h3>
            <button class="close" type="button" @click="closeAddWorkspaceModal">✕</button>
          </header>

          <div class="modal-body">
            <div class="field">
              <label>名称 <span class="required">*</span></label>
              <input
                ref="nameInputEl"
                v-model="draft.name"
                placeholder="如：kc_workspace · super-assistant"
              />
            </div>

            <div class="field">
              <label>本地路径 <span class="required">*</span></label>
              <div class="path-row">
                <input
                  v-model="draft.path"
                  placeholder="/Users/yourname/projects/..."
                />
                <button type="button" class="btn-pick" @click="onPickPath">📁 选择</button>
              </div>
              <div class="hint">workspace 不必在同一层级目录下，任意路径都行</div>
            </div>

          </div>

          <footer class="modal-foot">
            <button class="btn ghost" type="button" @click="closeAddWorkspaceModal">取消</button>
            <button class="btn primary" type="button" :disabled="!canSubmit" @click="onSubmit">
              添加
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
  width: 480px;
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

    .required { color: $danger; margin-left: 2px; }
    .optional { color: $text-faint; font-weight: $fw-regular; font-size: $fs-xs; margin-left: 4px; }
  }

  input {
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

  .hint {
    font-size: $fs-xs;
    color: $text-muted;
    margin-top: 4px;
  }
}

.path-row {
  display: flex;
  gap: 6px;

  input { flex: 1; }

  .btn-pick {
    padding: 8px 14px;
    background: $bg-secondary;
    border: 1px solid $border;
    border-radius: $radius-md;
    cursor: pointer;
    font-family: inherit;
    font-size: $fs-base;
    color: $text-secondary;
    white-space: nowrap;

    &:hover {
      border-color: $aurora-purple;
      color: $aurora-purple;
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

.modal-enter-active, .modal-leave-active {
  transition: opacity $anim-base;
  .modal-card { transition: transform $anim-base; }
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
  .modal-card { transform: translateY(8px) scale(0.98); }
}
</style>
