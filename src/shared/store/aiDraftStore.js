/**
 * AI 起草态 store · "🦀 帮我回复" 用
 *
 * 每个会话维度维护一份"草稿"状态：
 *   - idle      : 无草稿
 *   - thinking  : 已点击「帮我回复」，AI 还没开始输出
 *   - streaming : AI 正在流式输出
 *   - ready     : 已完成，可填到输入框、可编辑、可发送
 *
 * GroupChatInput 监听该状态，进入"AI 起草态"时禁用输入 + 显示 banner。
 * dev-mocks 的 startAiDraft helper 负责调 demo-server SSE 喂这条状态。
 */

import { defineStore } from 'pinia'

export const useAiDraftStore = defineStore('ai-draft', {
  state: () => ({
    /** conversationId → { status, sourceMessage, draftText } */
    drafts: {},
  }),
  getters: {
    /** 拿到某会话的草稿状态（默认 idle） */
    getDraft: (state) => (cid) => state.drafts[cid] || { status: 'idle', draftText: '', sourceMessage: null },
    /** 是否处于"AI 起草中"（thinking 或 streaming），输入框要 disable */
    isDrafting: (state) => (cid) => {
      const s = state.drafts[cid]?.status
      return s === 'thinking' || s === 'streaming'
    },
    /** 是否处于 ready 态（草稿生成完，等用户编辑/发送） */
    isReady: (state) => (cid) => state.drafts[cid]?.status === 'ready',
  },
  actions: {
    startDraft(cid, sourceMessage) {
      this.drafts[cid] = {
        status: 'thinking',
        sourceMessage,
        draftText: '',
      }
    },
    setStreaming(cid) {
      const d = this.drafts[cid]
      if (d && d.status === 'thinking') d.status = 'streaming'
    },
    appendText(cid, text) {
      const d = this.drafts[cid]
      if (!d) return
      if (d.status === 'thinking') d.status = 'streaming'
      d.draftText = (d.draftText || '') + (text || '')
    },
    setReady(cid) {
      const d = this.drafts[cid]
      if (!d) return
      if (d.status !== 'ready') d.status = 'ready'
    },
    setError(cid, message) {
      const d = this.drafts[cid]
      if (!d) {
        this.drafts[cid] = { status: 'ready', draftText: `（草稿失败：${message || '未知错误'}）`, sourceMessage: null }
        return
      }
      d.status = 'ready'
      d.draftText = `（草稿失败：${message || '未知错误'}）`
    },
    /** 清空草稿（用户编辑后自己发送，或主动放弃） */
    clear(cid) {
      delete this.drafts[cid]
    },
  },
})
