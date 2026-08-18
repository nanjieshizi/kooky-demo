import { defineStore } from 'pinia'
import { extractTranscriptPathFromPayload } from '@/modules/terminal/utils/claudeHookPayload'

/**
 * Claude Code 状态管理（轻量版）
 * 终端状态由 xterm.js + node-pty 直接管理，此 store 仅存全局偏好
 */
export const useClaudeCodeStore = defineStore('claudeCode', {
  state: () => ({
    envReady: false,
    defaultWorkingDir: '',
    defaultModel: 'claude-sonnet-4-20250514',
    theme: 'mocha', // 'mocha' | 'dark' | 'light'
    fontSize: 14,
    /** 最近一次 hook 中的 Claude Code 会话 ID（对应载荷 session_id） */
    lastHookSessionUuid: null,
    /** 最近一次 hook 中的回复/轮次 ID（若 CLI 未返回相关字段则为 null） */
    lastHookResponseId: null,
    lastHookEventName: null,
    lastHookAt: null,
    /** 最近一次 hook 完整载荷（与 preload 一致：event/route/data/timestamp） */
    lastHookPayload: null,
    /** 最近一次 payload.data 的键名排序列表，便于核对「实际返回了哪些字段」 */
    lastHookDataKeys: [],
  }),

  getters: {
    /** 最近一次 hook 中的 transcript 路径（未收到过则为 null），可能含 ~/ */
    lastTranscriptPath: (state) => extractTranscriptPathFromPayload(state.lastHookPayload),
  },

  actions: {
    setEnvReady(value) {
      this.envReady = value
    },
    setDefaultWorkingDir(dir) {
      this.defaultWorkingDir = dir
    },
    setTheme(theme) {
      this.theme = theme
    },
    setFontSize(size) {
      this.fontSize = size
    },

    /**
     * 合并写入 hook 解析出的 ID（有值才覆盖，避免空事件冲掉已有 responseId）
     * @param {{ sessionUuid?: string|null, responseId?: string|null, event?: string|null }} ids
     */
    mergeHookIdentifiers(ids) {
      if (ids.sessionUuid != null && String(ids.sessionUuid).length) {
        this.lastHookSessionUuid = ids.sessionUuid
      }
      if (ids.responseId != null && String(ids.responseId).length) {
        this.lastHookResponseId = ids.responseId
      }
      if (ids.event != null) {
        this.lastHookEventName = ids.event
      }
      this.lastHookAt = Date.now()
    },

    /**
     * 保存完整 hook 载荷（渲染进程收到的对象）
     * @param {{ event?: string, route?: string, data?: object, timestamp?: number, latestAssistantTurn?: object }|null} payload
     */
    setLastHookPayload(payload) {
      if (!payload) {
        this.lastHookPayload = null
        this.lastHookDataKeys = []
        return
      }
      const data = payload.data
      const lat = payload.latestAssistantTurn
      this.lastHookPayload = {
        event: payload.event ?? null,
        route: payload.route ?? null,
        timestamp: payload.timestamp ?? null,
        data:
          data && typeof data === 'object'
            ? JSON.parse(JSON.stringify(data))
            : data,
        ...(lat && typeof lat === 'object'
          ? {
              latestAssistantTurn: JSON.parse(JSON.stringify(lat)),
            }
          : {}),
      }
      this.lastHookDataKeys =
        data && typeof data === 'object' ? Object.keys(data).sort() : []
    },

    /**
     * 用系统默认程序打开最近一次 hook 中的 transcript（一般为 .jsonl）
     * @returns {Promise<{ ok: boolean, error?: string }>}
     */
    async openLastTranscriptFile() {
      const p = this.lastTranscriptPath
      if (!p) return { ok: false, error: '暂无 transcript_path，请先触发一次带该字段的 Hook' }
      if (!window.electronAPI?.openPath) return { ok: false, error: '仅桌面端可用' }
      const err = await window.electronAPI.openPath(p)
      if (err && String(err).length) return { ok: false, error: String(err) }
      return { ok: true }
    },

    /** 在资源管理器中定位最近一次 transcript 文件 */
    async revealLastTranscriptInFolder() {
      const p = this.lastTranscriptPath
      if (!p) return { ok: false, error: '暂无 transcript_path' }
      if (!window.electronAPI?.showItemInFolder) return { ok: false, error: '仅桌面端可用' }
      await window.electronAPI.showItemInFolder(p)
      return { ok: true }
    },
  },
})
