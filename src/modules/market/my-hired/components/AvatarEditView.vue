<template>
  <div class="avatar-edit">
    <Breadcrumb
      :items="[
        { label: '我的聘用', to: '/market/my-hired' },
        { label: detail?.name || '编辑', to: `/market/my-hired/${id}` },
        { label: '编辑' }
      ]"
    />
    <div class="avatar-edit__body">
      <div class="avatar-edit__scroll">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="left"
          class="avatar-edit__form"
        >
        <div class="custom-alert">
          <img src="../assets/warn-icon.svg" class="alert-icon" alt="" />
          <span class="alert-text">更新后，你手动修改的提示词和风格设置将被覆盖，仅保留名称，请确认后进行更新</span>
        </div>
        <!-- 基本信息 -->
        <div class="basic-info">
          <div class="title">
            <div class="belt"></div>基础信息
          </div>
          <div class="basic-info__fields">
            <el-form-item label="数字人图标" prop="avatar" required>
              <div class="avatar-upload__wrap" @click="showAvatarDialog = true">
                <img :src="form.avatar || defaultAvatarIcon" class="avatar-upload__img" alt="头像预览" @error="e => e.target.src = defaultAvatarIcon" />
                <img src="../assets/upload-icon.svg" class="avatar-upload__icon" alt="上传" />
              </div>
            </el-form-item>

            <el-form-item label="包名称" required>
              <el-input v-model="form.packageName" placeholder="请输入包名称" disabled style="width: 60%" />
            </el-form-item>

            <el-form-item label="数字人名称" prop="name" required>
              <el-input v-model="form.name" placeholder="请输入数字人名称" :maxlength="15" show-word-limit style="width: 60%" />
            </el-form-item>

            <el-form-item label="版本号" required>
              <el-input v-model="form.version" placeholder="1.0.0" style="width: 60%" disabled/>
            </el-form-item>

            <el-form-item label="描述" prop="description" required>
              <el-input
                v-model="form.description"
                type="textarea"
                placeholder="请输入数字人的功能描述"
                :rows="3"
                :maxlength="64"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="分类标签">
              <div class="tag-options">
                <span
                  v-for="tag in PRESET_TAGS"
                  :key="tag"
                  class="tag-option"
                  :class="{ active: form.tags.includes(tag) }"
                  @click="toggleTag(tag)"
                >{{ tag }}</span>
              </div>
            </el-form-item>
          </div>
        </div>


        <!-- 关联 Skill -->
        <div class="basic-info">
          <div class="title" style="margin-top: 16px">
            <div class="belt"></div>关联 Skill
          </div>
          <el-form-item label="Skill">
            <div class="skill-section">
              <div class="skill-section__toolbar">
                <div class="add-skill-from-market" @click="skillDialogVisible = true">
                  <div class="add">
                    <img :src="addSkillIcon" />
                  </div>
                  <div class="info">添加Skill</div>
                </div>
              </div>
              <div class="skill-list">
                <div
                  v-for="skill in selectedSkills"
                  :key="skill.slug"
                  class="skill-item"
                >
                  <div class="skill-item__avatar">
                    <img :src="skill.avatar || skill.icon || defaultSkillIcon" alt="" @error="e => e.target.src = defaultSkillIcon" />
                  </div>
                  <div class="skill-item__info">
                    <div class="skill-item_header">
                      <div class="skill-item__name">{{ skill.displayName || skill.slug}}</div>
                      <div class="skill-item__version">{{ skill.version ? `v${skill.version}` : '' }}</div>
                    </div>
                    <div class="skill-item_body">
                      <div class="skill-tags-wrap">
                        <template v-if="skill.tags && skill.tags.length">
                          <el-tag class="tag-item">{{ skill.tags[0] }}</el-tag>
                          <el-tooltip v-if="skill.tags.length > 1" effect="dark" placement="top">
                            <template #content>
                              <div class="tag-tooltip">
                                <span v-for="t in skill.tags.slice(1)" :key="t">{{ t }}</span>
                              </div>
                            </template>
                            <span class="tag-more">+{{ skill.tags.length - 1 }}</span>
                          </el-tooltip>
                        </template>
                        <span v-else class="skill-item__no-tag">&nbsp;</span>
                      </div>
                      <div class="skill-item__remove" @click="removeSkill(skill.slug)">移除</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-form-item>
        </div>
      </el-form>
      </div>

      <!-- 底部操作按钮 -->
      <div class="avatar-edit__footer">
        <div class="footer-btn">
          <el-button class="save-publish-btn" type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </div>
      </div>
    </div>

    <!-- 更新确认弹框 -->
    <UpdateConfirmDialog
      v-model="showConfirmDialog"
      :data="confirmData"
      @confirm="handleConfirmUpdate"
      @cancel="showConfirmDialog = false"
    />

    <!-- 头像上传弹框 -->
    <AvatarUploadDialog
      v-model="showAvatarDialog"
      :current-avatar="form.avatar"
      @confirm="handleAvatarConfirm"
    />

    <!-- Skill 市场弹框 -->
    <SkillMarketDialog
      v-model="skillDialogVisible"
      :selected-ids="dialogSelectedIds"
      @add="handleAddSkillFromMarket"
      @remove="handleRemoveSkillFromMarket"
    />

    <!-- Loading -->
    <Loading :visible="saving" text="保存中..." :fullscreen="false" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElTooltip } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import Breadcrumb from '@/shared/components/Breadcrumb.vue'
import UpdateConfirmDialog from './UpdateConfirmDialog.vue'
import AvatarUploadDialog from './AvatarUploadDialog.vue'
import SkillMarketDialog from '../../my-uploads/components/SkillMarketDialog.vue'
import Loading from '@/shared/components/Loading/index.vue'
import { useMyHiredStore } from '../store'
import { updateManagedAgent, fetchInstalledSkills, removeManagedSkill } from '../myHiredApi'
import addSkillIcon from '@/assets/market/myupload/add.svg'
import defaultSkillIcon from '../../my-uploads/assets/skill/S05@2x.png'
import defaultAvatarIcon from '../assets/ava/m01@2x.png'

const route = useRoute()
const router = useRouter()
const store = useMyHiredStore()

const id = computed(() => route.params.id)
const detail = computed(() => store.getById(id.value))

const formRef = ref(null)
const tagInputRef = ref(null)
const tagInputVisible = ref(false)
const tagInputValue = ref('')

const PRESET_TAGS = [
  '办公',
  '研发',
  '安全',
  '财务',
  '其他',
]
const showConfirmDialog = ref(false)
const confirmData = ref(null)
const showAvatarDialog = ref(false)
const saving = ref(false)
const agreed = ref(false)
const skillDialogVisible = ref(false)
const availableSkills = ref([])
const dialogSelectedIds = ref([])
const originalSkillSlugs = ref([]) // 记录初始加载的 skills

const form = reactive({
  avatar: '',
  packageName: '',
  name: '',
  version: '',
  description: '',
  tags: [],
  relatedSkillSlugs: [],
  changelog: '',
})

const rules = {
  avatar: [{ required: true, message: '请上传数字人图标', trigger: 'change' }],
  name: [{ required: true, message: '请输入数字人名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入描述', trigger: 'blur' }],
}

const selectedSkills = computed(() =>
  availableSkills.value.filter(s => form.relatedSkillSlugs.includes(s.slug))
)

function initFormData() {
  if (detail.value) {
    form.avatar = detail.value.avatar || ''
    form.packageName = detail.value.id || ''
    form.name = detail.value.name || ''
    form.version = detail.value.version || ''
    form.description = detail.value.description || ''
    form.tags = [...(detail.value.tags || [])]

    // 初始化 relatedSkillSlugs 和 availableSkills
    const skills = detail.value.skills || []
    form.relatedSkillSlugs = skills.map(s => s.slug).filter(Boolean)
    availableSkills.value = skills
    dialogSelectedIds.value = skills.map(s => s.id).filter(Boolean)
    // 记录初始的 skills
    originalSkillSlugs.value = [...form.relatedSkillSlugs]
  }
}

function toggleTag(tag) {
  const idx = form.tags.indexOf(tag)
  if (idx > -1) {
    form.tags.splice(idx, 1)
  } else {
    form.tags.push(tag)
  }
}

async function removeSkill(slug) {
  try {
    // 找到对应的 skill 对象
    const skill = availableSkills.value.find(s => (s.slug || s.name) === slug)
    if (!skill) {
      ElMessage.error('未找到该 Skill')
      return
    }

    // 调用删除接口
    await removeManagedSkill(skill.slug, id.value)
    ElMessage.success('Skill 移除成功')

    // 从本地数组中移除
    const idx = form.relatedSkillSlugs.indexOf(slug)
    if (idx > -1) form.relatedSkillSlugs.splice(idx, 1)

    // 重新加载 skills 列表
    const skills = await fetchInstalledSkills(id.value)
    availableSkills.value = skills
    form.relatedSkillSlugs = skills.map(s => s.slug).filter(Boolean)
    dialogSelectedIds.value = skills.map(s => s.id).filter(Boolean)
  } catch (e) {
    console.error('移除 skill 失败:', e)
    ElMessage.error('Skill 移除失败，请重试')
  }
}

function handleAddSkillFromMarket(skill) {
  const slug = skill.slug || skill.id
  if (!form.relatedSkillSlugs.includes(slug)) {
    form.relatedSkillSlugs.push(slug)
  }
  if (!availableSkills.value.find(s => s.slug === slug)) {
    availableSkills.value.push(skill)
  }
}

/** 弹窗内「移除添加」仅更新本地表单，不调卸载接口；卸载用列表项「移除」 */
function handleRemoveSkillFromMarket(skill) {
  const slug = skill.slug || skill.id
  const idx = form.relatedSkillSlugs.indexOf(slug)
  if (idx > -1) form.relatedSkillSlugs.splice(idx, 1)
  const ai = availableSkills.value.findIndex(
    (s) => s.slug === skill.slug || String(s.id) === String(skill.id),
  )
  if (ai > -1) availableSkills.value.splice(ai, 1)
  const rid = skill.id
  if (rid != null && rid !== '') {
    dialogSelectedIds.value = dialogSelectedIds.value.filter(
      (id) => id !== rid && String(id) !== String(rid),
    )
  }
}

function handleAvatarConfirm(avatarData) {
  form.avatar = avatarData
}

function handleCancel() {
  router.back()
}

async function handleSave() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  confirmData.value = {
    avatar: form.avatar,
    name: form.name,
    source: detail.value?.source,
    fromAgentName: detail.value?.fromAgentName,
    fromAgentSlug: detail.value?.fromAgentSlug,
    type: detail.value?.type,
    isBuiltin: detail.value?.isBuiltin
  }
  showConfirmDialog.value = true
}

async function handleConfirmUpdate() {
  saving.value = true
  try {
    // 只传递新增的 skills（在 form.relatedSkillSlugs 中但不在 originalSkillSlugs 中的）
    const newSkills = form.relatedSkillSlugs.filter(
      slug => !originalSkillSlugs.value.includes(slug)
    )

    await updateManagedAgent(id.value, {
      displayName: form.name,
      summary: form.description,
      tags: form.tags,
      avatar: form.avatar,
      changelog: form.changelog,
      skills: form.relatedSkillSlugs,
    })
    ElMessage.success('保存成功')
    showConfirmDialog.value = false
    // 刷新列表数据
    await store.loadList(true)
    router.back()
  } catch (e) {
    ElMessage.error('保存失败，请重试')
    console.error('更新失败:', e)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!store.list.length) await store.loadList()
  initFormData()
  // 获取最新 skill 数据
  if (id.value) {
    const skills = await fetchInstalledSkills(id.value)
    availableSkills.value = skills
    form.relatedSkillSlugs = skills.map(s => s.slug).filter(Boolean)
    dialogSelectedIds.value = skills.map(s => s.id).filter(Boolean)
    // 记录初始的 skills
    originalSkillSlugs.value = [...form.relatedSkillSlugs]
  }
})
</script>

<style lang="scss" scoped>
.avatar-edit {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.avatar-edit__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(0deg, #fff, #fff), linear-gradient(180deg, #f9fafa 0%, #fff 25%);
}

.avatar-edit__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.avatar-edit__form {
  width: 100%;
  padding: 24px 32px 16px;
}

.title {
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  display: flex;
  align-items: center;
  color: #2f3547;
  margin-bottom: 24px;

  .belt {
    background: #ff684e;
    margin-top: 2px;
    width: 3px;
    height: 14px;
    border-radius: 0 4px 4px 0;
    margin-right: 8px;
  }
}

.basic-info {
  margin-bottom: 24px;
  padding-bottom: 24px;
}

.basic-info__avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.basic-info__fields {
  flex: 1;
  min-width: 0;
}

.avatar-upload__wrap {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover .avatar-upload__icon {
    opacity: 0.6;
    background: #FFFFFF;
  }
}

.avatar-upload__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-upload__placeholder {
  color: #909399;
  height: 34px;
}

.avatar-upload__icon {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  border-radius: 8px;
  
}

.tag-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-option {
  font-size: 14px;
  color: #2f3547;
  cursor: pointer;
  padding: 2px 12px;
  border-radius: 6px;
  background: #f7f8fa;
  transition: color 0.2s, background 0.2s;
  user-select: none;

  &:hover {
    color: #ff684e;
    background: #ffeeeb;
  }

  &.active {
    color: #ff684e;
    background: #ffeeeb;
  }
}

.tag-item {
  border-radius: 4px;
  background: #f2f3f5;
  border-color: transparent;
  color: #646a73;
  height: 24px;
  line-height: 20px;
}

.tag-input {
  width: 120px;
}

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
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.skill-item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  border-radius: 12px;
  padding: 16px;
  background: rgba(247, 248, 250, 0.8);
  box-sizing: border-box;
  cursor: pointer;
  border: 1px solid rgba(247, 248, 250, 0.8);
  width: 100%;
  min-width: 0;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #ECEEF3;
    background: #FFFFFF;
  }

  &:hover .skill-item__remove {
    opacity: 1;
  }
}

.skill-item__avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: flex-start;
  align-self: flex-start;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.skill-item__info {
  flex: 1;
  min-width: 0;

  .skill-item_header {
    display: flex;
    align-items: end;
  }

  .skill-item_body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
  }
}

.skill-tags-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.tag-more {
  padding: 0 8px;
  background: #f2f3f5;
  border-radius: 4px;
  font-size: 12px;
  color: #646a73;
  cursor: pointer;
  white-space: nowrap;
  height: 24px;
  line-height: 24px;
  display: inline-flex;
  align-items: center;

  &:hover {
    color: #436ff6;
  }
}

.tag-tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-item__name {
  font-size: 16px;
  font-weight: 500;
  color: #2f3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
  line-height: 24px;
}

.skill-item__version {
  font-size: 12px;
  color: #91949E;
  line-height: 20px;
}

.skill-item__remove {
  height: 24px;
  padding: 0 12px;
  border: 1px solid #ECEEF3;
  border-radius: 6px;
  background: #fff;
  color: #2F3547;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;
  display: inline-flex;
  align-items: center;

  &:hover {
    background: #F5F6F9;
    border-color: #DFE2EA;
  }
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

.avatar-edit__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  border-top: 1px solid #eceef3;
  height: 64px;
  padding-right: 20px;

  .footer-btn {
    display: flex;
    gap: 8px;
  }
}

.save-publish-btn {
  height: 32px;
  border-radius: 6px;
  background: #171b26;
  border-color: #171b26;

  &:hover {
    background: #2e323c;
    border-color: #2e323c;
  }
}

:deep(.el-form-item) {
  margin-bottom: 20px;

  .el-form-item__label {
    font-size: 14px;
    color: #606572;
    width: 100px;
    flex-shrink: 0;
  }
}

:deep(.el-button:not(.el-button--primary):not(.el-button--danger):not(.el-button--text)) {
  color: #2f3547;

  &:hover {
    background: #f5f6f9;
    border-color: #dcdfe6;
    color: #2f3547;
  }
}
.custom-alert {
  display: flex;
  align-items: center;
  padding: 9px 16px;
  gap: 8px;
  border-radius: 12px;
  background: rgba(255, 104, 78, 0.08);
  box-sizing: border-box;
  border: 1px solid #FFBAAD;
  margin-bottom: 24px;
}

.alert-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.alert-text {
  font-family: 苹方-简;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  letter-spacing: normal;
  /* 文本色&图标色/--color-text-primary */
  /* 样式描述：一级文本色 */
  color: #2F3547;
}
</style>
