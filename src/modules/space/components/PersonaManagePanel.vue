<template>
  <div
    class="persona-manage-panel"
    :class="{ 'is-dragging': isDragging, 'is-embedded': embedded }"
    :style="embedded ? null : { width: panelWidth + 'px' }"
  >
    <!-- 左侧分割线（控制面板总宽度）；嵌入侧区时由侧区提供拖拽，隐藏此条 -->
    <div
      v-if="!embedded"
      class="divider left-divider"
      :class="{ dragging: isDragging }"
      @mousedown="startDrag"
    >
      <div class="divider-line" :class="{ dragging: isDragging }"></div>
      <div class="divider-handle" :class="{ dragging: isDragging }">
        <img :src="dragIcon" class="drag-icon drag-icon-default" alt="拖拽" />
        <img :src="dragHoverIcon" class="drag-icon drag-icon-hover" alt="拖拽" />
      </div>
    </div>

    <UpdateConfirmDialog
      v-model="showUpdateDialog"
      :data="updateConfirmData"
      @confirm="handleConfirmEmployeeUpdate"
    />

    <div class="panel-body">
      <!-- 保存中遮罩 -->
      <div v-if="saving" class="saving-mask">
        <img src="@/assets/skill/skill-loading.gif" alt="加载中" class="skill-loading-icon" />
      </div>

      <div class="panel-body-scroll">
      <!-- 查看模式 -->
      <template v-if="!isEditing">
        <div class="persona-view-stack" :class="{ 'employee-manage-card': isEmployeeContext }">
        <!-- 顶部标题栏 -->
        <div class="panel-header">
          <span class="panel-title">{{ panelTitle }}</span>
          <div class="header-actions">
            <button
              v-if="!isCollaborationEmployeeContext"
              class="header-btn"
              title="编辑"
              @click="handleEdit"
            >
              <SvgIcon name="icon-bianji1" :size="14" color="currentColor" />
            </button>
            <button class="header-btn close-btn" title="关闭" @click="handleClose">
              <SvgIcon name="icon-guanbi1" :size="14" color="currentColor" />
            </button>
          </div>
        </div>

        <!-- 分身卡片；嵌入整页时页头已经有头像/名字/版本/更新入口了，这里整块不重复 -->
        <div class="persona-content">
          <div v-if="!embedded" class="persona-card">
            <div v-if="!embedded" class="persona-avatar">
              <img :src="personaData.avatar" alt="Kooky" @error="onPersonaPanelAvatarError" />
            </div>
            <div v-if="!embedded" class="persona-info">
              <el-tooltip
                :content="personaDisplayName"
                placement="top"
                effect="dark"
                :show-after="300"
                :disabled="!isPersonaNameOverflowing"
              >
                <h3 ref="personaNameRef" class="persona-name">{{ personaDisplayName }}</h3>
              </el-tooltip>
              <p v-if="personaSubtitle" class="persona-subtitle">{{ personaSubtitle }}</p>
            </div>
            <button
              v-if="hasNewVersion"
              type="button"
              class="persona-update-btn"
              @click="handleEmployeeUpdate"
            >
              <span class="persona-update-dot" aria-hidden="true"></span>
              可更新
            </button>
          </div>

          <!-- 描述部分 -->
          <div v-if="!hideDescriptionField" class="persona-section">
            <h4 class="section-title">描述</h4>
            <p class="section-content section-content--wrap">
              {{ personaDisplayDescription }}
            </p>
          </div>

          <!-- 默认模型：决定他多聪明、多贵，跟人设分开列 -->
          <div v-if="employeeModelText" class="persona-section">
            <h4 class="section-title">默认模型</h4>
            <p class="section-content">{{ employeeModelText }}</p>
          </div>

          <!-- 人设：和编辑态「基本信息」里的三件套一一对应，没填的行不占地方 -->
          <div v-if="personaStyleRows.length" class="persona-section">
            <h4 class="section-title">人设</h4>
            <div class="persona-style-list">
              <div v-for="row in personaStyleRows" :key="row.label" class="persona-style-row">
                <span class="persona-style-label">{{ row.label }}</span>
                <span class="persona-style-value">{{ row.value }}</span>
              </div>
            </div>
          </div>

          <!-- Skill技能部分 -->
          <div class="persona-section">
            <h4 class="section-title">Skill技能</h4>
            <div v-if="loadingSkills" class="skills-loading">
              <img src="@/assets/skill/skill-loading.gif" alt="加载中" class="skill-loading-icon" />
            </div>
            <div v-else class="skills-grid">
              <div v-for="skill in skills" :key="skill.slug || skill.id" class="skill-card">
                <div class="skill-icon">
                  <img :src="skill.image || skill.icon || skillUploadIcon" :alt="skill.displayName || skill.slug" />
                </div>
                <div class="skill-info">
                  <h5 class="skill-name">{{ skill.displayName || skill.slug }}</h5>
                  <el-tooltip
                    :content="skill.summary"
                    placement="top"
                    :show-after="300"
                    :disabled="!skill.summary"
                    popper-class="skill-desc-tooltip"
                  >
                    <p class="skill-desc">{{ skill.summary }}</p>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>

          <!-- 记忆：编辑态能增删，这里只读列出，别让详情页下半截空着 -->
          <div class="persona-section">
            <h4 class="section-title">记忆</h4>
            <ul v-if="personaMemories.length" class="memory-view-list">
              <li v-for="m in personaMemories" :key="m.id" class="memory-view-item">{{ m.text }}</li>
            </ul>
            <p v-else class="section-content section-content--wrap">还没有记忆，聊几句它就记住了。</p>
          </div>

        </div>

        <!-- 数字员工：解聘（协作数字人 / 助理本体不展示；嵌入整页时按钮在页头，这里不重复） -->
        <div v-if="canDismissEmployee && !embedded" class="persona-employee-footer">
          <button
            type="button"
            class="dissolve-btn"
            :disabled="dismissLoading"
            @click="openDismissEmployeeConfirmDialog"
          >
            {{ dismissLoading ? '处理中…' : '解聘' }}
          </button>
        </div>
        </div>
      </template>

      <!-- 编辑模式 -->
      <template v-else>
        <div class="persona-edit-stack" :class="{ 'employee-manage-card': isEmployeeContext }">
        <!-- 编辑模式标题栏 -->
        <div class="panel-header">
          <button class="header-btn back-btn" @click="handleCancelEdit">
            <SvgIcon name="icon-shouqi" :size="14" color="currentColor" />
          </button>
          <span class="panel-title">编辑</span>
          <div class="header-actions">
            <button class="header-btn" title="关闭" @mousedown.prevent @click="handleClose">
              <SvgIcon name="icon-guanbi1" :size="14" color="currentColor" />
            </button>
          </div>
        </div>

        <!-- 标签页 -->
        <div class="edit-tabs">
          <div class="edit-tabs-title">
            <span
              class="tab-btn"
              :class="{ active: activeTab === 'basic' }"
              @click="activeTab = 'basic'"
            >基本信息</span>
            <span
              class="tab-btn"
              :class="{ active: activeTab === 'skills' }"
              @click="activeTab = 'skills'"
            >技能</span>
            <span
              class="tab-btn"
              :class="{ active: activeTab === 'memories' }"
              @click="activeTab = 'memories'"
            >记忆</span>
          </div>

        </div>
        <!-- 编辑内容区 -->
        <div class="edit-content">
          <!-- 基本信息 -->
          <div v-show="activeTab === 'basic'" class="tab-panel">
            <el-form
              ref="basicFormRef"
              :model="editFormData"
              :rules="formRules"
              label-position="top"
              hide-required-asterisk
              class="persona-form"
            >
              <el-form-item label="头像">
                <div class="avatar-upload">
                  <!-- 头像上传编辑：暂时关闭，下轮迭代恢复
                  <template v-if="isEmployeeContext">
                    <div
                      class="avatar-upload__click-wrap"
                      :class="{ 'is-busy': employeeAvatarUploading }"
                      role="button"
                      tabindex="0"
                      title="点击上传头像"
                      @click="triggerEmployeeAvatarPick"
                      @keydown.enter.prevent="triggerEmployeeAvatarPick"
                      @keydown.space.prevent="triggerEmployeeAvatarPick"
                    >
                      <input
                        ref="employeeAvatarInputRef"
                        type="file"
                        class="avatar-upload__file-input"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        @change="onEmployeeAvatarFileChange"
                      />
                      <img :src="editFormAvatarSrc" alt="" class="avatar-preview" />
                      <div class="avatar-upload__hover-icon" aria-hidden="true">
                        <img :src="uploadAgentIcon" alt="" class="avatar-upload__upload-icon" />
                      </div>
                      <div v-if="employeeAvatarUploading" class="avatar-upload__busy" aria-live="polite">
                        <el-icon class="is-loading"><Loading /></el-icon>
                      </div>
                    </div>
                  </template>
                  <img v-else :src="editFormAvatarSrc" alt="头像" class="avatar-preview" />
                  -->
                  <img
                    :src="editFormAvatarSrc"
                    alt="头像"
                    class="avatar-preview"
                    @error="onPersonaPanelAvatarError"
                  />
                </div>
              </el-form-item>

              <el-form-item label="名称" prop="name">
                <el-input
                  v-model="editFormData.name"
                  placeholder="请输入名称"
                  maxlength="64"
                  show-word-limit
                  @blur="saveBasicInfo"
                />
              </el-form-item>

              <el-form-item v-if="isEmployeeContext" label="职位" prop="job_title">
                <el-input
                  v-model="editFormData.job_title"
                  placeholder="如：产品经理、运维助手"
                  maxlength="64"
                  show-word-limit
                  @blur="saveBasicInfo"
                />
              </el-form-item>

              <!-- 默认模型：下拉选档位。选完立刻存（select 的 blur 不可靠，挂 change） -->
              <el-form-item v-if="isEmployeeContext" label="默认模型" prop="llm_model">
                <el-select
                  v-model="editFormData.llm_model"
                  placeholder="选择默认模型"
                  style="width: 100%"
                  @change="saveBasicInfo"
                >
                  <el-option v-for="m in modelOptions" :key="m" :label="m" :value="m" />
                </el-select>
              </el-form-item>

              <el-form-item v-if="!hideDescriptionField" label="描述" prop="description">
                <el-input
                  v-model="editFormData.description"
                  type="textarea"
                  placeholder="您的专属助理，理解您的目标并智能分配任务。"
                  :rows="6"
                  :maxlength="isEmployeeContext ? 1024 : 500"
                  show-word-limit
                  @blur="saveBasicInfo"
                />
              </el-form-item>

              <!-- 人设三件套：对齐生产「基本信息」tab（称呼风格 / 语言偏好 / 回答语气风格） -->
              <el-form-item label="称呼风格" prop="call_style">
                <el-input
                  v-model="editFormData.call_style"
                  type="textarea"
                  :rows="2"
                  placeholder="如：亲切自然、直呼其名"
                  maxlength="120"
                  @blur="saveBasicInfo"
                />
              </el-form-item>

              <el-form-item label="语言偏好" prop="language_preference">
                <el-input
                  v-model="editFormData.language_preference"
                  type="textarea"
                  :rows="2"
                  placeholder="如：简体中文、中英混合"
                  maxlength="120"
                  @blur="saveBasicInfo"
                />
              </el-form-item>

              <el-form-item label="回答语气风格" prop="tone_style">
                <el-input
                  v-model="editFormData.tone_style"
                  type="textarea"
                  :rows="2"
                  placeholder="如：专业严谨、耐心"
                  maxlength="120"
                  @blur="saveBasicInfo"
                />
              </el-form-item>
            </el-form>
          </div>

          <!-- 技能 -->
          <div v-show="activeTab === 'skills'" class="tab-panel">
            <div class="add-skill-wrapper" ref="addSkillWrapperRef">
              <button
                ref="addSkillTriggerRef"
                type="button"
                class="add-skill-header-btn"
                @click="toggleAddSkillMenu"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                添加 Skill
              </button>

            </div>
            <Teleport to="body">
              <!-- 添加方式下拉菜单：挂 body，避免被管理面板 overflow 裁剪 -->
              <Transition name="dropdown">
                <div
                  v-if="showAddSkillMenu"
                  ref="addSkillDropdownRef"
                  class="add-skill-dropdown add-skill-dropdown--teleport"
                  :style="addSkillDropdownStyle"
                >
                  <div class="dropdown-item" @click="handleAddFromMarket">
                    <img :src="skillMarketIcon" width="32" height="32" class="dropdown-item-icon" alt="" />
                    <div class="dropdown-item-text">
                      <div class="dropdown-item-title">从市场选择</div>
                      <el-tooltip
                        content="精选官方与生态技能，一键快速安装"
                        placement="top"
                        effect="dark"
                        :show-after="300"
                        append-to="#app"
                        popper-class="skill-desc-tooltip"
                      >
                        <div class="dropdown-item-desc">精选官方与生态技能，一键快速安装</div>
                      </el-tooltip>
                    </div>
                  </div>
                  <div class="dropdown-item" @click="handleUploadSkill">
                    <img :src="skillUploadIcon" width="32" height="32" class="dropdown-item-icon" alt="" />
                    <div class="dropdown-item-text">
                      <div class="dropdown-item-title">上传 Skill 工程</div>
                      <el-tooltip
                        content="上传 ZIP 工程包，导入已有技能"
                        placement="top"
                        effect="dark"
                        :show-after="300"
                        append-to="#app"
                        popper-class="skill-desc-tooltip"
                      >
                        <div class="dropdown-item-desc">上传 ZIP 工程包，导入已有技能</div>
                      </el-tooltip>
                    </div>
                  </div>
                  <div class="dropdown-item" @click="handleCreateByChat">
                    <img :src="skillTalkIcon" width="32" height="32" class="dropdown-item-icon" alt="" />
                    <div class="dropdown-item-text">
                      <div class="dropdown-item-title">通过对话创建</div>
                      <el-tooltip
                        content="自然语言描述需求，AI智能生成专属技能"
                        placement="top"
                        effect="dark"
                        :show-after="300"
                        append-to="#app"
                        popper-class="skill-desc-tooltip"
                      >
                        <div class="dropdown-item-desc">自然语言描述需求，AI智能生成专属技能</div>
                      </el-tooltip>
                    </div>
                  </div>
                </div>
              </Transition>
            </Teleport>

            <div class="skills-list">
              <div v-for="(skill, index) in editSkills" :key="skill.slug || skill.id || index" class="skill-item">
                <div class="skill-item-left">
                  <div class="skill-item-icon">
                    <img :src="skill.image || skill.icon || skillUploadIcon" :alt="skill.displayName || skill.slug" />
                  </div>
                  <div class="skill-item-info">
                    <div class="skill-item-name">
                      <el-tooltip
                        :content="skill.displayName || skill.slug"
                        placement="top"
                        :show-after="300"
                        :disabled="!(skill.displayName || skill.slug)"
                        popper-class="skill-desc-tooltip"
                      >
                        <span class="skill-item-name-text">{{ skill.displayName || skill.slug }}</span>
                      </el-tooltip>
                      <span v-if="skill.scope === 'market'" class="skill-badge">市场</span>
                      <button
                        v-if="skill.boundVersion && skill.version && skill.boundVersion !== skill.version"
                        class="skill-update-btn"
                        title="有新版本，点击更新"
                        @click="updateSkill(skill)"
                      >
                        <img :src="updateIcon" width="16" height="16" alt="更新" />
                      </button>
                    </div>
                    <el-tooltip
                      :content="skill.summary"
                      placement="top"
                      :show-after="300"
                      :disabled="!skill.summary"
                      popper-class="skill-desc-tooltip"
                    >
                      <div class="skill-item-desc">{{ skill.summary }}</div>
                    </el-tooltip>
                  </div>
                </div>
                <div class="skill-item-right">
                  <button
                    v-if="skill.deletable !== false"
                    class="skill-action-btn delete-btn"
                    title="移除"
                    @click="removeSkill(index)"
                  >
                    <!-- <img :src="deleteIcon" width="14" height="14" alt="移除" /> -->
                    <SvgIcon name="icon-shanchu2" :size="14" color="currentColor" /> 
                  </button>
                  <label class="skill-switch">
                    <input
                      v-model="skill.enabled"
                      type="checkbox"
                      class="skill-switch-input"
                      @change="saveSkillEnabled(skill)"
                    />
                    <span class="skill-switch-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 记忆 -->
          <div v-show="activeTab === 'memories'" class="tab-panel memories-panel">
            <button class="memory-add-btn" type="button" @click="onAddMemory">
              <span class="memory-add-plus">+</span>
              <span>新增记忆</span>
            </button>
            <div class="memory-hint">
              <span class="memory-hint-icon">✦</span>
              <span>分身在对话中沉淀下来的事实</span>
            </div>
            <div class="memory-list">
              <div
                v-for="(m, idx) in personaMemories"
                :key="m.id"
                class="memory-item"
              >
                <div class="memory-body">{{ m.text }}</div>
                <button
                  class="memory-delete"
                  type="button"
                  :title="'删除这条记忆'"
                  @click="removeMemory(idx)"
                >
                  <SvgIcon name="icon-shanchu2" :size="14" color="currentColor" />
                </button>
              </div>
              <div v-if="!personaMemories.length" class="memory-empty">
                还没有沉淀下任何记忆。多对话几次，分身会自动记下重要事实。
              </div>
            </div>
          </div>
        </div>

        <!-- 数字员工编辑：解聘（协作数字人 / 助理本体不展示） -->
        <div v-if="canDismissEmployee" class="persona-employee-footer">
          <button
            type="button"
            class="dissolve-btn"
            :disabled="dismissLoading"
            @click="openDismissEmployeeConfirmDialog"
          >
            {{ dismissLoading ? '处理中…' : '解聘' }}
          </button>
        </div>
        </div>
      </template>
      </div>
    </div>

    <!-- 技能市场弹框 -->
    <PersonaSkillMarketDialog
      v-model="showSkillMarketDialog"
      :agent-id="agentId"
      :installed-slugs="installedSkills.map(s => s.slug).filter(Boolean)"
      @skill-installed="onSkillInstalled"
    />

    <!-- 上传 Skill 工程弹框 -->
    <PersonaSkillUploadDialog
      v-model="showSkillUploadDialog"
      :agent-id="agentId"
      @skill-uploaded="onSkillInstalled"
    />

    <!-- 与 EmployeeChatSessionHeader「移除会话」确认弹框同结构、同样式 -->
    <Teleport to="body">
      <div
        v-if="dismissEmployeeConfirm.visible"
        class="delete-dialog-mask"
        @click.self="cancelDismissEmployeeConfirmDialog"
      >
        <div class="delete-dialog delete-dialog--dismiss">
          <div class="delete-dialog-header">
            <div class="delete-dialog-header-main">
              <img src="@/assets/deerflowChat/warning.svg" alt="" class="delete-dialog-icon" />
              <span class="delete-dialog-title">{{ dismissEmployeeConfirmTitle }}</span>
            </div>
            <button type="button" class="delete-dialog-close" @click="cancelDismissEmployeeConfirmDialog">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <p class="delete-dialog-desc">{{ dismissEmployeeConfirmDesc }}</p>
          <div class="delete-dialog-footer">
            <button type="button" class="delete-dialog-btn delete-dialog-btn--cancel" @click="cancelDismissEmployeeConfirmDialog">
              取消
            </button>
            <button type="button" class="delete-dialog-btn delete-dialog-btn--confirm" @click="confirmDismissEmployee">
              确认
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <!-- 移除技能确认弹框 -->
    <Teleport to="body">
      <div
        v-if="removeSkillDialog.visible"
        class="delete-dialog-mask"
        @click.self="cancelRemoveSkill"
      >
        <div class="delete-dialog delete-dialog--remove-skill">
          <div class="delete-dialog-header">
            <div class="delete-dialog-header-main">
              <img src="@/assets/deerflowChat/warning.svg" alt="" class="delete-dialog-icon" />
              <span class="delete-dialog-title">确认移除当前 Skill？</span>
            </div>
            <button type="button" class="delete-dialog-close" @click="cancelRemoveSkill">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <p class="delete-dialog-desc">移除后，该 Skill 将与当前数字人解绑，数字人将无法调用该能力。<br />此操作不可撤销，请确认后再执行。</p>
          <div class="delete-dialog-footer">
            <button type="button" class="delete-dialog-btn delete-dialog-btn--cancel" @click="cancelRemoveSkill">
              取消
            </button>
            <button type="button" class="delete-dialog-btn delete-dialog-btn--confirm" @click="confirmRemoveSkill">
              确认移除
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive, onUnmounted, onMounted, nextTick } from 'vue'
import { useOverflowDetect } from '@/composables/useOverflowDetect'
// 头像上传恢复时取消注释
// import { Loading } from '@element-plus/icons-vue'
import { useUIStore } from '@/modules/space/uiStore'
import { useDeerflowChatStore } from '@/modules/deerflow-chat/store'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { soloTeamApiErrorMessage } from '@/modules/solo-team/utils/apiErrorMessage'
import { updatePrivateAgent } from '@/modules/solo-team/service'
import { fetchInstalledSkills, unbindSkillFromAgent, deleteSkill } from '@/modules/deerflow-chat/services/skillApi'
import { installSkillToAgent } from '@/modules/market/skill/skillMarketApi.js'
import { threadApi } from '@/modules/deerflow-chat/services/threadApi'
import { ElMessage } from 'element-plus'
import dragIcon from '@/assets/home/drag.svg'
import dragHoverIcon from '@/assets/home/dragHover.svg'
import updateIcon from '@/assets/deerflowChat/updata.svg'
import skillMarketIcon from '@/assets/deerflowChat/skillMarket.svg'
import skillUploadIcon from '@/assets/deerflowChat/skillUpload.svg'
import skillTalkIcon from '@/assets/deerflowChat/skillTalk.svg'
// 头像上传恢复时取消注释
// import uploadAgentIcon from '@/assets/soloTeam/upload_agent.svg'
import individualImg from '@/assets/home/person_chat_head.png'
import { resolveBundledImageFromApiPath, isLikelyInvalidSrcAssetPath } from '@/shared/utils/localApiAssetMap'
import {
  resolveEmployeeAvatarSrc,
  pickEmployeeAvatarRawString,
  employeeDefaultAgentAvatar,
} from '@/modules/solo-team/utils/employeeChatAvatar'
import PersonaSkillMarketDialog from './PersonaSkillMarketDialog.vue'
import PersonaSkillUploadDialog from './PersonaSkillUploadDialog.vue'
import { buildPersonaSkillCreatorTarget } from '../utils/personaSkillCreator.mjs'
/** 与数字人市场 AvatarDetailView 一致：GET /kooky-api/api/v1/agents/detail/:id */
import { fetchAgentDetail } from '@/modules/market/avatar/services/avatarApi'
import UpdateConfirmDialog from '@/modules/market/my-hired/components/UpdateConfirmDialog.vue'

/** 展示文案：兼容 API 返回 number 等类型 */
function toPersonaDisplayText(value) {
  if (value == null || value === '') return ''
  return String(value).trim()
}

/** 数字员工/接口返回的头像：映射到打包后的 soloTeam/ava 等资源，伪源码路径回退默认图 */
function resolvePersonaAvatarDisplaySrc(src) {
  if (src == null || String(src).trim() === '') return individualImg
  const val = String(src).trim()
  const mapped = resolveBundledImageFromApiPath(val)
  if (mapped) return mapped
  if (isLikelyInvalidSrcAssetPath(val)) return individualImg
  return val
}

const props = defineProps({
  /** 智能体 ID，由父组件传入 */
  agentId: { type: [Number, String], default: null },
  /**
   * deerflow：默认分身（Thread API）
   * employee：一人团队「我的员工」（私有 agents API + solo-team store）
   * collaborationEmployee：协作数字人「数字员工管理」只读；详情优先 GET /api/v1/agents/detail/:id（与数字人市场 AvatarDetailView 一致），失败则回退 agent-usage 列表项
   */
  context: { type: String, default: 'deerflow' },
  /** 嵌入会话侧区 manage 槽：藏左侧 resize 分割线、宽度撑满、close 走 emit */
  embedded: { type: Boolean, default: false },
  /** 初始宽度（可拖拽调整）：通讯录这类整页管理场景给宽版，会话侧栏保持 260 */
  initialWidth: { type: Number, default: 260 },
})

const emit = defineEmits(['close'])

const uiStore = useUIStore()
const chatStore = useDeerflowChatStore()
const soloTeamStore = useSoloTeamStore()
const collaborationEmployeeStore = useCollaborationEmployeeChatStore()

const isEmployeeContext = computed(
  () => props.context === 'employee' || props.context === 'collaborationEmployee',
)
/**
 * 内嵌进通讯录员工详情页时，名称/描述由页头那块直接改，
 * 这里就不再重复出一份「描述」—— 同一个字段两个入口只会让人犯迷糊。
 * （侧栏形态 embedded=false，以及分身的 embedded 面板都不受影响）
 */
const hideDescriptionField = computed(() => props.embedded && isEmployeeContext.value)
/** 数字员工管理数据源：一人团队 vs 协作数字人 */
const employeeSessionStore = computed(() =>
  props.context === 'collaborationEmployee' ? collaborationEmployeeStore : soloTeamStore,
)

/** 协作数字人管理：只读，详情仅来自协作侧 agent-usage 列表 */
const isCollaborationEmployeeContext = computed(() => props.context === 'collaborationEmployee')

const panelTitle = computed(() => {
  if (!isEmployeeContext.value) return '分身管理'
  if (isCollaborationEmployeeContext.value) return '数字人管理'
  return '数字员工管理'
})

// 分身"记忆" tab：演示用假数据（UI-only，不接真实持久化）
// 共享 store 放到 window 上让剧本能预先注入新记忆（panel 未 mount 时）
function _initPersonaMemoriesStore() {
  if (typeof window === 'undefined') return []
  if (!window.__personaMemoriesStore) {
    window.__personaMemoriesStore = [
      { id: 'mem-1', text: '用户名为 LM，是一名产品经理，偏好简洁直接的沟通风格。' },
      { id: 'mem-2', text: '高风险操作（发送、删除、外部调用）先给建议，再等待用户确认。' },
      { id: 'mem-3', text: '日常使用 Kooky、Kode 与协作群推进工作；邓颖茹是 Kooky 专项负责人。' },
      { id: 'mem-4', text: '中文回复优先；技术细节可以英文术语，但解释要中文。' },
    ]
  }
  return window.__personaMemoriesStore
}
const personaMemories = ref(_initPersonaMemoriesStore())

function onAddMemory() {
  const seed = `mem-${Date.now()}`
  personaMemories.value.unshift({
    id: seed,
    text: '（新记忆草稿）请描述这条要让分身记住的事实…',
  })
}

function removeMemory(idx) {
  if (idx >= 0 && idx < personaMemories.value.length) {
    personaMemories.value.splice(idx, 1)
  }
}

// Dev 演示桥：让剧本播放器从对话里"沉淀"出新记忆条目
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__personaMemoryBridge = {
    add(text) {
      // 防重复：如果已有同样文本的记忆，不再加
      const existing = personaMemories.value.find(m => m.text === text)
      if (existing) {
        // 标 isNew 闪一下提示
        existing.isNew = true
        return
      }
      const item = { id: `mem-${Date.now()}`, text, isNew: true }
      personaMemories.value.unshift(item)
      if (Array.isArray(window.__personaMemoriesStore)) {
        // store 也防重
        if (!window.__personaMemoriesStore.some(m => m.text === text)) {
          window.__personaMemoriesStore.unshift(item)
        }
      }
    },
    sync() {
      // 把共享 store 的最新值拉到本 panel ref + 去重
      if (Array.isArray(window.__personaMemoriesStore)) {
        const seen = new Set()
        const deduped = []
        for (const m of window.__personaMemoriesStore) {
          if (!seen.has(m.text)) {
            seen.add(m.text)
            deduped.push(m)
          }
        }
        window.__personaMemoriesStore.length = 0
        window.__personaMemoriesStore.push(...deduped)
        personaMemories.value = [...deduped]
      }
    },
    reset() {
      // 完全重置回 4 条原始
      const base = [
        { id: 'mem-1', text: '用户名为 LM，是一名产品经理，偏好简洁直接的沟通风格。' },
        { id: 'mem-2', text: '高风险操作（发送、删除、外部调用）先给建议，再等待用户确认。' },
        { id: 'mem-3', text: '日常使用 Kooky、Kode 与协作群推进工作；邓颖茹是 Kooky 专项负责人。' },
        { id: 'mem-4', text: '中文回复优先；技术细节可以英文术语，但解释要中文。' },
      ]
      if (Array.isArray(window.__personaMemoriesStore)) {
        window.__personaMemoriesStore.length = 0
        window.__personaMemoriesStore.push(...base)
      }
      personaMemories.value = [...base]
    },
  }
}

function onPersonaPanelAvatarError(e) {
  const el = e?.target
  if (!el || el.dataset?.avatarFallback === '1') return
  el.dataset.avatarFallback = '1'
  el.src = isEmployeeContext.value ? employeeDefaultAgentAvatar : individualImg
}

// 编辑状态
const isEditing = ref(false)
const activeTab = ref('basic')
const basicFormRef = ref(null)
const showAddSkillMenu = ref(false)
const addSkillWrapperRef = ref(null)
const addSkillTriggerRef = ref(null)
const addSkillDropdownRef = ref(null)
const addSkillDropdownStyle = ref({})
const saving = ref(false)
const showSkillMarketDialog = ref(false)
const showSkillUploadDialog = ref(false)
const dismissLoading = ref(false)
// 头像上传恢复时取消注释
// const employeeAvatarInputRef = ref(null)
// const employeeAvatarUploading = ref(false)

// 检查是否包含emoji
const hasEmoji = (str) => {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}\u{FE00}-\u{FE0F}]/gu
  return emojiRegex.test(str)
}

// 检查是否有首尾空格
const hasTrimSpace = (str) => {
  return str !== str.trim()
}

// 自定义验证器：只验证，不修改数据
const validateName = (rule, value, callback) => {
  if (!value) {
    callback(new Error('名称不能为空'))
    return
  }

  if (hasTrimSpace(value)) {
    callback(new Error('名称首尾不能有空格'))
    return
  }

  if (hasEmoji(value)) {
    callback(new Error('名称不能包含表情符号'))
    return
  }

  if (!value.trim()) {
    callback(new Error('名称不能为空'))
    return
  }

  callback()
}

const validateDescription = (rule, value, callback) => {
  if (!value) {
    callback(new Error('描述不能为空'))
    return
  }

  if (hasTrimSpace(value)) {
    callback(new Error('描述首尾不能有空格'))
    return
  }

  if (hasEmoji(value)) {
    callback(new Error('描述不能包含表情符号'))
    return
  }

  if (!value.trim()) {
    callback(new Error('描述不能为空'))
    return
  }

  callback()
}

/** 职位可选；有内容时校验空格与 emoji */
const validateTitleOptional = (rule, value, callback) => {
  if (value == null || value === '') {
    callback()
    return
  }
  const s = String(value)
  if (hasTrimSpace(s)) {
    callback(new Error('职位首尾不能有空格'))
    return
  }
  if (hasEmoji(s)) {
    callback(new Error('职位不能包含表情符号'))
    return
  }
  callback()
}

// 表单验证规则
const formRules = {
  name: [
    { required: true, validator: validateName, trigger: 'blur' }
  ],
  description: [
    { required: true, validator: validateDescription, trigger: 'blur' }
  ],
  job_title: [
    { validator: validateTitleOptional, trigger: 'blur' }
  ],
}

// 智能体信息
const agentInfo = ref(null)
const loadingAgent = ref(false)

/** 将市场 agents/detail 响应映射为 PersonaManagePanel 的 agentInfo（协作只读） */
function mapMarketAgentDetailToPersonaAgentInfo(payload, installedAgentIdFallback) {
  const e = payload && typeof payload === 'object' ? payload : {}
  const id = String(e.id ?? e.agent_id ?? e.agentId ?? installedAgentIdFallback ?? '').trim()
  const name = String(e.display_name ?? e.displayName ?? e.name ?? '').trim() || '未命名'
  const description = String(e.description ?? e.summary ?? e.detailedDescription ?? '').trim()
  const avatar_url = e.avatar_url ?? e.avatarUrl ?? e.avatar ?? ''
  const rawCfg = e.agent_config ?? e.agentConfig
  const agent_config = rawCfg && typeof rawCfg === 'object' ? rawCfg : {}
  const job_title = String(
    e.job_title ?? e.jobTitle ?? e.title ?? e.team_name ?? e.teamName ?? '',
  ).trim()
  return {
    id: id || String(installedAgentIdFallback ?? ''),
    name,
    description,
    avatar_url,
    agent_config,
    job_title,
    cloned_from_agent_id: e.cloned_from_agent_id ?? e.cloned_from ?? e.from_agent_id,
  }
}

/** 协作数字人：agent-usage 列表项兜底（详情接口失败或未返回有效体时使用） */
function buildCollaborationEmployeeAgentInfoFromListItem(emp) {
  if (!emp) return null
  const r = emp.raw && typeof emp.raw === 'object' ? emp.raw : {}
  const desc =
    String(emp.description || '').trim()
    || String(r.description || r.summary || r.agent_description || '').trim()
  return {
    id: emp.id,
    name: String(emp.name || r.agent_display_name || r.agent_name || '').trim() || '未命名',
    description: desc,
    avatar_url: emp.avatar || r.agent_avatar_url || r.agent_avatar || r.icon || '',
    agent_config: r.agent_config || r.agentConfig || {},
    job_title:
      String(emp.title || '').trim()
      || String(r.job_title || r.jobTitle || r.team_name || r.teamName || r.role || '').trim()
      || '',
    cloned_from_agent_id: r.cloned_from_agent_id ?? r.cloned_from,
  }
}

/** 与 loadAgentInfo 一人团队分支一致：用侧栏已加载列表同步出 agentInfo，避免面板打开首帧「未命名」 */
function buildAgentInfoFromEmployeeChatEmployee(emp) {
  if (!emp) return null
  if (emp.raw && typeof emp.raw === 'object') {
    return {
      ...emp.raw,
      id: emp.id,
      name: emp.name ?? emp.raw.name,
      description: emp.description ?? emp.raw.description,
      job_title:
        emp.raw.job_title
        ?? emp.raw.jobTitle
        ?? emp.raw.team_name
        ?? emp.raw.teamName
        ?? emp.title
        ?? '',
    }
  }
  return {
    id: emp.id,
    name: emp.name,
    description: emp.description,
    avatar_url: emp.avatar,
    agent_config: emp.raw?.agent_config ?? {},
    job_title:
      emp.raw?.job_title
      ?? emp.raw?.jobTitle
      ?? emp.raw?.team_name
      ?? emp.raw?.teamName
      ?? emp.title
      ?? '',
  }
}

async function loadAgentInfo() {
  if (!props.agentId) return
  const idStr = String(props.agentId)
  loadingAgent.value = true

  // 切换不同员工时清掉上一份数据，避免短暂串名
  if (String(agentInfo.value?.id ?? '') !== idStr) {
    agentInfo.value = null
  }

  // 列表已有缓存时立即回填（不 await），消除打开数字员工管理时的「未命名」闪现
  if (props.context === 'collaborationEmployee') {
    const emp0 = collaborationEmployeeStore.employeeChatEmployees?.find((e) => String(e.id) === idStr)
    const seeded = buildCollaborationEmployeeAgentInfoFromListItem(emp0)
    if (seeded) agentInfo.value = seeded
  } else if (props.context === 'employee') {
    const emp0 = employeeSessionStore.value.employeeChatEmployees?.find((e) => String(e.id) === idStr)
    const seeded = buildAgentInfoFromEmployeeChatEmployee(emp0)
    if (seeded) agentInfo.value = seeded
  } else {
    // deerflow 分身：从 chatStore.agents 缓存回填，避免面板打开首帧空白
    const cached = chatStore.agents?.find((a) => String(a.id) === idStr)
    if (cached) agentInfo.value = cached
  }

  try {
    if (props.context === 'collaborationEmployee') {
      const estore = collaborationEmployeeStore
      await estore.loadEmployeeItems({ force: false })
      let emp = estore.employeeChatEmployees.find((e) => String(e.id) === String(props.agentId))
      if (!emp) {
        await estore.loadEmployeeItems({ force: true })
        emp = estore.employeeChatEmployees.find((e) => String(e.id) === String(props.agentId))
      }
      const agentIdStr = String(props.agentId ?? '').trim()
      const attempts = []
      const seen = new Set()
      const pushAttempt = (id, marketplace) => {
        const sid = String(id ?? '').trim()
        if (!sid) return
        const key = `${sid}::${marketplace ? '1' : '0'}`
        if (seen.has(key)) return
        seen.add(key)
        attempts.push({ id: sid, marketplace })
      }
      const raw = emp?.raw && typeof emp.raw === 'object' ? emp.raw : {}
      const marketAgentId =
        raw.market_agent_id ?? raw.marketAgentId ?? raw.agent_market_id ?? raw.market_agent?.id
      if (marketAgentId != null && String(marketAgentId).trim() !== '') {
        pushAttempt(marketAgentId, true)
      }
      pushAttempt(agentIdStr, false)
      pushAttempt(agentIdStr, true)

      for (const { id, marketplace } of attempts) {
        try {
          const res = await fetchAgentDetail(id, { marketplace })
          if (res && typeof res === 'object' && (res.id != null || res.display_name || res.name)) {
            agentInfo.value = mapMarketAgentDetailToPersonaAgentInfo(res, props.agentId)
            return
          }
        } catch (err) {
          console.error('[PersonaManagePanel] 协作数字人 agents/detail 失败:', { id, marketplace }, err)
        }
      }
      agentInfo.value = buildCollaborationEmployeeAgentInfoFromListItem(emp)
      return
    }

    if (isEmployeeContext.value) {
      const estore = employeeSessionStore.value
      await estore.loadEmployeeItems({ force: true })
      const emp = estore.employeeChatEmployees.find(
        (e) => String(e.id) === String(props.agentId),
      )
      agentInfo.value = buildAgentInfoFromEmployeeChatEmployee(emp)
      return
    }

    const data = await threadApi.listMyAgents({ stateful: true })
    let allAgents = []
    if (Array.isArray(data)) allAgents = data
    else if (Array.isArray(data?.items)) allAgents = data.items
    else if (Array.isArray(data?.agents)) allAgents = data.agents
    else if (Array.isArray(data?.data)) allAgents = data.data
    else if (Array.isArray(data?.data?.agents)) allAgents = data.data.agents

    agentInfo.value = allAgents.find(a => String(a.id) === String(props.agentId)) ?? null
  } catch (e) {
    console.error('[PersonaManagePanel] 加载智能体信息失败:', e)
    agentInfo.value = null
  } finally {
    loadingAgent.value = false
  }
}

// 从接口数据派生分身展示数据
const personaData = computed(() => {
  const agent = agentInfo.value
  if (!agent) {
    // 拉取中且无列表缓存：不展示「未命名」，避免首帧闪烁（加载结束后仍无数据再回退）
    if (isEmployeeContext.value && loadingAgent.value) {
      return {
        avatar: resolveEmployeeAvatarSrc({}),
        name: '',
        description: '',
      }
    }
    return {
      avatar: isEmployeeContext.value ? resolveEmployeeAvatarSrc({}) : individualImg,
      name: isEmployeeContext.value ? '未命名' : 'Kooky',
      description: isEmployeeContext.value
        ? '暂无描述'
        : '您的专属助理，理解您的目标并智能分配任务。',
    }
  }
  const avatar = isEmployeeContext.value
    ? resolveEmployeeAvatarSrc(agent)
    : resolvePersonaAvatarDisplaySrc(
      agent.avatar || agent.icon || agent.avatar_url || individualImg,
    )
  const nameText = toPersonaDisplayText(agent.name ?? agent.display_name ?? agent.displayName)
  const descText = toPersonaDisplayText(agent.description ?? agent.desc)
  return {
    avatar,
    name: nameText || (isEmployeeContext.value ? '未命名' : 'Kooky'),
    description:
      descText
      || (isEmployeeContext.value ? '暂无描述' : '您的专属助理，理解您的目标并智能分配任务。'),
  }
})

const personaDisplayName = computed(() => toPersonaDisplayText(personaData.value.name))
const personaDisplayDescription = computed(() => toPersonaDisplayText(personaData.value.description))

const personaNameRef = ref(null)
const { isOverflowing: isPersonaNameOverflowing } = useOverflowDetect(personaNameRef, personaDisplayName)

/** 查看模式：职位（API job_title，兼容历史 team_name / title） */
const employeePositionText = computed(() => {
  if (!isEmployeeContext.value) return ''
  const agent = agentInfo.value
  const t = agent?.job_title || agent?.jobTitle || agent?.team_name || agent?.teamName || agent?.title
  return t && String(t).trim() ? String(t).trim() : '专属数字员工'
})

const personaSubtitle = computed(() => {
  if (!isEmployeeContext.value) return '专属助理'
  const pos = employeePositionText.value
  // 员工名本来就常常是岗位名（「产品经理」），再把职位原样重复一遍是噪音
  return pos === personaDisplayName.value ? '' : pos
})

/** 查看态的人设三件套：和编辑表单读同一份 agent_config，空的不出行 */
/**
 * 可选模型档位。
 * ⚠️ demo：真实列表应来自模型接口（对话框那套 chatAvailableModels 是另一份口径，
 * 员工的 llm_model 现在存的是中文档位名，两边没打通）。当前值不在表里就补进去，
 * 免得下拉把人家现有的模型显示成空。
 */
const MODEL_OPTIONS = Object.freeze([
  '星火 X1',
  '星火 4.0 Turbo',
  'Claude Sonnet 4',
  'Claude Opus 4.5',
  'DeepSeek R1',
])

/** 当前默认模型：顶层字段优先，退回 agent_config */
const employeeModelText = computed(() => {
  const info = agentInfo.value || {}
  const cfg = info.agent_config || info.agentConfig || {}
  return String(info.llm_model || cfg.llm_model || '').trim()
})

const modelOptions = computed(() => {
  const cur = employeeModelText.value
  return cur && !MODEL_OPTIONS.includes(cur) ? [cur, ...MODEL_OPTIONS] : [...MODEL_OPTIONS]
})

const personaStyleRows = computed(() => {
  const cfg = agentInfo.value?.agent_config || agentInfo.value?.agentConfig || {}
  return [
    { label: '称呼风格', value: cfg.call_style ?? cfg.callStyle },
    { label: '语言偏好', value: cfg.language_preference ?? cfg.languagePreference },
    { label: '回答语气', value: cfg.tone_style ?? cfg.toneStyle },
  ]
    .map((row) => ({ ...row, value: String(row.value ?? '').trim() }))
    .filter((row) => row.value)
})

/**
 * 助理本体（is_default，agent 9001）：天生在岗、唯一，不提供解聘。
 * 列表项优先（打开面板时就有），接口回来后再用 agentInfo 兜一层。
 */
const isDefaultAssistantAgent = computed(() => {
  const idStr = String(props.agentId ?? '')
  if (!idStr) return false
  const item = employeeSessionStore.value.employeeChatEmployees?.find((e) => String(e.id) === idStr)
  if (item) return Boolean(item.isDefault ?? item.raw?.is_default)
  const a = agentInfo.value
  return Boolean(a?.is_default ?? a?.isDefault)
})

/** 是否可解聘：数字员工、且不是协作数字人、且不是助理本体 */
const canDismissEmployee = computed(
  () => isEmployeeContext.value && !isCollaborationEmployeeContext.value && !isDefaultAssistantAgent.value,
)

/** 是否市场聘用克隆（文案：解聘 vs 移除） */
const isHiredEmployee = computed(() => {
  if (!isEmployeeContext.value) return false
  const a = agentInfo.value
  if (!a) return false
  return Boolean(a.cloned_from_agent_id ?? a.cloned_from)
})

const dismissEmployeeConfirm = reactive({ visible: false })
const removeSkillDialog = reactive({ visible: false, index: null })

const dismissEmployeeConfirmLabel = computed(() => {
  const n = personaData.value?.name
  const s = n != null ? String(n).trim() : ''
  return s || '该员工'
})

const dismissEmployeeConfirmTitle = computed(() => {
  const act = isHiredEmployee.value ? '解聘' : '移除'
  return `确认${act}数字员工「${dismissEmployeeConfirmLabel.value}」吗？`
})

const dismissEmployeeConfirmDesc = computed(() =>
  isHiredEmployee.value
    ? '解聘后，数字员工将不再为您提供服务。'
    : '移除后，数字员工在列表消失。',
)

// 已安装的技能列表
const installedSkills = ref([])
const loadingSkills = ref(false)

async function loadInstalledSkills() {
  loadingSkills.value = true
  try {
    const items = await fetchInstalledSkills({
      agentId: props.agentId,
    })
    installedSkills.value = items
  } catch (e) {
    console.error('[PersonaManagePanel] 加载已安装技能失败:', e)
    installedSkills.value = []
  } finally {
    loadingSkills.value = false
  }
}

// ── 版本更新（员工来自市场，市场有新版本时一键更新；skill 取并集）──
const showUpdateDialog = ref(false)
const updateConfirmData = ref(null)
const employeeUpdatedVersion = ref('')
const employeeUpdatedSkills = ref(null)

const employeeCurrentVersion = computed(
  () => employeeUpdatedVersion.value || agentInfo.value?.version || '',
)
const employeeLatestVersion = computed(() => agentInfo.value?.latestVersion || '')
const hasNewVersion = computed(() =>
  isEmployeeContext.value
  && !!employeeLatestVersion.value
  && employeeLatestVersion.value !== employeeCurrentVersion.value,
)

function unionEmployeeSkills(a, b) {
  const out = []
  const seen = new Set()
  for (const sk of [...(a || []), ...(b || [])]) {
    const key = sk?.slug || sk?.id || sk?.displayName
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(sk)
  }
  return out
}

function handleEmployeeUpdate() {
  const a = agentInfo.value || {}
  updateConfirmData.value = {
    avatar: personaData.value.avatar,
    name: personaData.value.name,
    changelog: a.changelog || '',
  }
  showUpdateDialog.value = true
}

function handleConfirmEmployeeUpdate() {
  const a = agentInfo.value || {}
  const cur = employeeUpdatedSkills.value || a.skills || []
  employeeUpdatedSkills.value = unionEmployeeSkills(cur, a.latestSkills || [])
  employeeUpdatedVersion.value = a.latestVersion || a.version || ''
  ElMessage.success(`已更新到 ${employeeUpdatedVersion.value}`)
}

// agentId / context 变化时重新拉取智能体信息和技能
watch(
  () => [props.agentId, props.context],
  ([id, ctx]) => {
    employeeUpdatedVersion.value = ''
    employeeUpdatedSkills.value = null
    if (ctx === 'collaborationEmployee') {
      isEditing.value = false
    }
    if (id) {
      loadAgentInfo()
    }
    // 分身 context 即使没 agentId 也尝试加载（mock 会 fallback 到 persona-self）
    loadInstalledSkills()
  },
  { immediate: true },
)

// 查看模式：只展示已安装且在 agent_config.enabled_skills 中的技能
const skills = computed(() => {
  // demo：员工版本更新——更新后展示并集；初始用 mock 自带 skills（installedSkills 接口为空时兜底）
  if (isEmployeeContext.value) {
    if (employeeUpdatedSkills.value) return employeeUpdatedSkills.value
    const mock = agentInfo.value?.skills
    if (Array.isArray(mock) && mock.length && !installedSkills.value.length) return mock
  }
  const agent = agentInfo.value
  // 没有 agent 信息时（分身 context、agentId 为 null）直接显示全部已安装 skill
  if (!agent) return installedSkills.value

  const agentConfig = agent.agent_config || {}
  const enabledSkills = agentConfig.enabled_skills

  // enabled_skills 为 null 表示全部启用
  if (enabledSkills === null || enabledSkills === undefined) {
    return installedSkills.value
  }

  // enabled_skills 为数组，只显示在数组中的技能
  if (Array.isArray(enabledSkills)) {
    return installedSkills.value.filter(skill =>
      enabledSkills.includes(skill.slug)
    )
  }

  return []
})

// 编辑模式：独立的技能状态 ref，进入编辑时初始化，开关直接修改这里
const editSkillsState = ref([])

function initEditSkillsState() {
  const agent = agentInfo.value
  const agentConfig = agent?.agent_config || {}
  const enabledSkills = agentConfig.enabled_skills

  editSkillsState.value = installedSkills.value.map(s => ({
    ...s,
    // enabled_skills 为 null/undefined 表示全部启用
    enabled: (enabledSkills === null || enabledSkills === undefined)
      ? true
      : Array.isArray(enabledSkills)
        ? enabledSkills.includes(s.slug)
        : false
  }))
}

const editSkills = computed(() => editSkillsState.value)

// 编辑表单数据
const editFormData = ref({
  avatar: '',
  name: '',
  description: '',
  job_title: '',
  // 人设三件套：存在 agent_config 下（字段名待与后端对齐）
  call_style: '',
  language_preference: '',
  tone_style: '',
  skills: []
})

/** agent_config 里读人设字段（兼容驼峰/下划线两种写法） */
function readPersonaStyle(key, camelKey) {
  const cfg = agentInfo.value?.agent_config || agentInfo.value?.agentConfig || {}
  return String(cfg[key] ?? cfg[camelKey] ?? '')
}

/** 编辑表单头像预览（数字员工与对话区一致用 default_agent；分身仍用原逻辑） */
const editFormAvatarSrc = computed(() => {
  if (isEmployeeContext.value) {
    return resolveEmployeeAvatarSrc({ avatar: editFormData.value.avatar || '' })
  }
  return resolvePersonaAvatarDisplaySrc(editFormData.value.avatar || '')
})

// 面板宽度（初始值可由调用方指定：通讯录用宽版，会话侧栏保持 260 的老手感）
const panelWidth = ref(props.initialWidth || 260)
const minWidth = 260
const maxWidth = 600

// 拖拽状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartWidth = ref(0)

function startDrag(e) {
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartWidth.value = panelWidth.value
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function onDrag(e) {
  if (!isDragging.value) return
  const deltaX = dragStartX.value - e.clientX
  const newWidth = Math.max(minWidth, Math.min(maxWidth, dragStartWidth.value + deltaX))
  panelWidth.value = newWidth
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function handleEdit() {
  if (isCollaborationEmployeeContext.value) return
  editFormData.value = {
    avatar: isEmployeeContext.value
      ? pickEmployeeAvatarRawString(agentInfo.value)
      : personaData.value.avatar,
    name: personaData.value.name,
    description: personaData.value.description,
    job_title: isEmployeeContext.value
      ? employeePositionText.value
      : '',
    llm_model: employeeModelText.value,
    call_style: readPersonaStyle('call_style', 'callStyle'),
    language_preference: readPersonaStyle('language_preference', 'languagePreference'),
    tone_style: readPersonaStyle('tone_style', 'toneStyle'),
  }
  // 初始化技能编辑状态（独立副本，开关修改不影响原始数据）
  initEditSkillsState()
  isEditing.value = true
  activeTab.value = 'basic'
}

function handleCancelEdit() {
  isEditing.value = false
  // 重置表单验证状态
  basicFormRef.value?.resetFields()
}

// 头像上传恢复时取消注释
// function triggerEmployeeAvatarPick() {
//   employeeAvatarInputRef.value?.click()
// }

function buildEmployeeEditPayload(avatarUrl = editFormData.value.avatar) {
  return {
    name: editFormData.value.name,
    description: editFormData.value.description,
    jobTitle: editFormData.value.job_title,
    avatarUrl,
  }
}

/** 人设三件套的载荷（⚠️ 字段名按生产 UI 猜的，接后端时以真实契约为准） */
function buildPersonaStylePayload() {
  return {
    call_style: editFormData.value.call_style || '',
    language_preference: editFormData.value.language_preference || '',
    tone_style: editFormData.value.tone_style || '',
  }
}

/**
 * 数字员工的人设字段落在 agent_config 上（与技能开关同一条路：updatePrivateAgent）。
 * 必须整包合并已有 config，否则会把 enabled_skills 冲掉。
 */
async function savePersonaStyle() {
  if (!props.agentId) return
  const current = agentInfo.value?.agent_config || agentInfo.value?.agentConfig || {}
  const model = String(editFormData.value.llm_model || '').trim()
  await updatePrivateAgent(props.agentId, {
    agentConfig: {
      ...current,
      ...buildPersonaStylePayload(),
      // 默认模型跟人设同走 agent_config（整包合并，别冲掉 enabled_skills）
      ...(model ? { llm_model: model } : {}),
    },
  })
}

// 头像上传恢复时取消注释（含 readImageFileAsDataUrl、onEmployeeAvatarFileChange）
// /** 本地图片转 data URL（Base64），不经文件服务上传 */
// function readImageFileAsDataUrl(file) {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader()
//     reader.onload = () => resolve(String(reader.result || ''))
//     reader.onerror = () => reject(new Error('读取图片失败'))
//     reader.readAsDataURL(file)
//   })
// }
//
// async function onEmployeeAvatarFileChange(event) {
//   const input = event.target
//   const file = input?.files?.[0]
//   if (!file || !isEmployeeContext.value || !props.agentId) {
//     if (input) input.value = ''
//     return
//   }
//
//   const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
//   if (!allowed.includes(file.type)) {
//     ElMessage.error('只支持 PNG、JPEG、WebP 格式的图片')
//     input.value = ''
//     return
//   }
//   const maxSize = 2 * 1024 * 1024
//   if (file.size > maxSize) {
//     ElMessage.error('图片大小不能超过 2MB')
//     input.value = ''
//     return
//   }
//
//   const prevAvatar = editFormData.value.avatar
//   employeeAvatarUploading.value = true
//   saving.value = true
//   try {
//     const dataUrl = await readImageFileAsDataUrl(file)
//     if (!dataUrl.startsWith('data:image/')) {
//       throw new Error('无效的图片数据')
//     }
//     editFormData.value.avatar = dataUrl
//     await employeeSessionStore.value.updateEmployeeDetails(props.agentId, buildEmployeeEditPayload(dataUrl))
//     await loadAgentInfo()
//     ElMessage.success('头像已更新')
//   } catch (e) {
//     console.error('[PersonaManagePanel] 头像保存失败:', e)
//     editFormData.value.avatar = prevAvatar
//     ElMessage.error(soloTeamApiErrorMessage(e, '头像保存失败，请重试'))
//   } finally {
//     employeeAvatarUploading.value = false
//     saving.value = false
//     input.value = ''
//   }
// }

// 保存基本信息（名称/描述校验通过后调用）
async function saveBasicInfo() {
  if (!basicFormRef.value || !props.agentId) return
  try {
    await basicFormRef.value.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (isEmployeeContext.value) {
      await employeeSessionStore.value.updateEmployeeDetails(props.agentId, buildEmployeeEditPayload())
      await savePersonaStyle()
    } else {
      await threadApi.updateAgent(Number(props.agentId), {
        name: editFormData.value.name,
        description: editFormData.value.description || null,
        ...buildPersonaStylePayload(),
      })
    }
    await loadAgentInfo()

    // 同步更新 chatStore 中的 agents 数组，确保消息列表中的助手名字实时更新
    if (!isEmployeeContext.value && agentInfo.value) {
      const index = chatStore.agents.findIndex(a => a.id === agentInfo.value.id)
      if (index !== -1) {
        chatStore.agents[index] = { ...chatStore.agents[index], ...agentInfo.value }
      }
    }
  } catch (e) {
    console.error('[PersonaManagePanel] 保存基本信息失败:', e)
    ElMessage.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

// 保存技能启用状态（开关切换后调用）
async function saveSkillEnabled(skill) {
  if (!props.agentId) return
  saving.value = true
  try {
    const enabledSlugs = editSkillsState.value
      .filter(s => s.enabled === true)
      .map(s => s.slug)
      .filter(Boolean)
    if (isEmployeeContext.value) {
      await updatePrivateAgent(props.agentId, {
        agentConfig: { enabled_skills: enabledSlugs },
      })
    } else {
      await threadApi.updateAgent(Number(props.agentId), {
        agent_config: { enabled_skills: enabledSlugs },
      })
    }
    await Promise.all([loadAgentInfo(), loadInstalledSkills()])
  } catch (e) {
    console.error('[PersonaManagePanel] 保存技能状态失败:', e)
    ElMessage.error('保存失败，请重试')
    skill.enabled = !skill.enabled
  } finally {
    saving.value = false
  }
}

function updateAddSkillDropdownPosition() {
  const el = addSkillTriggerRef.value || addSkillWrapperRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const dropdownWidth = 300
  let left = rect.left
  if (left + dropdownWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - dropdownWidth - 8)
  }
  addSkillDropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${left}px`,
    width: `${dropdownWidth}px`,
    zIndex: 4000,
  }
}

let addSkillDropdownPositionRaf = null
function scheduleAddSkillDropdownPosition() {
  if (!showAddSkillMenu.value) return
  if (addSkillDropdownPositionRaf != null) {
    cancelAnimationFrame(addSkillDropdownPositionRaf)
  }
  addSkillDropdownPositionRaf = requestAnimationFrame(() => {
    addSkillDropdownPositionRaf = null
    updateAddSkillDropdownPosition()
  })
}

function toggleAddSkillMenu() {
  if (!showAddSkillMenu.value) {
    showAddSkillMenu.value = true
    nextTick(scheduleAddSkillDropdownPosition)
    return
  }
  showAddSkillMenu.value = false
}

watch(showAddSkillMenu, (open) => {
  if (open) nextTick(scheduleAddSkillDropdownPosition)
})

function closeAddSkillMenu() {
  showAddSkillMenu.value = false
}

function handleAddFromMarket() {
  closeAddSkillMenu()
  showSkillMarketDialog.value = true
}

function handleUploadSkill() {
  closeAddSkillMenu()
  showSkillUploadDialog.value = true
}

async function handleCreateByChat() {
  closeAddSkillMenu()
  const estore = isEmployeeContext.value ? employeeSessionStore.value : soloTeamStore
  let target = buildPersonaSkillCreatorTarget({
    context: props.context,
    currentEmployeeId: estore.currentEmployeeId,
    currentEmployeeThreadId: estore.currentEmployeeThreadId,
  })

  if (target.needsEmployeeSelection) {
    const picked = await employeeSessionStore.value.selectFirstEmployeeConversation()
    if (!picked?.employeeId || !picked?.threadId) {
      ElMessage.warning('请先创建或选择一个员工会话')
      return
    }
    target = buildPersonaSkillCreatorTarget({
      context: props.context,
      currentEmployeeId: picked.employeeId,
      currentEmployeeThreadId: picked.threadId,
    })
  }

  uiStore.setActiveNavigation(target.primaryNav, target.secondaryNav ?? undefined)

  if (isEmployeeContext.value) {
    employeeSessionStore.value.setEmployeePendingPrefillText(target.prefillText)
    return
  }

  chatStore.pendingPrefillText = target.prefillText
}

// 技能安装成功后刷新列表
async function onSkillInstalled() {
  await Promise.all([loadAgentInfo(), loadInstalledSkills()])
  initEditSkillsState()
}

// 点击外部关闭下拉菜单
function handleClickOutside(e) {
  const target = e.target
  if (addSkillWrapperRef.value?.contains(target)) return
  if (addSkillDropdownRef.value?.contains(target)) return
  closeAddSkillMenu()
}

async function updateSkill(skill) {
  if (!props.agentId || !skill.slug || !skill.version) return
  saving.value = true
  try {
    await installSkillToAgent(skill.slug, props.agentId, { version: skill.version })
    await Promise.all([loadAgentInfo(), loadInstalledSkills()])
    initEditSkillsState()
    ElMessage.success('更新成功')
  } catch (e) {
    console.error('[PersonaManagePanel] 更新技能失败:', e)
    ElMessage.error('更新失败，请重试')
  } finally {
    saving.value = false
  }
}

async function removeSkill(index) {
  const skill = editSkillsState.value[index]
  if (!skill || !props.agentId) return

  removeSkillDialog.visible = true
  removeSkillDialog.index = index
}

function cancelRemoveSkill() {
  removeSkillDialog.visible = false
  removeSkillDialog.index = null
}

async function confirmRemoveSkill() {
  const index = removeSkillDialog.index
  cancelRemoveSkill()
  if (index === null) return

  const skill = editSkillsState.value[index]
  if (!skill || !props.agentId) return

  saving.value = true
  try {
    const isOwned = skill.scope === 'private'
    if (isOwned) {
      await deleteSkill(skill.slug, props.agentId)
    } else {
      await unbindSkillFromAgent(skill.slug, props.agentId)
    }

    await Promise.all([loadAgentInfo(), loadInstalledSkills()])
    // 刷新编辑状态，确保列表更新
    initEditSkillsState()
    ElMessage.success('移除成功')
  } catch (e) {
    console.error('[PersonaManagePanel] 移除技能失败:', e)
    ElMessage.error('移除失败，请重试')
  } finally {
    saving.value = false
  }
}

function openDismissEmployeeConfirmDialog() {
  if (isCollaborationEmployeeContext.value) return
  if (!props.agentId || !isEmployeeContext.value || dismissLoading.value) return
  dismissEmployeeConfirm.visible = true
}

function cancelDismissEmployeeConfirmDialog() {
  dismissEmployeeConfirm.visible = false
}

async function confirmDismissEmployee() {
  if (isCollaborationEmployeeContext.value) return
  if (!props.agentId || !isEmployeeContext.value || dismissLoading.value) return
  const hired = isHiredEmployee.value
  cancelDismissEmployeeConfirmDialog()
  dismissLoading.value = true
  try {
    await employeeSessionStore.value.removeEmployee(props.agentId)
    ElMessage.success(hired ? '解聘成功' : '移除成功')
    isEditing.value = false
    handleClose()
    if (props.context === 'collaborationEmployee') {
      // 协作数字人：removeEmployee 内已处理导航与会话切换
      return
    }
    if (soloTeamStore.isEmployeeChatActive && soloTeamStore.currentEmployeeNavKey) {
      uiStore.setActiveNavigation(
        'solo-team',
        soloTeamStore.currentEmployeeNavKey,
      )
    } else {
      const teamId = soloTeamStore.currentTeamId
      uiStore.setActiveNavigation('solo-team', teamId ? `team:${teamId}` : null)
    }
  } catch (e) {
    console.error('[PersonaManagePanel] 解聘失败:', e)
    ElMessage.error(e?.response?.data?.detail || e?.message || '操作失败，请稍后重试')
  } finally {
    dismissLoading.value = false
  }
}

async function handleClose() {
  // 编辑模式下若输入框处于激活状态，先保存再关闭（避免点击叉号时丢失未保存的修改）
  if (isEditing.value) {
    const active = document.activeElement
    const root = basicFormRef.value?.$el
    if (active && root && root.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      active.blur()
      await saveBasicInfo()
    }
  }
  if (props.embedded) {
    emit('close')
    return
  }
  if (isEmployeeContext.value) {
    uiStore.digitalEmployeePanelVisible = false
  } else {
    uiStore.personaPanelVisible = false
  }
  uiStore.activeToolTab = null
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', scheduleAddSkillDropdownPosition)
  window.addEventListener('scroll', scheduleAddSkillDropdownPosition, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', scheduleAddSkillDropdownPosition)
  window.removeEventListener('scroll', scheduleAddSkillDropdownPosition, true)
  if (addSkillDropdownPositionRaf != null) {
    cancelAnimationFrame(addSkillDropdownPositionRaf)
    addSkillDropdownPositionRaf = null
  }
  cancelDismissEmployeeConfirmDialog()
  if (isDragging.value) {
    stopDrag()
  }
})
</script>

<style lang="scss" scoped>
@use '@/modules/solo-team/styles/cancel-button.scss' as cancel-btn;
@use '@/shared/styles/delete-confirm-dialog.scss' as delete-confirm;

.persona-manage-panel {
  display: flex;
  flex-shrink: 0;
  height: 100%;
  background: #F4F5F5;
  overflow: visible;
  box-sizing: border-box;
  position: relative;
  z-index: 3;
}
.persona-manage-panel.is-embedded {
  width: 100%;
  flex: 1;
}

/* 拖拽分割线时禁止子元素触发鼠标事件，防止卡顿（保留左侧拖拽条可响应） */
.persona-manage-panel.is-dragging *:not(.left-divider):not(.left-divider *) {
  pointer-events: none !important;
  user-select: none !important;
}

/* 左侧分割线：handle 向左突出，层级高于对话框 */
.left-divider {
  overflow: visible;
  z-index: 1600;
}

.left-divider .divider-handle {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1600;
}

/* 分割线 */
.divider {
  position: relative;
  width: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  z-index: 10;
  background: var(--bg-primary);
  margin-bottom: 10px;
  margin-top: 5px;
}

.divider-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: transparent;
  transition: background 0.15s;
}

.divider-line.dragging {
  background: linear-gradient(
    180deg,
    rgba(67, 111, 246, 0) 0%,
    rgba(67, 111, 246, 0.6) 21%,
    #436FF6 51%,
    rgba(67, 111, 246, 0.6) 82%,
    rgba(67, 111, 246, 0) 100%
  );
}

.divider:hover .divider-line {
  background: #E8EBF0;
}

.divider-handle {
  position: relative;
  z-index: 1;
  width: 16px;
  height: 32px;
  background: #fff;
  border: 1px solid #E8EBF0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
}

.drag-icon {
  width: 14px;
  height: 21.58px;
  object-fit: contain;
}

.drag-icon-hover {
  display: none;
}

.divider:hover .divider-handle {
  opacity: 1;
}

.divider-handle.dragging {
  opacity: 1;
  border-color: #436FF6;
  box-shadow: 0 0 0 2px rgba(67, 111, 246, 0.15);
}

.divider-handle.dragging .drag-icon-default {
  display: none;
}

.divider-handle.dragging .drag-icon-hover {
  display: block;
}

.panel-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  flex-direction: column;
  padding: 0;
  box-sizing: border-box;
  margin-right: 8px;
  border-radius: 12px;
  position: relative;
}

.panel-body-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* 查看/编辑纵向栈：分身模式铺满滚动区；数字员工模式叠加 employee-manage-card */
.persona-view-stack,
.persona-edit-stack {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.employee-manage-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

/* 数字员工：标题 + 可滚动内容 + 底部解聘同属一张白卡 */
.employee-manage-card .persona-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-radius: 0;
}

.employee-manage-card .edit-tabs {
  flex-shrink: 0;
}

.employee-manage-card .edit-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 20px;
}

/* 数字员工：底栏与白底标题栏一致，始终贴在面板底部；滚动区在上 */
.persona-employee-footer {
  flex-shrink: 0;
  padding: 0;
  background: #fff;
  border-radius: 0;
  overflow: hidden;
}

.persona-employee-footer .dissolve-btn {
  width: 100%;
  // height: 44px;
  margin: 0;
  padding: 10px 16px 22px;
  border: none;
  border-radius: 0;
  box-sizing: border-box;
  background: #fff;
  color: #ED4543;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.persona-employee-footer .dissolve-btn:hover:not(:disabled) {
  background: rgba(31, 180, 73, 0.3);
}

.persona-employee-footer .dissolve-btn:active:not(:disabled) {
  background: rgba(31, 180, 73, 0.3);
}

.persona-employee-footer .dissolve-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background: #fff;
}

.saving-mask {
  position: absolute;
  inset: 0;
  z-index: 100;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #436FF6;
}

.panel-header {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  /* flex-start + header-actions margin-left:auto：查看模式标题居左；编辑模式「编辑」紧跟返回，不再被撑到中间 */
  justify-content: flex-start;
  gap: 0;
  padding: 0 12px 0 16px;
  flex-shrink: 0;
  background: #fff;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #2F3547;
}

.header-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.header-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
  flex-shrink: 0;
  color: #6b7280;

  &:hover {
    background: rgba(47, 53, 71, 0.06);
  }

  img {
    display: block;
  }

  svg {
    display: block;
  }
}

.back-btn {
  margin-right: 8px;
}

.persona-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 16px;
  background: #fff;
  border-radius: 0px 0px 12px 12px;
}

.persona-card {
  display: flex;
  align-items: center;
  gap: 12px;
  // padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
  min-width: 0;
}

.persona-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #fff;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.persona-info {
  flex: 1;
  min-width: 0;

  :deep(.el-tooltip__trigger) {
    display: block;
    max-width: 100%;
    min-width: 0;
  }
}

.persona-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.persona-subtitle {
  font-size: 13px;
  margin: 0;
  opacity: 0.9;
}

.persona-update-btn {
  margin-left: auto;
  align-self: center;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border: 0.5px solid #ffe0a3;
  border-radius: 999px;
  background: #fff7e6;
  color: #d48806;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #ffefd0;
  }
}

.persona-update-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #faad14;
  flex-shrink: 0;
}

.persona-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #2F3547;
  margin: 0 0 12px;
}

.section-content {
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
  margin: 0;
}

.section-content--wrap {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* 查看态的人设三件套：窄侧栏里也不能挤，label 固定宽、value 自己换行 */
.persona-style-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.persona-style-row {
  display: flex;
  gap: 10px;
  font-size: 13px;
  line-height: 1.6;
}

.persona-style-label {
  flex: none;
  width: 56px;
  color: #9aa0ad;
}

.persona-style-value {
  flex: 1;
  min-width: 0;
  color: #6b7280;
  word-break: break-word;
}

/* 查看态的记忆：只读列表，跟编辑态的条目视觉对齐 */
.memory-view-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memory-view-item {
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
  background: #f7f8fa;
  border-radius: 8px;
  word-break: break-word;
}

.skills-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.skill-loading-icon {
  width: 48px;
  height: 48px;
}

.skills-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.skill-card {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(247, 248, 250, 0.8);
  border-radius: 12px;
  transition: all 0.2s;
  min-width: 0;
  overflow: hidden;
}

.skill-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #fff;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-size: 14px;
  font-weight: 500;
  color: #2f3547;
  margin: 0 0 4px;
}

.skill-desc {
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* 编辑模式样式 */
.edit-tabs {
  background: #fff;
}

.edit-tabs-title {
  display: inline-flex;
  padding: 4px 8px;
  background: #f5f6f9;
  height: 32px;
  border-radius: 8px;
  margin-left: 12px;
  gap: 4px;
  white-space: nowrap;
}

.tab-btn {
  padding: 4px 12px;
  line-height: 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    color: #2f3547;
  }

  &.active {
    color: #FF6B2C;
    font-weight: 500;
    background: #fff;
  }
}

.edit-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px 80px;
  background: #fff;
}

.tab-panel {
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ====== 记忆 tab ====== */
.memories-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 4px;
}

.memory-add-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 18px;
  border-radius: 18px;
  background: #1d1f2c;
  color: #ffffff;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.05s;
}
.memory-add-btn:hover { background: #2b3142; }
.memory-add-btn:active { transform: scale(0.98); }
.memory-add-plus {
  font-size: 16px;
  line-height: 1;
  margin-top: -1px;
}

.memory-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #86909c;
  line-height: 18px;
}
.memory-hint-icon {
  color: #7c5bff;
  font-size: 14px;
  line-height: 1;
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.memory-item {
  position: relative;
  padding: 12px 14px;
  background: #f5f6f9;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.memory-item:hover {
  background: #eef0f5;
  border-color: #e2e5ed;
}
.memory-item:hover .memory-delete {
  opacity: 1;
  pointer-events: auto;
}

.memory-body {
  font-size: 13px;
  line-height: 22px;
  color: #2f3547;
  white-space: pre-wrap;
  word-break: break-word;
  padding-right: 28px;
}

.memory-delete {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #86909c;
  border-radius: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}
.memory-delete:hover {
  background: #ffffff;
  color: #f5524d;
}

.memory-empty {
  padding: 28px 16px;
  text-align: center;
  font-size: 13px;
  color: #c1c5cf;
  background: #fafbfc;
  border-radius: 10px;
  border: 1px dashed #e5e7eb;
}

/* 详情页 readonly 模式 */
.section-title-hint {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #86909c;
}
.memory-list--readonly {
  margin-top: 4px;
}
.memory-item--readonly {
  cursor: default;
}
.memory-item--readonly:hover {
  background: #f5f6f9;
  border-color: transparent;
}

.form-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

/* Element Plus 表单样式覆盖 */
.persona-form {
  :deep(.el-form-item__label) {
    font-size: 13px;
    color: #6b7280;
    padding: 0;
    margin-bottom: 8px;
  }

  :deep(.el-input__wrapper) {
    border-radius: 8px;
    box-shadow: 0 0 0 1px #e5e7eb inset;
    transition: all 0.2s;

    &:hover {
      box-shadow: 0 0 0 1px #d1d5db inset;
    }
  }

  :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px #FF6B2C inset;
  }

  :deep(.el-textarea__inner) {
    border-radius: 8px;
    // border: 1px solid #e5e7eb;
    transition: all 0.2s;
    font-family: inherit;

    &:hover {
      border-color: #d1d5db;
    }

    &:focus {
      border-color: #FF6B2C;
      // box-shadow: 0 0 0 3px rgba(255, 107, 44, 0.1);
    }
  }

  :deep(.el-input__count) {
    background: transparent;
    font-size: 12px;
    color: #9ca3af;
  }

  :deep(.el-form-item.is-error .el-input__wrapper) {
    box-shadow: 0 0 0 1px #ef4444 inset;
  }

  :deep(.el-form-item.is-error .el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px #ef4444 inset, 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  :deep(.el-form-item.is-error .el-textarea__inner) {
    border-color: #ef4444;

    &:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
  }

  :deep(.el-form-item__error) {
    font-size: 12px;
    padding-top: 4px;
  }
}

.avatar-upload {
  display: flex;
  align-items: flex-start;
}

/* 头像上传交互样式：与模板中上传区块一并恢复
.avatar-upload__click-wrap {
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  outline: none;

  &:focus-visible {
    box-shadow: 0 0 0 2px rgba(47, 53, 71, 0.35);
  }

  &.is-busy {
    cursor: wait;
    pointer-events: none;
  }

  &:not(.is-busy):hover .avatar-upload__hover-icon {
    opacity: 1;
  }
}

.avatar-upload__file-input {
  display: none;
}

.avatar-upload__hover-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.avatar-upload__upload-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.55)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.35));
}

.avatar-upload__busy {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.72);
  font-size: 22px;
  color: #2f3547;
}
*/

.avatar-preview {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
  display: block;
}

.add-skill-wrapper {
  position: relative;
  margin-bottom: 16px;
  /* 收缩为按钮宽度，下拉层锚定在按钮正下方（避免全宽 flex + translateX 与 Transition transform 冲突导致从右侧「弹出」） */
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  vertical-align: top;
}

.add-skill-header-btn {
  padding: 6px 10px;
  border: none;
  background: #2f3547;
  border-radius: 8px;
  font-size: 14px;
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
  &:hover {
    background: #1e2535;
  }
}

.add-skill-dropdown {
  box-sizing: border-box;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.add-skill-dropdown--teleport {
  width: 300px;
  max-width: min(300px, calc(100vw - 16px));
}

.dropdown-item {
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 12px;

  &:hover {
    background: #f9fafb;
  }
}

.dropdown-item-icon {
  flex-shrink: 0;
}

.dropdown-item-text {
  flex: 1;
  min-width: 0;
}

.dropdown-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #2f3547;
  margin-bottom: 4px;
}

.dropdown-item-desc {
  font-size: 12px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  max-width: 100%;
}

.dropdown-item-text :deep(.el-tooltip__trigger) {
  display: block;
  min-width: 0;
  max-width: 100%;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.skill-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  gap: 6px;
  &:last-child {
    border-bottom: none;
  }

  &:hover .delete-btn {
    opacity: 1;
  }
}

.skill-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.skill-item-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f3f4f6;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.skill-item-info {
  flex: 1;
  min-width: 0;
}

.skill-item-name {
  font-size: 14px;
  font-weight: 500;
  color: #2f3547;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.skill-item-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.skill-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: #fff3e0;
  color: #ff9800;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}

.skill-update-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  line-height: 1;
  vertical-align: middle;

  img {
    display: block;
  }

  &:hover {
    opacity: 0.75;
  }
}

.skill-item-desc {
  font-size: 12px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-item-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.skill-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;

  &:hover {
    background: rgba(47, 53, 71, 0.06);
    color: #2f3547;
  }

  &.delete-btn {
    opacity: 0;
  }

  &.delete-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
}

.skill-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.skill-switch-input {
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + .skill-switch-slider {
    background-color: #2f3547;
  }

  &:checked + .skill-switch-slider:before {
    transform: translateX(20px);
  }
}

.skill-switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e7eb;
  transition: 0.3s;
  border-radius: 24px;

  &:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
}

/* 与 EmployeeChatSessionHeader「移除会话」确认弹框一致 */
.delete-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-dialog {
  position: relative;
  width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 24px 24px 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
}

.delete-dialog--dismiss {
  box-sizing: border-box;
  width: 480px;
  height: 172px;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 16px;

  @include delete-confirm.delete-dialog-header-row;

  .delete-dialog-desc {
    flex: 1;
    margin: 0 0 0 28px;
    line-height: 1.5;
  }

  .delete-dialog-footer {
    flex-shrink: 0;
    margin-top: auto;
  }
}

.delete-dialog-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.delete-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  word-break: break-word;
}

.delete-dialog-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 20px 28px;
  line-height: 1.6;
}

.delete-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.delete-dialog-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
  &:hover {
    opacity: 0.85;
  }
}

/* 解聘确认框：取消按钮白底描边（与一人团队取消按钮一致） */
.delete-dialog--dismiss .delete-dialog-btn--cancel {
  @include cancel-btn.solo-team-cancel-button;
}

.delete-dialog-btn--confirm {
  background: #1f2937;
  color: #fff;
}
</style>

<style>
.skill-desc-tooltip.el-popper {
  max-width: 480px;
  word-break: break-all;
}
</style>

<style lang="scss" scoped>
@use '@/shared/styles/delete-confirm-dialog.scss' as delete-confirm;

/* 移除 Skill 确认弹框样式（与对话删除弹框对齐） */
.delete-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-dialog--remove-skill {
  position: relative;
  width: 480px;
  background: #fff;
  border-radius: 12px;
  padding: 24px 24px 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);

  @include delete-confirm.delete-dialog-header-row;
}

.delete-dialog-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.delete-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.delete-dialog-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 20px 28px;
  line-height: 1.6;
}

.delete-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.delete-dialog-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
  &:hover { opacity: 0.85; }
}

.delete-dialog-btn--cancel {
  background: #f3f4f6;
  color: #374151;
}

.delete-dialog-btn--confirm {
  background: #1f2937;
  color: #fff;
}
</style>
