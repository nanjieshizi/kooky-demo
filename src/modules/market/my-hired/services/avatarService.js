/**
 * 头像上传服务
 * 当前为 Mock 实现，后续需要替换为实际的后端接口
 */

/**
 * 上传头像
 * @param {Object} params
 * @param {string} params.image - base64 编码的图片
 * @returns {Promise<{data: {url: string}}>}
 */
export async function uploadAvatarAPI(params) {
  // TODO: 替换为实际后端接口
  // import request from '@/utils/request'
  // return request.post('/api/avatar/upload', params)

  // Mock 实现：模拟网络延迟
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        data: {
          url: params.image // 暂时直接返回 base64
        }
      })
    }, 500)
  })
}

/**
 * 格式化文件大小（可选工具函数）
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
