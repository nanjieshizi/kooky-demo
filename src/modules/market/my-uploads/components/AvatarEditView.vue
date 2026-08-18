<template>
  <div class="avatar-edit">
    <Loading :visible="saving || publishing" :text="publishing ? '发布中...' : '保存中...'" :overlay="true" />
    <!-- 嵌入模式下面包屑由父组件（SkillUploadView）管理，不重复渲染 -->
    <Breadcrumb   :items="breadcrumbItems" />
    <div class="avatar-edit__body">
      <el-form ref="formRef" :model="form" :rules="formRules" label-position="left" class="avatar-edit__form"
        @submit.prevent>
        <!-- 基本信息（包含头像） -->
        <div class="basic-info">
          <div class="title">
            <div class="belt"></div>基础信息
          </div>
          <div class="basic-info__fields">
            <el-form-item label="数字人图标" required>
              <div class="basic-info__avatar">
                <div class="avatar-upload__preview" @click="avatarDialogVisible = true">
                  <img :src="avatarPreview || defaultAvatarIcon" alt="头像预览" />
                  <div class="avatar-upload__overlay">
                    <img :src="switchIconUrl" class="upload-avatar-icon" />
                  </div>
                </div>
              </div>
            </el-form-item>
            <!-- <el-form-item label="包名称" prop="name" required>
              <el-input v-model="form.name" placeholder="请输入数字人名称" disabled />
            </el-form-item> -->
            <el-form-item label="数字人名称" prop="displayName" required>
              <el-input v-model="form.displayName" placeholder="请输入数字人名称" :maxlength="64" show-word-limit />
            </el-form-item>
            <el-form-item class="version-form-item" label="版本号" prop="version" required>
              <div class="version-field">
                <el-input v-model="form.version" placeholder="1.0.0" :disabled="isVersionEditMode" :class="{ 'is-error': versionConflictMsg }"
                  @input="handleVersionInput">
                  <!-- <template v-if="!isVersionEditMode" #suffix>
                    <el-tooltip content="点击智能生成版本号" placement="top">
                      <img :src="smartGenIcon" class="smart-gen-icon" alt="" @click.stop="handleSmartGenVersion" />
                    </el-tooltip>
                  </template> -->
                </el-input>
                <div v-if="!versionConflictMsg && !isVersionEditMode" class="version-hint">
                  <img :src="versionHintInfoIcon" class="version-hint__icon" width="14" height="14" alt="" />
                  <span>
                    格式要求：主版本.次版本.修订版本
                    <template v-if="latestVersion">；当前最新版本：{{ latestVersion }}</template>
                  </span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="对话模型" prop="modelCode" required>
              <el-cascader
                v-model="modelCascadeValue"
                :options="providerCascadeOptions"
                :props="{ expandTrigger: 'hover' }"
                placeholder="请选择对话模型"
                style="max-width: 464px; width: 100%"
                popper-class="model-cascader-popper"
                @change="onModelCascadeChange"
              />
            </el-form-item>
            <el-form-item label="描述" prop="description" required>
              <el-input v-model="form.description" type="textarea" placeholder="请输入数字人的功能描述" :rows="3" :maxlength="1024"
                show-word-limit />
            </el-form-item>
            <!-- <el-form-item label="对话案例">
              <div class="conversation-case-container">
                <div class="conversation-case-upload" @click="triggerConversationCaseUpload">
                  <img v-if="conversationCasePreview" :src="conversationCasePreview" alt="对话案例"
                    class="conversation-case-image" />
                  <div v-else class="conversation-case-placeholder">
                    <span class="placeholder-plus">+</span>
                    <span class="placeholder-label">添加对话</span>
                    <span class="placeholder-hint">支持 PNG/JPG/JPEG，单文件≤5MB</span>
                  </div>
                  <div v-if="conversationCasePreview" class="conversation-case-overlay">
                    <img :src="uploadAvatarIcon" class="upload-icon" />
                  </div>
                </div>
                <input ref="conversationCaseInputRef" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  class="visually-hidden-file" @change="handleConversationCaseFileChange" />
              </div>
            </el-form-item> -->
            <el-form-item label="分类标签">
              <BuiltinCategoryTagPicker v-model="form.tags" />
            </el-form-item>
          </div>
        </div>

        <!-- 更新日志 -->
        <div class="basic-info">
          <div class="title">
            <div class="belt"></div>更新日志
          </div>
          <el-form-item label="描述" prop="changelog">
            <el-input v-model="form.changelog" type="textarea" placeholder="请输入本次更新的内容" :rows="4" :maxlength="1024"
              show-word-limit />
          </el-form-item>
        </div>

        <el-form-item v-show="false" prop="_uploadGate" class="avatar-edit__upload-gate" />


        <!-- 关联 Skill -->
        <!-- <div class="basic-info">
          <div class="title" style="margin-top: 16px">
            <div class="belt"></div>关联 Skill
          </div>
          <el-form-item label="">
            <div class="skill-section">
              <div class="skill-section__toolbar">
                <div class="add-skill-from-market" @click="skillDialogVisible = true">
                  <div class="add">
                    <img :src="addSkillIcon">
                  </div>
                  <div class="info">添加Skill</div>
                </div>
              </div>
              <div class="skill-list">
                <div v-for="skill in selectedSkills" :key="skill.id" class="skill-item">
                  <div class="skill-item__avatar">
                    <img v-if="skill.avatar" :src="skill.avatar" alt="" />
                    <span v-else class="skill-item__avatar-placeholder">{{ skill.displayName?.charAt(0) }}</span>
                  </div>
                  <div class="skill-item__info">
                    <div class="skill-item__header">
                      <span class="skill-item__name">{{ skill.displayName }}</span>
                      <span class="skill-item__version">{{ skill.installedVersion ? `v${skill.installedVersion}` : '' }}</span>
                    </div>

                    <div class="skill-item__footer">
                      <div class="skill-item__tags">
                        <el-tooltip v-for="(tag, idx) in skill.tags?.slice(0, 2)" :key="idx" :content="tag"
                          :disabled="tag.length <= 4" placement="top" effect="dark" :show-after="200">
                          <span class="skill-item__tag">{{ tag.length > 4 ? tag.slice(0, 4) + '…' : tag }}</span>
                        </el-tooltip>
                        <el-tooltip v-if="skill.tags?.length > 2" :content="skill.tags.slice(2).join('、')"
                          placement="top" effect="dark" :show-after="200">
                          <span class="skill-item__tag skill-item__tag--more">+{{ skill.tags.length - 2 }}</span>
                        </el-tooltip>
                      </div>
                      <MarketCustomButton class="skill-item__remove" size="small" @click="removeSkill(skill.id)">移除
                      </MarketCustomButton>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </el-form-item>
        </div> -->

        <!-- Skill 列表（来自包内，只读展示） -->
        <div   class="basic-info">
          <div class="title" style="margin-top: 16px">
            <div class="belt"></div>Skill 列表
          </div>
          <div class="pkg-skill-list">
            <div v-for="skill in packageSkillsInfo" :key="skill.id" class="pkg-skill-item">
              <div class="pkg-skill-item__avatar">
                <img :src="skill.icon" alt="" />
              </div>
              <div class="pkg-skill-item__info">
                <div class="pkg-skill-item__name">{{ skill.name }}</div>
                <div class="pkg-skill-item__desc">{{ skill.description }}</div>
              </div>
            </div>
            <div v-if="!packageSkillsInfo.length" class="pkg-skill-empty">暂无关联 Skill</div>
          </div>
        </div>

        <!-- 预置开场 Prompt -->
        <PromptSection v-model="form.prompts" />
      </el-form>
    </div>

    <!-- 底部操作区：与主体分列，随编辑区贴底，高度 64px（设计稿） -->
    <div class="avatar-edit__footer">
      <div class="footer-check">
        <el-checkbox v-model="licenseAgreed">我拥有此数字人的权利，并同意在 MIT-0 协议下发布。</el-checkbox>
        <div class="footer-look" @click="openLicense">查看详情</div>
      </div>
      <div class="footer-btn">
        <MarketCustomButton @click="router.back()">取消
        </MarketCustomButton>
        <MarketCustomButton :disabled="saving || publishing" @click="handleSave">{{ saving ? '保存中...' : '保存' }}
        </MarketCustomButton>
        <MarketCustomButton variant="dark" :disabled="saving || publishing" @click="handleSaveAndPublish">{{ publishing ? '发布中...' : '保存并发布' }}
        </MarketCustomButton>
      </div>
    </div>

    <!-- Skill 市场弹窗 -->
    <SkillMarketDialog v-model="skillDialogVisible" :selected-ids="form.relatedSkillIds" @add="handleAddSkillFromMarket"
      @remove="handleRemoveSkillFromMarket" />

    <!-- 头像上传弹窗 -->
    <AvatarUploadDialog v-model="avatarDialogVisible" :current-avatar="currentAvatarForDialog" type="agent"
      @confirm="handleAvatarConfirm" />

    <!-- 协议详情弹窗 -->
    <LicenseDialog v-model="licenseDialogVisible" />

    <!-- 协议确认发布弹窗（随「保存并发布」一并暂时注释） -->

    <el-dialog v-model="licenseConfirmVisible" 
    append-to-body title="请先勾选确认协议后再进行发布" width="480px" :show-close="false"
      class="license-confirm-dialog">
      <div class="license-confirm-content">
        <el-checkbox v-model="licenseAgreed">我拥有此数字人的权利，并同意在 MIT-0 协议下发布。</el-checkbox>
      </div>
      <template #footer>
        <div class="license-confirm-footer">
          <MarketCustomButton @click="licenseConfirmVisible = false">取消</MarketCustomButton>
          <MarketCustomButton variant="dark" :disabled="!licenseAgreed" @click="confirmAndPublish">确认并发布
          </MarketCustomButton>
        </div>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import Breadcrumb from '@/shared/components/Breadcrumb.vue'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import SkillMarketDialog from './SkillMarketDialog.vue'
import AvatarUploadDialog from './AvatarUploadDialog.vue'
import BuiltinCategoryTagPicker from './BuiltinCategoryTagPicker.vue'
import LicenseDialog from './LicenseDialog.vue'
import { sanitizeTagsToBuiltin } from '../constants/builtinCategoryTags'
import { createAgent, updateAgent, fetchAgentById, fetchMySkills, fetchProviderConfigs, fetchAgentAvatars, fetchAgentDetailByVersion, editAgentVersion } from '../services/myUploadsApi'
import type { AgentCreateData, AgentUpdateData, AvatarFormMode, AvatarFormData, SkillItem, SkillInfoItem, ProviderConfig, ModelConfig } from '../types'
import {
  generateVersion,
  isVersionConflict,
  isVersionTooLow,
  pickRandomVersionWithinFivePatchSteps,
  type UpdateType,
} from '../utils/versionUtils'
import addSkillIcon from '@/assets/market/myupload/add.svg'
import versionHintInfoIcon from '../assets/version-hint-info.svg?url'
 
import switchIconUrl from '@/assets/market/switch.svg'
import smartGenIcon from '@/assets/market/myupload/zhinengshencheng.svg'
import defaultSkillIcon from '@/assets/skill/skill-main.svg'
import { createAgentMultipart } from '../services/myUploadsApi'
import PromptSection from './PromptSection.vue'

// ---- 嵌入模式 props ----
const props = withDefaults(defineProps<{
  /** 嵌入模式：SkillUploadView 传入的原始上传文件，保存时通过 multipart 提交 */
  uploadedFile?: File | null
  /** 嵌入模式：validate 接口解析出的表单初始数据 */
  uploadQueryData?: Record<string, any>
}>(), {
  uploadedFile: null,
  uploadQueryData: () => ({}),
})

const emit = defineEmits<{
  (e: 'save-success'): void
  (e: 'back'): void
}>()

const isEmbedded = computed(() => !!props.uploadedFile)

const route = useRoute()
const router = useRouter()

// 模式判断：嵌入模式始终是创建模式
const mode = computed<AvatarFormMode>(() => {
  if (isEmbedded.value) return 'create'
  return route.name === 'AvatarCreate' || route.params.id === 'new' ? 'create' : 'edit'
})

const avatarId = computed(() => route.params.id as string | undefined)

/** 版本编辑模式：从 AvatarDetailView 点击编辑跳转，携带 editVersionId */
const isVersionEditMode = computed(() => !isEmbedded.value && !!route.query.editVersionId)
const editVersionId = computed(() => Number(route.query.editVersionId) || 0)
const editVersionFixed = computed(() => String(route.query.editVersion ?? '').replace(/^v/i, '').trim())

/** 从详情页「上传新版本」跳转时携带的 agentId */
const routeAgentId = computed(() => {
  const v = route.query.agentId
  return v ? Number(v) : null
})

// 嵌入模式：从 props 读取；路由模式：从 route.query 读取
const uploadQuery = computed<Record<string, any>>(() => {
  if (isEmbedded.value) {
    return props.uploadQueryData || {}
  }
  return route.query
})

const breadcrumbItems = computed(() => {
  if (isVersionEditMode.value) {
    return [
      { label: '我的上传', to: '/market/avatar' },
      // { label: '数字人详情', to: `/market/avatar/${avatarId.value}?from=my-uploads` },
      { label: '编辑' },
    ]
  }
  if (mode.value === 'create') {
    return [
      { label: '上传数字人', to: '/market/avatar' },
      { label: '编辑' },
    ]
  }
  return [
    { label: '数字人市场', to: '/market/avatar' },
    { label: '数字人详情', to: `/market/my-uploads/agent/${avatarId.value}` },
    { label: `${form.name} 编辑` },
  ]
})

// 表单数据
const form = reactive<AvatarFormData>({
  displayName: '',
  name: '',
  version: '1.0.0',
  tags: [],
  description: '',
  avatarUrl: '',
  relatedSkillIds: [],
  changelog: '',
  modelCode: '',
  prompts: [],
  _uploadGate: 'ok',
})

// 头像上传
const avatarPreview = ref('')
const defaultAvatarIcon = ref('')
/** 与表单项「头像预览」一致：无自定义图时传入默认图，选择头像弹窗内才显示当前图 */
const currentAvatarForDialog = computed(
  () => (avatarPreview.value || defaultAvatarIcon.value) as string,
)
const avatarDialogVisible = ref(false)
const licenseDialogVisible = ref(false)
const licenseAgreed = ref(false)
const saving = ref(false)
const publishing = ref(false)

// 对话模型配置
const providerConfigs = ref<ProviderConfig[]>([])

/** 级联选择器选项：一级 provider，二级 model */
const providerCascadeOptions = computed(() =>
  providerConfigs.value.map(p => ({
    value: p.template_code ?? String(p.id),
    label: p.display_name,
    children: p.models.map(m => ({
      value: m.model_code,
      label: m.model_name,
    })),
  }))
)

/** 级联选择器双向绑定值 [providerCode, modelCode] */
const modelCascadeValue = ref<string[]>([])

function onModelCascadeChange(val: string[]) {
  form.modelCode = val?.[1] ?? ''
}

/** 根据 model_code 反查 provider，用于回显 */
function resolveModelCascadeValue(modelCode: string): string[] {
  if (!modelCode) return []
  for (const p of providerConfigs.value) {
    const m = p.models.find(m => m.model_code === modelCode)
    if (m) return [p.template_code ?? String(p.id), m.model_code]
  }
  return []
}

// model_code -> ProviderConfig 映射，用于构建 model_config
const modelCodeToProviderMap = computed(() => {
  const map = new Map<string, ProviderConfig>()
  providerConfigs.value.forEach(provider => {
    provider.models.forEach(model => {
      map.set(model.model_code, provider)
    })
  })
  return map
})

function buildModelConfig(): ModelConfig {
  const modelCode = String(form.modelCode ?? '').trim()
  const provider = modelCodeToProviderMap.value.get(modelCode)
  return {
    llm_channel: 'kc-oc',
    llm_model_config_id: provider?.id ?? null,
    llm_provider_config_id: modelCode as any,
  }
}

// 版本智能生成
const existingVersions = ref<{ version: string }[]>([])
const versionConflictMsg = ref('')
const latestVersion = computed(() => {
  // 版本编辑来源：显示路由携带的 editVersion
  if (route.query.editVersion) {
    const v = String(route.query.editVersion ?? '').trim()
    return v ? (v.startsWith('v') || v.startsWith('V') ? v : `v${v}`) : ''
  }
  // 上传新版本来源：显示 existingVersions[0]（已按接口顺序，第一个为最新）
  if (routeAgentId.value && existingVersions.value.length) {
    const v = existingVersions.value[0]?.version ?? ''
    return v ? (v.startsWith('v') || v.startsWith('V') ? v : `v${v}`) : ''
  }
  return ''
})

function handleSmartGenVersion() {
  const picked = pickRandomVersionWithinFivePatchSteps(
    form.version,
    existingVersions.value,
  )
  form.version =
    picked ?? generateVersion(existingVersions.value, 'patch')
  versionConflictMsg.value = ''
  formRef.value?.validateField('version')
}

function handleVersionInput() {
  const v = form.version.trim()
  if (!v || !/^\d+\.\d+\.\d+$/.test(v)) {
    versionConflictMsg.value = ''
    formRef.value?.validateField('version')
    return
  }
  if (isVersionConflict(v, existingVersions.value)) {
    const matched = existingVersions.value.find(ev => ev.version === v)
    versionConflictMsg.value = `与已发布版本（v${matched?.version || v}）重复，请修改后再继续`
  } else if (isVersionTooLow(v, existingVersions.value)) {
    versionConflictMsg.value = `版本号不得低于已有版本（v${latestVersion.value}）`
  } else {
    versionConflictMsg.value = ''
  }
  formRef.value?.validateField('version')
}

const formRef = ref<FormInstance>()

/** 与表单项 maxlength 及包名安全长度一致 */
const FORM_LEN = {
  displayName: 64,
  packageName: 64,
  description: 1024,
  version: 32,
  changelog: 1024,
} as const

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入包名称', trigger: 'change' },
    { max: FORM_LEN.packageName, message: `包名称不能超过 ${FORM_LEN.packageName} 个字符`, trigger: 'change' },
    {
      pattern: /^[a-z0-9][a-z0-9-_]*$/,
      message: '包名称只能包含小写字母、数字、连字符和下划线',
      trigger: 'change',
    },
  ],
  displayName: [
    { required: true, message: '请输入数字人名称', trigger: ['blur', 'change'] },
    {
      validator: (_r, v, cb) => {
        const t = String(v ?? '').trim()
        if (!t) {
          cb(new Error('请输入数字人名称'))
          return
        }
        if (t.length > FORM_LEN.displayName) {
          cb(new Error(`数字人名称不能超过 ${FORM_LEN.displayName} 个字符`))
          return
        }
        cb()
      },
      trigger: ['blur', 'change'],
    },
  ],
  version: [
    { required: true, message: '请输入版本号', trigger: ['blur', 'change'] },
    {
      validator: (_r, v, cb) => {
        const s = String(v ?? '').trim()
        if (!s) {
          cb(new Error('请输入版本号'))
          return
        }
        if (s.length > FORM_LEN.version) {
          cb(new Error(`版本号不能超过 ${FORM_LEN.version} 个字符`))
          return
        }
        if (!/^\d+\.\d+\.\d+$/.test(s)) {
          cb(new Error('版本号格式不正确，请使用 x.x.x 格式'))
          return
        }
        if (versionConflictMsg.value) {
          cb(new Error(versionConflictMsg.value))
          return
        }
        cb()
      },
      trigger: ['blur', 'change'],
    },
  ],
  description: [
    { required: true, message: '请输入描述', trigger: ['blur', 'change'] },
    {
      validator: (_r, v, cb) => {
        const t = String(v ?? '').trim()
        if (!t) {
          cb(new Error('请输入描述'))
          return
        }
        if (t.length > FORM_LEN.description) {
          cb(new Error(`描述不能超过 ${FORM_LEN.description} 个字符`))
          return
        }
        cb()
      },
      trigger: ['blur', 'change'],
    },
  ],
  changelog: [
    {
      validator: (_r, v, cb) => {
        const t = v == null ? '' : String(v)
        if (t.length > FORM_LEN.changelog) {
          cb(new Error(`更新日志不能超过 ${FORM_LEN.changelog} 个字符`))
          return
        }
        cb()
      },
      trigger: 'change',
    },
  ],
  modelCode: [
    { required: true, message: '请选择对话模型', trigger: ['blur', 'change'] },
  ],
  _uploadGate: [
    {
      validator: (_r, _v, cb) => {
        if (mode.value !== 'create') {
          cb()
          return
        }
        const packageName = uploadQuery.value.packageName as string
        const displayName = uploadQuery.value.displayName as string
        if (!packageName || !displayName) {
          cb(new Error('缺少包文件信息，请重新上传'))
          return
        }
        cb()
      },
      trigger: 'change',
    },
  ],
}

function handleAvatarConfirm(url: string) {
  avatarPreview.value = url
  form.avatarUrl = url
}

/**
 * 提交创建/升级时的封面图：直接使用后端返回的头像地址。
 */
function resolveAgentCoverImageForSubmit(): string {
  return form.avatarUrl?.trim() || defaultAvatarIcon.value
}


const availableSkills = ref<SkillItem[]>([])

// 来自 validate-package 接口的包内 Skill 信息（只读展示）
const packageSkillsInfo = ref<SkillInfoItem[]>([])
// 来自 validate-package 接口的包内 Skill slug 列表，保存时传给后端
const packageSkills = ref<string[]>([])

// Skill 市场弹窗
const skillDialogVisible = ref(false)

function handleAddSkillFromMarket(skill: any) {
  // console.log('[AvatarEdit] handleAddSkillFromMarket skill:', JSON.stringify(skill))
  if (form.relatedSkillIds.includes(skill.id)) {
    ElMessage.warning('该 Skill 已被添加')
    return
  }

  form.relatedSkillIds.push(skill.id)

  // 同步到 availableSkills 以便卡片展示
  if (!availableSkills.value.find(s => s.id === skill.id)) {
    availableSkills.value.push(skill)
  }

  // console.log('[AvatarEdit] availableSkills:', JSON.stringify(availableSkills.value))

  ElMessage.success('添加成功')
}

function handleRemoveSkillFromMarket(skill: any) {
  removeSkill(skill.id)
  const idx = availableSkills.value.findIndex(s => s.id === skill.id)
  if (idx > -1) availableSkills.value.splice(idx, 1)
}

// Skill 选择
const selectedSkills = computed(() => {
  const result = availableSkills.value.filter(s => form.relatedSkillIds.includes(s.id))
  // console.log('[AvatarEdit] selectedSkills:', JSON.stringify(result))
  // console.log('[AvatarEdit] relatedSkillIds:', form.relatedSkillIds)
  // console.log('[AvatarEdit] availableSkills:', JSON.stringify(availableSkills.value))
  return result
})

// 构建关联的 skills 数组，格式为 ["slug@version"]
function buildSkillsArray(): string[] {
  return selectedSkills.value.map(skill => `${skill.slug}@${skill.version}`)
}

function removeSkill(id: number) {
  const idx = form.relatedSkillIds.indexOf(id)
  if (idx > -1) form.relatedSkillIds.splice(idx, 1)
}

function toggleSkill(id: number) {
  const idx = form.relatedSkillIds.indexOf(id)
  if (idx > -1) {
    form.relatedSkillIds.splice(idx, 1)
  } else {
    form.relatedSkillIds.push(id)
  }
}

// 保存逻辑（create 或 update）
async function doSave(scope: 'private' | 'market' = 'private'): Promise<number> {
  const skills = [...new Set([...buildSkillsArray(), ...packageSkills.value])]
  const image = resolveAgentCoverImageForSubmit()
  const skillsInfo = packageSkillsInfo.value.length ? packageSkillsInfo.value : undefined
  const model_config = buildModelConfig()

  // 版本编辑模式：PUT /api/v1/agents/{agent_id}/edit/{version_id}
  if (isVersionEditMode.value) {
    const agentNumericId = Number(avatarId.value)
    if (!agentNumericId || !editVersionId.value) throw new Error('缺少 agent_id 或 version_id')
    await editAgentVersion(agentNumericId, editVersionId.value, {
      avatar: image || undefined,
      display_name: form.displayName,
      model_config,
      description: form.description,
      tags: form.tags,
      change_log: form.changelog || undefined,
      prompts: form.prompts,
      scope,
    })
    return agentNumericId
  }

  // 嵌入模式：使用 multipart 接口将原始文件一起提交
  if (isEmbedded.value && props.uploadedFile) {
    const agent_id = routeAgentId.value ?? undefined
    const result = await createAgentMultipart(props.uploadedFile, {
      name: form.name,
      displayName: form.displayName,
      description: form.description,
      version: form.version,
      image,
      tags: form.tags,
      skills,
      changelog: form.changelog,
      model_config,
      prompts: form.prompts,
      skillsInfo,
      scope,
      ...(agent_id != null ? { agent_id } : {}),
    })
    return result.id || 0
  }

  if (mode.value === 'create') {
    const packageName = uploadQuery.value.packageName as string || ''
    const displayName = uploadQuery.value.displayName as string || ''

    if (!packageName || !displayName) {
      ElMessage.error('缺少包文件信息，请重新上传')
      router.push('/market/avatar')
      throw new Error('缺少包文件信息')
    }

    const agent_id = routeAgentId.value ?? undefined
    const data: AgentCreateData = {
      name: form.name,
      displayName: form.displayName,
      description: form.description,
      version: form.version,
      image,
      tags: form.tags,
      skills,
      changelog: form.changelog,
      isPublished: false,
      official: false,
      model_config,
      prompts: form.prompts,
      skillsInfo,
      scope,
      ...(agent_id != null ? { agent_id } : {}),
    }
    const result = await createAgent(data)
    return result.id || Number(avatarId.value)
  } else {
    // 升级场景：如果有新包数据，用 createAgent 创建新版本
    if (hasUploadData.value) {
      const data: AgentCreateData = {
        name: form.name,
        displayName: form.displayName,
        description: form.description,
        version: form.version,
        image,
        tags: form.tags,
        skills,
        changelog: form.changelog,
        isPublished: false,
        official: false,
          model_config,
        prompts: form.prompts,
        skillsInfo,
        scope,
      }
      const result = await createAgent(data)
      return result.id || Number(avatarId.value)
    }

    // 普通编辑：用 updateAgent
    const data: AgentUpdateData = {
      displayName: form.displayName,
      description: form.description,
      version: form.version,
      image,
      tags: form.tags,
      skills,
      changelog: form.changelog,
      isPublished: false,
      official: false,
      model_config,
      prompts: form.prompts,
      skillsInfo,
      scope,
    }
    await updateAgent(Number(avatarId.value), data)
    return Number(avatarId.value)
  }
}

// 保存
async function handleSave() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    await doSave('private')
    ElMessage.success(mode.value === 'create' ? '创建成功' : '保存成功')
    if (isEmbedded.value) {
      emit('save-success')
    } else if (isVersionEditMode.value) {
      router.push(`/market/avatar/${avatarId.value}?from=my-uploads&versionId=${editVersionId.value}`)
    } else {
      router.push('/market/avatar')
    }
  } catch (e: any) {
    console.error('保存失败:', e)
    ElMessage.error(e?.response?.data?.message || e?.response?.data?.detail || '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

const licenseConfirmVisible = ref(false)

async function executePublish() {
  publishing.value = true
  try {
    await doSave('market')
    ElMessage.success('保存并发布成功')
    if (isEmbedded.value) {
      emit('save-success')
    } else if (isVersionEditMode.value) {
      router.push(`/market/avatar/${avatarId.value}?from=my-uploads&versionId=${editVersionId.value}`)
    } else {
      router.push('/market/avatar')
    }
  } catch (e: any) {
    console.error('保存并发布失败:', e)
    ElMessage.error(e?.response?.data?.message || e?.response?.data?.detail || '保存并发布失败，请稍后重试')
  } finally {
    publishing.value = false
  }
}

async function handleSaveAndPublish() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (!licenseAgreed.value) {
    licenseConfirmVisible.value = true
    return
  }
  await executePublish()
}

async function confirmAndPublish() {
  licenseConfirmVisible.value = false
  await executePublish()
}


function openLicense() {
  licenseDialogVisible.value = true
}

// 是否有来自 validate 的新包数据（升级场景或首次创建）
const hasUploadData = computed(() => {
  return !!(uploadQuery.value.displayName && uploadQuery.value.packageName)
})

// 加载编辑数据
async function loadEditData() {
  // 版本编辑模式：从接口加载指定版本数据
  if (isVersionEditMode.value) {
    const agentNumericId = Number(avatarId.value)
    if (!agentNumericId || !editVersionId.value) return
    try {
      const res = await fetchAgentDetailByVersion(agentNumericId, editVersionId.value)
      const entity = res?.entity ?? res?.data?.entity ?? res
      form.displayName = String(entity?.displayName ?? entity?.display_name ?? '').trim()
      form.version = editVersionFixed.value || String(entity?.version ?? '').replace(/^v/i, '').trim()
      form.description = String(entity?.description ?? entity?.summary ?? '').trim()
      form.changelog = String(entity?.changelog ?? entity?.change_log ?? '').trim()
      form.tags = sanitizeTagsToBuiltin(entity?.tags)
      form.prompts = Array.isArray(entity?.prompts) ? entity.prompts : []
      form.avatarUrl = entity?.avatar_url ?? entity?.avatar ?? entity?.image ?? ''
      defaultAvatarIcon.value = form.avatarUrl
      if (form.avatarUrl) avatarPreview.value = form.avatarUrl
      // 回填 Skill 列表
      packageSkillsInfo.value = Array.isArray(entity?.skillsInfo) ? entity.skillsInfo
        : Array.isArray(entity?.skills_info) ? entity.skills_info : []
      // 加载模型配置
      const mc = entity?.model_config
      if (mc?.llm_provider_config_id) {
        form.modelCode = String(mc.llm_provider_config_id)
      }
      // 加载历史版本列表用于冲突校验
      try {
        const agent = await fetchAgentById(agentNumericId)
        const rawVersions = Array.isArray(agent.versions) ? agent.versions : []
        existingVersions.value = rawVersions.map((v: any) => ({
          ...v,
          version: String(v.version ?? '').replace(/^v/i, ''),
        }))
      } catch (e) {
        console.error('加载历史版本列表失败:', e)
      }
    } catch (e) {
      console.error('加载版本数据失败:', e)
      ElMessage.error('加载版本数据失败')
    }
    return
  }

  // 首次创建：从 query 参数初始化数据
  if (mode.value === 'create') {
    form.name = uploadQuery.value.packageName as string || ''
    form.displayName = uploadQuery.value.displayName as string || ''
    form.description = uploadQuery.value.description as string || ''
    form.version = uploadQuery.value.version as string || '1.0.0'
    form.tags = sanitizeTagsToBuiltin(uploadQuery.value.tags)
    packageSkillsInfo.value = uploadQuery.value.skillsInfo || []
    packageSkills.value = uploadQuery.value.skills || []

    // 从详情页「上传新版本」跳转时，用 latestVersionId 回填图标、模型、标签、Prompt 默认值，并加载历史版本用于冲突校验
    const latestVersionId = Number(uploadQuery.value.latestVersionId)
    const agentNumericId = routeAgentId.value
    if (latestVersionId && agentNumericId) {
      try {
        const res = await fetchAgentDetailByVersion(agentNumericId, latestVersionId)
        const entity = res?.entity ?? res?.data?.entity ?? res
        // 图标
        const avatarUrl = entity?.avatar_url ?? entity?.avatar ?? entity?.image ?? ''
        if (avatarUrl) {
          form.avatarUrl = avatarUrl
          defaultAvatarIcon.value = avatarUrl
          avatarPreview.value = avatarUrl
        }
        // 对话模型
        const mc = entity?.model_config
        if (mc?.llm_provider_config_id) {
          form.modelCode = String(mc.llm_provider_config_id)
        }
        // 分类标签（仅当 validate-package 未提供时才回填）
        if (!form.tags?.length) {
          form.tags = sanitizeTagsToBuiltin(entity?.tags)
        }
        // 预置开场 Prompt
        if (Array.isArray(entity?.prompts) && entity.prompts.length) {
          form.prompts = entity.prompts
        }

         existingVersions.value = entity.versions.map((v: any) => ({
          ...v,
          version: String(v.version ?? '').replace(/^v/i, ''),
        }))

        handleVersionInput()


      } catch (e) {
        console.error('加载历史版本默认值失败:', e)
      }
    }
    // 加载历史版本列表用于版本号冲突校验（数字人版本号格式为 "v1.7.0"，需去掉 v 前缀）
    if (agentNumericId) {
      try {
        const agent = await fetchAgentById(agentNumericId)
        const rawVersions = Array.isArray(agent.versions) ? agent.versions : []
        existingVersions.value = rawVersions.map((v: any) => ({
          ...v,
          version: String(v.version ?? '').replace(/^v/i, ''),
        }))
      } catch (e) {
        console.error('加载历史版本列表失败:', e)
      }
    }
    return
  }

  // 编辑模式（含升级场景）
  if (!avatarId.value || avatarId.value === 'new') {
    existingVersions.value = []
    form.version = '1.0.0'
    return
  }

  try {
    const agent = await fetchAgentById(Number(avatarId.value))

    // 升级场景：优先用 query 中新包 validate 的数据，其余用已有数据兜底
    if (hasUploadData.value) {
      form.name = uploadQuery.value.packageName as string || agent.name || agent.slug
      form.displayName = uploadQuery.value.displayName as string || agent.displayName
      form.description = uploadQuery.value.description as string || agent.summary
      form.version = uploadQuery.value.version as string || generateVersion(agent.versions || [], 'patch')
      form.tags = sanitizeTagsToBuiltin(uploadQuery.value.tags)
      packageSkillsInfo.value = uploadQuery.value.skillsInfo || []
      packageSkills.value = uploadQuery.value.skills || []
    } else {
      form.displayName = agent.displayName
      form.name = agent.name || agent.slug
      form.tags = sanitizeTagsToBuiltin(agent.tags)
      form.description = agent.summary
      form.version = generateVersion(agent.versions || [], 'patch')
    }

    form.avatarUrl = agent.avatar_url ?? agent.avatar ?? ''
    defaultAvatarIcon.value = form.avatarUrl
    if (form.avatarUrl) {
      avatarPreview.value = form.avatarUrl
    }

    // 加载已关联的 Skills
    if (agent.skills && agent.skills.length > 0) {
      form.relatedSkillIds = agent.skills.map(skill => skill.id)
      // 同步到 availableSkills 以便卡片展示
      agent.skills.forEach(skill => {
        if (!availableSkills.value.find(s => s.id === skill.id)) {
          availableSkills.value.push({
            id: skill.id,
            slug: skill.slug,
            displayName: skill.displayName,
            version: skill.version,
            summary: skill.summary,
            status: 'published',
            avatar: skill.avatar || '',
            statsDownloads: skill.statsDownloads || 0,
            statsStars: skill.statsStars || 0,
            updatedAt: '',
          })
        }
      })
    }

    // 记录所有历史版本（含已删除），用于冲突校验
    existingVersions.value = agent.versions || []
  } catch (e) {
    // console.error('加载数据失败:', e)
    ElMessage.error('加载数据失败')
  }
}

// 加载 Skill 列表
async function loadSkills() {
  try {
    const res = await fetchMySkills()
    availableSkills.value = res.results
  } catch (e) {
    console.error('加载 Skill 列表失败:', e)
  }
}

// 加载对话模型配置
async function loadProviderConfigs() {
  try {
    const configs = await fetchProviderConfigs('kc-oc')
    providerConfigs.value = configs
    // 设置默认选中第一个可用的模型
    if (!form.modelCode && configs.length > 0) {
      const firstProvider = configs[0]
      if (firstProvider.models.length > 0) {
        form.modelCode = firstProvider.models[0].model_code
      }
    }
    // 回显：configs 加载完后同步级联值
    modelCascadeValue.value = resolveModelCascadeValue(form.modelCode)
  } catch (e) {
    console.error('加载对话模型配置失败:', e)
  }
}

// 加载默认头像（仅创建模式，取第 3 个固定图标）
async function loadDefaultAvatar() {
  if (mode.value !== 'create') return
  try {
    const avatars = await fetchAgentAvatars()
    defaultAvatarIcon.value = avatars.length > 2 ? avatars[2] : (avatars[0] ?? '')
  } catch (e) {
    console.error('加载默认头像失败:', e)
    defaultAvatarIcon.value = ''
  }
}

onMounted(() => {
  loadEditData()
  loadSkills()
  loadProviderConfigs()
  loadDefaultAvatar()
})
</script>

<style lang="scss" scoped>
.el-cascader {
  --el-color-primary: #FF9566;
}
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
  letter-spacing: 0px;

  font-variation-settings: "opsz" auto;
  color: #2F3547;
  margin-bottom: 24px;

  .belt {
    background: #FF684E;
    // margin-top: 2px;
    width: 3px;
    height: 14px;
    border-radius: 0px 4px 4px 0px;
    margin-right: 8px;
  }
}

.avatar-edit {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}

.avatar-edit__body {
  flex: 1;
  min-height: 0;
  padding: 24px 32px;
  overflow-y: auto;
  background: linear-gradient(0deg, #FFFFFF, #FFFFFF), linear-gradient(180deg, #F9FAFA 0%, #FFFFFF 25%);
}

.avatar-edit__form {
  width: 100%;

  /* 设计稿：单行输入最大 464px，描述类文本域最大 588px */
  :deep(.el-input) {
    max-width: 464px;
    width: 100%;
  }

  :deep(.el-textarea) {
    max-width: 588px;
    width: 100%;
  }
}

// 基本信息
.basic-info {
  gap: 32px;
  margin-bottom: 24px;
  padding-bottom: 24px;
}

.basic-info__avatar {
  width: 80px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  align-content: center;
  border-radius: 24px;
  box-sizing: border-box;
  border: 1px solid #DFE2EA;
  cursor: pointer;
}

/* 与 rules 校验错误（或 versionConflict 通过 validator 报红）同时出现时，不展示「格式要求」说明 */
:deep(.version-form-item.is-error) {
  .version-hint {
    display: none;
  }
}

.version-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 464px;

  :deep(.el-input) {
    width: 100%;
  }

  .smart-gen-icon {
    width: 16px;
    height: 16px;
    cursor: pointer;
    opacity: 0.7;

    &:hover {
      opacity: 1;
    }
  }

  .version-hint {
    display: flex;
    align-items: center;
    font-size: 12px;
    color: #8f959e;
    line-height: 18px;
    padding-top: 2px;
    line-height: 1;
    position: absolute;
    top: 100%;
    animation: avatar-version-hint-appear 0.45s ease-out both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    &__icon {
      display: block;
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      margin-right: 6px;
      object-fit: contain;
    }
  }

  .version-error {
    font-size: 12px;
    color: #ED4543;
    line-height: 18px;
  }
}

@keyframes avatar-version-hint-appear {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.basic-info__fields {
  flex: 1;
  min-width: 0;
}

// 头像上传
.avatar-upload__preview {
  width: 80px;
  height: 80px;
  // padding:10px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  align-content: center;
  border-radius: 24px;
  box-sizing: border-box;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-upload__overlay {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    background: #FFFFFF;
    opacity: 0;
    transition: opacity 0.2s;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;

    .upload-avatar-icon {
      width: 14px;
      height: 14px;
    }
  }

    &:hover {
    border: none;
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      background-color: rgba($color: #000000, $alpha: 0.2);
    }
  }

  &:hover .avatar-upload__overlay {
    opacity: 1;
  }
}
.basic-info__avatar{
  &:hover{
    border: none;
  }
}

.avatar-upload__placeholder {
  color: #909399;
}

// Skill 列表
.skill-section {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__toolbar {
    display: flex;
    justify-content: flex-start;
  }
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.skill-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  width: 318px;
  border-radius: 16px;
  padding: 16px;
  background: #ffffff;
  box-sizing: border-box;
  border: 1px solid #eceef3;
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    border: 1px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);

    .skill-item__remove {
      opacity: 1;
    }
  }
}

.skill-item__avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
}

.skill-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .skill-item__footer {
    height: 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.skill-item__header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.skill-item__name {
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #2f3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  // flex: 1;
  min-width: 0;
}

.skill-item__version {
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  color: #91949e;
  flex-shrink: 0;
}

.skill-item__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.skill-item__tag {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0 6px;
  border-radius: 4px;
  background: #eceef3;
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  line-height: 20px;
  color: #6b7280;
  white-space: nowrap;

  &--more {
    background: #eceef3;
    color: #4b5563;
    cursor: pointer;

    &:hover {
      background: #f5f6f9;
    }
  }
}

.skill-item__remove {
  // position: absolute;
  // right: 16px;
  // bottom: 16px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.add-skill-from-market {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 160px;
  height: 84px;
  border-radius: 16px;
  background: #FFFFFF;
  box-sizing: border-box;
  border: 0.8px dashed #DFE2EA;
  cursor: pointer;

  .add {
    width: 16px;
    height: 16px;
    margin-bottom: 8px;
  }

  .info {
    font-family: PingFang SC;
    font-size: 12px;
    font-weight: normal;
    line-height: 20px;
    text-align: center;
    letter-spacing: 0px;
    color: #2F3547;
  }
}

// 底部操作
.avatar-edit__footer {
  flex: 0 0 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  height: 64px;
  padding: 0 32px;
  border-top: 1px solid #ECEEF3;
  background: #fff;
  z-index: 2;

  .footer-check {
    display: flex;
    align-items: center;

    :deep(.el-checkbox__label) {
      font-family: 苹方;
      font-size: 14px;
      font-weight: normal;
      line-height: 22px;
      display: flex;
      align-items: center;
      letter-spacing: normal;
      color: #606572 !important;
    }

    :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
      background-color: #FF621F;
      border-color: #FF621F;
    }

    :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
      color: #606572 !important;
    }

    .footer-look {
      font-family: PingFang SC;
      font-size: 13px;
      font-weight: normal;
      line-height: 21px;
      text-align: center;
      letter-spacing: 0px;
      color: #FF684E;
      margin-left: 8px;
      cursor: pointer;
      min-width: 60px;
    }
  }

  .footer-btn {
    display: flex;
    gap: 8px;
  }
}

.visually-hidden-file {
  display: none;
}

// 协议确认弹窗
.license-confirm-dialog {
  .license-confirm-content {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.el-checkbox__label) {
      font-family: 苹方;
      font-size: 14px;
      font-weight: normal;
      line-height: 22px;
      display: flex;
      align-items: center;
      letter-spacing: normal;
      color: #606572 !important;
    }

    :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
      background-color: #FF621F;
      border-color: #FF621F;
    }

    :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
      color: #606572 !important;
    }

    .footer-look {
      font-size: 13px;
      color: #FF684E;
      cursor: pointer;
    }
  }

  .license-confirm-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;

    :deep(.el-button--primary) {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 5px 16px;
      gap: 8px;
      border-radius: 6px;
      background: #171B26;
      border-color: #171B26;

      &:hover,
      &:focus {
        background: #171B26;
        border-color: #171B26;
      }
    }
  }
}

// 包内 Skill 列表（只读）
.pkg-skill-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(318px, 1fr));
  gap: 12px;
}

.pkg-skill-empty {
  width: 100%;
  padding: 24px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}

.pkg-skill-item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  // width: 318px;
  border-radius: 16px;
  padding: 16px;
  background: #ffffff;
  box-sizing: border-box;
  border: 1px solid #eceef3;
  transition: all 0.2s ease;

  &:hover {
    border: 1px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);
  }
}

.pkg-skill-item__avatar {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width:36px;
    height:36px;
    object-fit: contain;
  }
}

.pkg-skill-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pkg-skill-item__name {
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: #2F3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pkg-skill-item__desc {
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  color: #91949E;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}


:deep(.el-form-item) {
  margin-bottom: 20px;

  .el-form-item__label {
    font-family: 苹方;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    display: flex;
    align-items: center;
    letter-spacing: normal;
    color: #2F3547;
    width: 93px;
    margin-right: 24px;
    flex-shrink: 0;

    // 把必填 * 号移到 label 文字右边
    &::before {
      display: none;
    }

    &::after {
      content: attr(data-required-asterisk);
    }
  }

  // Element Plus 必填时在 label 后追加 *
  &.is-required .el-form-item__label::after {
    content: ' *';
    color: #ED4543;
    margin-left: 2px;
  }

  .el-form-item__content {
    flex: 1;
    min-width: 0;
  }
}

// 预置开场 Prompt
.prompt-hint {
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  color: #91949E;
  margin: 0 0 16px 0;
}

.prompt-toolbar {
  margin-bottom: 16px;
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
  position: relative;
  overflow: hidden;

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    padding: 0 0 0 16px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &:hover &__actions {
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

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    object-fit: contain;
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

  &__content {
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
</style>

<style lang="scss">
.prompt-edit-dialog {
  .prompt-dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}
.model-cascader-popper{
  --el-color-primary: #FF9566;
}

// 对话模型下拉弹窗样式（全局样式，不使用 scoped）
.model-select-popper {
  max-width: none !important;
  width: auto !important;
}
</style>
