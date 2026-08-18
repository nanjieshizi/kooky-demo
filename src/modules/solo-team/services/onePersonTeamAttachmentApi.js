import api, { getSsoToken } from '@/shared/services/api'
import { absoluteKookyPublicUrl } from '@/shared/utils/kookyGateway'

function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function toAbsoluteOnePersonMediaUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return ''
  if (/^(blob:|data:)/i.test(pathOrUrl)) return pathOrUrl
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return absoluteKookyPublicUrl(path)
}

export function resolveOnePersonArtifactUrl(langgraphThreadId, absolutePath) {
  if (!langgraphThreadId || !absolutePath) return ''
  const path = String(absolutePath).startsWith('/') ? String(absolutePath) : `/${absolutePath}`
  return absoluteKookyPublicUrl(`/kooky-api/api/threads/${langgraphThreadId}/artifacts${path}`)
}

export function buildOnePersonUploadArtifactUrl(langgraphThreadId, filename) {
  if (!langgraphThreadId || !filename) return ''
  return absoluteKookyPublicUrl(
    `/kooky-api/api/threads/${langgraphThreadId}/artifacts/mnt/user-data/uploads/${encodeURIComponent(filename)}`,
  )
}

export const onePersonTeamAttachmentApi = {
  async uploadFiles(langgraphThreadId, files) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post(`/kooky-api/api/threads/${langgraphThreadId}/uploads`, formData, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
    })
  },

  async fetchThreadArtifactBlob(absoluteOrRelativeUrl) {
    const url = toAbsoluteOnePersonMediaUrl(absoluteOrRelativeUrl)
    if (!url) return null
    const res = await api.get(url, {
      headers: getAuthHeaders(),
      responseType: 'blob',
    })
    const data = res?.data ?? res
    return data instanceof Blob ? data : null
  },
}
