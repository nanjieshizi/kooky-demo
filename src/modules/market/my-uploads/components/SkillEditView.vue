<template>
  <div class="skill-edit">
    <Loading :visible="saving || publishing" :text="publishing ? '发布中...' : '保存中...'" :overlay="true" />
    <!-- 嵌入模式下面包屑由父组件（SkillUploadView）管理，不重复渲染 -->
    <Breadcrumb :items="breadcrumbItems" />
    <div class="skill-edit__body">
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-position="left"
        class="skill-edit__form"
        @submit.prevent
      >
        <!-- 基本信息 -->
        <div class="basic-info">
          <div class="title">
            <div class="belt"></div>基础信息
          </div>
          <div class="basic-info__fields">
            <el-form-item label="Skill 图标" required>
              <div class="basic-info__avatar">
                <div class="avatar-upload__preview" @click="avatarDialogVisible = true">
                  <img class="avatar" :src="avatarPreview || defaultSkillIcon" alt="图标预览" />
                  <div class="avatar-upload__overlay">
                    <img :src="switchIconUrl" class="upload-avatar-icon" />
                  </div>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="Skill ID" prop="name" class="skill-id-form-item">
              <template #label>
                <span>Skill ID</span>
                <span class="required-asterisk"> *</span>
                <el-tooltip
                  content="修改 ID 可能导致引用该 ID 的 Skill 文件失效，请自行检查并同步更新。"
                  placement="top"
                >
                  <img
                    :src="versionHintInfoIcon"
                    class="skill-id-hint-icon"
                    width="14"
                    height="14"
                    alt=""
                  />
                </el-tooltip>
              </template>
              <el-input
                v-model="form.name"
                placeholder="仅支持英文、数字及中划线「-」"
                :disabled="isSkillIdDisabled"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="Skill 名称" prop="displayName" required>
              <el-input
                v-model="form.displayName"
                placeholder="请输入 Skill 名称"
                :maxlength="64"
                show-word-limit
              />
            </el-form-item>
            <el-form-item
              class="version-form-item"
              label="版本号"
              prop="version"
              required
            >
              <div class="version-field">
                <el-input
                  v-model="form.version"
                  placeholder="1.0.0"
                  :disabled="isVersionEditMode"
                  :class="{ 'is-error': versionConflictMsg }"
                  @input="handleVersionInput"
                >
                  <!-- <template v-if="!isVersionEditMode" #suffix>
                    <el-tooltip content="点击智能生成版本号" placement="top">
                      <img
                        :src="smartGenIcon"
                        class="smart-gen-icon"
                        alt=""
                        @click.stop="handleSmartGenVersion"
                      />
                    </el-tooltip>
                  </template> -->
                </el-input>
                <!-- <div v-if="versionConflictMsg" class="version-error">{{ versionConflictMsg }}</div> -->
                <div v-if="!versionConflictMsg && !isVersionEditMode" class="version-hint">
                  <span>
                    格式要求：主版本.次版本.修订版本
                    <template v-if="latestVersion">，当前版本 v{{ latestVersion }}</template>
                  </span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="描述" prop="description" required>
              <el-input
                v-model="form.description"
                type="textarea"
                placeholder="请输入 Skill 的功能描述"
                :rows="3"
                :maxlength="1024"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="分类标签">
              <BuiltinCategoryTagPicker v-model="form.tags" />
            </el-form-item>
            <el-form-item label="文件">
                    <!-- 文件预览 -->
      <div class="basic-info file-preview-section">
        <!-- <div class="title">
          <div class="belt"></div>文件预览
        </div> -->
        <div class="file-browser-wrap">
          <!-- 版本编辑模式：通过 slug + version 调 API -->
          <SkillFileBrowser
            v-if="isVersionEditMode && editSlug"
            :slug="editSlug"
            :version="editVersionFixed || undefined"
          />
          <!-- 嵌入模式（上传新版本 / 首次创建）：传入 zip 文件，组件内部解析 -->
          <SkillFileBrowser
            v-else-if="isEmbedded && props.uploadedFile"
            :zip-file="props.uploadedFile"
          />
          <div v-else class="file-browser-placeholder">
            <p>上传文件后可预览内容</p>
          </div>
        </div>
      </div>
            </el-form-item>
          </div>
        </div>

        <!-- 更新日志 -->
        <div class="basic-info">
          <div class="title">
            <div class="belt"></div>更新日志
          </div>
          <el-form-item label="描述" prop="changelog">
            <el-input
              v-model="form.changelog"
              type="textarea"
              placeholder="请输入本次更新的内容"
              :rows="4"
              :maxlength="1024"
              show-word-limit
            />
          </el-form-item>
        </div>
      </el-form>



      <!-- 头像上传弹窗 -->
      <AvatarUploadDialog
        v-model="avatarDialogVisible"
        :current-avatar="currentAvatarForDialog"
        @confirm="handleAvatarConfirm"
      />

      <!-- 协议详情弹窗 -->
      <LicenseDialog v-model="licenseDialogVisible" />

      <!-- 协议确认发布弹窗 -->
      <el-dialog
        v-model="licenseConfirmVisible"
        title="请先勾选确认协议后再进行发布"
        width="480px"
        append-to-body
        :show-close="false"
        class="license-confirm-dialog"
      >
        <div class="license-confirm-content">
          <el-checkbox v-model="licenseAgreed">我拥有此 Skill 的权利，并同意在 MIT-0 协议下发布。</el-checkbox>
        </div>
        <template #footer>
          <div class="license-confirm-footer">
            <MarketCustomButton
              :disabled="saving"
              @click="licenseConfirmVisible = false"
            >取消</MarketCustomButton>
            <MarketCustomButton 
              variant="dark"
              :disabled="!licenseAgreed" @click="confirmAndPublish"
            >确认并发布</MarketCustomButton>
          
          
          </div>
        </template>
      </el-dialog>
    </div>

    <!-- 底部操作区：与主体分列，随编辑区贴底，高度 64px（设计稿） -->
    <div class="skill-edit__footer">
      <div class="footer-check">
        <el-checkbox v-model="licenseAgreed">我拥有此 Skill 的权利,并同意在 MIT-0 协议下发布。</el-checkbox>
        <div class="footer-look" @click="openLicense">查看详情</div>
      </div>
      <div class="footer-btn">
        <MarketCustomButton
          @click="router.back()"
        >取消</MarketCustomButton>
        <MarketCustomButton
          :disabled="saving"
          @click="handleSave"
        >保存</MarketCustomButton>
         <MarketCustomButton 
          variant="dark"
          :disabled="publishing"
          @click="handleSaveAndPublish"
        >保存并发布</MarketCustomButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import Breadcrumb from '@/shared/components/Breadcrumb.vue'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import AvatarUploadDialog from './AvatarUploadDialog.vue'
import BuiltinCategoryTagPicker from './BuiltinCategoryTagPicker.vue'
import LicenseDialog from './LicenseDialog.vue'
import SkillFileBrowser from '../../components/SkillFileBrowser.vue'
import { sanitizeTagsToBuiltin } from '../constants/builtinCategoryTags'
import { createSkill, createSkillMultipart, updateSkill, updateSkillMultipart, fetchSkillById, fetchSkillIcons } from '../services/myUploadsApi'
import { fetchSkillMarketDetail } from '@/modules/market/skill/skillMarketApi.js'
import type { SkillCreateData, SkillUpdateData } from '../types'
import {
  generateVersion,
  isVersionConflict,
  isVersionTooLow,
  pickRandomVersionWithinFivePatchSteps,
  type UpdateType,
} from '../utils/versionUtils'

import versionHintInfoIcon from '../assets/version-hint-info.svg?url' 
import switchIconUrl from '@/assets/market/switch.svg'
import smartGenIcon from '@/assets/market/myupload/zhinengshencheng.svg'

// ---- 嵌入模式 props ----
const props = withDefaults(defineProps<{
  /** 嵌入模式：SkillUploadView 传入的原始上传文件，保存时通过 multipart 提交 */
  uploadedFile?: File | null
  /** 嵌入模式：validate 接口解析出的表单初始数据 */
  uploadQueryData?: Record<string, string>
}>(), {
  uploadedFile: null,
  uploadQueryData: () => ({}),
})

const emit = defineEmits<{
  /** 保存/发布成功，通知父组件跳转 */
  (e: 'save-success'): void
  /** 返回上传页 */
  (e: 'back'): void
}>()

// 是否为嵌入模式（由 SkillUploadView 嵌套，不走独立路由）
const isEmbedded = computed(() => !!props.uploadedFile)

const route = useRoute()
const router = useRouter()

const mode = computed(() => {
  // 嵌入模式始终是创建模式
  if (isEmbedded.value) return 'create'
  return route.name === 'SkillCreate' || route.params.id === 'new' ? 'create' : 'edit'
})

/** 版本编辑模式：从 SkillDetailView 点击编辑图标跳转，携带 editSlug + editVersionId */
const isVersionEditMode = computed(() =>
  !isEmbedded.value && !!route.query.editSlug,
)
const editSlug = computed(() => String(route.query.editSlug ?? '').trim())
const editVersionId = computed(() => String(route.query.editVersionId ?? '').trim())
const editVersionFixed = computed(() => String(route.query.editVersion ?? '').trim())

const skillId = computed(() => route.params.id)

const breadcrumbItems = computed(() => {
  if (isVersionEditMode.value) {
    return [
      { label: '我的上传', to: '/market/skill' },
      { label: `Skill 编辑` },
    ]
  }
  if (mode.value === 'create') {
    return [
      { label: '上传 Skill', to: '/market/skill' },
      { label: '编辑' },
    ]
  }
  return [
    { label: 'Skill 市场', to: '/market/skill' },
    { label: 'Skill 详情', to: `/market/my-uploads/skill/${skillId.value}` },
    { label: `${form.name} 编辑` },
  ]
})

const form = reactive({
  displayName: '',
  name: '',
  version: '1.0.0',
  tags: [] as string[],
  description: '',
  avatarUrl: '',
  changelog: '',
})

const avatarInputRef = ref(null)
const avatarPreview = ref('')
const defaultSkillIcon = ref('')
/** 与表单项「图标预览」一致：无自定义图时传入默认图标，弹窗内才能同步显示 */
const currentAvatarForDialog = computed(
  () => (avatarPreview.value || defaultSkillIcon.value) as string,
)
const avatarDialogVisible = ref(false)
const licenseDialogVisible = ref(false)
const licenseAgreed = ref(false)
const licenseConfirmVisible = ref(false)
const saving = ref(false)
const publishing = ref(false)

// 本地 zip 解析结果，用于嵌入模式文件预览
// edit 模式下从接口加载到的 slug，用于 updateSkill / setSkillVisibility
const skillSlug = ref('')
const updateType = ref<UpdateType>('patch')

// 版本智能生成
const existingVersions = ref<{ version: string }[]>([])
const versionConflictMsg = ref('')
const latestVersion = computed(() => {
  if (!existingVersions.value.length) return ''
  return [...existingVersions.value].sort((a, b) => {
    const pa = a.version.split('.').map(Number)
    const pb = b.version.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0)
    }
    return 0
  })[0].version
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
    versionConflictMsg.value = `版本号不得低于已有版本（${latestVersion.value}）`
  } else {
    versionConflictMsg.value = ''
  }
  formRef.value?.validateField('version')
}

const formRef = ref<FormInstance>()

/** 与表单项 maxlength / 包名安全长度一致 */
const FORM_LEN = {
  displayName: 64,
  /** 包名 slug，表单项无 maxlength 时与接口习惯对齐 */
  packageName: 64,
  description: 1024,
  version: 32,
  changelog: 1024,
} as const

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入 Skill ID', trigger: 'change' },
    { max: FORM_LEN.packageName, message: `Skill ID 不能超过 ${FORM_LEN.packageName} 个字符`, trigger: 'change' },
    {
      pattern: /^[a-zA-Z0-9-]+$/,
      message: 'Skill ID 仅支持英文、数字及中划线「-」',
      trigger: 'change',
    },
  ],
  displayName: [
    { required: true, message: '请输入 Skill 名称', trigger: ['blur', 'change'] },
    {
      validator: (_r, v, cb) => {
        const t = String(v ?? '').trim()
        if (!t) {
          cb(new Error('请输入 Skill 名称'))
          return
        }
        if (t.length > FORM_LEN.displayName) {
          cb(new Error(`Skill 名称不能超过 ${FORM_LEN.displayName} 个字符`))
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
    { required: true, message: '请输入 Skill 描述', trigger: ['blur', 'change'] },
    {
      validator: (_r, v, cb) => {
        const t = String(v ?? '').trim()
        if (!t) {
          cb(new Error('请输入 Skill 描述'))
          return
        }
        if (t.length > FORM_LEN.description) {
          cb(new Error(`Skill 描述不能超过 ${FORM_LEN.description} 个字符`))
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
}

// triggerAvatarUpload 和 handleAvatarChange 已被 AvatarUploadDialog 替代，保留但不再使用
function triggerAvatarUpload() {
  avatarInputRef.value?.click?.()
}

async function handleAvatarChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
    ElMessage.warning('仅支持 JPG、JPEG、PNG 格式')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片最大不能超过 5MB')
    return
  }

  avatarPreview.value = URL.createObjectURL(file)
  form.avatarUrl = URL.createObjectURL(file)
  input.value = ''
}

function handleAvatarConfirm(url: string) {
  avatarPreview.value = url
  form.avatarUrl = url
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const r = reader.result
      if (typeof r === 'string') resolve(r)
      else reject(new Error('readAsDataURL failed'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 提交创建/升级时的封面图：
 * - 已是 data URL 则直接返回；
 * - blob: URL（本地上传）先 fetch 再转为 base64；
 * - http(s): URL（后端返回）直接使用，无需转换。
 */
async function resolveSkillCoverImage(): Promise<string> {
  const raw = form.avatarUrl?.trim()
  if (!raw) return defaultSkillIcon.value as string
  if (raw.startsWith('data:')) return raw
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw

  // blob: URL —— 本地选择的文件，转为 base64
  try {
    const res = await fetch(raw)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    return await blobToDataUrl(blob)
  } catch (e) {
    console.error('Skill 封面转为 base64 失败:', e)
    ElMessage.warning('封面图片未能转为 base64，将使用原地址提交')
    return raw
  }
}

/**
 * 后端架构调整：上传和校验已融合到 validate 接口
 * 保存时不再需要 ossUrl 和 fileMd5
 */

// 保存逻辑（create 或 update），返回 slug
async function doSave(scope: 'private' | 'market' = 'private', publish: boolean = false): Promise<string> {
  // 版本编辑模式：PUT multipart
  if (isVersionEditMode.value) {
    const slug = editSlug.value
    if (!slug) throw new Error('缺少 Skill 标识')
    const payload = {
      slug,
      displayName: form.displayName,
      description: form.description,
      version: form.version,
      official: false,
      changelog: form.changelog || null,
      tags: form.tags,
      acceptLicenseTerms: true,
      image: await resolveSkillCoverImage(),
      scope: 'market',
      publish,
    }
    await updateSkillMultipart(slug, payload)
    return slug
  }

  // 嵌入模式：使用 multipart 接口将原始文件一起提交
  if (isEmbedded.value && props.uploadedFile) {
    const skillId = uploadQuery.value.skillId
    await createSkillMultipart(props.uploadedFile, {
      slug: form.name,
      displayName: form.displayName,
      description: form.description,
      version: form.version,
      official: false,
      changelog: form.changelog || null,
      tags: form.tags,
      acceptLicenseTerms: true,
      avatar: await resolveSkillCoverImage(),
      scope: 'market',
      publish,
      ...(skillId ? { skillId } : {}),
    })
    return form.name
  }

  if (mode.value === 'create') {
    const skillId = uploadQuery.value.skillId
    const data: SkillCreateData = {
      slug: form.name,
      displayName: form.displayName,
      description: form.description,
      version: form.version,
      official: false,
      changelog: form.changelog,
      tags: form.tags,
      acceptLicenseTerms: true,
      image: await resolveSkillCoverImage(),
      scope: 'market',
      publish,
      ...(skillId ? { skillId } : {}),
    }
    await createSkill(data)
    return form.name
  } else {
    // 升级场景：用 createSkill 创建新版本（不走 updateSkill）
    if (hasUploadData.value) {
      const existingSlug = (route.query.existingSlug as string) || skillSlug.value
      const data: SkillCreateData = {
        slug: existingSlug,
        displayName: form.displayName,
        description: form.description,
        version: form.version,
        official: false,
        changelog: form.changelog,
        tags: form.tags,
        acceptLicenseTerms: true,
        image: await resolveSkillCoverImage(),
        scope: 'market', // 保存和保存并发布都传 market
        publish, // 保存并发布时传 true，保存时传 false
      }
      await createSkill(data)
      return existingSlug
    }
    const data: SkillUpdateData = {
      displayName: form.displayName,
      summary: form.description,
      tags: form.tags,
      scope: 'market', // 保存和保存并发布都传 market
      publish, // 保存并发布时传 true，保存时传 false
    }
    await updateSkill(skillSlug.value, data)
    return skillSlug.value
  }
}

async function handleSave() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    await doSave('market', false)
    ElMessage.success(mode.value === 'create' ? '创建成功' : '保存成功')
    if (isEmbedded.value) {
      emit('save-success')
    } else if (isVersionEditMode.value || mode.value === 'edit') {
      router.back()
    } else {
      router.push('/market/skill')
    }
  } catch (e: any) {
    console.error('保存失败:', e)
    // 优先从 detail 字段获取错误消息，兼容 message/msg/error 字段
    const responseData = e?.response?.data
    const errMsg = responseData?.detail || responseData?.message || responseData?.msg || responseData?.error || '保存失败,请稍后重试'
    ElMessage.error(errMsg)
  } finally {
    saving.value = false
  }
}

async function executePublish() {
  publishing.value = true
  try {
    await doSave('market', true)
    ElMessage.success('保存并发布成功')
    if (isEmbedded.value) {
      emit('save-success')
    } else if (isVersionEditMode.value || mode.value === 'edit') {
      router.back()
    } else {
      router.push('/market/skill')
    }
  } catch (e: any) {
    console.error('保存并发布失败:', e)
    // 优先从 detail 字段获取错误消息，兼容 message/msg/error 字段
    const responseData = e?.response?.data
    const errMsg = responseData?.detail || responseData?.message || responseData?.msg || responseData?.error || '保存并发布失败,请稍后重试'
    ElMessage.error(errMsg)
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

// 与上传流程相关的字段（create / 编辑页带新包升级）
// 嵌入模式：从 props 读取；路由模式：从 route.query 读取
const uploadQuery = computed(() => {
  if (isEmbedded.value) {
    return props.uploadQueryData || {}
  }
  return route.query
})

// 是否有来自 validate 的新包数据（升级场景）
const hasUploadData = computed(() => {
  return !!(uploadQuery.value.displayName && uploadQuery.value.packageName)
})

// Skill ID 是否应该禁用：只有首次创建时可编辑，其他情况（编辑、版本编辑、上传新版本）都置灰
const isSkillIdDisabled = computed(() => {
  // 版本编辑模式：置灰
  if (isVersionEditMode.value) return true
  // 编辑模式：置灰
  if (mode.value === 'edit') return true
  // 创建模式但有 skillId（上传新版本）：置灰
  if (mode.value === 'create' && uploadQuery.value.skillId) return true
  // 首次创建：可编辑
  return false
})

async function loadEditData() {
  // 版本编辑模式：从 SkillDetailView 点击编辑图标跳转
  if (isVersionEditMode.value) {
    const slug = editSlug.value
    if (!slug) return
    try {
      const res: any = await fetchSkillMarketDetail(slug, {
        version: editVersionFixed.value || undefined,
        marketplace: false,
      })
      const entity = res?.entity ?? res?.data?.entity ?? res
      skillSlug.value = slug
      form.name = slug
      form.displayName = String(entity?.displayName ?? '').trim()
      form.description = String(entity?.description ?? entity?.summary ?? '').trim()
      form.version = editVersionFixed.value || String(entity?.version ?? '1.0.0').trim()
      form.tags = sanitizeTagsToBuiltin(entity?.tags)
      form.changelog = String(entity?.changelog ?? '').trim()
      form.avatarUrl = entity?.avatar_url ?? entity?.image ?? entity?.avatar ?? ''
      defaultSkillIcon.value = form.avatarUrl
      if (form.avatarUrl) avatarPreview.value = form.avatarUrl
      existingVersions.value = entity?.versionHistory || []
    } catch (e) {
      console.error('加载版本数据失败:', e)
      ElMessage.error('加载版本数据失败')
    }
    return
  }

  if (mode.value === 'create') {
    // 创建模式：从 query 参数初始化数据
    existingVersions.value = []
    // 优先使用 slug 参数（从详情页跳转时携带），否则使用 packageName
    form.name = (uploadQuery.value.slug as string) || (uploadQuery.value.packageName as string) || ''
    form.displayName = uploadQuery.value.displayName as string || ''
    form.description = uploadQuery.value.description as string || ''
    form.version = uploadQuery.value.version as string || '1.0.0'
    form.tags = sanitizeTagsToBuiltin(uploadQuery.value.tags)

    // 从详情页「上传新版本」跳转时，调用详情接口回填图标、标签默认值，并加载历史版本用于冲突校验
    const prevSlug = (uploadQuery.value.slug as string) || ''
    const prevVersion = (uploadQuery.value.prevVersion as string) || ''
    if (prevSlug) {
      try {
        const res: any = await fetchSkillMarketDetail(prevSlug, {
          ...(prevVersion ? { version: prevVersion } : {}),
          marketplace: false,
        })
        const entity = res?.entity ?? res?.data?.entity ?? res
        // 图标
        const avatarUrl = entity?.avatar_url ?? entity?.image ?? entity?.avatar ?? ''
        if (avatarUrl) {
          form.avatarUrl = avatarUrl
          defaultSkillIcon.value = avatarUrl
          avatarPreview.value = avatarUrl
        }
        // 分类标签：仅当 validate-package 未提供时才回填
        if (!form.tags?.length) {
          form.tags = sanitizeTagsToBuiltin(entity?.tags)
        }
        // 历史版本列表，用于版本号冲突校验（skill 版本号格式为 "1.7.0"，无 v 前缀）
        if (Array.isArray(entity?.versionHistory)) {
          existingVersions.value = entity.versionHistory
          // 历史版本加载完成后，对预填版本号主动触发一次冲突校验
          handleVersionInput()
        }
      } catch (e) {
        console.error('加载历史版本默认值失败:', e)
      }
    }
    return
  }

  // 编辑模式（含升级场景）
  if (!skillId.value || skillId.value === 'new') {
    existingVersions.value = []
    form.version = '1.0.0'
    return
  }

  try {
    const res = await fetchSkillById(Number(skillId.value))
    const skill = (res as any).entity ?? res

    skillSlug.value = skill.slug || skill.name

    // 升级场景：优先用 query 中新包 validate 的数据，其余用已有数据兜底
    if (hasUploadData.value) {
      // 优先使用 slug 参数（从详情页跳转时携带），否则使用 packageName 或已有数据
      form.name = (uploadQuery.value.slug as string) || (uploadQuery.value.packageName as string) || skill.name || skill.slug
      form.displayName = uploadQuery.value.displayName as string || skill.displayName
      form.description = uploadQuery.value.description as string || skill.description
      form.version = uploadQuery.value.version as string || generateVersion(skill.versionHistory || [], updateType.value)
      form.tags = sanitizeTagsToBuiltin(skill.tags)
    } else {
      form.displayName = skill.displayName
      form.name = skill.name || skill.slug
      form.tags = sanitizeTagsToBuiltin(skill.tags)
      form.description = skill.description
      form.version = generateVersion(skill.versionHistory || [], updateType.value)
    }

    form.avatarUrl = skill.avatar_url ?? skill.image ?? ''
    defaultSkillIcon.value = form.avatarUrl
    if (form.avatarUrl) {
      avatarPreview.value = form.avatarUrl
    }
    existingVersions.value = skill.versionHistory || []
  } catch (e) {
    console.error('加载数据失败:', e)
    ElMessage.error('加载数据失败')
  }
}

async function loadDefaultSkillIcon() {
  if (mode.value !== 'create') return
  try {
    const icons = await fetchSkillIcons()
    defaultSkillIcon.value = icons.length > 2 ? icons[2] : (icons[0] ?? '')
  } catch (e) {
    console.error('加载 Skill 默认图标失败:', e)
  }
}

onMounted(() => {
  loadEditData()
  loadDefaultSkillIcon()
})
</script>

<style lang="scss" scoped>
.el-input{
  --accent: #FF9566;
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

.skill-edit {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.skill-edit__body {
  flex: 1;
  min-height: 0;
  padding: 24px 32px;
  overflow-y: auto;
  background: linear-gradient(0deg, #FFFFFF, #FFFFFF), linear-gradient(180deg, #F9FAFA 0%, #FFFFFF 25%);
}

.skill-edit__form {
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

.basic-info__fields {
  flex: 1;
  min-width: 0;
}

/* 与 rules 校验错误（或 versionConflict 通过 validator 报红）同时出现时，不展示「格式要求」说明 */
:deep(.version-form-item.is-error) {
  .version-hint {
    display: none;
  }
  .el-form-item__error {
    // display: none;
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
    animation: skill-version-hint-appear 0.45s ease-out both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }

  .version-error {
    font-size: 12px;
    color: #ED4543;
    line-height: 18px;
  }
}

@keyframes skill-version-hint-appear {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

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
    width: 60px;
    height: 60px;
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

.skill-edit__footer {
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

  }
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
    width: 82px;
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

// Skill ID 字段特殊处理：有自定义 label，不显示自动添加的 *
:deep(.skill-id-form-item) {
  .el-form-item__label {
    width: auto;
    min-width: 82px;
    white-space: nowrap;

    // 不显示自动添加的 * 号
    &::after {
      content: none !important;
    }
  }
}

// Skill ID 提示图标样式
.skill-id-hint-icon {
  display: inline-block;
  margin-left: 4px;
  cursor: pointer;
  vertical-align: middle;
}

// 必填 * 号样式
.required-asterisk {
  color: #ED4543;
  margin-left: 2px;
}

.file-preview-section {
  margin-top: 8px;
  max-width: 840px;
  width: -webkit-fill-available;
}

.file-browser-wrap {
  // label(93px) + margin(24px) + content(max 588px) 与表单内容区对齐
  max-width: 840px;
  // width: 100%;
  height: 420px;
  min-height: 0;
}

.file-browser-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ECEEF3;
  border-radius: 8px;
  color: #91949E;
  font-size: 13px;
}
</style>
