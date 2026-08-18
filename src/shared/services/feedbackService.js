import api, { getSsoToken } from './api'

/**
 * 批量上传反馈图片
 * @param {File[]} files - 图片文件数组(最多5张,每张最大5MB)
 * @returns {Promise<{code: string, data: string[], msg: string}>}
 */
export function uploadFeedbackImages(files) {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  const token = getSsoToken()
  return api.post('/kc-public/kc-user/api/client/v1/feedback/upload-images', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': `Bearer ${token}`
    }
  })
}

/**
 * 提交用户反馈
 * @param {Object} data
 * @param {string} data.feedbackType - 反馈类型: bug|feature|other
 * @param {string} data.content - 反馈内容
 * @param {string[]} data.images - 图片URL数组
 * @param {string} data.clientType - 客户端类型: web|electron
 * @param {Object} data.clientInfo - 客户端信息
 * @returns {Promise}
 */
export function submitFeedback(data) {
  const token = getSsoToken()
  return api.post('/kooky-api/api/client/v1/feedback/submit', data, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}
