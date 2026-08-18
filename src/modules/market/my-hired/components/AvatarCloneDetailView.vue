<template>
  <div class="clone-detail">
    <Breadcrumb
      :items="[
        { label: '我的聘用', to: '/market/my-hired' },
        { label: detail.name }
      ]"
    />
    <div class="detail-body">
      <!-- 头部 -->
      <div class="detail-header">
        <div class="header-left">
          <div class="avatar-wrap">
            <img :src="detail.avatar || defaultAvatarIcon" class="avatar-img" alt="" @error="e => e.target.src = defaultAvatarIcon" />
          </div>
          <div class="header-info">
            <h1 class="header-title">{{ detail.name }}</h1>
            <p class="header-subtitle">{{ detail.subtitle }}</p>
          </div>
        </div>
        <button class="btn-add-skill" @click="handleAddSkill">添加skill</button>
      </div>

      <!-- 基本信息 -->
      <section class="section">
        <h2 class="section-title">基本信息</h2>
        <h2 class="section-title-child">描述</h2>
        <p class="description-block">{{ detail.description }}</p>
      </section>

      <!-- 已添加 skill -->
      <section class="section">
        <h2 class="section-title">已添加skill</h2>
        <div v-if="skills.length" class="skill-grid">
          <div
            v-for="skill in skills"
            :key="skill.slug"
            class="skill-card"
            @mouseenter="hoveredSkill = skill.slug"
            @mouseleave="hoveredSkill = null"
          >
            <div class="skill-top-row">
              <div class="skill-icon-wrap">
                <img :src="skill.image || defaultSkillIcon" class="skill-icon" alt="" @error="e => e.target.src = defaultSkillIcon" />
              </div>
              <div class="skill-info">
                <div class="skill-header">
                  <span class="skill-title">{{ skill.displayName || skill.name }}</span>
                  <span class="skill-version">{{ skill.version ? `v${skill.version}` : '' }}</span>
                </div>
                <div class="skill-tags-wrap">
                  <!-- 标签：折叠悬浮 -->
                  <div v-if="skill.tags && skill.tags.length" class="skill-tags">
                    <span class="tag">{{ skill.tags[0] }}</span>
                    <el-tooltip v-if="skill.tags.length > 1" effect="dark" placement="top">
                      <template #content>
                        <div class="tag-tooltip">
                          <span v-for="t in skill.tags.slice(1)" :key="t">{{ t }}</span>
                        </div>
                      </template>
                      <span class="tag-more">+{{ skill.tags.length - 1 }}</span>
                    </el-tooltip>
                  </div>
                  <p class="skill-role">{{ skill.author ? `@${skill.author}` : '\u00a0' }}</p>
                </div>
              </div>
            </div>
            <p class="skill-content">{{ skill.description || '-' }}</p>
            <div class="skill-footer">
              <button class="action-btn">
                <img src="../assets/down.svg" class="action-icon" alt="下载" />
                <span>{{ formatCount(skill.downloadCount || skill.downloads) }}</span>
              </button>
              <button class="action-btn">
                <img src="../assets/collect.svg" class="action-icon" alt="点赞" />
                <span>{{ formatCount(skill.collectCount || skill.stars) }}</span>
              </button>
              <div v-show="hoveredSkill == skill.slug" class="skill-actions">
                <button
                  class="btn-remove"
                  @click="handleRemoveSkill(skill.slug || skill.id)"
                >移除</button>
                <button
                  class="btn-view"
                  @click="handleViewSkill(skill)"
                >查看</button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-skills">暂无已添加的 skill</div>
      </section>
    </div>

    <!-- Skill 市场弹框 -->
    <SkillMarketDialog
      v-model="skillDialogVisible"
      :selected-ids="dialogSelectedIds"
      @add="handleAddSkillFromMarket"
      @remove="handleRemoveSkillFromMarket"
    />

    <!-- Loading -->
    <Loading :visible="loading" text="加载中..." :fullscreen="true" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElTooltip } from 'element-plus'
import Breadcrumb from '@/shared/components/Breadcrumb.vue'
import SkillMarketDialog from '../../my-uploads/components/SkillMarketDialog.vue'
import Loading from '@/shared/components/Loading/index.vue'
import { MOCK_CLONE_DETAIL } from '../store'
import { fetchInstalledSkills, updateManagedAgent, removeManagedSkill } from '../myHiredApi'
import defaultSkillIcon from '../../my-uploads/assets/skill/S05@2x.png'
import defaultAvatarIcon from '../assets/ava/m01@2x.png'

const props = defineProps({
  detail: {
    type: Object,
    default: () => MOCK_CLONE_DETAIL
  }
})
const detail = ref(props.detail || MOCK_CLONE_DETAIL) 
const router = useRouter()

const hoveredSkill = ref(null)
const skillDialogVisible = ref(false)
const skills = ref([])
const relatedSkillSlugs = ref([])
const dialogSelectedIds = ref([])
const loading = ref(false)

// 加载已安装的 skills
async function loadSkills() {
  if (!detail.value?.id) return
  try {
    skills.value = await fetchInstalledSkills(detail.value.id)
    relatedSkillSlugs.value = skills.value.map(s => s.slug || s.name)
    dialogSelectedIds.value = skills.value.map(s => s.id).filter(Boolean)
  } catch (e) {
    console.error('加载 skills 失败:', e)
  }
}

// 监听 detail 变化，重新加载 skills
watch(() => props.detail, (newDetail) => {
  if (newDetail) {
    detail.value = newDetail
    loadSkills && loadSkills()
  }
}, { immediate: true })

function formatCount(count) {
  if (!count) return '0'
  return count >= 1000 ? (count / 1000).toFixed(1) + 'k' : String(count)
}

function handleAddSkill() {
  skillDialogVisible.value = true
}

async function handleAddSkillFromMarket(skill) {
  const slug = skill.slug

  // 只有不在已有列表中的才调用安装接口
  if (!relatedSkillSlugs.value.includes(slug)) {
    loading.value = true
    try {
      // 只传递新选择的 skill
      await updateManagedAgent(detail.value.id, { skills: [...relatedSkillSlugs.value, slug] })
      ElMessage.success('Skill 添加成功')
      await loadSkills()
    } catch (e) {
      console.error('安装 skill 失败:', e)
      ElMessage.error('Skill 添加失败，请重试')
    } finally {
      loading.value = false
    }
  }
}

/** 弹窗内「移除添加」仅取消勾选，不调卸载接口；真正卸载用卡片上「移除」 */
function handleRemoveSkillFromMarket(skill) {
  const slug = skill.slug
  if (!slug) return
  relatedSkillSlugs.value = relatedSkillSlugs.value.filter((s) => s !== slug)
  const rid = skill.id
  if (rid != null && rid !== '') {
    dialogSelectedIds.value = dialogSelectedIds.value.filter(
      (id) => id !== rid && String(id) !== String(rid),
    )
  }
}

async function handleRemoveSkill(slug) {
  try {
    // 找到对应的 skill 对象获取 ID
    const skill = skills.value.find(s => (s.slug || s.id) === slug)
    if (!skill) {
      ElMessage.error('未找到该 Skill')
      return
    }

    // 调用删除接口
    await removeManagedSkill(skill.slug, detail.value.id)
    ElMessage.success('Skill 移除成功')

    // 重新加载列表
    await loadSkills()
  } catch (e) {
    console.error('移除 skill 失败:', e)
    ElMessage.error('Skill 移除失败，请重试')
  }
}

function handleViewSkill(skill) {
  const id = skill.slug || skill.id
  if (!skill.official) {
    router.push({ name: 'MySkillDetail', params: { id }, query: { from: 'my-uploads' }})
  } else {
    router.push({ name: 'SkillDetail', params: { id } })
  }
}
</script>

<style lang="scss" scoped>
.clone-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 24px 40px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-wrap {
  width: 68px;
  height: 68px;
  border-radius: 100%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  font-weight: 600;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-title {
  margin: 0;
  font-family: PingFang SC;
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}

.header-subtitle {
  margin: 0;
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  text-align: justify; /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/三级文本色 */
  color: #91949E;
}

.btn-add-skill {
  height: 32px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: #141517;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: #2e323c;
  }
}

.section {
  margin-bottom: 32px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: #2f3547;
  line-height: 24px;

  &::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 14px;
    background: url('../assets/title-line.svg') no-repeat center / cover;
    flex-shrink: 0;
  }
}

.section-title-child {
  margin: 20px 0 8px 0;
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  letter-spacing: normal;
  color: #91949E;
}

.description-block {
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  letter-spacing: normal;
  color: #2F3547;
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.skill-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid transparent;
  background: rgba(247, 248, 250, 0.8);
  box-sizing: border-box;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  min-width: 0;

  &:hover {
    background: #ffffff;
    border-color: #eceef3;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);
  }
}

.skill-top-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-icon-wrap {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  padding: 6px;
  box-sizing: border-box;
}

.skill-icon {
  width: 36px;
  height: 36px;
  object-fit: cover;
}

.skill-icon-placeholder {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.skill-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-header {
  display: flex;
  align-items: end;
  gap: 8px;
}

.skill-title {
  font-size: 16px;
  font-weight: 500;
  color: #2f3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-version {
  font-size: 12px;
  color: #91949e;
  white-space: nowrap;
  flex-shrink: 0;
}

.skill-tags-wrap {
  display: flex;
  gap: 8px;
  align-items: center;
}

.skill-tags {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.tag {
  padding: 2px 8px;
  background: #f0f2f5;
  border-radius: 4px;
  font-size: 12px;
  color: #606572;
  white-space: nowrap;
}

.tag-more {
  padding: 2px 6px;
  background: #f0f2f5;
  border-radius: 4px;
  font-size: 12px;
  color: #91949e;
  cursor: pointer;

  &:hover {
    color: #436ff6;
  }
}

.tag-tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-role {
  margin: 0;
  font-size: 12px;
  color: #91949e;
  line-height: 18px;
}

.skill-desc {
  margin: 0;
  font-size: 12px;
  color: #91949e;
  line-height: 18px;
}

.skill-content {
  margin: 0;
  font-size: 13px;
  color: #91949e;
  line-height: 18px;
  height: 36px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.skill-footer {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 12px;
  color: #91949e;
  cursor: pointer;

  &:hover {
    color: #5f6573;
  }
}

.action-icon {
  width: 14px;
  height: 14px;
  opacity: 0.6;
}

.skill-actions {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 8px;
}

.btn-remove {
  height: 24px;
  padding: 0 12px;
  border: 1px solid #ECEEF3;
  border-radius: 6px;
  background: #fff;
  color: #2F3547;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #F5F6F9;
    border-color: #DFE2EA;
  }
}

.btn-view {
  height: 24px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: #141517;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #2e323c;
  }
}

.empty-skills {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: #91949e;
}
</style>
