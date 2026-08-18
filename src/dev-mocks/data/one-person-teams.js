/**
 * dev-mocks 一人团队群（内置）
 *
 * 默认 2 个团队群，复用聘用过的数字人作为成员：
 *   🚀 迭代上线攻坚队 = 研发 + 测试 + 架构
 *   📋 PRD 写作组    = 产品 + 设计
 *
 * 字段对照 normalizeOnePersonTeam：
 *   { id, name, coordinator_id, members[], max_concurrent_goals, auto_archive_hours }
 */

import { findRawAgent } from './digital-humans'

export const RAW_ONE_PERSON_TEAMS = [
  {
    id: 'opt-001',
    teamId: 'opt-001',
    name: '🚀 迭代上线攻坚队',
    description: '产研测协同跑研发流水线',
    coordinator_id: 1002, // 研发数字人
    members: [
      { agent_id: 1002, role: 'coordinator' },
      { agent_id: 1003, role: 'member' }, // 测试
      { agent_id: 1005, role: 'member' }, // 架构
    ],
    max_concurrent_goals: 3,
    auto_archive_hours: 24,
    avatar: '',
    created_at: '2026-05-10T10:00:00.000Z',
  },
  {
    id: 'opt-002',
    teamId: 'opt-002',
    name: '📋 PRD 写作组',
    description: '产品设计协同写文档',
    coordinator_id: 1001, // 产品数字人
    members: [
      { agent_id: 1001, role: 'coordinator' },
      { agent_id: 1004, role: 'member' }, // 设计
    ],
    max_concurrent_goals: 3,
    auto_archive_hours: 24,
    avatar: '',
    created_at: '2026-05-12T10:00:00.000Z',
  },
]

/** 拓宽：把 members[].agent_id 解出来挂上 agent 详情，给前端 UI 用 */
export function enrichOnePersonTeam(team) {
  const members = (team.members || []).map((m) => {
    const agent = findRawAgent(m.agent_id)
    return {
      ...m,
      agent_id: m.agent_id,
      role: m.role,
      name: agent?.agent_display_name || `Agent ${m.agent_id}`,
      avatar: agent?.agent_avatar_url || '',
    }
  })
  return {
    ...team,
    members,
  }
}

export function mockFetchOnePersonTeams() {
  return RAW_ONE_PERSON_TEAMS.map(enrichOnePersonTeam)
}
