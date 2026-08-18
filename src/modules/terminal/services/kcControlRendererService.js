import { usePanelStore } from '@/modules/terminal/stores/panel'
import { useNotificationStore } from '@/modules/terminal/stores/notification'
import { useProjectStore } from '@/modules/terminal/stores/project'
import { useTabStore } from '@/modules/terminal/stores/tab'
import { useWorkbenchStore } from '@/modules/terminal/stores/workbench'
import { buildNotificationTeamMeta } from '@/modules/terminal/utils/panelRuntimeState.mjs'
import { removeProjectCascade } from '@/modules/terminal/utils/projectSessionLifecycle.js'

const DEFAULT_PROJECT_NAME = 'kc_workspace'

function createProtocolError(code, message, details) {
  const error = new Error(message)
  error.code = code
  if (details !== undefined) {
    error.details = details
  }
  return error
}

function normalizeError(error) {
  if (!error) {
    return {
      code: 'INTERNAL_ERROR',
      message: 'Unknown renderer control error',
    }
  }

  return {
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || 'Unknown renderer control error',
    ...(error.details !== undefined ? { details: error.details } : {}),
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function makeRef(kind, index) {
  return `${kind}:${index + 1}`
}

function normalizeLabel(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed || fallback
}

function toOrdinal(index) {
  return Number.isInteger(index) && index >= 0 ? index + 1 : null
}

async function getDefaultProjectContext() {
  const payload = await window.electronAPI?.project?.getDefaultContext?.().catch(() => null)
  return {
    name: typeof payload?.name === 'string' && payload.name.trim() ? payload.name.trim() : DEFAULT_PROJECT_NAME,
    path: typeof payload?.path === 'string' ? payload.path.trim() : '',
  }
}

function normalizeProfile(profile) {
  const value = typeof profile === 'string' ? profile.trim().toLowerCase() : ''
  if (value === 'claude-code' || value === 'claude_code' || value === 'claude') {
    return 'claude_code'
  }
  return 'shell'
}

function cloneSerializable(value) {
  if (value == null) {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

function profileToMode(profile) {
  return normalizeProfile(profile) === 'claude_code' ? 'claude-code' : 'shell'
}

function collectLeafNodes(node, output = []) {
  if (!node) return output
  if (node.type === 'leaf') {
    output.push(node)
    return output
  }
  if (node.type === 'split' && Array.isArray(node.children)) {
    node.children.forEach((child) => collectLeafNodes(child, output))
  }
  return output
}

function findFirstLeafId(node) {
  if (!node) return null
  if (node.type === 'leaf') return node.id ?? null
  if (node.type === 'split' && Array.isArray(node.children)) {
    for (const child of node.children) {
      const leafId = findFirstLeafId(child)
      if (leafId) {
        return leafId
      }
    }
  }
  return null
}

function inferWorkspaceTitle(tab, panels) {
  if (isNonEmptyString(tab?.name)) {
    return tab.name
  }

  const leadPanel = panels.find((panel) => panel?.title) || panels[0]
  if (!leadPanel) {
    return 'Workspace'
  }

  if (isNonEmptyString(leadPanel.title)) {
    return leadPanel.title
  }

  if (leadPanel.mode === 'claude-code') {
    return 'Claude Code'
  }

  if (isNonEmptyString(leadPanel.cwd)) {
    const lastSegment = leadPanel.cwd.split('/').filter(Boolean).pop()
    if (lastSegment) {
      return `shell ~/${lastSegment}`
    }
  }

  return 'Terminal'
}

function ensureStoreObject(storeGetter, pinia) {
  const store = storeGetter(pinia)
  if (!store) {
    throw createProtocolError('WINDOW_NOT_READY', 'renderer store is not ready')
  }
  return store
}

export function createKcControlRendererService({ pinia, bridge = null } = {}) {
  if (!pinia) {
    throw new TypeError('pinia is required')
  }

  const projectStore = ensureStoreObject(useProjectStore, pinia)
  const workbenchStore = ensureStoreObject(useWorkbenchStore, pinia)
  const tabStore = ensureStoreObject(useTabStore, pinia)
  const panelStore = ensureStoreObject(usePanelStore, pinia)
  const notificationStore = ensureStoreObject(useNotificationStore, pinia)

  function getProjectById(projectId) {
    return projectStore.getProject(projectId)
  }

  function getWorkbenchById(workbenchId) {
    return workbenchStore.getWorkbench(workbenchId)
  }

  function getTabById(tabId) {
    return tabStore.getTab(tabId)
  }

  function getOrderedPanelsForTab(tabId) {
    const panels = panelStore.panelsByTab(tabId).filter((panel) => !panel.detached)
    const manager = tabStore.getManager(tabId)
    const ordered = []
    const seen = new Set()

    if (manager?.layoutRoot?.value) {
      collectLeafNodes(manager.layoutRoot.value).forEach((leaf) => {
        const panel = panelStore.getPanel(leaf.panelId)
        if (panel && !panel.detached && !seen.has(panel.id)) {
          ordered.push(panel)
          seen.add(panel.id)
        }
      })
    }

    if (ordered.length > 0 || manager?.layoutRoot?.value) {
      return ordered
    }

    panels.forEach((panel) => {
      if (!seen.has(panel.id)) {
        ordered.push(panel)
        seen.add(panel.id)
      }
    })

    return ordered
  }

  function resolveCurrentContext() {
    const activeProject =
      projectStore.activeProject ||
      projectStore.projects[0] ||
      null

    if (!activeProject) {
      return {
        project: null,
        workbench: null,
        workspace: null,
        manager: null,
        activeLeafId: null,
        activePane: null,
        activeSurface: null,
      }
    }

    const workbenchId =
      activeProject.activeWorkbenchId ||
      activeProject.workbenchIds.find((id) => !!getWorkbenchById(id)) ||
      null

    const workbench = workbenchId ? getWorkbenchById(workbenchId) : null
    const workspaceId =
      workbench?.activeTabId ||
      workbench?.tabIds.find((id) => !!getTabById(id)) ||
      null
    const workspace = workspaceId ? getTabById(workspaceId) : null
    const manager = workspace ? tabStore.getManager(workspace.id) : null
    const activeLeafId = manager?.activeLeafId?.value ?? null
    const activeLeaf = activeLeafId && manager
      ? manager.findNode(manager.layoutRoot.value, activeLeafId)?.node ?? null
      : null
    const activePane = activeLeaf?.panelId ? panelStore.getPanel(activeLeaf.panelId) : null
    const activeSurface = activePane?.terminalId ? activePane : null

    return {
      project: activeProject,
      workbench,
      workspace,
      manager,
      activeLeafId,
      activePane,
      activeSurface,
    }
  }

  function buildTopologySnapshot() {
    const current = resolveCurrentContext()
    const workspaceEntries = []
    const paneEntries = []
    const surfaceEntries = []

    projectStore.projects.forEach((project) => {
      const workbenchIds = Array.isArray(project.workbenchIds) ? project.workbenchIds : []
      workbenchIds.forEach((workbenchId) => {
        const workbench = getWorkbenchById(workbenchId)
        if (!workbench) return

        const tabIds = Array.isArray(workbench.tabIds) ? workbench.tabIds : []
        tabIds.forEach((tabId) => {
          const tab = getTabById(tabId)
          if (!tab) return

          const manager = tabStore.getManager(tabId)
          const activeLeafId = manager?.activeLeafId?.value ?? null
          const orderedPanels = getOrderedPanelsForTab(tabId)
          const paneIds = orderedPanels.map((panel) => panel.id)
          const surfaceIds = orderedPanels
            .map((panel) => panel.terminalId)
            .filter((surfaceId) => isNonEmptyString(surfaceId))
          const projectName = normalizeLabel(project.name, DEFAULT_PROJECT_NAME)
          const workbenchName = normalizeLabel(workbench.name, '默认')
          const workspaceTitle = inferWorkspaceTitle(tab, orderedPanels)
          const workspaceOrdinal = toOrdinal(tabIds.indexOf(tab.id))
          const activePane = activeLeafId && manager
            ? panelStore.getPanel(manager.findNode(manager.layoutRoot.value, activeLeafId)?.node?.panelId ?? '')
            : null
          const activeSurfaceId = activePane?.terminalId ?? null

          workspaceEntries.push({
            id: tab.id,
            tab_id: tab.id,
            project_id: project.id,
            workbench_id: workbench.id,
            project_name: projectName,
            workbench_name: workbenchName,
            title: workspaceTitle,
            workspace_ordinal: workspaceOrdinal,
            active: current.workspace?.id === tab.id,
            pane_ids: paneIds,
            surface_ids: surfaceIds,
            active_pane_id: activePane?.id ?? null,
            active_surface_id: activeSurfaceId,
          })

          orderedPanels.forEach((panel, panelIndex) => {
            const surfaceId = isNonEmptyString(panel.terminalId) ? panel.terminalId : null
            const paneOrdinal = toOrdinal(panelIndex)
            const paneEntry = {
              id: panel.id,
              panel_id: panel.id,
              project_id: project.id,
              workbench_id: workbench.id,
              workspace_id: tab.id,
              tab_id: tab.id,
              project_name: projectName,
              workbench_name: workbenchName,
              workspace_title: workspaceTitle,
              workspace_ordinal: workspaceOrdinal,
              pane_ordinal: paneOrdinal,
              surface_ids: surfaceId ? [surfaceId] : [],
              active_surface_id: activeSurfaceId === surfaceId ? surfaceId : null,
              surface_count: surfaceId ? 1 : 0,
              focused: current.activePane?.id === panel.id,
              rows: panel.rows ?? null,
              columns: panel.cols ?? null,
              pixel_frame: null,
              container_frame: null,
            }

            paneEntries.push(paneEntry)

            if (!surfaceId) {
              return
            }

            surfaceEntries.push({
              id: surfaceId,
              terminal_id: surfaceId,
              project_id: project.id,
              workbench_id: workbench.id,
              workspace_id: tab.id,
              tab_id: tab.id,
              pane_id: panel.id,
              panel_id: panel.id,
              project_name: projectName,
              workbench_name: workbenchName,
              workspace_title: workspaceTitle,
              workspace_ordinal: workspaceOrdinal,
              pane_ordinal: paneOrdinal,
              surface_ordinal: toOrdinal(surfaceIds.indexOf(surfaceId)),
              type: 'terminal',
              profile: normalizeProfile(panel.mode),
              title: panel.title || inferWorkspaceTitle(tab, [panel]),
              cwd: panel.cwd || '',
              focused: current.activeSurface?.terminalId === surfaceId,
              selected: current.activeSurface?.terminalId === surfaceId,
              detached: !!panel.detached,
              status: panel.shellState || 'idle',
            })
          })
        })
      })
    })

    const workspaceById = new Map()
    const paneById = new Map()
    const surfaceById = new Map()

    workspaceEntries.forEach((workspace, index) => {
      workspace.ref = makeRef('workspace', index)
      workspaceById.set(workspace.id, workspace)
      workspaceById.set(workspace.ref, workspace)
    })

    paneEntries.forEach((pane, index) => {
      pane.ref = makeRef('pane', index)
      paneById.set(pane.id, pane)
      paneById.set(pane.ref, pane)
    })

    surfaceEntries.forEach((surface, index) => {
      surface.ref = makeRef('surface', index)
      surfaceById.set(surface.id, surface)
      surfaceById.set(surface.ref, surface)
    })

    return {
      current,
      workspaces: workspaceEntries,
      panes: paneEntries,
      surfaces: surfaceEntries,
      workspaceById,
      paneById,
      surfaceById,
    }
  }

  function requireSnapshotEntity(snapshot, kind, candidates, fallbackCurrent = false) {
    const filteredCandidates = candidates.filter((value) => value !== undefined && value !== null && value !== '')
    for (const candidate of filteredCandidates) {
      const map = kind === 'workspace'
        ? snapshot.workspaceById
        : kind === 'pane'
          ? snapshot.paneById
          : snapshot.surfaceById
      const entity = map.get(candidate)
      if (entity) {
        return entity
      }
    }

    if (fallbackCurrent) {
      if (kind === 'workspace' && snapshot.current.workspace) {
        return snapshot.workspaceById.get(snapshot.current.workspace.id) || null
      }
      if (kind === 'pane' && snapshot.current.activePane) {
        return snapshot.paneById.get(snapshot.current.activePane.id) || null
      }
      if (kind === 'surface' && snapshot.current.activeSurface?.terminalId) {
        return snapshot.surfaceById.get(snapshot.current.activeSurface.terminalId) || null
      }
    }

    throw createProtocolError('TARGET_NOT_FOUND', `${kind} not found`)
  }

  async function ensureProjectPathAvailable(projectId) {
    const project = getProjectById(projectId)
    if (!project) {
      throw createProtocolError('TARGET_NOT_FOUND', 'project routing context is unavailable')
    }

    const nextProjectState = await projectStore.validateProjectPath(projectId)
    if (nextProjectState?.readonly) {
      throw createProtocolError('CONFLICT', 'project path is unavailable')
    }

    return getProjectById(projectId)
  }

  async function activateWorkspace(workspaceEntity) {
    const project = getProjectById(workspaceEntity.project_id)
    const workbench = getWorkbenchById(workspaceEntity.workbench_id)
    if (!project || !workbench) {
      throw createProtocolError('TARGET_NOT_FOUND', 'workspace routing context is unavailable')
    }

    await ensureProjectPathAvailable(project.id)
    projectStore.switchProject(project.id)
    projectStore.setActiveWorkbench(project.id, workbench.id)
    workbenchStore.switchWorkbench(workbench.id)
    if (workbench.activeTabId && workbench.activeTabId !== workspaceEntity.id) {
      workbench.lastTabId = workbench.activeTabId
    }
    workbenchStore.switchTab(workbench.id, workspaceEntity.id)
  }

  async function activatePane(paneEntity) {
    const workspace = getTabById(paneEntity.workspace_id)
    const manager = workspace ? tabStore.getManager(workspace.id) : null
    if (!workspace || !manager) {
      throw createProtocolError('TARGET_NOT_FOUND', 'pane workspace is unavailable')
    }

    await activateWorkspace({
      project_id: paneEntity.project_id,
      workbench_id: paneEntity.workbench_id,
      id: paneEntity.workspace_id,
    })

    const leaf = collectLeafNodes(manager.layoutRoot.value).find((item) => item.panelId === paneEntity.id)
    if (!leaf) {
      throw createProtocolError('TARGET_NOT_FOUND', 'pane leaf not found in workspace layout')
    }

    if (manager.activeLeafId?.value && manager.activeLeafId.value !== leaf.id) {
      manager.lastActiveLeafId = manager.activeLeafId.value
    }
    manager.setActiveLeafId(leaf.id)
  }

  async function ensureProjectWorkbenchContext() {
    let project = projectStore.activeProject || projectStore.projects[0] || null
    if (!project) {
      const defaultProject = await getDefaultProjectContext()
      const projectId = projectStore.addProject(defaultProject.name, defaultProject.path)
      project = getProjectById(projectId)
    }

    if (!project) {
      throw createProtocolError('WINDOW_NOT_READY', 'project context is unavailable')
    }

    await ensureProjectPathAvailable(project.id)

    let workbenchId =
      project.activeWorkbenchId ||
      project.workbenchIds.find((id) => !!getWorkbenchById(id)) ||
      null

    if (!workbenchId) {
      workbenchId = workbenchStore.addWorkbench(project.id, '默认')
      projectStore.addWorkbenchToProject(project.id, workbenchId)
    }

    const workbench = getWorkbenchById(workbenchId)
    if (!workbench) {
      throw createProtocolError('WINDOW_NOT_READY', 'workbench context is unavailable')
    }

    return { project, workbench }
  }

  function resolveWorkspaceCreateContext(snapshot, params = {}) {
    const explicitWorkspace = (
      params.workspace_id ||
      params.workspace_ref ||
      params.workspace ||
      params.workspace_handle
    )
      ? requireSnapshotEntity(
        snapshot,
        'workspace',
        [params.workspace_id, params.workspace_ref, params.workspace, params.workspace_handle],
        false
      )
      : null

    if (explicitWorkspace) {
      const project = getProjectById(explicitWorkspace.project_id)
      const workbench = getWorkbenchById(explicitWorkspace.workbench_id)
      if (!project || !workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workspace create target context not found')
      }
      return { project, workbench }
    }

    const explicitWorkbenchId = isNonEmptyString(params.workbench_id)
      ? params.workbench_id.trim()
      : isNonEmptyString(params.workbench)
        ? params.workbench.trim()
        : ''

    if (explicitWorkbenchId) {
      const workbench = getWorkbenchById(explicitWorkbenchId)
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'target workbench not found')
      }
      const project = getProjectById(workbench.projectId)
      if (!project) {
        throw createProtocolError('TARGET_NOT_FOUND', 'target workbench project not found')
      }
      return { project, workbench }
    }

    return null
  }

  function ensureImportedProjectWorkbench(exportedWorkspace) {
    const projectPayload =
      exportedWorkspace.project && typeof exportedWorkspace.project === 'object' && !Array.isArray(exportedWorkspace.project)
        ? exportedWorkspace.project
        : {}
    const workbenchPayload =
      exportedWorkspace.workbench && typeof exportedWorkspace.workbench === 'object' && !Array.isArray(exportedWorkspace.workbench)
        ? exportedWorkspace.workbench
        : {}

    let project = isNonEmptyString(projectPayload.id) ? getProjectById(projectPayload.id.trim()) : null
    if (!project) {
      const projectId = projectStore.addProject(
        projectPayload.name ?? DEFAULT_PROJECT_NAME,
        projectPayload.path ?? '',
        {
          id: isNonEmptyString(projectPayload.id) ? projectPayload.id.trim() : undefined,
          activate: false,
        },
      )
      project = getProjectById(projectId)
    }

    if (!project) {
      throw createProtocolError('WINDOW_NOT_READY', 'project context is unavailable for workspace import')
    }

    let workbench = isNonEmptyString(workbenchPayload.id) ? getWorkbenchById(workbenchPayload.id.trim()) : null
    if (workbench && workbench.projectId !== project.id) {
      throw createProtocolError('CONFLICT', 'target window already has a conflicting workbench id')
    }

    if (!workbench) {
      const workbenchId = workbenchStore.addWorkbench(
        project.id,
        workbenchPayload.name ?? '默认',
        {
          id: isNonEmptyString(workbenchPayload.id) ? workbenchPayload.id.trim() : undefined,
        },
      )
      workbench = getWorkbenchById(workbenchId)
    }

    if (!workbench) {
      throw createProtocolError('WINDOW_NOT_READY', 'workbench context is unavailable for workspace import')
    }

    projectStore.addWorkbenchToProject(project.id, workbench.id)
    return { project, workbench }
  }

  function getLeafForPanel(tabId, panelId) {
    const manager = tabStore.getManager(tabId)
    if (!manager?.layoutRoot?.value) {
      return { manager, leaf: null }
    }

    const leaf = collectLeafNodes(manager.layoutRoot.value).find((item) => item.panelId === panelId) || null
    return { manager, leaf }
  }

  function createRuntimeManagedPanel({
    projectId,
    workbenchId,
    workspaceId,
    terminalId,
    profile,
    title = '',
    cwd = '',
  }) {
    return panelStore.createPanel('terminal', workbenchId, projectId, {
      tabId: workspaceId,
      terminalId,
      mode: profileToMode(profile),
      title,
      cwd,
      runtimeManaged: true,
    })
  }

  function shapeAttachResult(snapshot, workspaceId, paneId, surfaceId) {
    return {
      workspace: requireSnapshotEntity(snapshot, 'workspace', [workspaceId]),
      pane: requireSnapshotEntity(snapshot, 'pane', [paneId]),
      surface: requireSnapshotEntity(snapshot, 'surface', [surfaceId]),
    }
  }

  function shapeWorkspaceResult(snapshot, workspaceId) {
    const workspace = requireSnapshotEntity(snapshot, 'workspace', [workspaceId])
    const pane = workspace.active_pane_id
      ? requireSnapshotEntity(snapshot, 'pane', [workspace.active_pane_id])
      : snapshot.panes.find((entry) => entry.workspace_id === workspace.id) || null
    const surfaceId =
      workspace.active_surface_id ||
      pane?.surface_ids?.[0] ||
      null
    const surface = surfaceId
      ? requireSnapshotEntity(snapshot, 'surface', [surfaceId])
      : null

    return {
      workspace,
      pane,
      surface,
    }
  }

  function shapeWorkbenchResult(snapshot, workbenchId, options = {}) {
    const workbench = getWorkbenchById(workbenchId)
    if (!workbench) {
      throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
    }

    const workspaceIds = Array.isArray(workbench.tabIds)
      ? workbench.tabIds.filter((tabId) => !!getTabById(tabId))
      : []
    const activeWorkspaceId = isNonEmptyString(workbench.activeTabId) && getTabById(workbench.activeTabId)
      ? workbench.activeTabId
      : workspaceIds[0] ?? null
    const selectedWorkspaceId = isNonEmptyString(options.workspaceId) && getTabById(options.workspaceId)
      ? options.workspaceId.trim()
      : activeWorkspaceId

    const result = {
      workbench: {
        id: workbench.id,
        project_id: workbench.projectId,
        name: workbench.name ?? '',
        workspace_ids: workspaceIds,
        active_workspace_id: activeWorkspaceId,
      },
    }

    if (!selectedWorkspaceId) {
      return result
    }

    return {
      ...result,
      ...shapeWorkspaceResult(snapshot, selectedWorkspaceId),
    }
  }

  function resolveWorkbenchTransferContext(snapshot, params = {}, fallbackCurrentWorkspace = false) {
    const explicitWorkbenchId = isNonEmptyString(params.workbench_id)
      ? params.workbench_id.trim()
      : isNonEmptyString(params.workbench_ref)
        ? params.workbench_ref.trim()
        : isNonEmptyString(params.workbench)
          ? params.workbench.trim()
          : ''

    if (explicitWorkbenchId) {
      const workbench = getWorkbenchById(explicitWorkbenchId)
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      const workspaceId = isNonEmptyString(workbench.activeTabId) && getTabById(workbench.activeTabId)
        ? workbench.activeTabId
        : Array.isArray(workbench.tabIds)
          ? workbench.tabIds.find((tabId) => !!getTabById(tabId)) ?? null
          : null
      const workspace = workspaceId
        ? requireSnapshotEntity(snapshot, 'workspace', [workspaceId])
        : null
      return { workbench, workspace }
    }

    const workspace = requireSnapshotEntity(
      snapshot,
      'workspace',
      [params.workspace_id, params.workspace_ref, params.workspace, params.id, params.ref],
      fallbackCurrentWorkspace
    )
    const workbench = getWorkbenchById(workspace.workbench_id)
    if (!workbench) {
      throw createProtocolError('TARGET_NOT_FOUND', 'workspace workbench not found')
    }

    return { workbench, workspace }
  }

  function buildWorkspaceTransferPayload(workspaceId, options = {}) {
    const {
      allowEmpty = false,
    } = options
    const tab = getTabById(workspaceId)
    const manager = tab ? tabStore.getManager(tab.id) : null
    if (!tab) {
      throw createProtocolError('TARGET_NOT_FOUND', 'workspace not found')
    }

    const orderedPanels = getOrderedPanelsForTab(workspaceId)
    const layoutRoot = manager?.layoutRoot?.value
      ? cloneSerializable(manager.layoutRoot.value)
      : null
    if (!allowEmpty && (!layoutRoot || orderedPanels.length === 0)) {
      throw createProtocolError('TARGET_NOT_FOUND', 'workspace layout not found')
    }
    if (!allowEmpty && orderedPanels.length === 0) {
      throw createProtocolError('CONFLICT', 'workspace has no attached panes to export')
    }
    if (orderedPanels.length > 0 && !layoutRoot) {
      throw createProtocolError('TARGET_NOT_FOUND', 'workspace layout not found')
    }

    return {
      id: tab.id,
      name: tab.name ?? '',
      layout_root: layoutRoot,
      active_leaf_id: layoutRoot
        ? (manager?.activeLeafId?.value ?? findFirstLeafId(layoutRoot))
        : null,
      panels: orderedPanels.map((panel) => cloneSerializable(panel)),
    }
  }

  function importWorkspacePayload({ projectId, workbenchId, workspacePayload }) {
    const tabId = tabStore.addTab(
      workbenchId,
      workspacePayload.name ?? 'Workspace',
      {
        id: workspacePayload.id,
        ...(workspacePayload.layout_root ? { layoutRoot: workspacePayload.layout_root } : {}),
        ...(workspacePayload.active_leaf_id ? { activeLeafId: workspacePayload.active_leaf_id } : {}),
      },
    )
    workbenchStore.addTabToWorkbench(workbenchId, tabId)

    workspacePayload.panels.forEach((panel) => {
      panelStore.createPanel(panel.type ?? 'terminal', workbenchId, projectId, {
        ...cloneSerializable(panel),
        id: panel.id,
        tabId,
        detached: false,
        detachedWindowId: null,
        runtimeManaged: panel.runtimeManaged !== false,
      })
    })

    return tabId
  }

  async function restoreSnapshotFocus(previousSnapshot) {
    if (previousSnapshot?.current?.activePane?.id) {
      try {
        await activatePane(previousSnapshot.current.activePane)
        return
      } catch {
        // noop
      }
    }

    if (previousSnapshot?.current?.workspace?.id) {
      try {
        await activateWorkspace(previousSnapshot.current.workspace)
      } catch {
        // noop
      }
    }
  }

  function cleanupWorkspaceIfEmpty(workspaceId) {
    const remainingPanels = panelStore.panelsByTab(workspaceId).filter((panel) => !panel.detached)
    if (remainingPanels.length > 0) {
      return false
    }

    const workspace = getTabById(workspaceId)
    if (!workspace) {
      return false
    }

    const workbench = getWorkbenchById(workspace.workbenchId)
    if (!workbench) {
      return false
    }

    workbenchStore.removeTabFromWorkbench(workbench.id, workspaceId)
    tabStore.removeTab(workspaceId)
    return true
  }

  function detachWorkspaceTopology(workspaceId) {
    const snapshot = buildTopologySnapshot()
    const workspace = requireSnapshotEntity(snapshot, 'workspace', [workspaceId])
    const workbench = getWorkbenchById(workspace.workbench_id)
    if (!workbench) {
      throw createProtocolError('TARGET_NOT_FOUND', 'workspace workbench not found')
    }

    const panes = snapshot.panes.filter((pane) => pane.workspace_id === workspace.id)
    panes.forEach((pane) => panelStore.removePanel(pane.id))
    workbenchStore.removeTabFromWorkbench(workbench.id, workspace.id)
    tabStore.removeTab(workspace.id)

    const remainingWorkbench = getWorkbenchById(workbench.id)
    if (remainingWorkbench && Array.isArray(remainingWorkbench.tabIds) && remainingWorkbench.tabIds.length === 0) {
      const owningProjectId = remainingWorkbench.projectId
      workbenchStore.removeWorkbench(remainingWorkbench.id)
      projectStore.removeWorkbenchFromProject(owningProjectId, remainingWorkbench.id)

      const owningProject = getProjectById(owningProjectId)
      if (owningProject && Array.isArray(owningProject.workbenchIds) && owningProject.workbenchIds.length === 0) {
        removeProjectCascade({
          projectId: owningProject.id,
          projectStore,
          workbenchStore,
          tabStore,
          panelStore,
          notificationStore,
        })
      }
    }

    const nextSnapshot = buildTopologySnapshot()
    syncNotificationFocus(nextSnapshot)

    return {
      detached: true,
      workspace,
      current_workspace_id: nextSnapshot.current.workspace?.id ?? null,
    }
  }

  function detachWorkbenchTopology(workbenchId) {
    const snapshot = buildTopologySnapshot()
    const workbench = getWorkbenchById(workbenchId)
    if (!workbench) {
      throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
    }

    const workspaceIds = Array.isArray(workbench.tabIds)
      ? workbench.tabIds.filter((tabId) => !!getTabById(tabId))
      : []
    const detachedWorkbench = {
      id: workbench.id,
      project_id: workbench.projectId,
      name: workbench.name ?? '',
      workspace_ids: [...workspaceIds],
      active_workspace_id: workbench.activeTabId ?? workspaceIds[0] ?? null,
    }

    workspaceIds.forEach((workspaceId) => {
      const panes = snapshot.panes.filter((pane) => pane.workspace_id === workspaceId)
      panes.forEach((pane) => panelStore.removePanel(pane.id))
      workbenchStore.removeTabFromWorkbench(workbench.id, workspaceId)
      tabStore.removeTab(workspaceId)
    })

    const remainingWorkbench = getWorkbenchById(workbench.id)
    if (remainingWorkbench && Array.isArray(remainingWorkbench.tabIds) && remainingWorkbench.tabIds.length === 0) {
      const owningProjectId = remainingWorkbench.projectId
      workbenchStore.removeWorkbench(remainingWorkbench.id)
      projectStore.removeWorkbenchFromProject(owningProjectId, remainingWorkbench.id)

      const owningProject = getProjectById(owningProjectId)
      if (owningProject && Array.isArray(owningProject.workbenchIds) && owningProject.workbenchIds.length === 0) {
        removeProjectCascade({
          projectId: owningProject.id,
          projectStore,
          workbenchStore,
          tabStore,
          panelStore,
          notificationStore,
        })
      }
    }

    const nextSnapshot = buildTopologySnapshot()
    syncNotificationFocus(nextSnapshot)

    return {
      detached: true,
      workbench: detachedWorkbench,
      detached_workspace_ids: workspaceIds,
      current_workspace_id: nextSnapshot.current.workspace?.id ?? null,
    }
  }

  function normalizeWorkspaceExportPayload(params = {}) {
    const payload =
      params.exported_workspace ??
      params.workspace_export ??
      params.export ??
      null

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw createProtocolError('INVALID_PARAMS', 'exported_workspace is required')
    }

    const workspace = payload.workspace
    if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
      throw createProtocolError('INVALID_PARAMS', 'exported_workspace.workspace is required')
    }

    if (!isNonEmptyString(workspace.id)) {
      throw createProtocolError('INVALID_PARAMS', 'exported_workspace.workspace.id is required')
    }

    if (!payload.layout_root || typeof payload.layout_root !== 'object' || Array.isArray(payload.layout_root)) {
      throw createProtocolError('INVALID_PARAMS', 'exported_workspace.layout_root is required')
    }

    if (!Array.isArray(payload.panels) || payload.panels.length === 0) {
      throw createProtocolError('INVALID_PARAMS', 'exported_workspace.panels is required')
    }

    return {
      workspace: {
        ...workspace,
        id: workspace.id.trim(),
      },
      layout_root: cloneSerializable(payload.layout_root),
      active_leaf_id: isNonEmptyString(payload.active_leaf_id)
        ? payload.active_leaf_id.trim()
        : findFirstLeafId(payload.layout_root),
      panels: payload.panels.map((panel) => cloneSerializable(panel)),
    }
  }

  function normalizeWorkbenchExportPayload(params = {}) {
    const payload =
      params.exported_workbench ??
      params.workbench_export ??
      params.export ??
      null

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw createProtocolError('INVALID_PARAMS', 'exported_workbench is required')
    }

    const workbench = payload.workbench
    if (!workbench || typeof workbench !== 'object' || Array.isArray(workbench) || !isNonEmptyString(workbench.id)) {
      throw createProtocolError('INVALID_PARAMS', 'exported_workbench.workbench.id is required')
    }

    if (!Array.isArray(payload.workspaces) || payload.workspaces.length === 0) {
      throw createProtocolError('INVALID_PARAMS', 'exported_workbench.workspaces is required')
    }

    return {
      project:
        payload.project && typeof payload.project === 'object' && !Array.isArray(payload.project)
          ? cloneSerializable(payload.project)
          : {},
      workbench: {
        ...cloneSerializable(workbench),
        id: workbench.id.trim(),
        active_workspace_id: isNonEmptyString(workbench.active_workspace_id)
          ? workbench.active_workspace_id.trim()
          : null,
      },
      requested_workspace_id: isNonEmptyString(payload.requested_workspace_id)
        ? payload.requested_workspace_id.trim()
        : null,
      workspaces: payload.workspaces.map((workspace) => {
        if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace) || !isNonEmptyString(workspace.id)) {
          throw createProtocolError('INVALID_PARAMS', 'exported_workbench.workspaces[].id is required')
        }
        if (!Array.isArray(workspace.panels)) {
          throw createProtocolError('INVALID_PARAMS', 'exported_workbench.workspaces[].panels is required')
        }
        if (workspace.panels.length > 0 && (!workspace.layout_root || typeof workspace.layout_root !== 'object' || Array.isArray(workspace.layout_root))) {
          throw createProtocolError('INVALID_PARAMS', 'exported_workbench.workspaces[].layout_root is required when panels are present')
        }

        return {
          id: workspace.id.trim(),
          name: workspace.name ?? '',
          layout_root: workspace.layout_root ? cloneSerializable(workspace.layout_root) : null,
          active_leaf_id: isNonEmptyString(workspace.active_leaf_id)
            ? workspace.active_leaf_id.trim()
            : (workspace.layout_root ? findFirstLeafId(workspace.layout_root) : null),
          panels: workspace.panels.map((panel) => cloneSerializable(panel)),
        }
      }),
    }
  }

  async function movePaneBetweenTargets({ sourcePane, targetPane, direction = 'right', focus = false }) {
    const previousSnapshot = buildTopologySnapshot()
    const sourceWorkspace = requireSnapshotEntity(previousSnapshot, 'workspace', [sourcePane.workspace_id])
    const targetWorkspace = requireSnapshotEntity(previousSnapshot, 'workspace', [targetPane.workspace_id])
    const sourceLeafState = getLeafForPanel(sourceWorkspace.id, sourcePane.id)
    const targetLeafState = getLeafForPanel(targetWorkspace.id, targetPane.id)

    if (!sourceLeafState.manager || !sourceLeafState.leaf) {
      throw createProtocolError('TARGET_NOT_FOUND', 'source pane leaf not found')
    }
    if (!targetLeafState.manager || !targetLeafState.leaf) {
      throw createProtocolError('TARGET_NOT_FOUND', 'target pane leaf not found')
    }

    if (sourceWorkspace.id === targetWorkspace.id) {
      const manager = sourceLeafState.manager
      const previousActiveLeafId = manager.activeLeafId?.value ?? null
      manager.moveLeaf(sourceLeafState.leaf.id, targetLeafState.leaf.id, direction)
      if (focus !== true) {
        const canRestore = previousActiveLeafId && manager.findNode(manager.layoutRoot.value, previousActiveLeafId)
        manager.setActiveLeafId(canRestore ? previousActiveLeafId : targetLeafState.leaf.id)
      }
    } else {
      sourceLeafState.manager.removeLeaf(sourceLeafState.leaf.id)
      panelStore.movePanelToTab(sourcePane.id, targetWorkspace.id, targetWorkspace.workbench_id)
      const panel = panelStore.getPanel(sourcePane.id)
      if (!panel) {
        throw createProtocolError('TARGET_NOT_FOUND', 'source panel not found')
      }
      panel.projectId = targetWorkspace.project_id
      panel.workbenchId = targetWorkspace.workbench_id
      const newLeafId = targetLeafState.manager.addLeaf(targetLeafState.leaf.id, direction, sourcePane.id)
      cleanupWorkspaceIfEmpty(sourceWorkspace.id)
      if (focus === true && newLeafId) {
        await activateWorkspace(targetWorkspace)
        targetLeafState.manager.setActiveLeafId(newLeafId)
      } else {
        await restoreSnapshotFocus(previousSnapshot)
      }
    }

    const nextSnapshot = buildTopologySnapshot()
    if (focus === true) {
      syncNotificationFocus(nextSnapshot)
    }

    return {
      sourceWorkspace,
      targetWorkspace,
      snapshot: nextSnapshot,
    }
  }

  function resolveTargetEntities(snapshot, params = {}, options = {}) {
    const {
      fallbackCurrentWorkspace = false,
      fallbackCurrentWorkbench = false,
      fallbackCurrentPane = false,
      fallbackCurrentSurface = false,
    } = options
    let workspace = null
    let workbench = null
    let pane = null
    let surface = null

    if (params.surface_id || params.surface_ref || params.surface || params.surface_handle) {
      surface = requireSnapshotEntity(
        snapshot,
        'surface',
        [params.surface_id, params.surface_ref, params.surface, params.surface_handle, params.id, params.ref],
        fallbackCurrentSurface
      )
      pane = requireSnapshotEntity(snapshot, 'pane', [surface.pane_id])
      workspace = requireSnapshotEntity(snapshot, 'workspace', [surface.workspace_id])
      workbench = getWorkbenchById(workspace.workbench_id)
    }

    if (!pane && (params.pane_id || params.pane_ref || params.pane || params.pane_handle)) {
      pane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.pane_id, params.pane_ref, params.pane, params.pane_handle, params.id, params.ref],
        fallbackCurrentPane
      )
      workspace = requireSnapshotEntity(snapshot, 'workspace', [pane.workspace_id])
      workbench = getWorkbenchById(workspace.workbench_id)
    }

    if (!workspace && (params.workspace_id || params.workspace_ref || params.workspace || params.workspace_handle)) {
      workspace = requireSnapshotEntity(
        snapshot,
        'workspace',
        [
          params.workspace_id,
          params.workspace_ref,
          params.workspace,
          params.workspace_handle,
          params.id,
          params.ref,
        ],
        fallbackCurrentWorkspace
      )
      workbench = getWorkbenchById(workspace.workbench_id)
    }

    if (!workbench && (params.workbench_id || params.workbench)) {
      const explicitWorkbenchId = isNonEmptyString(params.workbench_id)
        ? params.workbench_id.trim()
        : isNonEmptyString(params.workbench)
          ? params.workbench.trim()
          : ''
      if (explicitWorkbenchId) {
        workbench = getWorkbenchById(explicitWorkbenchId)
        if (!workbench) {
          throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
        }
      }
    }

    if (!workspace && fallbackCurrentWorkspace && snapshot.current.workspace) {
      workspace = requireSnapshotEntity(snapshot, 'workspace', [snapshot.current.workspace.id], true)
      workbench = workbench || getWorkbenchById(workspace.workbench_id)
    }

    if (!workbench && fallbackCurrentWorkbench && snapshot.current.workspace?.workbench_id) {
      workbench = getWorkbenchById(snapshot.current.workspace.workbench_id)
    }

    if (!workspace && workbench && fallbackCurrentWorkspace) {
      const candidateWorkspaceId = workbench.activeTabId
        || workbench.tabIds?.find((tabId) => snapshot.workspaceById.has(tabId))
        || null
      workspace = candidateWorkspaceId
        ? requireSnapshotEntity(snapshot, 'workspace', [candidateWorkspaceId], true)
        : null
    }

    if (!pane && workspace && fallbackCurrentPane) {
      pane = snapshot.current.activePane?.id
        ? requireSnapshotEntity(snapshot, 'pane', [snapshot.current.activePane.id], true)
        : null
    }

    if (!surface && pane && fallbackCurrentSurface) {
      surface = snapshot.surfaces.find((entry) => entry.pane_id === pane.id) || null
    }

    return { workspace, workbench, pane, surface }
  }

  function buildNotificationTarget(snapshot, params = {}, options = {}) {
    const entities = resolveTargetEntities(snapshot, params, options)
    const workspace = entities.workspace
    const pane = entities.pane
    const surface = entities.surface
    const workbench = entities.workbench ?? (workspace ? getWorkbenchById(workspace.workbench_id) : null)
    const project = workspace ? getProjectById(workspace.project_id) : null

    return {
      projectId: project?.id ?? null,
      workbenchId: workbench?.id ?? null,
      workspaceId: workspace?.id ?? null,
      paneId: pane?.id ?? null,
      surfaceId: surface?.id ?? null,
    }
  }

  function syncNotificationFocus(snapshot = buildTopologySnapshot()) {
    const workspaceId = snapshot.current.workspace?.id ?? null
    const paneId = snapshot.current.activePane?.id ?? null
    const surfaceId = snapshot.current.activeSurface?.terminalId ?? null

    if (surfaceId) {
      notificationStore.syncNotificationsForFocusedSurface(surfaceId, paneId, workspaceId)
      return
    }

    if (workspaceId) {
      notificationStore.setFocusedTarget?.({
        windowId: null,
        workspaceId,
        paneId,
        surfaceId: null,
      })
    }
  }

  const handlers = {
    'workspace.list': async () => {
      const snapshot = buildTopologySnapshot()
      return {
        workspaces: snapshot.workspaces,
        current_workspace_id: snapshot.current.workspace?.id ?? null,
      }
    },
    'workspace.current': async () => {
      const snapshot = buildTopologySnapshot()
      const workspace = snapshot.current.workspace
        ? snapshot.workspaceById.get(snapshot.current.workspace.id)
        : null
      if (!workspace) {
        throw createProtocolError('TARGET_NOT_FOUND', 'current workspace not found')
      }
      return { workspace }
    },
    'workspace.create': async (params = {}) => {
      throw createProtocolError(
        'NOT_SUPPORTED_YET',
        'workspace.create is deferred until automation owns terminal lifecycle semantics end to end'
      )
    },
    'workspace.select': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const workspace = requireSnapshotEntity(
        snapshot,
        'workspace',
        [params.workspace_id, params.workspace_ref, params.workspace, params.id, params.ref],
        true
      )
      await activateWorkspace(workspace)
      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return {
        workspace: requireSnapshotEntity(nextSnapshot, 'workspace', [workspace.id], true),
      }
    },
    'workspace.close': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      requireSnapshotEntity(
        snapshot,
        'workspace',
        [params.workspace_id, params.workspace_ref, params.workspace, params.id, params.ref],
        true
      )
      throw createProtocolError(
        'NOT_SUPPORTED_YET',
        'workspace.close is deferred until automation owns terminal lifecycle semantics end to end'
      )
    },
    'workspace.rename': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const workspace = requireSnapshotEntity(
        snapshot,
        'workspace',
        [params.workspace_id, params.workspace_ref, params.workspace, params.id, params.ref],
        true
      )
      const title = isNonEmptyString(params.title)
        ? params.title.trim()
        : isNonEmptyString(params.name)
          ? params.name.trim()
          : ''
      if (!title) {
        throw createProtocolError('INVALID_PARAMS', 'workspace rename requires title')
      }
      const tab = getTabById(workspace.id)
      if (!tab) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workspace not found')
      }
      tab.name = title
      const nextSnapshot = buildTopologySnapshot()
      return {
        workspace: requireSnapshotEntity(nextSnapshot, 'workspace', [workspace.id]),
      }
    },
    'workspace.next': async () => {
      const snapshot = buildTopologySnapshot()
      const currentWorkspace = snapshot.current.workspace
        ? requireSnapshotEntity(snapshot, 'workspace', [snapshot.current.workspace.id], true)
        : null
      if (!currentWorkspace) {
        throw createProtocolError('TARGET_NOT_FOUND', 'current workspace not found')
      }
      const workbench = getWorkbenchById(currentWorkspace.workbench_id)
      const tabIds = Array.isArray(workbench?.tabIds) ? workbench.tabIds : []
      const currentIndex = tabIds.indexOf(currentWorkspace.id)
      if (currentIndex === -1 || tabIds.length === 0) {
        throw createProtocolError('TARGET_NOT_FOUND', 'current workspace order not found')
      }
      const nextId = tabIds[(currentIndex + 1) % tabIds.length]
      await activateWorkspace({
        id: nextId,
        project_id: currentWorkspace.project_id,
        workbench_id: currentWorkspace.workbench_id,
      })
      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return {
        workspace: requireSnapshotEntity(nextSnapshot, 'workspace', [nextId], true),
      }
    },
    'workspace.previous': async () => {
      const snapshot = buildTopologySnapshot()
      const currentWorkspace = snapshot.current.workspace
        ? requireSnapshotEntity(snapshot, 'workspace', [snapshot.current.workspace.id], true)
        : null
      if (!currentWorkspace) {
        throw createProtocolError('TARGET_NOT_FOUND', 'current workspace not found')
      }
      const workbench = getWorkbenchById(currentWorkspace.workbench_id)
      const tabIds = Array.isArray(workbench?.tabIds) ? workbench.tabIds : []
      const currentIndex = tabIds.indexOf(currentWorkspace.id)
      if (currentIndex === -1 || tabIds.length === 0) {
        throw createProtocolError('TARGET_NOT_FOUND', 'current workspace order not found')
      }
      const previousId = tabIds[(currentIndex - 1 + tabIds.length) % tabIds.length]
      await activateWorkspace({
        id: previousId,
        project_id: currentWorkspace.project_id,
        workbench_id: currentWorkspace.workbench_id,
      })
      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return {
        workspace: requireSnapshotEntity(nextSnapshot, 'workspace', [previousId], true),
      }
    },
    'workspace.last': async () => {
      const snapshot = buildTopologySnapshot()
      const currentWorkspace = snapshot.current.workspace
        ? requireSnapshotEntity(snapshot, 'workspace', [snapshot.current.workspace.id], true)
        : null
      if (!currentWorkspace) {
        throw createProtocolError('TARGET_NOT_FOUND', 'current workspace not found')
      }
      const workbench = getWorkbenchById(currentWorkspace.workbench_id)
      const lastId = workbench?.lastTabId
      if (!lastId || lastId === currentWorkspace.id || !getTabById(lastId)) {
        return { workspace: currentWorkspace }
      }
      await activateWorkspace({
        id: lastId,
        project_id: currentWorkspace.project_id,
        workbench_id: currentWorkspace.workbench_id,
      })
      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return {
        workspace: requireSnapshotEntity(nextSnapshot, 'workspace', [lastId], true),
      }
    },
    'workspace.reorder': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const workspace = requireSnapshotEntity(
        snapshot,
        'workspace',
        [params.workspace_id, params.workspace_ref, params.workspace, params.id, params.ref],
        true
      )
      const workbench = getWorkbenchById(workspace.workbench_id)
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workspace workbench not found')
      }
      const targetId = params.before_workspace_id ?? params.before_workspace_ref ?? params.before_workspace ?? params.target_workspace_id ?? params.target_workspace_ref ?? params.target_workspace
      if (!targetId) {
        throw createProtocolError('INVALID_PARAMS', 'workspace.reorder requires before_workspace_id or target_workspace_id')
      }
      const targetWorkspace = requireSnapshotEntity(snapshot, 'workspace', [targetId])
      const fromIndex = workbench.tabIds.indexOf(workspace.id)
      const toIndex = workbench.tabIds.indexOf(targetWorkspace.id)
      if (fromIndex === -1 || toIndex === -1) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workspace reorder indices not found')
      }
      const [moved] = workbench.tabIds.splice(fromIndex, 1)
      workbench.tabIds.splice(toIndex, 0, moved)
      const nextSnapshot = buildTopologySnapshot()
      return {
        workspace: requireSnapshotEntity(nextSnapshot, 'workspace', [workspace.id]),
        workspaces: nextSnapshot.workspaces.filter((entry) => entry.workbench_id === workspace.workbench_id),
      }
    },
    'pane.list': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const workspace = params.workspace_id || params.workspace || params.workspace_ref || params.ref || params.id
        ? requireSnapshotEntity(
            snapshot,
            'workspace',
            [params.workspace_id, params.workspace_ref, params.workspace, params.id, params.ref]
          )
        : null

      return {
        panes: workspace
          ? snapshot.panes.filter((pane) => pane.workspace_id === workspace.id)
          : snapshot.panes,
        current_pane_id: snapshot.current.activePane?.id ?? null,
      }
    },
    'pane.current': async () => {
      const snapshot = buildTopologySnapshot()
      const pane = snapshot.current.activePane
        ? snapshot.paneById.get(snapshot.current.activePane.id)
        : null
      if (!pane) {
        throw createProtocolError('TARGET_NOT_FOUND', 'current pane not found')
      }
      return { pane }
    },
    'pane.focus': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const pane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.pane_id, params.pane_ref, params.pane, params.id, params.ref],
        true
      )
      await activatePane(pane)
      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return {
        pane: requireSnapshotEntity(nextSnapshot, 'pane', [pane.id], true),
      }
    },
    'pane.surfaces': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const pane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.pane_id, params.pane_ref, params.pane, params.id, params.ref],
        true
      )
      return {
        pane,
        surfaces: snapshot.surfaces.filter((surface) => surface.pane_id === pane.id),
      }
    },
    'pane.last': async () => {
      const snapshot = buildTopologySnapshot()
      const currentPane = snapshot.current.activePane
        ? requireSnapshotEntity(snapshot, 'pane', [snapshot.current.activePane.id], true)
        : null
      if (!currentPane) {
        throw createProtocolError('TARGET_NOT_FOUND', 'current pane not found')
      }
      const manager = tabStore.getManager(currentPane.workspace_id)
      const lastLeafId = manager?.lastActiveLeafId ?? null
      if (!lastLeafId) {
        return { pane: currentPane }
      }
      const lastLeaf = manager.findNode(manager.layoutRoot.value, lastLeafId)?.node ?? null
      if (!lastLeaf?.panelId) {
        return { pane: currentPane }
      }
      await activatePane({
        id: lastLeaf.panelId,
        project_id: currentPane.project_id,
        workbench_id: currentPane.workbench_id,
        workspace_id: currentPane.workspace_id,
      })
      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return {
        pane: requireSnapshotEntity(nextSnapshot, 'pane', [lastLeaf.panelId], true),
      }
    },
    'pane.close': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      requireSnapshotEntity(
        snapshot,
        'pane',
        [params.pane_id, params.pane_ref, params.pane, params.id, params.ref],
        true
      )
      throw createProtocolError(
        'NOT_SUPPORTED_YET',
        'pane.close is deferred until automation owns terminal lifecycle semantics end to end'
      )
    },
    'pane.swap': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const sourcePane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.pane_id, params.pane_ref, params.pane, params.id, params.ref],
        true
      )
      const targetPane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.target_pane_id, params.target_pane_ref, params.target_pane]
      )
      const sourceWorkspace = requireSnapshotEntity(snapshot, 'workspace', [sourcePane.workspace_id])
      const targetWorkspace = requireSnapshotEntity(snapshot, 'workspace', [targetPane.workspace_id])
      if (sourceWorkspace.id !== targetWorkspace.id) {
        throw createProtocolError('CONFLICT', 'pane.swap currently requires both panes to be in the same workspace')
      }
      const { manager, leaf: sourceLeaf } = getLeafForPanel(sourceWorkspace.id, sourcePane.id)
      const { leaf: targetLeaf } = getLeafForPanel(targetWorkspace.id, targetPane.id)
      if (!manager || !sourceLeaf || !targetLeaf) {
        throw createProtocolError('TARGET_NOT_FOUND', 'pane leaf not found for swap')
      }
      const temporaryPanelId = sourceLeaf.panelId
      sourceLeaf.panelId = targetLeaf.panelId
      targetLeaf.panelId = temporaryPanelId
      const nextSnapshot = buildTopologySnapshot()
      return {
        panes: [
          requireSnapshotEntity(nextSnapshot, 'pane', [sourcePane.id], true),
          requireSnapshotEntity(nextSnapshot, 'pane', [targetPane.id], true),
        ],
      }
    },
    'pane.break': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const pane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.pane_id, params.pane_ref, params.pane, params.id, params.ref],
        true
      )
      const workspace = requireSnapshotEntity(snapshot, 'workspace', [pane.workspace_id])
      const workbench = getWorkbenchById(workspace.workbench_id)
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found for pane.break')
      }
      const newWorkspaceId = tabStore.addTab(workbench.id, params.title ?? workspace.title ?? 'Workspace')
      workbenchStore.addTabToWorkbench(workbench.id, newWorkspaceId)
      const newManager = tabStore.getManager(newWorkspaceId)
      const { manager, leaf } = getLeafForPanel(workspace.id, pane.id)
      if (!manager || !leaf || !newManager) {
        throw createProtocolError('TARGET_NOT_FOUND', 'pane leaf not found for pane.break')
      }
      const previousSnapshot = buildTopologySnapshot()
      manager.removeLeaf(leaf.id)
      panelStore.movePanelToTab(pane.id, newWorkspaceId, workspace.workbench_id)
      const panel = panelStore.getPanel(pane.id)
      if (panel) {
        panel.projectId = workspace.project_id
        panel.workbenchId = workspace.workbench_id
      }
      newManager.init(pane.id)
      cleanupWorkspaceIfEmpty(workspace.id)
      if (params.focus === true) {
        await activateWorkspace({
          id: newWorkspaceId,
          project_id: workspace.project_id,
          workbench_id: workspace.workbench_id,
        })
      } else {
        await restoreSnapshotFocus(previousSnapshot)
      }
      const nextSnapshot = buildTopologySnapshot()
      if (params.focus === true) {
        syncNotificationFocus(nextSnapshot)
      }
      const nextPane = nextSnapshot.panes.find((entry) => entry.id === pane.id) || null
      const nextSurface = nextPane
        ? nextSnapshot.surfaces.find((entry) => entry.pane_id === nextPane.id) || null
        : null
      return {
        workspace: requireSnapshotEntity(nextSnapshot, 'workspace', [newWorkspaceId], true),
        pane: nextPane,
        surface: nextSurface,
      }
    },
    'pane.join': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const sourcePane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.pane_id, params.pane_ref, params.pane, params.id, params.ref],
        true
      )
      const targetPane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.target_pane_id, params.target_pane_ref, params.target_pane]
      )
      const result = await movePaneBetweenTargets({
        sourcePane,
        targetPane,
        direction: isNonEmptyString(params.direction) ? params.direction.trim().toLowerCase() : 'right',
        focus: params.focus === true,
      })
      const pane = requireSnapshotEntity(result.snapshot, 'pane', [sourcePane.id], true)
      const surface = result.snapshot.surfaces.find((entry) => entry.pane_id === pane.id) || null
      return {
        workspace: requireSnapshotEntity(result.snapshot, 'workspace', [pane.workspace_id], true),
        pane,
        surface,
      }
    },
    'surface.list': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      let surfaces = snapshot.surfaces

      if (params.workspace_id || params.workspace || params.workspace_ref || params.workspace_handle) {
        const workspace = requireSnapshotEntity(
          snapshot,
          'workspace',
          [
            params.workspace_id,
            params.workspace_ref,
            params.workspace,
            params.workspace_handle,
            params.id,
            params.ref,
          ]
        )
        surfaces = surfaces.filter((surface) => surface.workspace_id === workspace.id)
      }

      if (params.pane_id || params.pane || params.pane_ref) {
        const pane = requireSnapshotEntity(
          snapshot,
          'pane',
          [params.pane_id, params.pane_ref, params.pane, params.id, params.ref]
        )
        surfaces = surfaces.filter((surface) => surface.pane_id === pane.id)
      } else if (params.surface_id || params.surface || params.surface_ref || params.id || params.ref) {
        const surface = requireSnapshotEntity(
          snapshot,
          'surface',
          [params.surface_id, params.surface_ref, params.surface, params.id, params.ref]
        )
        surfaces = surfaces.filter((entry) => entry.id === surface.id)
      }

      return {
        surfaces,
        current_surface_id: snapshot.current.activeSurface?.terminalId ?? null,
      }
    },
    'surface.current': async () => {
      const snapshot = buildTopologySnapshot()
      const surface = snapshot.current.activeSurface?.terminalId
        ? snapshot.surfaceById.get(snapshot.current.activeSurface.terminalId)
        : null
      if (!surface) {
        throw createProtocolError('TARGET_NOT_FOUND', 'current surface not found')
      }
      return { surface }
    },
    'surface.focus': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const surface = requireSnapshotEntity(
        snapshot,
        'surface',
        [params.surface_id, params.surface_ref, params.surface, params.id, params.ref],
        true
      )
      const pane = requireSnapshotEntity(snapshot, 'pane', [surface.pane_id])
      await activatePane(pane)
      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return {
        surface: requireSnapshotEntity(nextSnapshot, 'surface', [surface.id], true),
      }
    },
    'notification.create': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const target = buildNotificationTarget(snapshot, params, { fallbackCurrentWorkspace: false })
      const targetPanel = target.paneId ? panelStore.getPanel(target.paneId) : null
      const notification = notificationStore.createNotification({
        ...target,
        title: params.title ?? '',
        body: params.body ?? params.content ?? '',
        type: params.type ?? 'info',
        sound: params.sound !== 'false' && params.sound !== false,
        suppressed: Boolean(params.suppressed),
        targetKind: params.target_kind ?? 'global',
        ...(targetPanel ? buildNotificationTeamMeta(targetPanel) : {}),
      })
      return { notification }
    },
    'notification.create_for_surface': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const target = buildNotificationTarget(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentPane: true,
        fallbackCurrentSurface: true,
      })
      if (!target.surfaceId) {
        throw createProtocolError('TARGET_NOT_FOUND', 'surface not found')
      }
      const targetPanel = target.paneId ? panelStore.getPanel(target.paneId) : null
      const suppressed = Object.prototype.hasOwnProperty.call(params, 'suppressed')
        ? Boolean(params.suppressed)
        : snapshot.current.activeSurface?.terminalId === target.surfaceId
      const notification = notificationStore.createNotification({
        ...target,
        title: params.title ?? '',
        body: params.body ?? params.content ?? '',
        type: params.type ?? 'info',
        sound: params.sound !== 'false' && params.sound !== false,
        suppressed,
        targetKind: 'surface',
        ...(targetPanel ? buildNotificationTeamMeta(targetPanel) : {}),
      })
      return { notification }
    },
    'notification.create_for_target': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const target = buildNotificationTarget(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentPane: true,
        fallbackCurrentSurface: true,
      })
      const targetPanel = target.paneId ? panelStore.getPanel(target.paneId) : null
      const suppressed = Object.prototype.hasOwnProperty.call(params, 'suppressed')
        ? Boolean(params.suppressed)
        : (
          (target.surfaceId && snapshot.current.activeSurface?.terminalId === target.surfaceId) ||
          (!target.surfaceId && target.paneId && snapshot.current.activePane?.id === target.paneId) ||
          (!target.surfaceId && !target.paneId && target.workspaceId && snapshot.current.workspace?.id === target.workspaceId)
        )
      const notification = notificationStore.createNotification({
        ...target,
        title: params.title ?? '',
        body: params.body ?? params.content ?? '',
        type: params.type ?? 'info',
        sound: params.sound !== 'false' && params.sound !== false,
        suppressed,
        targetKind: params.target_kind ?? (target.surfaceId ? 'surface' : target.paneId ? 'pane' : target.workspaceId ? 'workspace' : 'global'),
        ...(targetPanel ? buildNotificationTeamMeta(targetPanel) : {}),
      })
      return { notification }
    },
    'notification.list': async (params = {}) => {
      return {
        notifications: notificationStore.listNotifications({
          windowId: params.window_id ?? null,
          projectId: params.project_id ?? null,
          workbenchId: params.workbench_id ?? null,
          workspaceId: params.workspace_id ?? null,
          paneId: params.pane_id ?? null,
          surfaceId: params.surface_id ?? null,
          ...(Object.prototype.hasOwnProperty.call(params, 'read') ? { read: params.read } : {}),
        }),
      }
    },
    'notification.clear': async (params = {}) => {
      const cleared = notificationStore.clearNotifications({
        windowId: params.window_id ?? null,
        projectId: params.project_id ?? null,
        workbenchId: params.workbench_id ?? null,
        workspaceId: params.workspace_id ?? null,
        paneId: params.pane_id ?? null,
        surfaceId: params.surface_id ?? null,
        ...(Object.prototype.hasOwnProperty.call(params, 'read') ? { read: params.read } : {}),
      })
      return { cleared }
    },
    'status.set': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workspace, workbench } = resolveTargetEntities(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentWorkbench: true,
      })
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      if (!isNonEmptyString(params.key)) {
        throw createProtocolError('INVALID_PARAMS', 'key is required')
      }
      const item = notificationStore.setStatus(workbench.id, params.key.trim(), params.value ?? '')
      return { workspace, workbench, item, status_items: notificationStore.listStatus(workbench.id) }
    },
    'status.clear': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workspace, workbench } = resolveTargetEntities(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentWorkbench: true,
      })
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      notificationStore.clearStatus(workbench.id, isNonEmptyString(params.key) ? params.key.trim() : null)
      return { workspace, workbench, status_items: notificationStore.listStatus(workbench.id) }
    },
    'status.list': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workspace, workbench } = resolveTargetEntities(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentWorkbench: true,
      })
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      return { workspace, workbench, status_items: notificationStore.listStatus(workbench.id) }
    },
    'progress.set': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workspace, workbench } = resolveTargetEntities(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentWorkbench: true,
      })
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      const rawProgress = Number(params.progress)
      if (!Number.isFinite(rawProgress)) {
        throw createProtocolError('INVALID_PARAMS', 'progress must be a number')
      }
      const progress = notificationStore.setProgress(workbench.id, rawProgress, params.label ?? '')
      return { workspace, workbench, progress }
    },
    'progress.clear': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workspace, workbench } = resolveTargetEntities(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentWorkbench: true,
      })
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      notificationStore.clearProgress(workbench.id)
      return { workspace, workbench, cleared: true }
    },
    'log.append': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workspace, workbench } = resolveTargetEntities(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentWorkbench: true,
      })
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      if (!isNonEmptyString(params.message)) {
        throw createProtocolError('INVALID_PARAMS', 'message is required')
      }
      const entry = notificationStore.appendLog(workbench.id, params.level ?? 'info', params.message.trim())
      return { workspace, workbench, entry }
    },
    'log.list': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workspace, workbench } = resolveTargetEntities(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentWorkbench: true,
      })
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      const limit = params.limit == null || params.limit === ''
        ? null
        : Number(params.limit)
      if (limit != null && (!Number.isInteger(limit) || limit <= 0)) {
        throw createProtocolError('INVALID_PARAMS', 'limit must be a positive integer')
      }
      return { workspace, workbench, logs: notificationStore.listLog(workbench.id, { limit }) }
    },
    'log.clear': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workspace, workbench } = resolveTargetEntities(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentWorkbench: true,
      })
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      notificationStore.clearLog(workbench.id)
      return { workspace, workbench, cleared: true }
    },
    'sidebar.state': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workspace, workbench } = resolveTargetEntities(snapshot, params, {
        fallbackCurrentWorkspace: true,
        fallbackCurrentWorkbench: true,
      })
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workbench not found')
      }
      return {
        workspace,
        workbench,
        ...notificationStore.getSidebarState(workbench.id),
      }
    },
    'pane.create': async () => {
      throw createProtocolError('NOT_SUPPORTED_YET', 'pane.create is deferred until automation owns terminal creation semantics end to end')
    },
    'surface.create': async () => {
      throw createProtocolError('NOT_SUPPORTED_YET', 'surface.create is deferred until automation owns terminal creation semantics end to end')
    },
    'pane.resize': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const pane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.pane_id, params.pane_ref, params.pane, params.id, params.ref],
        true
      )
      const { manager, leaf } = getLeafForPanel(pane.workspace_id, pane.id)
      if (!manager || !leaf) {
        throw createProtocolError('TARGET_NOT_FOUND', 'pane leaf not found for resize')
      }
      const parent = manager.findNode(manager.layoutRoot.value, leaf.id)?.parent ?? null
      if (!parent?.id || parent.type !== 'split') {
        throw createProtocolError('CONFLICT', 'pane has no resizable split parent')
      }
      const sizes = Array.isArray(params.sizes) ? params.sizes.map((value) => Number(value)) : null
      if (!sizes || sizes.length !== parent.children.length || sizes.some((value) => !Number.isFinite(value) || value <= 0)) {
        throw createProtocolError('INVALID_PARAMS', 'pane.resize requires sizes matching the split child count')
      }
      manager.resizeNode(parent.id, sizes)
      const nextSnapshot = buildTopologySnapshot()
      return {
        pane: requireSnapshotEntity(nextSnapshot, 'pane', [pane.id], true),
      }
    },
    'surface.close': async () => {
      throw createProtocolError('NOT_SUPPORTED_YET', 'surface.close is deferred until terminal lifecycle ownership is formalized for automation')
    },
    'surface.split': async () => {
      throw createProtocolError('NOT_SUPPORTED_YET', 'surface.split is deferred until automation owns terminal creation semantics end to end')
    },
    'surface.move': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const surface = requireSnapshotEntity(
        snapshot,
        'surface',
        [params.surface_id, params.surface_ref, params.surface, params.id, params.ref],
        true
      )
      const sourcePane = requireSnapshotEntity(snapshot, 'pane', [surface.pane_id])
      const targetPane = params.target_pane_id || params.target_pane_ref || params.target_pane
        ? requireSnapshotEntity(snapshot, 'pane', [params.target_pane_id, params.target_pane_ref, params.target_pane])
        : requireSnapshotEntity(snapshot, 'pane', [requireSnapshotEntity(
          snapshot,
          'surface',
          [params.target_surface_id, params.target_surface_ref, params.target_surface],
        ).pane_id])
      const result = await movePaneBetweenTargets({
        sourcePane,
        targetPane,
        direction: isNonEmptyString(params.direction) ? params.direction.trim().toLowerCase() : 'right',
        focus: params.focus === true,
      })
      return shapeAttachResult(result.snapshot, targetPane.workspace_id, sourcePane.id, surface.id)
    },
    'surface.drag_to_split': async (params = {}) => {
      return handlers['surface.move'](params)
    },
    'surface.reorder': async (params = {}) => {
      return handlers['surface.move']({
        ...params,
        direction: params.direction ?? params.position ?? 'right',
      })
    },
    'runtime.workspace_create': async (params = {}) => {
      const terminalId = isNonEmptyString(params.terminal_id) ? params.terminal_id.trim() : ''
      if (!terminalId) {
        throw createProtocolError('INVALID_PARAMS', 'terminal_id is required')
      }

      const currentSnapshot = buildTopologySnapshot()
      const explicitContext = resolveWorkspaceCreateContext(currentSnapshot, params)
      const { project, workbench } = explicitContext || await ensureProjectWorkbenchContext()
      const title = isNonEmptyString(params.title)
        ? params.title.trim()
        : isNonEmptyString(params.name)
          ? params.name.trim()
          : ''
      const tabId = tabStore.addTab(workbench.id, title)
      workbenchStore.addTabToWorkbench(workbench.id, tabId)

      const panelId = createRuntimeManagedPanel({
        projectId: project.id,
        workbenchId: workbench.id,
        workspaceId: tabId,
        terminalId,
        profile: params.profile,
        title: params.surface_title ?? '',
        cwd: params.cwd ?? '',
      })

      const manager = tabStore.getManager(tabId)
      manager.init(panelId)

      if (params.focus === true) {
        await activateWorkspace({
          id: tabId,
          project_id: project.id,
          workbench_id: workbench.id,
        })
      }

      const nextSnapshot = buildTopologySnapshot()
      if (params.focus === true) {
        syncNotificationFocus(nextSnapshot)
      }
      return shapeAttachResult(nextSnapshot, tabId, panelId, terminalId)
    },
    'runtime.workspace_close': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const workspace = requireSnapshotEntity(
        snapshot,
        'workspace',
        [params.workspace_id, params.workspace_ref, params.workspace, params.id, params.ref],
        true
      )
      const workbench = getWorkbenchById(workspace.workbench_id)
      if (!workbench) {
        throw createProtocolError('TARGET_NOT_FOUND', 'workspace workbench not found')
      }
      if (!Array.isArray(workbench.tabIds) || workbench.tabIds.length <= 1) {
        throw createProtocolError('CONFLICT', 'last workspace in the current workbench cannot be closed yet')
      }

      const panes = snapshot.panes.filter((pane) => pane.workspace_id === workspace.id)
      panes.forEach((pane) => panelStore.removePanel(pane.id))
      workbenchStore.removeTabFromWorkbench(workbench.id, workspace.id)
      tabStore.removeTab(workspace.id)

      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return {
        closed: true,
        workspace,
        current_workspace_id: nextSnapshot.current.workspace?.id ?? null,
      }
    },
    'runtime.workspace_export': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const workspace = requireSnapshotEntity(
        snapshot,
        'workspace',
        [params.workspace_id, params.workspace_ref, params.workspace, params.id, params.ref],
        true
      )
      const workspacePayload = buildWorkspaceTransferPayload(workspace.id)

      return {
        ...shapeWorkspaceResult(snapshot, workspace.id),
        exported_workspace: {
          project: {
            id: workspace.project_id,
            name: getProjectById(workspace.project_id)?.name ?? '',
            path: getProjectById(workspace.project_id)?.path ?? '',
          },
          workbench: {
            id: workspace.workbench_id,
            name: getWorkbenchById(workspace.workbench_id)?.name ?? '',
          },
          workspace: {
            id: workspacePayload.id,
            name: workspacePayload.name,
          },
          layout_root: workspacePayload.layout_root,
          active_leaf_id: workspacePayload.active_leaf_id,
          panels: workspacePayload.panels,
        },
      }
    },
    'runtime.workspace_import': async (params = {}) => {
      const exportedWorkspace = normalizeWorkspaceExportPayload(params)
      const { project, workbench } = ensureImportedProjectWorkbench(exportedWorkspace)
      const workspaceId = exportedWorkspace.workspace.id
      if (getTabById(workspaceId)) {
        throw createProtocolError('CONFLICT', 'workspace already exists in target window')
      }

      const conflictingPanel = exportedWorkspace.panels.find((panel) => panelStore.getPanel(panel.id))
      if (conflictingPanel) {
        throw createProtocolError('CONFLICT', `pane already exists in target window: ${conflictingPanel.id}`)
      }

      const tabId = importWorkspacePayload({
        projectId: project.id,
        workbenchId: workbench.id,
        workspacePayload: {
          id: workspaceId,
          name: params.title ?? exportedWorkspace.workspace.name ?? 'Workspace',
          layout_root: exportedWorkspace.layout_root,
          active_leaf_id: exportedWorkspace.active_leaf_id,
          panels: exportedWorkspace.panels,
        },
      })

      if (params.focus === true) {
        await activateWorkspace({
          id: tabId,
          project_id: project.id,
          workbench_id: workbench.id,
        })
      }

      const nextSnapshot = buildTopologySnapshot()
      if (params.focus === true) {
        syncNotificationFocus(nextSnapshot)
      }
      return shapeWorkspaceResult(nextSnapshot, tabId)
    },
    'runtime.workspace_detach': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const workspace = requireSnapshotEntity(
        snapshot,
        'workspace',
        [params.workspace_id, params.workspace_ref, params.workspace, params.id, params.ref],
        true
      )
      return detachWorkspaceTopology(workspace.id)
    },
    'runtime.workbench_export': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workbench, workspace } = resolveWorkbenchTransferContext(snapshot, params, true)
      const workspaceIds = Array.isArray(workbench.tabIds)
        ? workbench.tabIds.filter((tabId) => !!getTabById(tabId))
        : []
      if (workspaceIds.length === 0) {
        throw createProtocolError('CONFLICT', 'workbench has no workspaces to export')
      }

      const exportedWorkspaces = workspaceIds.map((workspaceId) =>
        buildWorkspaceTransferPayload(workspaceId, { allowEmpty: true }))

      return {
        ...shapeWorkbenchResult(snapshot, workbench.id, { workspaceId: workspace?.id ?? null }),
        exported_workbench: {
          project: {
            id: workbench.projectId,
            name: getProjectById(workbench.projectId)?.name ?? '',
            path: getProjectById(workbench.projectId)?.path ?? '',
          },
          workbench: {
            id: workbench.id,
            name: workbench.name ?? '',
            active_workspace_id: isNonEmptyString(workbench.activeTabId) ? workbench.activeTabId : (workspaceIds[0] ?? null),
          },
          requested_workspace_id: workspace?.id ?? null,
          workspaces: exportedWorkspaces,
        },
      }
    },
    'runtime.workbench_import': async (params = {}) => {
      const exportedWorkbench = normalizeWorkbenchExportPayload(params)
      if (getWorkbenchById(exportedWorkbench.workbench.id)) {
        throw createProtocolError('CONFLICT', 'workbench already exists in target window')
      }

      const conflictingWorkspaceId = exportedWorkbench.workspaces.find((workspace) => getTabById(workspace.id))?.id ?? null
      if (conflictingWorkspaceId) {
        throw createProtocolError('CONFLICT', `workspace already exists in target window: ${conflictingWorkspaceId}`)
      }

      const conflictingPanel = exportedWorkbench.workspaces
        .flatMap((workspace) => workspace.panels)
        .find((panel) => panelStore.getPanel(panel.id))
      if (conflictingPanel) {
        throw createProtocolError('CONFLICT', `pane already exists in target window: ${conflictingPanel.id}`)
      }

      const { project, workbench } = ensureImportedProjectWorkbench(exportedWorkbench)

      exportedWorkbench.workspaces.forEach((workspacePayload) => {
        importWorkspacePayload({
          projectId: project.id,
          workbenchId: workbench.id,
          workspacePayload,
        })
      })

      const activeWorkspaceId = isNonEmptyString(exportedWorkbench.workbench.active_workspace_id) && getTabById(exportedWorkbench.workbench.active_workspace_id)
        ? exportedWorkbench.workbench.active_workspace_id
        : exportedWorkbench.workspaces[0]?.id ?? null
      if (activeWorkspaceId) {
        workbenchStore.switchTab(workbench.id, activeWorkspaceId)
      }

      if (params.focus === true && activeWorkspaceId) {
        await activateWorkspace({
          id: activeWorkspaceId,
          project_id: project.id,
          workbench_id: workbench.id,
        })
      }

      const nextSnapshot = buildTopologySnapshot()
      if (params.focus === true) {
        syncNotificationFocus(nextSnapshot)
      }
      return shapeWorkbenchResult(nextSnapshot, workbench.id, {
        workspaceId: exportedWorkbench.requested_workspace_id,
      })
    },
    'runtime.workbench_detach': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const { workbench } = resolveWorkbenchTransferContext(snapshot, params, true)
      return detachWorkbenchTopology(workbench.id)
    },
    'runtime.surface_attach': async (params = {}) => {
      const terminalId = isNonEmptyString(params.terminal_id) ? params.terminal_id.trim() : ''
      if (!terminalId) {
        throw createProtocolError('INVALID_PARAMS', 'terminal_id is required')
      }

      const snapshot = buildTopologySnapshot()
      const anchorPane = requireSnapshotEntity(
        snapshot,
        'pane',
        [params.pane_id, params.pane_ref, params.pane],
        true
      )
      const workspace = requireSnapshotEntity(snapshot, 'workspace', [anchorPane.workspace_id])
      const { manager, leaf } = getLeafForPanel(workspace.id, anchorPane.id)
      if (!manager || !leaf) {
        throw createProtocolError('TARGET_NOT_FOUND', 'anchor pane leaf not found')
      }

      const panelId = createRuntimeManagedPanel({
        projectId: workspace.project_id,
        workbenchId: workspace.workbench_id,
        workspaceId: workspace.id,
        terminalId,
        profile: params.profile,
        title: params.title ?? '',
        cwd: params.cwd ?? '',
      })
      const direction = isNonEmptyString(params.direction) ? params.direction.trim().toLowerCase() : 'right'
      const newLeafId = manager.addLeaf(leaf.id, direction, panelId)
      if (params.focus !== true) {
        manager.setActiveLeafId(leaf.id)
      } else if (newLeafId) {
        manager.setActiveLeafId(newLeafId)
      }

      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return shapeAttachResult(nextSnapshot, workspace.id, panelId, terminalId)
    },
    'runtime.surface_close': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const surface = requireSnapshotEntity(
        snapshot,
        'surface',
        [params.surface_id, params.surface_ref, params.surface, params.id, params.ref],
        true
      )
      const pane = requireSnapshotEntity(snapshot, 'pane', [surface.pane_id])
      const workspace = requireSnapshotEntity(snapshot, 'workspace', [surface.workspace_id])
      const workbench = getWorkbenchById(workspace.workbench_id)
      const { manager, leaf } = getLeafForPanel(workspace.id, pane.id)
      if (!manager || !leaf) {
        throw createProtocolError('TARGET_NOT_FOUND', 'surface pane leaf not found')
      }

      const isRootLeaf = manager.layoutRoot.value?.id === leaf.id
      if (isRootLeaf) {
        if (!workbench || !Array.isArray(workbench.tabIds) || workbench.tabIds.length <= 1) {
          throw createProtocolError('CONFLICT', 'last surface in the current workbench cannot be closed yet')
        }
        panelStore.removePanel(pane.id)
        workbenchStore.removeTabFromWorkbench(workbench.id, workspace.id)
        tabStore.removeTab(workspace.id)
      } else {
        manager.removeLeaf(leaf.id)
        panelStore.removePanel(pane.id)
      }

      const nextSnapshot = buildTopologySnapshot()
      syncNotificationFocus(nextSnapshot)
      return {
        closed: true,
        surface,
        current_surface_id: nextSnapshot.current.activeSurface?.terminalId ?? null,
      }
    },
    'runtime.surface_refresh': async (params = {}) => {
      const snapshot = buildTopologySnapshot()
      const surface = requireSnapshotEntity(
        snapshot,
        'surface',
        [params.surface_id, params.surface_ref, params.surface, params.id, params.ref],
        true
      )
      return { surface, refreshed: true }
    },
  }

  async function dispatchRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw createProtocolError('INVALID_PARAMS', 'renderer control request must be an object')
    }

    const method = typeof request.method === 'string' ? request.method : ''
    const params =
      request.params && typeof request.params === 'object' && !Array.isArray(request.params)
        ? request.params
        : {}

    const handler = handlers[method]
    if (!handler) {
      throw createProtocolError('INVALID_METHOD', `Unsupported renderer control method: ${method || 'unknown'}`)
    }

    return handler(params, request)
  }

  async function handleEnvelope(envelope) {
    try {
      const result = await dispatchRequest(envelope?.request)
      return { ok: true, result }
    } catch (error) {
      return {
        ok: false,
        error: normalizeError(error),
      }
    }
  }

  function attachBridge(nextBridge = bridge) {
    if (!nextBridge?.onRequest || !nextBridge?.respond) {
      console.warn('[kcControlRenderer] request bridge unavailable; renderer automation service is idle')
      return () => {}
    }

    return nextBridge.onRequest(async (envelope) => {
      const requestId = typeof envelope?.requestId === 'string' ? envelope.requestId : ''
      if (!requestId) {
        return
      }

      const payload = await handleEnvelope(envelope)
      try {
        nextBridge.respond(requestId, payload)
      } catch (error) {
        console.error('[kcControlRenderer] failed to respond to control request:', error)
      }
    })
  }

  return {
    attachBridge,
    dispatchRequest,
    handleEnvelope,
  }
}
