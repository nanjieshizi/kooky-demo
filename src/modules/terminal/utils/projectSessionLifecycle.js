import { resolveProjectTerminalCwd } from './projectPathStatus.js'
import { isDefaultProject } from './defaultProject.js'

function collectProjectWorkbenchIds(project, workbenchStore) {
  const ids = new Set(Array.isArray(project?.workbenchIds) ? project.workbenchIds : [])
  if (workbenchStore?.workbenchesByProject && project?.id) {
    workbenchStore.workbenchesByProject(project.id).forEach((workbench) => {
      if (workbench?.id) ids.add(workbench.id)
    })
  }
  return Array.from(ids)
}

export function isProjectInteractive(projectStore, projectId) {
  if (!projectId) return true
  if (!projectStore?.isProjectPathInvalid) return true
  return !projectStore.isProjectPathInvalid(projectId)
}

export function createWorkbenchWithInitialTab({
  projectStore,
  workbenchStore,
  tabStore,
  panelStore,
  projectId,
  name = '',
  mode = 'shell',
  fallbackCwd = '',
  generateTermId = () => `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
} = {}) {
  const project = projectId ? projectStore?.getProject?.(projectId) : null
  if (!project || !isProjectInteractive(projectStore, projectId)) {
    return null
  }

  const existingWorkbenchIds = collectProjectWorkbenchIds(project, workbenchStore)
  const workbenchId = workbenchStore.addWorkbench(
    project.id,
    name || `Workbench ${existingWorkbenchIds.length + 1}`,
  )
  projectStore.addWorkbenchToProject(project.id, workbenchId)

  const tabId = tabStore.addTab(workbenchId, '')
  workbenchStore.addTabToWorkbench(workbenchId, tabId)

  const panelId = panelStore.createPanel('terminal', workbenchId, project.id, {
    terminalId: generateTermId(),
    tabId,
    mode,
    title: '',
    cwd: resolveProjectTerminalCwd(project, fallbackCwd),
  })

  tabStore.getManager(tabId)?.init(panelId)
  return workbenchId
}

export function removeProjectCascade({
  projectId,
  projectStore,
  workbenchStore,
  tabStore,
  panelStore,
  notificationStore,
  cleanupTerminalRefs = () => {},
} = {}) {
  const project = projectId ? projectStore?.getProject?.(projectId) : null
  if (!project || isDefaultProject(project)) {
    return {
      removed: false,
      workbenchIds: [],
      tabIds: [],
      panelIds: [],
      terminalIds: [],
    }
  }

  const workbenchIds = collectProjectWorkbenchIds(project, workbenchStore)
  const tabIds = []
  const panelIds = []
  const terminalIds = []

  workbenchIds.forEach((workbenchId) => {
    const workbench = workbenchStore.getWorkbench(workbenchId)
    const nextTabIds = new Set(Array.isArray(workbench?.tabIds) ? workbench.tabIds : [])
    if (tabStore?.tabsByWorkbench) {
      tabStore.tabsByWorkbench(workbenchId).forEach((tab) => {
        if (tab?.id) nextTabIds.add(tab.id)
      })
    }

    Array.from(nextTabIds).forEach((tabId) => {
      if (!tabIds.includes(tabId)) tabIds.push(tabId)
      panelStore.panelsByTab(tabId).forEach((panel) => {
        if (!panelIds.includes(panel.id)) panelIds.push(panel.id)
        if (panel.terminalId && !terminalIds.includes(panel.terminalId)) {
          terminalIds.push(panel.terminalId)
        }
      })
    })
  })

  terminalIds.forEach((termId) => {
    cleanupTerminalRefs(termId)
  })

  panelIds.forEach((panelId) => {
    panelStore.removePanel(panelId)
    if (notificationStore?.focusedReadIndicators?.[panelId]) {
      delete notificationStore.focusedReadIndicators[panelId]
    }
  })

  tabIds.forEach((tabId) => {
    const tab = tabStore.getTab(tabId)
    if (tab?.workbenchId) {
      workbenchStore.removeTabFromWorkbench(tab.workbenchId, tabId)
    }
    tabStore.removeTab(tabId)
  })

  workbenchIds.forEach((workbenchId) => {
    // 兼容旧的 tab-keyed metadata，先清当前 workbench，再顺带尝试 tab 级残留。
    notificationStore?.clearStatus?.(workbenchId)
    notificationStore?.clearProgress?.(workbenchId)
    notificationStore?.clearLog?.(workbenchId)
    projectStore.removeWorkbenchFromProject(project.id, workbenchId)
    workbenchStore.removeWorkbench(workbenchId)
  })

  tabIds.forEach((tabId) => {
    notificationStore?.clearStatus?.(tabId)
    notificationStore?.clearProgress?.(tabId)
    notificationStore?.clearLog?.(tabId)
  })

  notificationStore?.clearNotifications?.({ projectId: project.id })
  projectStore.removeProject(project.id)

  return {
    removed: true,
    workbenchIds,
    tabIds,
    panelIds,
    terminalIds,
  }
}
