import { computed, nextTick, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useGroupStore } from '@/modules/group/store'
import { usePrivateStore } from '@/modules/private/store'
import { httpIMClient } from '@/shared/im-http/httpClient.js'

const DEFAULT_BEFORE_LIMIT = 10
const DEFAULT_AFTER_LIMIT = 10
const HIGHLIGHT_MS = 1500

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function raf() {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

function escapeCssValue(value) {
  const raw = String(value ?? '')
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(raw)
  }
  return raw.replace(/["\\]/g, '\\$&')
}

async function waitForDomStable() {
  await nextTick()
  await nextTick()
  await raf()
  await raf()
  await sleep(50)
}

function getStore(scope) {
  if (scope === 'group') return useGroupStore()
  if (scope === 'private') return usePrivateStore()
  throw new Error(`[useMessageLocate] unsupported scope: ${scope}`)
}

function findInStore(store, id, messageId) {
  if (typeof store.findMessageInCurrentWindow === 'function') {
    return store.findMessageInCurrentWindow(id, messageId)
  }
  return null
}

function replaceWithContext(store, id, ctx, beforeLimit, afterLimit) {
  store.replaceWithContext(id, ctx.messages, {
    targetMessageId: ctx.targetMessageId,
    beforeReachedStart: (ctx.beforeCount ?? 0) < beforeLimit,
    afterReachedEnd: (ctx.afterCount ?? 0) < afterLimit,
  })
}

export function useMessageLocate(options) {
  const {
    scope,
    id,
    listRef,
    scrollToMessageId: customScrollToMessageId,
  } = options || {}

  const store = getStore(scope)
  const isLocatingRequest = ref(false)
  const pendingLocateMessageId = ref(null)
  let activeRequestId = 0
  let currentAbortController = null
  const timers = new Set()
  const highlightedElements = new Set()

  const shouldSkipAutoScrollOnActivate = computed(() =>
    isLocatingRequest.value || pendingLocateMessageId.value !== null,
  )

  function setTimer(fn, ms) {
    const timer = setTimeout(() => {
      timers.delete(timer)
      fn()
    }, ms)
    timers.add(timer)
    return timer
  }

  function clearTimers() {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }

  function clearHighlights() {
    for (const el of highlightedElements) {
      el?.classList?.remove('highlight-flash')
    }
    highlightedElements.clear()
  }

  async function defaultScrollToMessageId(messageId) {
    await waitForDomStable()
    const selector = `[data-event-id="${escapeCssValue(messageId)}"]`
    const el = listRef?.value?.querySelector?.(selector)
    if (!el) return false
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-flash')
    highlightedElements.add(el)
    setTimer(() => {
      el.classList.remove('highlight-flash')
      highlightedElements.delete(el)
    }, HIGHLIGHT_MS)
    return true
  }

  async function scrollToTarget(messageId) {
    if (typeof customScrollToMessageId === 'function') {
      const ok = await customScrollToMessageId(messageId)
      if (ok) return true
    }
    return defaultScrollToMessageId(messageId)
  }

  function exitLocating() {
    activeRequestId += 1
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    clearTimers()
    clearHighlights()
    isLocatingRequest.value = false
    pendingLocateMessageId.value = null
  }

  async function locate(messageId) {
    const target = String(messageId ?? '').trim()
    if (!target) {
      ElMessage.warning('该消息已无法定位')
      return { ok: false, reason: 'not_found' }
    }

    exitLocating()
    const requestId = activeRequestId + 1
    activeRequestId = requestId
    isLocatingRequest.value = true

    const storeHit = findInStore(store, id, target)
    if (storeHit) {
      const hitEventId = storeHit.message?.eventId ?? storeHit.message?.event_id ?? target
      const ok = await scrollToTarget(hitEventId)
      await sleep(HIGHLIGHT_MS)
      if (requestId === activeRequestId) isLocatingRequest.value = false
      if (!ok) {
        ElMessage.warning('消息已加载，但定位失败，请手动查找')
        return { ok: false, reason: 'render_failed' }
      }
      return { ok: true, source: 'store', targetMessageId: hitEventId }
    }

    currentAbortController = typeof AbortController !== 'undefined'
      ? new AbortController()
      : null

    try {
      const ctx = await httpIMClient.getMessageContextConverted(id, target, {
        before_limit: DEFAULT_BEFORE_LIMIT,
        after_limit: DEFAULT_AFTER_LIMIT,
        ...(currentAbortController ? { signal: currentAbortController.signal } : {}),
      })

      if (requestId !== activeRequestId || currentAbortController?.signal?.aborted) {
        return { ok: false, reason: 'aborted' }
      }

      if (!ctx?.targetMessageId || !Array.isArray(ctx.messages) || ctx.messages.length === 0) {
        ElMessage.warning('该消息已无法定位')
        isLocatingRequest.value = false
        return { ok: false, reason: 'not_found' }
      }

      replaceWithContext(store, id, ctx, DEFAULT_BEFORE_LIMIT, DEFAULT_AFTER_LIMIT)
      const ok = await scrollToTarget(ctx.targetMessageId)
      await sleep(HIGHLIGHT_MS)
      if (requestId === activeRequestId) isLocatingRequest.value = false
      if (!ok) {
        ElMessage.warning('消息已加载，但定位失败，请手动查找')
        return { ok: false, reason: 'render_failed' }
      }
      return { ok: true, source: 'api', targetMessageId: ctx.targetMessageId }
    } catch (error) {
      if (requestId !== activeRequestId || error?.name === 'AbortError') {
        return { ok: false, reason: 'aborted' }
      }
      console.error('[useMessageLocate] locate failed:', error)
      ElMessage.error('加载失败，请稍后重试')
      isLocatingRequest.value = false
      return { ok: false, reason: 'request_failed' }
    } finally {
      if (requestId === activeRequestId) {
        currentAbortController = null
      }
    }
  }

  function locateFirstUnread() {
    return Promise.resolve({ ok: false, reason: 'unimplemented' })
  }

  function locateFirstMention() {
    return Promise.resolve({ ok: false, reason: 'unimplemented' })
  }

  function setPendingLocate(messageId) {
    pendingLocateMessageId.value = messageId || null
  }

  onUnmounted(() => {
    exitLocating()
  })

  return {
    locate,
    locateFirstUnread,
    locateFirstMention,
    setPendingLocate,
    isLocatingRequest,
    shouldSkipAutoScrollOnActivate,
    exitLocating,
  }
}
