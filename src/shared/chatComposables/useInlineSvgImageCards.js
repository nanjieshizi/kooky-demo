import { ElMessage } from 'element-plus'
import api, { getSsoToken } from '@/shared/services/api'
import { useUserStore } from '@/modules/auth/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { getOneEnv } from '@/shared/utils/oneEnv'

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const INLINE_SVG_PREVIEW_PREFIX = 'kooky:inline-svg-preview:'
const INLINE_SVG_PREVIEW_TTL = 2 * 60 * 60 * 1000

function roomTypeToBusinessType(roomType) {
  if (roomType === 'bot_person_chat') return 'person'
  if (roomType === 'super_person_chat') return 'opt'
  if (roomType === 'employee_chat') return 'employee'
  if (roomType === 'group_chat') return 'team'
  return 'team'
}

function parsePositiveNumber(value) {
  const n = Number.parseFloat(String(value || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function parseViewBox(svg) {
  const raw = svg?.getAttribute?.('viewBox') || ''
  const parts = raw.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  return { x: parts[0], y: parts[1], width: Math.abs(parts[2]), height: Math.abs(parts[3]) }
}

function measureSvgBBox(svg) {
  try {
    const bbox = svg.getBBox?.()
    if (!bbox) return null
    const { x, y, width, height } = bbox
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
    return { x, y, width, height }
  } catch {
    return null
  }
}

function buildExpandedViewBox(svg) {
  const viewBox = parseViewBox(svg)
  const bbox = measureSvgBBox(svg)
  if (!bbox && (!viewBox.width || !viewBox.height)) return null

  const boxes = []
  if (viewBox.width && viewBox.height) boxes.push(viewBox)
  if (bbox) boxes.push(bbox)

  const padding = 8
  const minX = Math.min(...boxes.map(box => box.x)) - padding
  const minY = Math.min(...boxes.map(box => box.y)) - padding
  const maxX = Math.max(...boxes.map(box => box.x + box.width)) + padding
  const maxY = Math.max(...boxes.map(box => box.y + box.height)) + padding
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)

  return { x: minX, y: minY, width, height }
}

function isSymbolSprite(svg) {
  const children = Array.from(svg?.children || [])
  return children.length > 0 && children.every(child => String(child.tagName || '').toLowerCase() === 'symbol')
}

function shouldCardifySvg(svg) {
  if (!svg || svg.closest?.('[data-inline-svg-card="true"]')) return false
  if (svg.closest?.('button, a, .code-block-wrapper, .file-path-wrapper, .table-wrapper')) return false
  if (isSymbolSprite(svg)) return false
  if (svg.getAttribute?.('aria-hidden') === 'true') return false
  if (svg.closest?.('.mermaid-block')) return true

  const rect = svg.getBoundingClientRect?.() || { width: 0, height: 0 }
  const viewBox = parseViewBox(svg)
  const width = rect.width || parsePositiveNumber(svg.getAttribute('width')) || viewBox.width
  const height = rect.height || parsePositiveNumber(svg.getAttribute('height')) || viewBox.height
  return width >= 96 || height >= 80 || viewBox.width >= 120 || viewBox.height >= 80
}

function serializeSvg(svg) {
  const clone = svg.cloneNode(true)
  const viewBox = buildExpandedViewBox(svg)
  clone.setAttribute('xmlns', clone.getAttribute('xmlns') || SVG_NS)
  clone.setAttribute('xmlns:xlink', clone.getAttribute('xmlns:xlink') || XLINK_NS)
  if (viewBox) {
    const x = Number(viewBox.x.toFixed(2))
    const y = Number(viewBox.y.toFixed(2))
    const width = Number(viewBox.width.toFixed(2))
    const height = Number(viewBox.height.toFixed(2))
    clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`)
    clone.setAttribute('width', String(Math.ceil(width)))
    clone.setAttribute('height', String(Math.ceil(height)))
    clone.setAttribute('overflow', 'visible')
    clone.style.width = ''
    clone.style.height = ''
    clone.style.maxWidth = ''
  }
  return new XMLSerializer().serializeToString(clone)
}

function svgToDataUrl(svgText) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
}

function formatBytes(bytes) {
  const n = Number(bytes || 0)
  if (!Number.isFinite(n) || n <= 0) return 'SVG 图片'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function safeFileStem(value, fallback) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  const cleaned = text.replace(/[\\/:*?"<>|]+/g, ' ').trim()
  return (cleaned || fallback).slice(0, 48)
}

function findHeadingTitle(svg) {
  const root = svg.closest?.('.markdown-content') || svg.parentElement
  let node = svg.closest?.('.mermaid-block') || svg
  while (node && node !== root) {
    let prev = node.previousElementSibling
    while (prev) {
      if (/^H[1-6]$/i.test(prev.tagName || '')) return prev.textContent
      prev = prev.previousElementSibling
    }
    node = node.parentElement
  }
  return ''
}

function buildFileName(svg, index) {
  const prefix = svg.closest?.('.mermaid-block') ? 'mermaid' : 'svg'
  const title = safeFileStem(findHeadingTitle(svg), `${prefix}-image`)
  return `${title}-${index + 1}.svg`
}

function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'inline-svg-card-action-icon')
  svg.setAttribute('aria-hidden', 'true')

  const use = document.createElementNS(SVG_NS, 'use')
  use.setAttributeNS(XLINK_NS, 'xlink:href', `#${name}`)
  use.setAttribute('href', `#${name}`)
  svg.appendChild(use)
  return svg
}

function createActionButton({ title, iconName, onClick }) {
  const wrapper = document.createElement('span')
  wrapper.className = 'inline-svg-card-tooltip'
  wrapper.dataset.tooltip = title

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'inline-svg-card-action-btn'
  button.title = title
  button.setAttribute('aria-label', title)
  button.appendChild(createIcon(iconName))
  button.addEventListener('click', onClick)
  wrapper.appendChild(button)

  return { wrapper, button }
}

function downloadSvg(svgText, fileName) {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1200)
}

function pruneInlineSvgPreviewCache(now = Date.now()) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i)
      if (!key?.startsWith(INLINE_SVG_PREVIEW_PREFIX)) continue
      const payload = JSON.parse(localStorage.getItem(key) || '{}')
      if (!payload.createdAt || now - payload.createdAt > INLINE_SVG_PREVIEW_TTL) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    /* ignore cache cleanup failures */
  }
}

function cacheInlineSvgPreview({ dataUrl, fileName, byteSize }) {
  if (typeof localStorage === 'undefined') return ''
  const key = `${INLINE_SVG_PREVIEW_PREFIX}${Date.now()}:${Math.random().toString(36).slice(2)}`
  try {
    pruneInlineSvgPreviewCache()
    localStorage.setItem(key, JSON.stringify({
      inlineDataUrl: dataUrl,
      name: fileName,
      type: 'svg',
      size: byteSize,
      mimeType: 'image/svg+xml',
      createdAt: Date.now(),
    }))
    return key
  } catch {
    return ''
  }
}

function openSvgPreviewFallback(dataUrl, title) {
  const mask = document.createElement('div')
  mask.className = 'inline-svg-preview-mask'

  const dialog = document.createElement('div')
  dialog.className = 'inline-svg-preview-dialog'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')

  const header = document.createElement('div')
  header.className = 'inline-svg-preview-header'

  const name = document.createElement('div')
  name.className = 'inline-svg-preview-title'
  name.textContent = title || 'SVG 预览'

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'inline-svg-preview-close'
  closeBtn.setAttribute('aria-label', '关闭预览')
  closeBtn.textContent = 'x'

  const body = document.createElement('div')
  body.className = 'inline-svg-preview-body'

  const img = document.createElement('img')
  img.className = 'inline-svg-preview-img'
  img.src = dataUrl
  img.alt = title || 'SVG 预览'

  function close() {
    document.removeEventListener('keydown', onKeydown)
    mask.remove()
  }

  function onKeydown(event) {
    if (event.key === 'Escape') close()
  }

  closeBtn.addEventListener('click', close)
  mask.addEventListener('click', (event) => {
    if (event.target === mask) close()
  })
  document.addEventListener('keydown', onKeydown)

  header.append(name, closeBtn)
  body.appendChild(img)
  dialog.append(header, body)
  mask.appendChild(dialog)
  document.body.appendChild(mask)
}

function openSvgPreview({ dataUrl, fileName, byteSize, spaceId, roomType }) {
  const inlinePreviewKey = cacheInlineSvgPreview({ dataUrl, fileName, byteSize })
  if (!inlinePreviewKey) {
    openSvgPreviewFallback(dataUrl, fileName)
    return
  }

  const previewInfo = {
    id: inlinePreviewKey,
    name: fileName,
    type: 'svg',
    inlinePreviewKey,
    mxcUrl: '',
    httpUrl: '',
    size: byteSize,
    mimeType: 'image/svg+xml',
    spaceId: spaceId ? String(spaceId) : '',
    roomType,
    source: 'inline-svg',
  }

  if (window.electronAPI?.openFilePreview) {
    window.electronAPI.openFilePreview(previewInfo)
    return
  }

  openSvgPreviewFallback(dataUrl, fileName)
}

async function saveSvgToLibrary({ svgText, fileName, spaceId, roomType }) {
  if (!spaceId) {
    ElMessage.warning('缺少会话信息，无法保存')
    return
  }

  const userStore = useUserStore()
  const uiStore = useUIStore()
  const imConnectionStore = useImConnectionStore()
  if (!userStore.userInfo && typeof userStore.initFromStorage === 'function') userStore.initFromStorage()

  const formData = new FormData()
  const file = new File([svgText], fileName, { type: 'image/svg+xml' })
  formData.append('file', file, fileName)

  const userId = String(userStore.userInfo?.userId ?? '')
  const token = getSsoToken()
  await api.post('kc-media/api/v1/team-files/upload', formData, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Business-Type': roomTypeToBusinessType(roomType),
      'X-Business-Id': String(spaceId),
      'X-Env': getOneEnv(),
      ...(userId ? { 'X-User-Id': userId } : {}),
      'X-Bind-Im-User-Id': String(imConnectionStore.userId || userId || ''),
    },
  })

  ElMessage.success('已保存到文件库')
  window.dispatchEvent(new CustomEvent('files-uploaded-to-tree', {
    detail: { spaceId: String(spaceId), roomType },
  }))
  uiStore.setActiveToolTab('file')
}

function createSvgCard({ svgText, dataUrl, fileName, byteSize, sizeText, spaceId, roomType, registerCleanup }) {
  const card = document.createElement('div')
  card.className = 'inline-svg-image-card'
  card.dataset.inlineSvgCard = 'true'

  const preview = document.createElement('div')
  preview.className = 'inline-svg-card-preview'
  preview.setAttribute('role', 'button')
  preview.setAttribute('tabindex', '0')
  preview.setAttribute('aria-label', '预览 SVG')

  const img = document.createElement('img')
  img.className = 'inline-svg-card-thumb'
  img.src = dataUrl
  img.alt = fileName
  img.loading = 'lazy'
  preview.appendChild(img)

  const info = document.createElement('div')
  info.className = 'inline-svg-card-info'
  info.setAttribute('role', 'button')
  info.setAttribute('tabindex', '0')
  info.setAttribute('aria-label', '预览 SVG')

  const name = document.createElement('span')
  name.className = 'inline-svg-card-name'
  name.title = fileName
  name.textContent = fileName

  const size = document.createElement('span')
  size.className = 'inline-svg-card-size'
  size.textContent = sizeText
  info.append(name, size)

  const actions = document.createElement('div')
  actions.className = 'inline-svg-card-actions'

  const onPreview = (event) => {
    event?.stopPropagation?.()
    openSvgPreview({ dataUrl, fileName, byteSize, spaceId, roomType })
  }
  const onDownload = (event) => {
    event.stopPropagation()
    downloadSvg(svgText, fileName)
  }
  const onSave = async (event) => {
    event.stopPropagation()
    const button = event.currentTarget
    if (button?.disabled) return
    button.disabled = true
    try {
      await saveSvgToLibrary({ svgText, fileName, spaceId, roomType })
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || '保存失败'
      ElMessage.error(msg)
    } finally {
      button.disabled = false
    }
  }

  preview.addEventListener('click', onPreview)
  const onPreviewKeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onPreview(event)
    }
  }
  preview.addEventListener('keydown', onPreviewKeydown)
  info.addEventListener('click', onPreview)
  const onInfoKeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onPreview(event)
    }
  }
  info.addEventListener('keydown', onInfoKeydown)

  const save = createActionButton({ title: '保存', iconName: 'icon-baocun', onClick: onSave })
  const download = createActionButton({ title: '下载', iconName: 'icon-xiazai', onClick: onDownload })
  actions.append(save.wrapper, download.wrapper)

  registerCleanup(() => {
    preview.removeEventListener('click', onPreview)
    preview.removeEventListener('keydown', onPreviewKeydown)
    info.removeEventListener('click', onPreview)
    info.removeEventListener('keydown', onInfoKeydown)
    save.button.removeEventListener('click', onSave)
    download.button.removeEventListener('click', onDownload)
  })

  card.append(preview, info, actions)
  return card
}

export function useInlineSvgImageCards({ containerRef, enabled, spaceId, roomType = 'super_person_chat' }) {
  const cleanups = []

  function registerCleanup(cleanup) {
    cleanups.push(cleanup)
  }

  function cleanupInlineSvgCards() {
    while (cleanups.length) {
      const cleanup = cleanups.pop()
      try { cleanup?.() } catch { /* noop */ }
    }
  }

  function isEnabled() {
    return typeof enabled === 'function' ? !!enabled() : !!enabled
  }

  function renderInlineSvgCards() {
    if (!isEnabled()) return

    const container = containerRef?.value
    if (!container) return

    const svgs = Array.from(container.querySelectorAll('svg')).filter(shouldCardifySvg)
    svgs.forEach((svg, index) => {
      const svgText = serializeSvg(svg)
      const dataUrl = svgToDataUrl(svgText)
      const fileName = buildFileName(svg, index)
      const size = new Blob([svgText]).size
      const sizeText = formatBytes(size)
      const card = createSvgCard({
        svgText,
        dataUrl,
        fileName,
        byteSize: size,
        sizeText,
        spaceId: typeof spaceId === 'function' ? spaceId() : spaceId,
        roomType: typeof roomType === 'function' ? roomType() : roomType,
        registerCleanup,
      })
      const mermaidBlock = svg.closest('.mermaid-block')
      if (mermaidBlock && mermaidBlock.children.length === 1) {
        mermaidBlock.replaceChildren(card)
      } else {
        svg.replaceWith(card)
      }
    })
  }

  return {
    renderInlineSvgCards,
    cleanupInlineSvgCards,
  }
}
