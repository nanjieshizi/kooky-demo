<template>
  <div class="avatar-detail">
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
          <div class="avatar-wrapper">
            <img :src="detail.avatar || defaultAvatarIcon" class="avatar" alt="" @error="e => e.target.src = defaultAvatarIcon" />
          </div>
          <div class="header-info">
            <div class="title-row">
              <h1 class="title">{{ detail.name }}</h1>
              <span v-if="detail.version" class="version">v{{ detail.version }}</span>
            </div>
            <div class="tags-row-wrap">
              <div v-if="detail.tags && detail.tags.length" class="tags-row">
                <span v-for="tag in detail.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
              <p class="description" v-if="detail.fromAgentName">来自 @{{ detail.source }} 发布的 <span class="from-agent-link" @click="goToAgentDetail">{{ detail.fromAgentName }}</span></p>
            </div>
            <p v-if="ownerName" class="owner">
              所属：<span class="owner-link" @click="handleOwnerClick">{{ ownerName }}</span>
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-fire" @click="handleFire">解雇</button>
          <button class="btn-edit" @click="handleEdit">编辑</button>
          <!-- 市场详情：更新按钮 -->
          <template v-if="detail.type === 'market'">
            <button
              v-if="hasNewVersion"
              class="btn-update"
              @click="handleUpdate"
            >
              立即更新
            </button>
            <button v-else class="btn-no-update">暂无更新</button>
          </template>
        </div>
      </div>

      <!-- 基本信息 -->
      <div class="section">
        <h2 class="section-title">基本信息</h2>
        <h2 class="section-title-child">描述</h2>
        <p class="description-block">{{ detail.detailedDescription || detail.description || '-' }}</p>
        <!-- <h2 class="section-title-child">模拟对话案例</h2>
        <div v-if="detail.demoImage" class="demo-image-wrapper">
          <img :src="detail.demoImage" class="demo-image" alt="模拟对话案例" />
        </div> -->
        <!-- <div v-else class="demo-image-placeholder">模拟对话案例（暂无图片）</div> -->
      </div>

      <!-- 更新日志（仅市场详情） -->
      <div v-if="detail.type === 'market' && updateLogs.length" class="section">
        <h2 class="section-title">更新日志</h2>
        <div class="update-log-list">
          <div v-for="(log, index) in updateLogs" :key="log.version" class="log-card">
            <div class="log-header">
              <span class="log-version">{{ log.version }}</span>
              <span
                v-if="log.version == `v${detail.version}`"
                class="log-icon log-icon--current"
              >当前</span>
              <span
                v-else-if="index === 0"
                class="log-icon log-icon--new"
              >最新</span>
            </div>
            <p class="log-info">{{ log.updater }} <span style="margin: 0 8px;">|</span> {{ formatTime(log.updateTime) }}</p>
            <p class="log-content">{{ log.content }}</p>
          </div>
        </div>
      </div>

      <!-- 关联 Skill -->
      <div class="section">
        <h2 class="section-title">关联 Skill</h2>
        <div v-if="skills.length" class="skill-grid">
          <div
            v-for="skill in skills"
            :key="skill.slug"
            class="skill-card"
            @mouseenter="hoveredSkillId = skill.slug"
            @mouseleave="hoveredSkillId = null"
          >
            <div class="skill-top-row">
              <div class="skill-icon">
                <img :src="skill.image || defaultSkillIcon" alt="" @error="e => e.target.src = defaultSkillIcon" />
              </div>
              <div class="skill-info">
                <div class="skill-header">
                  <h3 class="skill-title">{{ skill.name }}</h3>
                  <span class="skill-version">{{ skill.version || '' }}</span>
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

            <p class="skill-text">{{ skill.description || '-' }}</p>
            <div class="skill-actions">
              <button class="action-btn">
                <img src="../assets/down.svg" class="action-icon" alt="下载" />
                <span>{{ formatCount(skill.downloads) }}</span>
              </button>
              <button class="action-btn">
                <img src="../assets/collect.svg" class="action-icon" alt="点赞" />
                <span>{{ formatCount(skill.stars) }}</span>
              </button>
              <button
                v-if="hoveredSkillId == skill.slug && !skill.isBuiltin"
                class="btn-view"
                @click.stop="handleViewSkill(skill)"
              >
                查看
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-skills">暂无关联 Skill</div>
      </div>
    </div>

    <!-- 更新确认弹框 -->
    <UpdateConfirmDialog
      v-model="showUpdateDialog"
      :data="updateConfirmData"
      @confirm="handleConfirmUpdate"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElTooltip, ElMessageBox, ElMessage } from 'element-plus'
import Breadcrumb from '@/shared/components/Breadcrumb.vue'
import UpdateConfirmDialog from './UpdateConfirmDialog.vue'
import { fireAgent, fetchInstalledSkills, fetchAgentDetail, fetchAgentRoomDetail, installAgent } from '../myHiredApi'
import { useMyHiredStore } from '../store'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import defaultSkillIcon from '../../my-uploads/assets/skill/S05@2x.png'
import defaultAvatarIcon from '../assets/ava/m01@2x.png'

const props = defineProps({
  detail: {
    type: Object,
    required: true,
  },
})

const router = useRouter()
const store = useMyHiredStore()
const uiStore = useUIStore()
const soloTeamStore = useSoloTeamStore()
const hoveredSkillId = ref(null)
const skills = ref([])
const updateLogs = ref([])
const ownerName = ref('')
const showUpdateDialog = ref(false)
const updateConfirmData = ref(null)
const isUpdateFromButton = ref(false)
const agentFileMd5 = ref('')
const agentArtifactUrl = ref('')
const hasNewVersion = ref(false)

async function loadSkills() {
  if (!props.detail?.id) return
  skills.value = await fetchInstalledSkills(props.detail.id)
}

async function loadDetail() {
  if (!props.detail?.id) return

  // 只有存在 fromAgentSlug 时才调用日志接口
  if (props.detail.fromAgentSlug) {
    const detail = await fetchAgentDetail(props.detail.fromAgentSlug)
    if (detail) {
      updateLogs.value = detail.updateLogs || []
      agentFileMd5.value = detail.fileMd5 || ''
      agentArtifactUrl.value = detail.downloadUrl || ''
      hasNewVersion.value = detail.updateLogs[0]?.version !== `v${props.detail.version}`
    }
  }

  const roomDetail = await fetchAgentRoomDetail(props.detail.id)
  if (roomDetail?.name) ownerName.value = roomDetail.name
}

async function handleOwnerClick() {
  try {
    const agentId = props.detail?.id
    if (!agentId) return
    await soloTeamStore.loadEmployeeItems({ force: true })
    await soloTeamStore.fetchEmployeeThreads(agentId)
    let thread = soloTeamStore.getEmployeeThreads(agentId)[0]
    if (!thread) thread = await soloTeamStore.createEmployeeThread(agentId)
    if (!thread?.id) return
    await soloTeamStore.selectEmployeeThread(agentId, thread.id)
    uiStore.setActiveNavigation('solo-team', `employee:${agentId}:${thread.id}`)
    uiStore.expandSidebar()
  } catch (e) {
    console.error('跳转失败:', e)
    ElMessage.error('打开对话失败')
  }
}

// 监听 detail 对象引用变化，重新加载数据；immediate 确保首次进入也触发
watch(() => props.detail, () => {
  loadSkills()
  loadDetail()
}, { immediate: true })

function handleUpdate() {
  isUpdateFromButton.value = true
  updateConfirmData.value = {
    avatar: props.detail.avatar,
    name: props.detail.name,
    source: props.detail.source,
    fromAgentName: props.detail.fromAgentName,
    fromAgentSlug: props.detail.fromAgentSlug,
    type: props.detail.type,
    changelog: updateLogs.value?.[0]?.content || '',
    isBuiltin: props.detail?.isBuiltin
  }
  showUpdateDialog.value = true
}

async function handleConfirmUpdate() {
  try {
    if (isUpdateFromButton.value) {
      const latestLog = updateLogs.value?.[0]
      await installAgent({
        agentId: props.detail.id,
        agentName: props.detail.name,
        version: latestLog?.version?.replace(/^v/i, '') || props.detail.version,
        isUpdate: true,
        marketSlug: props.detail.fromAgentSlug,
        md5: agentFileMd5.value,
        artifact_url: agentArtifactUrl.value,
      })
    }
    ElMessage.success('更新成功')
    showUpdateDialog.value = false
    await store.loadList(true)
  } catch (e) {
    ElMessage.error('更新失败，请重试')
    console.error('更新失败:', e)
  } finally {
    isUpdateFromButton.value = false
  }
}

function handleEdit() {
  router.push({ name: 'HiredEdit', params: { id: props.detail.id } })
}

function goToAgentDetail() {
  if (!props.detail.fromAgentSlug || props.detail.isBuiltin) return
  if (props.detail.type === 'selfBuilt') {
    router.push({ name: 'MyAvatarDetail', params: { id: props.detail.fromAgentSlug }, query: { from: 'my-uploads' } })
  } else {
    router.push({ name: 'AvatarDetail', params: { id: props.detail.fromAgentSlug } })
  }
}

async function handleFire() {
  try {
    await ElMessageBox.confirm(
      '解雇后，你手动修改的提示词和风格设置将被清空，请确认后进行操作',
      '确认解雇该数字人吗？',
      {
        confirmButtonText: '确认解雇',
        cancelButtonText: '取消',
        type: 'warning',
        buttonSize: 'default',
        customClass: 'fire-confirm-dialog',
      }
    )

    await fireAgent(props.detail.id)
    ElMessage.success('解雇成功')

    // 强制刷新列表并返回列表页
    await store.loadList(true)
    router.push({ name: 'MyHired' })
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('解雇失败，请重试')
      console.error('解雇失败:', e)
    }
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

function formatCount(count) {
  if (!count) return '0'
  if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
  return String(count)
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return String(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
</script>

<style lang="scss" scoped>
.avatar-detail {
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
  gap: 16px;
  margin-bottom: 32px;
}

.header-left {
  display: flex;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.avatar-wrapper {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
}

.avatar {
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
  font-size: 28px;
  font-weight: 600;
}

.header-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}



.title-row {
  display: flex;
  align-items: end;
  gap: 8px;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #2f3547;
  line-height: 28px;
}

.version {
  font-size: 12px;
  color: #91949e;
  flex-shrink: 0;
}

.tags-row-wrap {
  display: flex;
  gap: 16px;
  align-items: center;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 2px 8px;
  background: #f0f2f5;
  border-radius: 4px;
  font-size: 12px;
  color: #606572;
  white-space: nowrap;
}

.owner {
  margin: 0;
  font-size: 13px;
  color: #91949e;
  line-height: 20px;
}

.owner-link {
  color: #436ff6;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
}

.description {
  margin: 0;
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  color: #91949E;

  .from-agent-link {
    color: #436FF6;
    cursor: pointer;

    &:hover {
      text-decoration: none;
    }
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.btn-fire {
  height: 32px;
  padding: 0 16px;
  border: 1px solid #eceef3;
  border-radius: 6px;
  background: #fff;
  color: #2F3547;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #F5F6F9;
    color: #2F3547;
  }
}

.btn-edit {
  height: 32px;
  padding: 0 16px;
  border: 1px solid #eceef3;
  border-radius: 6px;
  background: #fff;
  color: #2F3547;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #F5F6F9;
    color: #2F3547;
  }
}

.btn-update {
  height: 32px;
  padding: 0 16px;
  border: none;
  border-radius: 6px;
  background: #141517;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #2e323c;
  }
}

.btn-no-update {
  height: 32px;
  padding: 0 16px;
  border: none;
  border-radius: 6px;
  background: rgba(23, 27, 38, 0.6);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  &:hover {
    background: rgba(46, 50, 60, 0.6);
  }
}

.section {
  margin-bottom: 32px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px;
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
  text-align: justify; /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/三级文本色 */
  color: #91949E;
}

.description-block {
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  text-align: justify; /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}

.demo-image-wrapper {
  border-radius: 8px;
  overflow: hidden;
}

.demo-image {
  width: 100%;
  display: block;
}

.demo-image-placeholder {
  padding: 32px;
  border-radius: 8px;
  border: 1px dashed #eceef3;
  text-align: center;
  font-size: 13px;
  color: #c0c4cc;
}

.update-log-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.log-card {
  padding: 16px;
  border-radius: 12px;
  background: rgba(247, 248, 250, 0.8);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.log-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.log-version {
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  text-align: justify; /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}

.log-icon {
  width: 37px;
  height: 25px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 7px;
  font-weight: normal;
  line-height: 8px;
  letter-spacing: 0.57px;
  color: #fff;
  background-size: 100% 100%;
  background-repeat: no-repeat;

  &--new {
    background-image: url('../assets/new-icon.svg');
  }

  &--current {
    background-image: url('../assets/current-icon.svg');
  }
}

.log-updater {
  font-size: 12px;
  color: #91949e;
}

.log-time {
  font-size: 12px;
  color: #91949e;
  margin-left: auto;
}

.log-info {
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  text-align: justify; /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/三级文本色 */
  color: #91949E;
  margin-bottom: 8px;
}

.log-content {
  margin: 0;
  font-family: PingFang SC;
  font-size: 13px;
  font-weight: normal;
  line-height: 21px;
  text-align: justify; /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
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

.skill-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  padding: 6px;
  box-sizing: border-box;

  img {
    width: 36px;
    height: 36px;
    object-fit: cover;
  }
}

.icon-placeholder {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.skill-header {
  display: flex;
  align-items: end;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.skill-title {
  margin: 0;
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-version {
  flex-shrink: 0;
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  /* 文本色&图标色/三级文本色 */
  color: #91949E;
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

.skill-text {
  margin: 0;
  font-family: PingFang SC;
  font-size: 13px;
  font-weight: normal;
  line-height: 18px;
  letter-spacing: normal;
  color: #91949E;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  height: 36px;
}

.skill-actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  color: #606572;
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

.btn-view {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
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

<style lang="scss">
// 解雇确认弹框样式（非 scoped，覆盖 Element Plus）
.fire-confirm-dialog {
  .el-message-box__btns {
    .el-button--primary {
      background: #ff4d4f;
      border-color: #ff4d4f;

      &:hover,
      &:focus {
        background: #ff7875;
        border-color: #ff7875;
      }
    }
  }
}
</style>
