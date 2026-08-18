<template>
  <aside
    ref="workbenchRef"
    class="collaboration-b-workbench"
    :class="{ 'is-dragging': dragging }"
    :style="workbenchStyle"
    :aria-label="`${outerTitle}区域`"
  >
    <div
      class="workbench-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="调整对话与右侧区域宽度"
      @mousedown.prevent="startDrag"
    ></div>

    <header class="workbench-header" :class="{ 'is-project': isProjectArea }">
      <nav v-if="isProjectArea" class="project-segments" aria-label="项目视图">
        <button
          v-for="tab in projectTabs"
          :key="tab.key"
          type="button"
          class="project-segment"
          :class="{ active: activeTab === tab.key }"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>
      <h2 v-else class="workbench-title is-file">{{ outerTitle }}</h2>

      <button type="button" class="workbench-close" :aria-label="`收起${outerTitle}区域`" @click="closeWorkbench">
        <svg viewBox="0 0 24 24" fill="none"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </header>

    <div class="workbench-body">
      <ProjectOverviewPanel
        v-show="activeTab === 'project'"
        embedded
        :conversation-id="conversationId"
        class="workbench-panel"
        @close="closeWorkbench"
        @navigate-tab="selectTab"
      />
      <ProjectTaskBoardPanel
        v-show="activeTab === 'board'"
        :conversation-id="conversationId"
        class="workbench-panel"
        @open-workflow="openWorkflow"
        @request-start-workflow="requestStartWorkflow"
      />
      <CollabGroupTasksPanel
        v-show="activeTab === 'tasks'"
        embedded
        display-mode="split"
        :conversation-id="conversationId"
        :reveal-request="taskRevealRequest"
        class="workbench-panel"
        @close="closeWorkbench"
        @request-collapse="closeWorkbench"
      />
      <CollabConversationFilesPanel
        v-show="activeTab === 'files'"
        embedded
        :conversation-id="conversationId"
        :preview-request="previewRequest"
        class="workbench-panel"
        @close="closeWorkbench"
        @preview-change="handlePreviewChange"
      />
    </div>
  </aside>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import ProjectOverviewPanel from '@/modules/collaboration/components/ProjectOverviewPanel.vue'
import ProjectTaskBoardPanel from '@/modules/collaboration-b/components/ProjectTaskBoardPanel.vue'
import CollabGroupTasksPanel from '@/modules/collaboration/components/CollabGroupTasksPanel.vue'
import CollabConversationFilesPanel from '@/modules/collaboration/components/CollabConversationFilesPanel.vue'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { useCollaborationBWorkbenchStore } from '@/modules/collaboration-b/store/workbenchStore'

defineOptions({ name: 'CollaborationBWorkbench' })

const props = defineProps({
  conversationId: { type: String, required: true },
})
const emit = defineEmits(['request-start-workflow'])

const workbenchStore = useCollaborationBWorkbenchStore()
const taskStore = useCollabTaskStore()
const workbenchRef = ref(null)
const dragging = ref(false)
let dragStartX = 0
let dragStartWidth = 0

const projectTabs = Object.freeze([
  { key: 'project', label: '概览' },
  { key: 'board', label: '事项' },
  { key: 'tasks', label: '协作任务' },
])

const activeTab = computed(() => workbenchStore.activeTab(props.conversationId))
const isProjectArea = computed(() => ['project', 'board', 'tasks'].includes(activeTab.value))
const outerTitle = computed(() => isProjectArea.value ? '项目' : '文件')
const previewRequest = computed(() => workbenchStore.previewRequest(props.conversationId))
const taskRevealRequest = computed(() => workbenchStore.taskRevealRequest(props.conversationId))
const workbenchStyle = computed(() => {
  const saved = workbenchStore.width(props.conversationId)
  return { width: saved ? `${saved}px` : '58%' }
})

function selectTab(tab) {
  workbenchStore.setTab(props.conversationId, tab)
}

function openWorkflow(taskId) {
  const task = taskStore.tasks[taskId]
  if (!task || String(task.conversationId) !== String(props.conversationId)) return
  taskStore.setActiveTask(props.conversationId, taskId)
  taskStore.toggleDetailPanel(props.conversationId, true)
  workbenchStore.openTask(props.conversationId, taskId)
}

function requestStartWorkflow(matter) {
  emit('request-start-workflow', matter)
}

function closeWorkbench() {
  workbenchStore.close(props.conversationId)
}

function handlePreviewChange(file) {
  if (!file) workbenchStore.clearPreview(props.conversationId)
}

function startDrag(event) {
  const el = workbenchRef.value
  if (!el) return
  dragging.value = true
  dragStartX = event.clientX
  dragStartWidth = el.getBoundingClientRect().width
  window.addEventListener('mousemove', handleDrag)
  window.addEventListener('mouseup', endDrag)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleDrag(event) {
  if (!dragging.value) return
  const hostWidth = workbenchRef.value?.parentElement?.getBoundingClientRect().width || window.innerWidth
  const minimum = Math.min(420, Math.max(340, hostWidth * 0.48))
  const maximum = Math.max(minimum, hostWidth - 340)
  const next = Math.min(maximum, Math.max(minimum, dragStartWidth + dragStartX - event.clientX))
  workbenchStore.setWidth(props.conversationId, next)
}

function endDrag() {
  dragging.value = false
  window.removeEventListener('mousemove', handleDrag)
  window.removeEventListener('mouseup', endDrag)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onBeforeUnmount(endDrag)
</script>

<style scoped>
.collaboration-b-workbench {
  position: relative;
  min-width: min(420px, 58%);
  max-width: calc(100% - 340px);
  height: 100%;
  min-height: 0;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid #e9ebef;
  background: #fff;
  transition: width .24s cubic-bezier(.22, 1, .36, 1);
}
.collaboration-b-workbench.is-dragging { transition: none; }
.workbench-resizer { position: absolute; left: -3px; top: 0; bottom: 0; width: 7px; z-index: 8; cursor: col-resize; }
.workbench-resizer:hover,
.collaboration-b-workbench.is-dragging .workbench-resizer { background: linear-gradient(90deg, transparent, rgba(255,98,31,.65), transparent); }
.workbench-header { height: 54px; min-height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 12px 0 18px; border-bottom: 1px solid #eff0f2; box-sizing: border-box; }
.workbench-header.is-project { padding-left: 14px; }
.workbench-title { min-width: 0; margin: 0; color: #ff5a1f; font-size: 15px; font-weight: 700; line-height: 1; letter-spacing: .01em; }
.workbench-title.is-file { color: #2f3547; }
.workbench-close { width: 28px; height: 28px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 7px; color: #8b919e; background: #f5f5f6; cursor: pointer; }
.workbench-close:hover { color: #2f3547; background: #f3f4f6; }
.workbench-close svg { width: 18px; height: 18px; }
.project-segments { width: calc(100% - 40px); max-width: 330px; min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; padding: 3px; border-radius: 11px; background: #f1f1f3; box-sizing: border-box; }
.project-segment { min-width: 0; height: 32px; padding: 0 12px; border: 1px solid transparent; outline: none; border-radius: 8px; background: transparent; color: #3d4353; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: color .16s ease, background .16s ease, box-shadow .16s ease; }
.project-segment:hover { color: #2f3547; background: rgba(255,255,255,.52); }
.project-segment.active { border-color: #e6e8ed; background: #fff; color: #ff5a1f; font-weight: 600; box-shadow: 0 1px 3px rgba(35,39,52,.08); }
.project-segment:focus-visible { box-shadow: 0 0 0 2px rgba(255,98,31,.2); }
.workbench-body { flex: 1; min-height: 0; position: relative; overflow: hidden; background: #fff; }
.workbench-panel { position: absolute; inset: 0; min-width: 0; }
@media (max-width: 1100px) {
  .collaboration-b-workbench {
    position: absolute;
    inset: 0;
    z-index: 12;
    width: 100% !important;
    min-width: 0;
    max-width: 100%;
    border-left: 0;
    box-shadow: -10px 0 30px rgba(31, 35, 48, .12);
  }
  .workbench-resizer { display: none; }
}
</style>
