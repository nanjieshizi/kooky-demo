<template>
  <div class="prompt-section">
    <div class="title">
      <div class="belt"></div>预置开场 Prompt
    </div>
    <p class="prompt-hint">可为数字人设置开场推荐提示词，用户进入对话界面将自动展示。前台固定展示 4 张，超出可点击「换一换」切换，最多可配置 20 项，建议填写高频用户使用场景。</p>

    <div class="prompt-toolbar">
      <MarketCustomButton :disabled="prompts.length >= 20" @click="openAdd">
        <img :src="addNavIcon" width="16" height="16" alt="" class="add-icon" />
        添加 Prompt {{ prompts.length }}/20
      </MarketCustomButton>
    </div>

    <div v-if="prompts.length > 0" class="prompt-list">
      <div
        v-for="(prompt, idx) in prompts"
        :key="idx"
        class="prompt-card"
      >
        <div class="prompt-card__body">
          <div class="prompt-card__header">
            <img v-if="prompt.icon" :src="prompt.icon" width="20" height="20" alt="" class="prompt-card__icon" />
            <span v-else class="prompt-card__icon-placeholder">💬</span>
            <span class="prompt-card__title">{{ prompt.title }}</span>
          </div>
          <div class="prompt-card__subtitle">{{ prompt.subtitle }}</div>
        </div>
        <div class="prompt-card__actions">
          <img :src="editIcon" width="16" height="16" alt="编辑" class="prompt-card__action-icon" @click="openEdit(idx)" />
          <img :src="deleteIcon" width="16" height="16" alt="删除" class="prompt-card__action-icon" @click="handleDelete(idx)" />
        </div>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      width="560px"
      :show-close="false"
      align-center
      append-to-body
      class="prompt-dialog"
    >
      <template #header>
        <div class="prompt-dialog__header">
          <span class="prompt-dialog__title">新建开场 Prompt</span>
          <button class="prompt-dialog__close" @click="dialogVisible = false">
            <img :src="closeIcon" width="16" height="16" alt="关闭" />
          </button>
        </div>
      </template>

      <el-form label-position="left" label-width="60px" class="prompt-dialog__body">
        <el-form-item label="标题" required>
          <el-input
            v-model="draftForm.title"
            placeholder="请输入标题，尽量简洁"
            :maxlength="12"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="副标题" required>
          <el-input
            v-model="draftForm.subtitle"
            placeholder="请简单描述使用场景"
            :maxlength="64"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="Prompt" required>
          <el-input
            v-model="draftForm.content"
            type="textarea"
            placeholder="请输入"
            :rows="6"
            :maxlength="1024"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="prompt-dialog__footer">
          <MarketCustomButton @click="dialogVisible = false">取消</MarketCustomButton>
          <MarketCustomButton
            :variant="prompts.length >= 19 || editIndex !== null ? 'dark' : 'default'"
            :disabled="!isFormValid"
            @click="handleConfirm"
          >确定</MarketCustomButton>
          <MarketCustomButton
            v-if="prompts.length < 19 && editIndex === null"
            variant="dark"
            :disabled="!isFormValid"
            @click="handleConfirmAndContinue"
          >
            确定，并继续添加
          </MarketCustomButton>
        </div>
      </template>
    </el-dialog>

    <!-- 删除二次确认弹窗 -->
    <MarketConfirmDialog
      ref="confirmDialogRef"
      :title="`确认删除 ${deleteTargetIdx !== null ? prompts[deleteTargetIdx]?.title : ''} ？`"
      content="删除操作不可撤回，请谨慎操作。"
      confirm-text="删除"
      confirm-variant="danger"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import MarketConfirmDialog from '@/modules/market/components/MarketConfirmDialog.vue'
import addNavIcon from '@/assets/navigation/add.svg'
import editIcon from '@/assets/market/edit.png'
import deleteIcon from '@/assets/market/myupload/skill-version-delete.svg'
import closeIcon from '@/assets/home/close.svg'
import { fetchPromptIcons } from '../services/myUploadsApi'

defineOptions({ name: 'PromptSection' })

export interface PromptItem {
  title: string
  subtitle: string
  content: string
  icon?: string
}

const props = defineProps<{
  modelValue: PromptItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: PromptItem[]): void
}>()

const prompts = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 图标列表（从接口获取）
const iconPool = ref<string[]>([])

async function loadIconPool() {
  try {
    iconPool.value = await fetchPromptIcons()
  } catch {
    iconPool.value = []
  }
}

function pickRandomIcon(): string | undefined {
  if (!iconPool.value.length) return undefined
  return iconPool.value[Math.floor(Math.random() * iconPool.value.length)]
}

onMounted(() => {
  loadIconPool()
})

const dialogVisible = ref(false)
const editIndex = ref<number | null>(null)
const draftForm = reactive<PromptItem>({ title: '', subtitle: '', content: '', icon: '' })

const isFormValid = computed(
  () => draftForm.title.trim() !== '' && draftForm.subtitle.trim() !== '' && draftForm.content.trim() !== '',
)

function resetDraft() {
  draftForm.title = ''
  draftForm.subtitle = ''
  draftForm.content = ''
  draftForm.icon = ''
}

function openAdd() {
  if (prompts.value.length >= 20) return
  editIndex.value = null
  resetDraft()
  draftForm.icon = pickRandomIcon() || ''
  dialogVisible.value = true
}

function openEdit(idx: number) {
  editIndex.value = idx
  const p = prompts.value[idx]
  draftForm.title = p.title
  draftForm.subtitle = p.subtitle
  draftForm.content = p.content
  draftForm.icon = p.icon || ''
  dialogVisible.value = true
}

const confirmDialogRef = ref<InstanceType<typeof MarketConfirmDialog> | null>(null)
const deleteTargetIdx = ref<number | null>(null)

function handleDelete(idx: number) {
  deleteTargetIdx.value = idx
  confirmDialogRef.value?.open()
}

function confirmDelete() {
  if (deleteTargetIdx.value === null) return
  const next = [...prompts.value]
  next.splice(deleteTargetIdx.value, 1)
  emit('update:modelValue', next)
  deleteTargetIdx.value = null
}

function commitDraft() {
  const item: PromptItem = {
    title: draftForm.title.trim(),
    subtitle: draftForm.subtitle.trim(),
    content: draftForm.content.trim(),
    icon: pickRandomIcon(),
  }
  const next = [...prompts.value]
  if (editIndex.value !== null) {
    next.splice(editIndex.value, 1, item)
  } else {
    next.push(item)
  }
  emit('update:modelValue', next)
}

function handleConfirm() {
  commitDraft()
  dialogVisible.value = false
}

function handleConfirmAndContinue() {
  commitDraft()
  editIndex.value = null
  resetDraft()
}
</script>

<style lang="scss" scoped>
.prompt-section {
  margin-top: 16px;
  margin-bottom: 24px;
  padding-bottom: 24px;

  .el-input {
    --accent: #FF9566;
  }

  .el-select {
    --el-color-primary: #FF9566;
  }

  .title {
    font-family: PingFang SC;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    display: flex;
    align-items: center;
    color: #2F3547;
    margin-bottom: 8px;

    .belt {
      background: #FF684E;
      width: 3px;
      height: 14px;
      border-radius: 0px 4px 4px 0px;
      margin-right: 8px;
      flex-shrink: 0;
    }
  }

  .prompt-hint {
    font-family: PingFang SC;
    font-size: 12px;
    font-weight: normal;
    line-height: 20px;
    color: #91949E;
    margin: 0px 0 16px 0;
  }

  .prompt-toolbar {
    margin-bottom: 16px;

    .add-icon {
      margin-right: 4px;
      flex-shrink: 0;
    }
  }

  .prompt-list {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;

    @media (max-width: 1200px) {
      grid-template-columns: repeat(3, 1fr);
    }

    @media (max-width: 900px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 600px) {
      grid-template-columns: 1fr;
    }
  }

  .prompt-card {
    border-radius: 12px;
    background: rgba(247, 248, 250, 0.8);
    padding: 16px;
    height: 81px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    overflow: hidden;

    &__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      padding-left: 16px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    &:hover .prompt-card__actions {
      opacity: 1;
    }

    &__action-icon {
      width: 16px;
      height: 16px;
      cursor: pointer;
      opacity: 0.6;
      flex-shrink: 0;

      &:hover {
        opacity: 1;
      }
    }

    &__body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    &__header {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    &__icon-placeholder {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      font-size: 16px;
      line-height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &__icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      object-fit: contain;
    }

    &__title {
      font-family: PingFang SC;
      font-size: 14px;
      font-weight: 500;
      line-height: 22px;
      color: #2F3547;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__subtitle {
      font-family: PingFang SC;
      font-size: 12px;
      font-weight: normal;
      line-height: 20px;
      color: #91949E;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}
</style>

<style lang="scss">
.prompt-dialog {
  padding: 20px 24px 24px;
  border-radius: 12px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    font-family: PingFang SC;
    font-size: 16px;
    font-weight: 500;
    color: #2F3547;
  }

  &__close {
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

    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }
  }

  &__body {
    .el-form-item {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }

      .el-form-item__label {
        font-family: PingFang SC;
        font-size: 14px;
        color: #2F3547;
        height: 32px;
        line-height: 32px;
        padding: 0px;
        margin-right: 24px;
      }
    }
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .el-input__wrapper,
  .el-textarea__inner {
    border-radius: 8px;
  }
}
</style>
