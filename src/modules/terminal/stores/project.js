import { defineStore } from 'pinia'
import { useNotificationStore } from './notification'
import {
  mapValidationResultToProjectState,
  normalizeProjectSnapshot,
  normalizeProjectPathReason,
  PROJECT_PATH_STATUS,
} from '../utils/projectPathStatus.js'
import { isDefaultProject } from '../utils/defaultProject.js'

let _projSeq = 0
let _projectSwitchValidationSeq = 0
function genProjectId() {
  return `proj_${Date.now()}_${++_projSeq}`
}

function appendMetadataEvent(event) {
  try {
    const append = typeof window !== 'undefined'
      ? window.electronAPI?.session?.appendMetadataEvent
      : null
    if (typeof append === 'function') {
      Promise.resolve(append(event)).catch(() => {})
    }
  } catch {}
}

function normalizeProjectPathKey(targetPath) {
  if (typeof targetPath !== 'string') return ''
  const trimmed = targetPath.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/\\/g, '/')
  if (/^[A-Za-z]:\/$/.test(normalized) || normalized === '/') {
    return normalized
  }

  return normalized.replace(/\/+$/, '')
}

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [],
    activeProjectId: null,
  }),

  getters: {
    activeProject: (state) => {
      return state.projects.find(p => p.id === state.activeProjectId) ?? null
    },
    getProject: (state) => (id) => {
      return state.projects.find(p => p.id === id) ?? null
    },
    findProjectByName: (state) => (name, excludeId = null) => {
      const trimmed = typeof name === 'string' ? name.trim() : ''
      if (!trimmed) return null
      return state.projects.find(project =>
        project.id !== excludeId &&
        (project.name || '').trim() === trimmed
      ) ?? null
    },
    isNameTaken: (state) => (name, excludeId = null) => {
      const trimmed = typeof name === 'string' ? name.trim() : ''
      if (!trimmed) return false
      return state.projects.some(project =>
        project.id !== excludeId &&
        (project.name || '').trim() === trimmed
      )
    },
    findProjectByPath: (state) => (targetPath) => {
      const pathKey = normalizeProjectPathKey(targetPath)
      if (!pathKey) return null
      return state.projects.find((project) => normalizeProjectPathKey(project.path) === pathKey) ?? null
    },
  },

  actions: {
    addProject(name, path, options = {}) {
      const explicitId = typeof options.id === 'string' && options.id.trim() ? options.id.trim() : null
      const id = explicitId || genProjectId()
      const project = normalizeProjectSnapshot({
        id, name, path,
        ...(options.project ?? {}),
        pathStatus: options.pathStatus ?? PROJECT_PATH_STATUS.VALID,
        pathStatusReason: options.pathStatusReason ?? '',
        lastPathCheckAt: options.lastPathCheckAt ?? 0,
      })
      this.projects.push(project)
      if (options.activate !== false) {
        this.activeProjectId = id
      }
      appendMetadataEvent({
        type: 'project-created',
        payload: {
          projectId: id,
          ...JSON.parse(JSON.stringify(project)),
        },
      })
      return id
    },

    removeProject(id) {
      const idx = this.projects.findIndex(p => p.id === id)
      if (idx === -1) return
      if (isDefaultProject(this.projects[idx])) return
      const notificationStore = useNotificationStore()
      notificationStore.clearNotifications({ projectId: id })
      appendMetadataEvent({
        type: 'project-removed',
        payload: {
          projectId: id,
        },
      })
      this.projects.splice(idx, 1)
      if (this.activeProjectId === id) {
        this.activeProjectId = this.projects[0]?.id ?? null
      }
    },

    switchProject(id) {
      const proj = this.projects.find(p => p.id === id)
      if (proj) {
        this.activeProjectId = id
        appendMetadataEvent({
          type: 'project-activated',
          payload: {
            projectId: id,
          },
        })
      }
    },

    renameProject(id, name) {
      const project = this.projects.find(p => p.id === id)
      const nextName = typeof name === 'string' ? name.trim() : ''
      if (!project || !nextName) return false
      if (isDefaultProject(project)) return false
      if (this.isNameTaken(nextName, id)) return false

      if (project.name !== nextName) {
        project.name = nextName
        appendMetadataEvent({
          type: 'project-updated',
          payload: {
            projectId: id,
            name: nextName,
          },
        })
      }

      return true
    },

    async validateProjectPath(projectId) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return null

      const targetPath = typeof project.path === 'string' ? project.path : ''
      const result = await window.electronAPI?.project?.validatePath?.(targetPath)
      const nextProjectState = mapValidationResultToProjectState(
        result && typeof result === 'object'
          ? result
          : { ok: false, reason: 'unknown', path: targetPath },
      )

      this.setProjectPathStatus(projectId, {
        ...nextProjectState,
        lastPathCheckAt: Date.now(),
      })

      return nextProjectState
    },

    async switchProjectWithValidation(projectId) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return null

      const requestId = ++_projectSwitchValidationSeq
      const nextProjectState = await this.validateProjectPath(projectId)

      if (requestId !== _projectSwitchValidationSeq) {
        return {
          project: this.projects.find(p => p.id === projectId) ?? null,
          readonly: !!nextProjectState?.readonly,
          stale: true,
        }
      }

      if (!nextProjectState?.readonly) {
        try {
          await window.electronAPI?.project?.ensureClaudeTrust?.(project.path)
        } catch (error) {
          console.warn('[projectStore] ensureClaudeTrust failed:', error)
        }
      }

      this.switchProject(projectId)

      return {
        project: this.projects.find(p => p.id === projectId) ?? null,
        readonly: !!nextProjectState?.readonly,
        stale: false,
      }
    },

    async refreshProjectPathStates(options = {}) {
      const {
        force = false,
        maxAgeMs = 30000,
        onlyInvalid = false,
      } = options

      const now = Date.now()
      const refreshed = []

      for (const project of this.projects) {
        if (!project?.id) continue
        if (onlyInvalid && project.pathStatus !== PROJECT_PATH_STATUS.INVALID) continue

        const lastPathCheckAt = typeof project.lastPathCheckAt === 'number'
          ? project.lastPathCheckAt
          : 0
        const shouldRefresh = force || lastPathCheckAt <= 0 || (now - lastPathCheckAt) >= maxAgeMs
        if (!shouldRefresh) continue

        const state = await this.validateProjectPath(project.id)
        refreshed.push({
          projectId: project.id,
          state,
        })
      }

      return refreshed
    },

    addWorkbenchToProject(projectId, workbenchId) {
      const proj = this.projects.find(p => p.id === projectId)
      if (proj) {
        if (!proj.workbenchIds.includes(workbenchId)) {
          proj.workbenchIds.push(workbenchId)
        }
        if (!proj.activeWorkbenchId) {
          proj.activeWorkbenchId = workbenchId
        }
      }
    },

    reorderWorkbench(projectId, fromWorkbenchId, toWorkbenchId) {
      const proj = this.projects.find(p => p.id === projectId)
      if (!proj) return

      const fromIndex = proj.workbenchIds.indexOf(fromWorkbenchId)
      const toIndex = proj.workbenchIds.indexOf(toWorkbenchId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return

      const [moved] = proj.workbenchIds.splice(fromIndex, 1)
      proj.workbenchIds.splice(toIndex, 0, moved)

      appendMetadataEvent({
        type: 'workbench-reordered',
        payload: {
          projectId,
          workbenchIds: [...proj.workbenchIds],
        },
      })
    },

    removeWorkbenchFromProject(projectId, workbenchId) {
      const proj = this.projects.find(p => p.id === projectId)
      if (!proj) return
      const idx = proj.workbenchIds.indexOf(workbenchId)
      if (idx !== -1) proj.workbenchIds.splice(idx, 1)
      if (proj.activeWorkbenchId === workbenchId) {
        proj.activeWorkbenchId = proj.workbenchIds[0] ?? null
      }
    },

    setActiveWorkbench(projectId, workbenchId) {
      const proj = this.projects.find(p => p.id === projectId)
      if (proj) {
        proj.activeWorkbenchId = workbenchId
        appendMetadataEvent({
          type: 'workbench-activated',
          payload: {
            projectId,
            workbenchId,
          },
        })
      }
    },

    loadProjects(data) {
      this.projects = (data.list ?? []).map(project => normalizeProjectSnapshot(project))
      this.activeProjectId = data.activeProjectId ?? this.projects[0]?.id ?? null
    },

    setProjectPathStatus(projectId, payload = {}) {
      const proj = this.projects.find(p => p.id === projectId)
      if (!proj) return

      const nextStatus = payload.pathStatus === PROJECT_PATH_STATUS.INVALID
        ? PROJECT_PATH_STATUS.INVALID
        : PROJECT_PATH_STATUS.VALID

      proj.pathStatus = nextStatus
      proj.pathStatusReason = nextStatus === PROJECT_PATH_STATUS.INVALID
        ? normalizeProjectPathReason(payload.pathStatusReason)
        : ''
      proj.lastPathCheckAt = typeof payload.lastPathCheckAt === 'number'
        ? payload.lastPathCheckAt
        : Date.now()
    },

    isProjectPathInvalid(projectId) {
      const proj = this.projects.find(p => p.id === projectId)
      return proj?.pathStatus === PROJECT_PATH_STATUS.INVALID
    },

    exportProjects() {
      return {
        list: JSON.parse(JSON.stringify(this.projects)),
        activeProjectId: this.activeProjectId,
      }
    },
  },
})
