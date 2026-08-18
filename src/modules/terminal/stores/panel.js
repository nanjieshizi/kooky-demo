// src/stores/panel.js
import { defineStore } from 'pinia'
import { getPanelRuntimeState } from '../utils/panelRuntimeState.mjs'
import { getPanelAutoTitle } from '../utils/tabTitle.mjs'
import { useNotificationStore } from './notification'

let _panelSeq = 0
const userPermissionModeOverrides = new Map()
const cliBrandSyncTasks = new Map()
const terminatedClaudeSessionByTermId = new Map()

const TEAM_METADATA_FIELDS = [
  'teamId',
  'teamName',
  'teamRole',
  'teamLabel',
  'teamAgentId',
  'teamAgentType',
  'teamLeadSessionId',
  'teamModel',
  'teamColor',
  'teamPlanModeRequired',
  'teamSurfaceId',
  'teamWorkspaceId',
  'teamPaneIndex',
  'runtimeManaged',
]

function appendMetadataEvent(event) {
  try {
    const append = typeof window !== 'undefined'
      ? window.electronAPI?.session?.appendMetadataEvent
      : null
    if (typeof append === 'function') {
      Promise.resolve(append(event)).catch((error) => {
        console.warn('[panelStore] appendMetadataEvent failed:', error?.message || error)
      })
    }
  } catch (error) {
    console.warn('[panelStore] appendMetadataEvent threw:', error?.message || error)
  }
}

function genPanelId() {
  return `panel_${Date.now()}_${++_panelSeq}`
}

function normalizeCliBrand(cliBrand) {
  const normalized = typeof cliBrand === 'string'
    ? cliBrand.trim().toLowerCase().replace(/_/g, '-')
    : ''

  if (!normalized) return ''
  if (normalized === 'claude' || normalized === 'claude-code') return 'claude-code'
  if (normalized === 'open-code' || normalized === 'kooky' || normalized === 'ko') return 'kooky'
  if (normalized === 'shell') return 'shell'
  return normalized
}

function syncCliBrandFromMain(terminalId, onResolved) {
  const normalizedTermId = typeof terminalId === 'string' ? terminalId.trim() : ''
  if (!normalizedTermId || cliBrandSyncTasks.has(normalizedTermId)) return

  const getCliBrand = typeof window !== 'undefined'
    ? window.electronAPI?.terminal?.getCliBrand
    : null
  if (typeof getCliBrand !== 'function') return

  const syncTask = Promise.resolve(getCliBrand(normalizedTermId))
    .then((cliBrand) => {
      const normalizedCliBrand = normalizeCliBrand(cliBrand)
      if (normalizedCliBrand && typeof onResolved === 'function') {
        onResolved(normalizedCliBrand)
      }
    })
    .catch((error) => {
      console.warn('[panelStore] sync cliBrand failed:', error?.message || error)
    })
    .finally(() => {
      cliBrandSyncTasks.delete(normalizedTermId)
    })

  cliBrandSyncTasks.set(normalizedTermId, syncTask)
}

function isTerminatedClaudeSessionRebind(panel, sessionId) {
  const normalizedTermId = typeof panel?.terminalId === 'string' ? panel.terminalId.trim() : ''
  const normalizedSessionId = typeof sessionId === 'string' ? sessionId.trim() : ''
  if (!normalizedTermId || !normalizedSessionId) return false
  if (terminatedClaudeSessionByTermId.get(normalizedTermId) !== normalizedSessionId) return false

  return panel.mode === 'shell' && panel.claudeActive !== true
}

export const usePanelStore = defineStore('panel', {
  state: () => ({
    panels: {},
  }),

  getters: {
    panelList: (state) => Object.values(state.panels),

    panelsByWorkbench: (state) => (workbenchId) => {
      return Object.values(state.panels).filter(p => p.workbenchId === workbenchId)
    },

    panelsByTab: (state) => (tabId) => {
      return Object.values(state.panels).filter(p => p.tabId === tabId)
    },

    detachedPanels: (state) => {
      return Object.values(state.panels).filter(p => p.detached)
    },

    teamPanels: (state) => (teamId) => {
      if (!teamId) return []
      return Object.values(state.panels).filter(p => p.teamId === teamId)
    },

    getPanel: (state) => (panelId) => {
      return state.panels[panelId] ?? null
    },

    workbenchState: (state) => (workbenchId) => {
      const panels = Object.values(state.panels).filter(
        p => p.workbenchId === workbenchId && !p.detached
      )
      if (panels.length === 0) return 'idle'
      if (panels.some((panel) => {
        const tone = getPanelRuntimeState(panel).tone
        return tone === 'running' || tone === 'needs-input'
      })) return 'running'
      if (panels.some(panel => getPanelRuntimeState(panel).tone === 'error')) return 'error'
      if (panels.some(panel => getPanelRuntimeState(panel).tone === 'idle')) return 'idle'
      return 'exited'
    },
  },

  actions: {
    createPanel(type, workbenchId, projectId, options = {}) {
      const explicitId = typeof options.id === 'string' && options.id.trim() ? options.id.trim() : null
      const id = explicitId || genPanelId()
      const panel = {
        id,
        type,
        projectId,
        workbenchId,
        tabId: options.tabId ?? null,
        terminalId: options.terminalId ?? null,
        mode: options.mode ?? 'claude-code',
        title: options.title ?? '',
        detached: Boolean(options.detached),
        detachedWindowId: options.detachedWindowId ?? null,
        runtimeManaged: Boolean(options.runtimeManaged),
        cwd: options.cwd ?? '',
        claudeSessionId: options.claudeSessionId ?? null,
        claudeActive: Boolean(options.claudeActive),
        cols: options.cols ?? 80,
        rows: options.rows ?? 24,
        // 新增字段
        shell: options.shell ?? '',
        shellHostedClaude: Boolean(options.shellHostedClaude),
        shellState: options.shellState ?? 'idle',
        cliBrand: options.cliBrand ?? 'claude-code',
        lastExitCode: options.lastExitCode ?? null,
        gitBranch: options.gitBranch ?? '',
        gitDirty: Boolean(options.gitDirty),
        ptySpawnedAt: options.ptySpawnedAt ?? Date.now(),
        aiModel: options.aiModel ?? '',
        aiContextPercent: null,
        aiTokenSpeed: null,
        aiCostUsd: null,
        aiSubagentCount: options.aiSubagentCount ?? 0,
        aiActiveSubagentCount: options.aiActiveSubagentCount ?? 0,
        aiReadCount: options.aiReadCount ?? 0,
        aiWriteCount: options.aiWriteCount ?? 0,
        aiToolCount: options.aiToolCount ?? 0,
        aiActiveToolCount: options.aiActiveToolCount ?? 0,
        // claude-hud 对齐：细粒度工具统计 + running tools + todos
        aiToolCountsByName: options.aiToolCountsByName ?? {},
        aiRunningTools: options.aiRunningTools ?? [],
        aiTodos: options.aiTodos ?? [],
        // 权限模式：default | acceptEdits | plan | bypassPermissions
        aiPermissionMode: options.aiPermissionMode ?? 'default',
        // Claude 模型策略（与 CLI --model 对齐）：opusplan | claude-opus-4-6 | claude-sonnet-4-6 | claude-haiku-4-5
        // opusplan 为启动默认；用户通过 ShortcutBar 切换后更新；持久化到 snapshot，resume 时还原
        claudeModelStrategy: options.claudeModelStrategy ?? 'opusplan',
        // Claude 自动生成的对话摘要标题（customTitle / slug）
        aiSessionName: options.aiSessionName ?? '',
        // Config counts：CLAUDE.md / MCPs / hooks
        aiClaudeMdCount: options.aiClaudeMdCount ?? 0,
        aiMcpCount: options.aiMcpCount ?? 0,
        aiHooksCount: options.aiHooksCount ?? 0,
        // Team metadata
        teamId: options.teamId ?? null,
        teamName: options.teamName ?? '',
        teamRole: options.teamRole ?? null,       // 'leader' | 'teammate'
        teamLabel: options.teamLabel ?? '',
        teamAgentId: options.teamAgentId ?? '',
        teamAgentType: options.teamAgentType ?? '',
        teamLeadSessionId: options.teamLeadSessionId ?? '',
        teamModel: options.teamModel ?? '',
        teamColor: options.teamColor ?? '',
        teamPlanModeRequired: Boolean(options.teamPlanModeRequired),
        teamSurfaceId: options.teamSurfaceId ?? null,
        teamWorkspaceId: options.teamWorkspaceId ?? null,
        teamPaneIndex: options.teamPaneIndex ?? null,
        teamStatus: options.teamStatus ?? null,   // 'running' | 'idle' | 'needs-input' | 'error'
        teamStatusIcon: options.teamStatusIcon ?? null,
        teamStatusColor: options.teamStatusColor ?? null,
      }
      if (options.aiContextPercent != null) panel.aiContextPercent = options.aiContextPercent
      if (Object.prototype.hasOwnProperty.call(options, 'aiTokenSpeed')) panel.aiTokenSpeed = options.aiTokenSpeed
      if (options.aiCostUsd != null) panel.aiCostUsd = options.aiCostUsd
      this.panels[id] = panel
      appendMetadataEvent({
        type: 'panel-created',
        payload: {
          panelId: id,
          projectId,
          workbenchId,
          tabId: panel.tabId,
          terminalId: panel.terminalId,
          mode: panel.mode,
          cwd: panel.cwd,
          claudeSessionId: panel.claudeSessionId,
          claudeActive: panel.claudeActive,
          shellHostedClaude: panel.shellHostedClaude,
          shellState: panel.shellState,
          aiPermissionMode: panel.aiPermissionMode,
          teamId: panel.teamId,
          teamName: panel.teamName,
          teamRole: panel.teamRole,
          teamLabel: panel.teamLabel,
          teamAgentId: panel.teamAgentId,
          teamAgentType: panel.teamAgentType,
          teamLeadSessionId: panel.teamLeadSessionId,
          teamModel: panel.teamModel,
          teamColor: panel.teamColor,
          teamPlanModeRequired: panel.teamPlanModeRequired,
          teamSurfaceId: panel.teamSurfaceId,
          teamWorkspaceId: panel.teamWorkspaceId,
          teamPaneIndex: panel.teamPaneIndex,
          runtimeManaged: panel.runtimeManaged,
          cliBrand: panel.cliBrand,
        },
      })
      return id
    },

    removePanel(panelId) {
      const panel = this.panels[panelId]
      const notificationStore = useNotificationStore()
      notificationStore.clearPanelNotifications(panelId, {
        surfaceId: panel?.terminalId ?? null,
      })
      if (panel?.terminalId) {
        userPermissionModeOverrides.delete(panel.terminalId)
      }
      if (panel) {
        appendMetadataEvent({
          type: 'panel-removed',
          payload: {
            panelId,
            workbenchId: panel.workbenchId,
            tabId: panel.tabId,
            terminalId: panel.terminalId ?? null,
          },
        })
      }
      delete this.panels[panelId]
    },

    movePanel(panelId, targetWorkbenchId) {
      const panel = this.panels[panelId]
      if (panel) {
        panel.workbenchId = targetWorkbenchId
      }
    },

    movePanelToTab(panelId, tabId, workbenchId) {
      const panel = this.panels[panelId]
      if (panel) {
        panel.tabId = tabId
        if (workbenchId) panel.workbenchId = workbenchId
        appendMetadataEvent({
          type: 'panel-attached',
          payload: {
            panelId,
            tabId: panel.tabId,
            workbenchId: panel.workbenchId,
            detached: Boolean(panel.detached),
            detachedWindowId: panel.detachedWindowId ?? null,
          },
        })
      }
    },

    detachPanel(panelId, windowId) {
      const panel = this.panels[panelId]
      if (panel) {
        panel.detached = true
        panel.detachedWindowId = windowId
        appendMetadataEvent({
          type: 'panel-detached',
          payload: {
            panelId,
            tabId: panel.tabId,
            workbenchId: panel.workbenchId,
            detachedWindowId: windowId ?? null,
          },
        })
      }
    },

    reattachPanel(panelId, options = {}) {
      const panel = this.panels[panelId]
      if (panel) {
        panel.detached = false
        panel.detachedWindowId = null
        if (typeof options.runtimeManaged === 'boolean') {
          panel.runtimeManaged = options.runtimeManaged
        }
        appendMetadataEvent({
          type: 'panel-attached',
          payload: {
            panelId,
            tabId: panel.tabId,
            workbenchId: panel.workbenchId,
            detachedWindowId: null,
            runtimeManaged: panel.runtimeManaged,
          },
        })
      }
    },

    updatePanelTitle(panelId, title) {
      const panel = this.panels[panelId]
      if (panel) {
        panel.title = title
        appendMetadataEvent({
          type: 'panel-updated',
          payload: {
            panelId,
            title,
          },
        })
      }
    },

    updateCwd(panelId, cwd) {
      const panel = this.panels[panelId]
      if (panel && cwd) {
        panel.cwd = cwd
        appendMetadataEvent({
          type: 'panel-updated',
          payload: {
            panelId,
            terminalId: panel.terminalId,
            cwd,
          },
        })
      }
    },

    updateClaudeSessionId(panelId, sessionId) {
      const panel = this.panels[panelId]
      if (!panel) return false

      const nextSessionId =
        sessionId != null && String(sessionId).trim()
          ? String(sessionId).trim()
          : null

      if (nextSessionId && isTerminatedClaudeSessionRebind(panel, nextSessionId)) {
        return false
      }

      if (panel.claudeSessionId === nextSessionId) return true
      if (nextSessionId && panel.terminalId) {
        terminatedClaudeSessionByTermId.delete(panel.terminalId)
      }
      panel.claudeSessionId = nextSessionId
      appendMetadataEvent({
        type: 'panel-session-bound',
        payload: {
          panelId,
          terminalId: panel.terminalId,
          claudeSessionId: nextSessionId,
          clearClaudeSessionId: nextSessionId == null,
        },
      })

      if (nextSessionId && panel.terminalId) {
        syncCliBrandFromMain(panel.terminalId, (cliBrand) => {
          const currentPanel = this.panels[panelId]
          if (!currentPanel?.terminalId) return
          this.updateCliBrand(currentPanel.terminalId, cliBrand)
        })
      }
      return true
    },

    promotePanelToClaudeMode(terminalId, options = {}) {
      const panel = Object.values(this.panels).find(p => p.terminalId === terminalId)
      if (!panel) return

      terminatedClaudeSessionByTermId.delete(terminalId)
      const preserveShellHost = options?.preserveShellHost === true
      panel.mode = 'claude-code'
      panel.claudeActive = true
      panel.shellHostedClaude = preserveShellHost
      panel.shellState = 'idle'
      panel.lastExitCode = null
    },

    updateCliBrand(terminalId, cliBrand) {
      const normalizedCliBrand = normalizeCliBrand(cliBrand)
      if (!terminalId || !normalizedCliBrand) return
      const panel = Object.values(this.panels).find(p => p.terminalId === terminalId)
      if (!panel) return
      if (panel.cliBrand === normalizedCliBrand) return
      panel.cliBrand = normalizedCliBrand
      appendMetadataEvent({
        type: 'panel-updated',
        payload: {
          panelId: panel.id,
          terminalId,
          cliBrand: normalizedCliBrand,
        },
      })
    },

    demotePanelToShellMode(terminalId) {
      const panel = Object.values(this.panels).find(p => p.terminalId === terminalId)
      if (!panel) return

      const previousSessionId =
        typeof panel.claudeSessionId === 'string' && panel.claudeSessionId.trim()
          ? panel.claudeSessionId.trim()
          : ''
      if (previousSessionId) {
        terminatedClaudeSessionByTermId.set(terminalId, previousSessionId)
      }
      userPermissionModeOverrides.delete(terminalId)
      panel.mode = 'shell'
      panel.shellHostedClaude = false
      panel.claudeSessionId = null
      panel.claudeActive = false
      panel.aiModel = ''
      panel.aiContextPercent = null
      panel.aiTokenSpeed = null
      panel.aiCostUsd = null
      panel.aiSubagentCount = 0
      panel.aiActiveSubagentCount = 0
      panel.aiReadCount = 0
      panel.aiWriteCount = 0
      panel.aiToolCount = 0
      panel.aiActiveToolCount = 0
      panel.aiToolCountsByName = {}
      panel.aiRunningTools = []
      panel.aiTodos = []
      panel.aiPermissionMode = 'default'
      panel.claudeModelStrategy = 'opusplan'
      panel.aiSessionName = ''
      panel.aiClaudeMdCount = 0
      panel.aiMcpCount = 0
      panel.aiHooksCount = 0
      panel.shellState = 'idle'
      panel.lastExitCode = null

      appendMetadataEvent({
        type: 'panel-session-bound',
        payload: {
          panelId: panel.id,
          terminalId,
          mode: panel.mode,
          claudeSessionId: null,
          clearClaudeSessionId: true,
          claudeActive: false,
          shellHostedClaude: false,
          shellState: panel.shellState,
          lastExitCode: panel.lastExitCode,
        },
      })
    },

    updateAiPermissionMode(terminalId, permissionMode) {
      if (!terminalId || !permissionMode) return
      const panel = Object.values(this.panels).find(p => p.terminalId === terminalId)
      if (!panel) return
      if (panel.aiPermissionMode === permissionMode) return
      userPermissionModeOverrides.set(terminalId, permissionMode)
      panel.aiPermissionMode = permissionMode
      appendMetadataEvent({
        type: 'panel-permission-mode',
        payload: {
          panelId: panel.id,
          terminalId,
          aiPermissionMode: permissionMode,
        },
      })
    },

    updateClaudeModelStrategy(terminalId, strategy) {
      if (!terminalId || !strategy) return
      const panel = Object.values(this.panels).find(p => p.terminalId === terminalId)
      if (!panel) return
      panel.claudeModelStrategy = strategy
    },

    updateTerminalSize(panelId, cols, rows) {
      const panel = this.panels[panelId]
      if (panel) {
        panel.cols = cols
        panel.rows = rows
      }
    },

    updateShellState(terminalId, data) {
      const panel = Object.values(this.panels).find(p => p.terminalId === terminalId)
      if (!panel) return

      // 直启 Claude pane 没有 shell 接管，收到的 shell-state 往往是旧 shell 的残留写回。
      // 但 shell 承载的 Claude 会话需要允许 shell 接管后重新降回 shell 模式。
      if (panel.mode === 'claude-code' && !panel.shellHostedClaude) {
        return
      }

      const previousRuntime = {
        mode: panel.mode,
        claudeSessionId: panel.claudeSessionId,
        claudeActive: panel.claudeActive,
        shellHostedClaude: panel.shellHostedClaude,
        shellState: panel.shellState,
        lastExitCode: panel.lastExitCode,
        cwd: panel.cwd,
        gitBranch: panel.gitBranch,
        gitDirty: panel.gitDirty,
        aiPermissionMode: panel.aiPermissionMode,
      }

      if (data.cwd) panel.cwd = data.cwd
      if (data.gitBranch !== undefined) panel.gitBranch = data.gitBranch
      if (data.gitDirty !== undefined) panel.gitDirty = data.gitDirty

      // claude-hud 对齐：仅在 shell 模式下、shell 接管（state===idle）时清理 Claude 数据
      // claude-code 模式没有 shell，不该触发清理（initial idle 写入会误触发）
      const isShellTakingOver = data.state === 'idle' && panel.claudeActive
      if (isShellTakingOver) {
        userPermissionModeOverrides.delete(terminalId)
        panel.mode = 'shell'
        panel.shellHostedClaude = false
        panel.claudeSessionId = null
        panel.claudeActive = false
        panel.aiModel = ''
        panel.aiContextPercent = null
        panel.aiTokenSpeed = null
        panel.aiCostUsd = null
        panel.aiSubagentCount = 0
        panel.aiActiveSubagentCount = 0
        panel.aiReadCount = 0
        panel.aiWriteCount = 0
        panel.aiToolCount = 0
        panel.aiActiveToolCount = 0
        panel.aiRunningTools = []
        panel.aiToolCountsByName = {}
        panel.aiTodos = []
        panel.aiPermissionMode = 'default'
        panel.aiSessionName = ''
        panel.aiClaudeMdCount = 0
        panel.aiMcpCount = 0
        panel.aiHooksCount = 0
      }

      if (data.state === 'idle') {
        panel.shellState = (data.exitCode != null && data.exitCode !== 0) ? 'error' : 'idle'
        panel.lastExitCode = data.exitCode ?? null
      } else if (data.state === 'running') {
        terminatedClaudeSessionByTermId.delete(terminalId)
        panel.shellState = 'running'
      }

      const nextRuntime = {
        mode: panel.mode,
        claudeSessionId: panel.claudeSessionId,
        claudeActive: panel.claudeActive,
        shellHostedClaude: panel.shellHostedClaude,
        shellState: panel.shellState,
        lastExitCode: panel.lastExitCode,
        cwd: panel.cwd,
        gitBranch: panel.gitBranch,
        gitDirty: panel.gitDirty,
        aiPermissionMode: panel.aiPermissionMode,
      }

      if (JSON.stringify(previousRuntime) !== JSON.stringify(nextRuntime)) {
        appendMetadataEvent({
          type: 'panel-shell-state',
          payload: {
            panelId: panel.id,
            terminalId,
            ...nextRuntime,
            clearClaudeSessionId: isShellTakingOver,
          },
        })
      }
    },

    updateAiStatus(terminalId, data) {
      const panel = Object.values(this.panels).find(p => p.terminalId === terminalId)
      if (!panel) return
      const previousSessionId =
        typeof panel.claudeSessionId === 'string' && panel.claudeSessionId.trim()
          ? panel.claudeSessionId.trim()
          : ''
      const nextSessionId =
        typeof data.sessionId === 'string' && data.sessionId.trim()
          ? data.sessionId.trim()
          : ''
      const isFreshShellPromotedSession =
        panel.mode === 'shell' &&
        nextSessionId &&
        nextSessionId !== previousSessionId
      const previousPermissionMode = panel.aiPermissionMode

      if (nextSessionId && isTerminatedClaudeSessionRebind(panel, nextSessionId)) {
        return false
      }

      if (isFreshShellPromotedSession) {
        terminatedClaudeSessionByTermId.delete(terminalId)
        userPermissionModeOverrides.delete(terminalId)
        panel.mode = 'claude-code'
        panel.shellHostedClaude = true
        panel.aiPermissionMode = 'default'
        panel.shellState = 'idle'
        panel.lastExitCode = null
      }

      if (data.cwd) panel.cwd = data.cwd
      if (data.sessionId) panel.claudeSessionId = data.sessionId
      if (data.sessionId || data.transcriptPath || data.model) {
        panel.claudeActive = true
        if (panel.mode === 'claude-code' && panel.shellState !== 'running') {
          panel.shellState = 'idle'
          panel.lastExitCode = null
        }
      }
      if (data.model) panel.aiModel = data.model
      if (data.contextPercent != null) panel.aiContextPercent = data.contextPercent
      if (Object.prototype.hasOwnProperty.call(data, 'tokenSpeed')) panel.aiTokenSpeed = data.tokenSpeed
      if (data.costUsd != null) panel.aiCostUsd = data.costUsd
      if (data.subagentCount != null) panel.aiSubagentCount = data.subagentCount
      if (data.activeSubagentCount != null) panel.aiActiveSubagentCount = data.activeSubagentCount
      if (data.readCount != null) panel.aiReadCount = data.readCount
      if (data.writeCount != null) panel.aiWriteCount = data.writeCount
      if (data.toolCount != null) panel.aiToolCount = data.toolCount
      if (data.activeToolCount != null) panel.aiActiveToolCount = data.activeToolCount
      if (data.toolCountsByName != null) panel.aiToolCountsByName = data.toolCountsByName
      if (data.runningTools != null) panel.aiRunningTools = data.runningTools
      if (data.todos != null) panel.aiTodos = data.todos
      if (data.permissionMode != null) {
        const override = userPermissionModeOverrides.get(terminalId)
        if (!override || override === data.permissionMode) {
          panel.aiPermissionMode = data.permissionMode
          userPermissionModeOverrides.delete(terminalId)
        }
      }
      if (data.sessionName != null) panel.aiSessionName = data.sessionName
      if (data.claudeMdCount != null) panel.aiClaudeMdCount = data.claudeMdCount
      if (data.mcpCount != null) panel.aiMcpCount = data.mcpCount
      if (data.hooksCount != null) panel.aiHooksCount = data.hooksCount

      if (nextSessionId && nextSessionId !== previousSessionId) {
        appendMetadataEvent({
          type: 'panel-session-bound',
          payload: {
            panelId: panel.id,
            terminalId,
            claudeSessionId: nextSessionId,
            mode: panel.mode,
            claudeActive: panel.claudeActive,
            shellHostedClaude: panel.shellHostedClaude,
          },
        })

        syncCliBrandFromMain(terminalId, (cliBrand) => {
          const currentPanel = Object.values(this.panels).find(candidate => candidate.terminalId === terminalId)
          if (!currentPanel?.terminalId) return
          this.updateCliBrand(currentPanel.terminalId, cliBrand)
        })
      }

      if (panel.aiPermissionMode !== previousPermissionMode) {
        appendMetadataEvent({
          type: 'panel-permission-mode',
          payload: {
            panelId: panel.id,
            terminalId,
            aiPermissionMode: panel.aiPermissionMode,
          },
        })
      }
    },

    updateTeamStatus(termId, { teamStatus, teamStatusIcon, teamStatusColor } = {}) {
      const panel = Object.values(this.panels).find(p => p.terminalId === termId)
      if (!panel) return
      if (teamStatus !== undefined) panel.teamStatus = teamStatus
      if (teamStatusIcon !== undefined) panel.teamStatusIcon = teamStatusIcon
      if (teamStatusColor !== undefined) panel.teamStatusColor = teamStatusColor
    },

    markTeamRuntimeFailed(termId, { cascadeToTeam = false } = {}) {
      const panel = Object.values(this.panels).find(p => p.terminalId === termId)
      if (!panel?.teamId) return

      const targets = cascadeToTeam
        ? Object.values(this.panels).filter(candidate => candidate.teamId === panel.teamId)
        : [panel]

      for (const target of targets) {
        target.teamStatus = 'error'
        target.teamStatusIcon = '❌'
        target.teamStatusColor = '#FF3B30'
      }
    },

    updateTeamIdentity(panelId, { teamLabel } = {}) {
      const panel = this.panels[panelId]
      if (!panel) return
      if (teamLabel !== undefined) panel.teamLabel = teamLabel
      appendMetadataEvent({
        type: 'panel-updated',
        payload: TEAM_METADATA_FIELDS.reduce((payload, field) => {
          if (field === 'teamLabel' && teamLabel !== undefined) {
            payload.teamLabel = teamLabel
            return payload
          }
          payload[field] = panel[field]
          return payload
        }, {
          panelId,
          teamLabel: panel.teamLabel,
        }),
      })
    },

    updateTeamRuntimeBinding(panelId, updates = {}) {
      const panel = this.panels[panelId]
      if (!panel) return

      const payload = { panelId }
      let changed = false
      for (const field of TEAM_METADATA_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(updates, field)) continue
        if (panel[field] === updates[field]) continue
        panel[field] = updates[field]
        payload[field] = panel[field]
        changed = true
      }

      if (!changed) return

      appendMetadataEvent({
        type: 'panel-updated',
        payload: {
          panelId,
          ...TEAM_METADATA_FIELDS.reduce((nextPayload, field) => {
            nextPayload[field] = panel[field]
            return nextPayload
          }, {}),
        },
      })
    },

    markShellRuntimeReady(terminalId) {
      const panel = Object.values(this.panels).find(p => p.terminalId === terminalId)
      if (!panel || panel.mode !== 'shell') return
      panel.shellState = 'idle'
      panel.lastExitCode = null
    },

    markPanelExited(terminalId) {
      const panel = Object.values(this.panels).find(p => p.terminalId === terminalId)
      if (panel) panel.shellState = 'exited'
    },

    loadPanels(panelsObj) {
      // 恢复时清空 OSC 标题，避免显示过时的进程标题（如上次的 "claude"）
      // 等新 shell/进程启动后由 OSC 重新上报
      const nextPanels = Object.entries(panelsObj || {}).reduce((acc, [panelId, panel]) => {
        if (!panel || typeof panel !== 'object') return acc
        acc[panelId] = {
          ...panel,
          id: typeof panel.id === 'string' && panel.id.trim() ? panel.id.trim() : panelId,
        }
        return acc
      }, {})
      userPermissionModeOverrides.clear()
      terminatedClaudeSessionByTermId.clear()
      for (const panel of Object.values(nextPanels)) {
        const isOrdinaryShellPane =
          panel.mode === 'shell' &&
          !(typeof panel.claudeSessionId === 'string' && panel.claudeSessionId.trim())

        panel.title = isOrdinaryShellPane
          ? (panel.title || getPanelAutoTitle(panel))
          : ''
        if (panel?.terminalId && panel.aiPermissionMode && panel.aiPermissionMode !== 'default') {
          userPermissionModeOverrides.set(panel.terminalId, panel.aiPermissionMode)
        }
      }
      this.panels = nextPanels
    },

    exportPanels() {
      return JSON.parse(JSON.stringify(this.panels))
    },
  },
})
