/**
 * 群聊 API（兼容层）
 * 此文件保留作为兼容层，实际接口已迁移到 @/shared/services/imApi.js
 */

export {
  createGroupApi as createGroup,
  getGroupsApi as getGroups,
  getGroupDetailApi as getGroupDetail,
  inviteGroupMembersApi as inviteGroupMembers,
  removeGroupMembersApi as removeGroupMembers,
  leaveGroupApi as leaveGroup,
  saveGroupSettingsApi as saveGroupSettings,
  renameGroupApi as renameGroup,
  dissolveGroupApi as dissolveGroupConversation,
  sendGroupMessageApi as sendGroupMessage,
  getGroupMessagesApi as getGroupMessages,
  getConversationEventsApi as getConversationEvents,
  isFirstMessageApi as isFirstMessage,
  isLastMessageApi as isLastMessage,
  getMessageContextApi as getMessageContext,
  forwardSingleMessageApi as forwardSingleMessage,
  forwardBatchMessagesApi as forwardBatchMessages,
  bindGroupAgentApi as bindGroupAgent,
  unbindGroupAgentApi as unbindGroupAgent,
  getGroupTasksApi as getGroupTasks,
} from '@/shared/services/imApi.js'

/**
 * 上传群聊文件（包含复杂的 XHR 逻辑，保留在此文件中）
 * @param {string|number} conversationId
 * @param {File} file
 * @param {object} options
 * @param {string} options.baseUrl
 * @param {string} options.token
 * @param {string} options.userId
 * @param {string} options.env
 * @param {Function} options.onProgress
 * @returns {Promise<{ fileId: string, fileInfo: object, downloadUrl: string }>}
 */
export function uploadGroupFile(conversationId, file, options = {}) {
  const { baseUrl = '', token = '', userId = '', env = 'dev', onProgress } = options

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('ext', JSON.stringify({ source: 'conversation', sourceId: String(conversationId) }))

    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        onProgress(e.loaded / e.total)
      }
    }

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = xhr.responseText ? JSON.parse(xhr.responseText) : {}
          const fileInfo = response.data || response
          const fileId = fileInfo.id

          if (!fileId) {
            reject(new Error('上传成功但未返回文件 ID'))
            return
          }

          try {
            const downloadUrl = await getFileDownloadUrl(conversationId, fileId, { baseUrl, token, userId, env })
            resolve({ fileId, fileInfo, downloadUrl })
          } catch (urlError) {
            reject(new Error(`获取下载链接失败: ${urlError.message}`))
          }
        } catch (e) {
          reject(new Error('上传响应解析失败'))
        }
      } else {
        reject(new Error(`上传失败：HTTP ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('网络错误，文件上传失败'))
    xhr.onabort = () => reject(new Error('文件上传已取消'))

    const fullUrl = `${baseUrl}/kc-media/api/v1/team-files/upload`
    xhr.open('POST', fullUrl)

    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('X-Business-Id', 'staging')
    xhr.setRequestHeader('X-Business-Type', 'team')
    xhr.setRequestHeader('X-Env', env)
    if (userId) {
      xhr.setRequestHeader('X-User-Id', userId)
      xhr.setRequestHeader('X-Bind-Im-User-Id', userId)
    }

    xhr.send(formData)
  })
}

/**
 * 获取文件下载 URL
 * @private
 */
async function getFileDownloadUrl(conversationId, fileId, options = {}) {
  const { baseUrl = '', token = '', userId = '', env = 'dev' } = options

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = xhr.responseText ? JSON.parse(xhr.responseText) : {}
          const url = response.data || response.url || ''
          if (url) {
            resolve(url)
          } else {
            reject(new Error('未返回下载链接'))
          }
        } catch (e) {
          reject(new Error('响应解析失败'))
        }
      } else {
        reject(new Error(`获取下载链接失败：HTTP ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('网络错误'))

    const fullUrl = `${baseUrl}/kc-media/api/v1/team-files/${fileId}/download-url?expireSeconds=0`
    xhr.open('GET', fullUrl)

    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('X-Business-Id', String(conversationId))
    xhr.setRequestHeader('X-Business-Type', 'team')
    xhr.setRequestHeader('X-Env', env)
    if (userId) {
      xhr.setRequestHeader('X-User-Id', userId)
      xhr.setRequestHeader('X-Bind-Im-User-Id', userId)
    }

    xhr.send()
  })
}

