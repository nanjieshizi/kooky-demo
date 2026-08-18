<template>
  <div class="psef">
    <!-- 已选文件 -->
    <div class="psef-section">
      <div class="psef-section__title">已选文件</div>
      <div class="psef-file-card">
        <div class="psef-file-card__icon">ZIP</div>
        <div class="psef-file-card__name">{{ file?.name }}</div>
        <div class="psef-file-card__size">({{ fileSizeText }})</div>
        <button
          type="button"
          class="psef-file-card__remove"
          title="移除文件"
          :disabled="submitting"
          @click="emit('remove')"
        >
          <el-icon><CircleClose /></el-icon>
        </button>
      </div>
    </div>

    <!-- 技能信息 -->
    <div class="psef-section">
      <div class="psef-section__title">技能信息</div>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="left"
        label-width="78px"
        class="psef-form"
        @submit.prevent
      >
        <el-form-item label="Skill ID" prop="slug" required>
          <el-input v-model="form.slug" placeholder="请输入 Skill ID" :maxlength="64" />
          <div class="psef-hint">
            <el-icon class="psef-hint__icon"><InfoFilled /></el-icon>
            <span>仅支持英文、数字及中划线「-」</span>
          </div>
        </el-form-item>
        <el-form-item label="Skill 名称" prop="displayName" required>
          <el-input
            v-model="form.displayName"
            placeholder="请输入 Skill 名称"
            :maxlength="64"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="描述" prop="description" required>
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="6"
            placeholder="请输入描述"
            :maxlength="1024"
            show-word-limit
          />
        </el-form-item>
      </el-form>
    </div>

    <!-- 操作按钮 -->
    <div class="psef-actions">
      <el-button :disabled="submitting" @click="emit('cancel')">取消</el-button>
      <el-button class="psef-confirm" :loading="submitting" @click="handleConfirm">确定</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleClose, InfoFilled } from '@element-plus/icons-vue'
import { createSkillMultipart } from '@/modules/market/my-uploads/services/myUploadsApi'
import { installSkillToAgent } from '@/modules/market/skill/skillMarketApi.js'

const props = defineProps({
  /** 已校验通过的 zip 文件 */
  file: { type: Object, default: null },
  /** validateSkill 的返回结果，用于回填表单 */
  initialData: { type: Object, default: () => ({}) },
  /** 智能体 ID，保存后自动绑定 */
  agentId: { type: [Number, String], default: null },
})
const emit = defineEmits(['cancel', 'remove', 'success'])

const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  slug: '',
  displayName: '',
  description: '',
  version: '1.0.0',
})

watch(
  () => props.initialData,
  (data) => {
    form.slug = data?.packageName || ''
    // Skill 名称默认填充 Skill ID，支持二次编辑
    form.displayName = data?.displayName || data?.packageName || ''
    form.description = data?.description || ''
    form.version = data?.version || '1.0.0'
  },
  { immediate: true, deep: true },
)

const fileSizeText = computed(() => {
  const bytes = props.file?.size
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(1)}MB`
  const kb = bytes / 1024
  return `${kb.toFixed(0)}KB`
})

const rules = {
  slug: [
    { required: true, message: '请输入 Skill ID', trigger: 'blur' },
    {
      pattern: /^[A-Za-z0-9-]+$/,
      message: '仅支持英文、数字及中划线「-」',
      trigger: ['blur', 'change'],
    },
    { max: 64, message: '不能超过 64 个字符', trigger: 'change' },
  ],
  displayName: [
    { required: true, message: '请输入 Skill 名称', trigger: 'blur' },
    { max: 64, message: '不能超过 64 个字符', trigger: 'change' },
  ],
  description: [
    { required: true, message: '请输入描述', trigger: 'blur' },
    { max: 1024, message: '不能超过 1024 个字符', trigger: 'change' },
  ],
}

async function handleConfirm() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (!props.file) {
    ElMessage.warning('请先上传文件')
    return
  }
  submitting.value = true
  try {
    await createSkillMultipart(props.file, {
      agentId: props.agentId,
      slug: form.slug,
      displayName: form.displayName,
      description: form.description,
      version: form.version,
      changelog: null,
      acceptLicenseTerms: true,
      scope: 'private',
      publish: false,
    })
    if (props.agentId) {
      try {
        await installSkillToAgent(form.slug, props.agentId)
      } catch (e) {
        console.error('[PersonaSkillEditForm] 绑定技能到智能体失败:', e)
      }
    }
    ElMessage.success('添加成功')
    emit('success', { skillSlug: form.slug, agentId: props.agentId })
  } catch (e) {
    console.error('[PersonaSkillEditForm] 创建技能失败:', e)
    // 优先从 detail 字段获取错误消息，兼容 message/msg/error 字段
    const responseData = e?.response?.data
    const errMsg = responseData?.detail || responseData?.message || responseData?.msg || responseData?.error || '创建失败，请重试'
    ElMessage.error(errMsg)
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.psef {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 4px 0 0;
}

.psef-section__title {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 10px;
}

.psef-file-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #ECEEF3;
  border-radius: 10px;

  &__icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: linear-gradient(135deg, #34D399 0%, #10B981 100%);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__name {
    font-size: 14px;
    color: #2F3547;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__size {
    font-size: 13px;
    color: #9CA3AF;
    flex-shrink: 0;
  }

  &__remove {
    border: none;
    background: transparent;
    color: #C2C3C9;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: color 0.15s;

    &:hover {
      color: #6b7280;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
}

.psef-form {
  :deep(.el-form-item) {
    margin-bottom: 18px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
    color: #2F3547;
  }

  :deep(.el-input__wrapper),
  :deep(.el-textarea__inner) {
    border-radius: 8px;
  }
}

.psef-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #8F959E;
  margin-top: 6px;
  line-height: 1.4;

  &__icon {
    font-size: 14px;
    color: #C2C3C9;
  }
}

.psef-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 4px;
}

.psef-confirm {
  background: #171B26;
  border-color: #171B26;
  color: #fff;

  &:hover,
  &:focus {
    background: #2A2E3A;
    border-color: #2A2E3A;
    color: #fff;
  }

  &.is-loading {
    color: #fff;
  }
}
</style>
