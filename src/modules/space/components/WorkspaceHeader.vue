<template>
  <header class="workspace-header" :class="{ 'workspace-header--group': isGroupSpaceContext }">
    <!-- 群组：左对齐团队信息 + 右侧入口 -->
    <template v-if="isGroupSpaceContext">
      <div class="header-left header-left--group">
        <span class="team-name">{{ headerSpaceLabel }}</span>
      </div>
      <div class="header-right">
        <!-- 统一会话侧区功能按钮（群管理/任务/文件预览）——群管理已并入此处 -->
        <ModuleAsideButtons />
      </div>
    </template>

    <!-- 非群组：保持居中标题 -->
    <template v-else>
      <div class="header-left header-left--spacer">
        <span v-if="isDeerflowNav" style="font-size: 14px;">会话</span>
      </div>
      <div class="header-center">
        <!-- <span class="space-name">{{ headerSpaceLabel }}</span> -->
      </div>
      <div class="header-right">
        <!-- 统一会话侧区按钮：分身出 管理/文件预览；市场/社区注册表为空则不显示 -->
        <ModuleAsideButtons />
        <!-- 文件入口（我的分身中隐藏） -->
        <!-- <el-tooltip
          v-if="!isDeerflowNav"
          content="文件"
          placement="bottom"
          effect="dark"
          append-to="#app"
          strategy="fixed"
          :popper-options="workspaceHeaderTooltipPopperOptions"
        >
          <button
            type="button"
            class="icon-btn"
            :class="{ active: isFileTabActive }"
            aria-label="文件"
            @click="uiStore.setActiveToolTab('file')"
          >
            <SvgIcon name="icon-wenjian" :size="16" color="#2F3547" />
          </button>
        </el-tooltip> -->
      </div>
    </template>
  </header>

</template>

<script setup>
import { computed } from 'vue'
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import ModuleAsideButtons from '@/modules/space/components/ModuleAsideButtons.vue'
import { ROOM_TYPES } from '@/shared/im-client'
import folderIcon from '@/assets/home/folder.svg'
import folderOpenedIcon from '@/assets/home/opened.svg'
import personSetIcon from '@/assets/deerflowChat/person_set.svg'

const groupStore = useGroupStore()
const uiStore = useUIStore()

/** Win：减轻 hover 时 Popper 顶到视口边缘触发的滚动条/布局闪动（不用 html scrollbar-gutter） */
const workspaceHeaderTooltipPopperOptions = Object.freeze({
  modifiers: [{ name: 'preventOverflow', options: { padding: 10 } }],
})

const headerSpaceLabel = computed(() => {
  const r = groupStore.conversations.find((x) => x.conversationId === groupStore.currentSpaceId)
  const n = r?.name && String(r.name).trim() ? String(r.name).trim() : groupStore.currentSpaceId
  return n
})

const isDeerflowNav = computed(() => uiStore.activePrimaryNav === 'deerflow')

const isGroupSpaceContext = computed(() => {
  if (isDeerflowNav.value) return false
  const r = groupStore.conversations.find((x) => x.conversationId === groupStore.currentSpaceId)
  return r?.createRoomType === ROOM_TYPES.GROUP_CHAT
})

// 成员列表不在切会话时拉取；打开团队管理右侧栏时触发 loadConversationMembers

const isFileTabActive = computed(
  () => uiStore.activeToolTab === 'file' && !uiStore.fileTreeCollapsed
)

const folderIconSrc = computed(() =>
  isFileTabActive.value ? folderIcon : folderIcon
)

function toggleTeamManagePanel() {
  uiStore.toggleGroupRosterTab('manage')
  const conversationId = groupStore.currentSpaceId
  if (conversationId) groupStore.loadConversationMembers(conversationId, { force: true })
}
</script>

<style scoped>
.workspace-header {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  user-select: none;
  position: relative;
  /* z-index: 100; */
}

.workspace-header--group {
  justify-content: space-between;
  background: transparent;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  min-width: 0;
  position: relative;
  z-index: 100;
}

.header-left--spacer,
.header-right--spacer {
  min-width: 80px;
}

.header-left--group {
  flex: 1;
  min-width: 0;
  gap: 8px;
  align-items: center;
}

.team-name {
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  display: flex;
  align-items: center;
  letter-spacing: normal;
  color: #2F3547;
  min-width: 0;
  max-width: min(360px, 42vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  justify-content: flex-end;
  gap: 6px;
  flex-shrink: 0;
  margin-top: 0;
}

.header-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.space-name {
  font-family: 'PingFang SC', system-ui, sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  display: flex;
  align-items: center;
  color: #2f3547;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: #91949e;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  /* background: var(--bg-tertiary, #F0F2F5); */
  background: rgba(47, 53, 71, 0.06);
  color: var(--text-primary);
}

.icon-btn.active {
  /* background: var(--accent-light, #EBF3FF); */
  background: rgba(47, 53, 71, 0.06);
  color: var(--accent);
}

.file-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  display: block;
}

.person-set-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  display: block;
}
</style>
