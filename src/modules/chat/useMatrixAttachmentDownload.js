import { ElMessage } from 'element-plus'

export function useMatrixAttachmentDownload() {
  function attachmentDownloadHref(file) {
    return file?.url || ''
  }

  function isImageAttachment(file) {
    if (!file) return false
    if (file.type === 'image') return true
    const m = file.mimeType
    return typeof m === 'string' && m.startsWith('image/')
  }

  async function fetchAttachmentPreviewObjectUrl(file) {
    if (!file?.url) return ''
    try {
      const resp = await fetch(file.url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      return URL.createObjectURL(blob)
    } catch (e) {
      console.warn('[useMatrixAttachmentDownload] 预览 Blob 拉取失败:', e)
      return ''
    }
  }

  function revokeAttachmentPreviewUrl(url) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* noop */
      }
    }
  }

  async function downloadAttachment(file) {
    if (!file?.url) return
    const name = file?.name || 'download'
    try {
      const resp = await fetch(file.url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      console.warn('[useMatrixAttachmentDownload] 附件下载失败:', e)
      const href = attachmentDownloadHref(file)
      if (href) {
        window.open(href, '_blank', 'noopener,noreferrer')
      } else {
        ElMessage.warning('下载失败，请稍后重试')
      }
    }
  }

  function onAttachmentActivate(file) {
    if (!attachmentDownloadHref(file)) return
    void downloadAttachment(file)
  }

  return {
    attachmentDownloadHref,
    downloadAttachment,
    onAttachmentActivate,
    isImageAttachment,
    fetchAttachmentPreviewObjectUrl,
    revokeAttachmentPreviewUrl,
  }
}
