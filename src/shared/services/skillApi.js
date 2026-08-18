/**
 * Skills 接口服务
 * 接口文档：OC实例端侧接口文档.md §2 已安装 Skills 列表
 * 本期全量加载，前端保留分页参数结构，后期替换分页接口时只改此文件
 */
import api from './api'
import { USER_INFO_STORAGE_KEY } from '@/shared/constants/storageKeys'

const SKILLS_PATH = '/assistant/be-super-assistant/api/v1/agent/admin/skills'

/**
 * 获取已安装技能列表
 * @param {{ page?: number, pageSize?: number, keyword?: string }} options
 * @returns {Promise<{ list: Array<{ id: string, name: string, version: string, path: string }>, total: number, hasMore: boolean }>}
 */
export async function fetchSkills({ page = 1, pageSize = 20, keyword = '' } = {}) {
  let username = ''
  try {
    const raw = localStorage.getItem(USER_INFO_STORAGE_KEY)
    if (raw) {
      const info = JSON.parse(raw)
      username = info?.userId || ''
    }
  } catch {
    // ignore
  }

  const res = await api.get(SKILLS_PATH, {
    params: { type: 'global' },
    headers: {
      'X-KC-Account': username,
    },
  })

  const data = res.data?.data ?? res.data ?? {}

  let list = Object.values(data).map(skill => ({
    id: skill.id,
    name: skill.meta?.name || skill.id,
    version: skill.meta?.version || '',
    path: skill.path || '',
  }))

  if (keyword) {
    const kw = keyword.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(kw) || s.id.toLowerCase().includes(kw))
  }

  const total = list.length
  return { list, total, hasMore: false }
}
