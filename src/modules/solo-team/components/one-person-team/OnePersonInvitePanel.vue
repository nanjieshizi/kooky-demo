<template>
  <div class="invite-mask" @click.self="$emit('close')">
    <div class="invite-panel">
      <div class="ip-head">
        <span class="ip-title">{{ headTitle }}</span>
        <button type="button" class="ip-close" @click="$emit('close')" aria-label="关闭">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.6" stroke-linecap="round" /></svg>
        </button>
      </div>
      <p class="ip-sub">{{ subText }}</p>

      <div class="ip-search">
        <svg class="ip-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input v-model="query" class="ip-search__input" type="text" placeholder="搜索数字员工" spellcheck="false" />
        <button v-if="query" type="button" class="ip-search__clear" @click="query = ''" aria-label="清空">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="#c0c4cc" stroke-width="1.6" stroke-linecap="round" /></svg>
        </button>
      </div>

      <div class="ip-scroll">
        <!-- 我的员工 -->
        <div class="ip-section">
          <div class="ip-section__label">我的员工 <span class="ip-section__hint">· {{ filteredEmployees.length }} 位</span></div>
          <button
            v-for="m in filteredEmployees"
            :key="m.agent_id"
            type="button"
            class="ip-item"
            :class="{ 'is-picked': selected.has(String(m.agent_id)), 'is-disabled': inTeam.has(String(m.agent_id)) && !manage }"
            :disabled="inTeam.has(String(m.agent_id)) && !manage"
            @click="toggle(m)"
          >
            <img class="ip-avatar" :src="m.avatar || fallbackAvatar" alt="" draggable="false" />
            <span class="ip-info">
              <span class="ip-name">{{ m.name }}</span>
              <span class="ip-desc">{{ m.title || m.role_desc || '数字员工' }}</span>
            </span>
            <span v-if="inTeam.has(String(m.agent_id))" class="ip-tag" :class="manage ? 'ip-tag--remove' : 'ip-tag--in'">
              {{ manage ? '移出 ✕' : '已在群' }}
            </span>
            <span v-else class="ip-check" :class="{ 'is-on': selected.has(String(m.agent_id)) }" aria-hidden="true">
              <svg v-if="selected.has(String(m.agent_id))" width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>
          <div v-if="!filteredEmployees.length" class="ip-empty">没找到「{{ query }}」相关的员工</div>
        </div>

        <!-- 为你推荐（广告位）：每次打开随机换人 -->
        <div v-if="!query" class="ip-section">
          <div class="ip-section__label ip-section__label--promo">✨ 为你推荐 <span class="ip-section__hint">· 每次都有新面孔</span></div>
          <button
            v-for="m in market"
            :key="m.agent_id"
            type="button"
            class="ip-item ip-item--promo"
            :class="{ 'is-picked': selected.has(String(m.agent_id)) }"
            @click="toggle(m)"
          >
            <img class="ip-avatar" :src="m.avatar || fallbackAvatar" alt="" draggable="false" />
            <span class="ip-info">
              <span class="ip-name">{{ m.name }}<span class="ip-promo">{{ m.promo }}</span></span>
              <span class="ip-desc">{{ m.title }}</span>
            </span>
            <span class="ip-check" :class="{ 'is-on': selected.has(String(m.agent_id)) }" aria-hidden="true">
              <svg v-if="selected.has(String(m.agent_id))" width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>
        </div>
      </div>

      <div class="ip-foot">
        <button type="button" class="ip-market-link" @click="goMarket">
          没有中意的？去市场找更心仪的数字人 →
        </button>
        <button type="button" class="ip-confirm" :disabled="!selected.size" @click="confirmInvite">
          {{ mode === 'create' ? '开始会话' : '拉进会话' }}{{ selected.size ? `（${selected.size}）` : '' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { inviteMembers, removeMember } from '../../demo/onePersonDirector'
import { useUIStore } from '@/modules/space/uiStore'
import fallbackAvatar from '@/assets/default-agent-avatar.svg'

const router = useRouter()
const uiStore = useUIStore()

defineOptions({ name: 'OnePersonInvitePanel' })

const props = defineProps({
  teamId: { type: [String, Number], default: '' },
  mainThreadId: { type: String, default: '' },
  memberIds: { type: Array, default: () => [] }, // 已在群的 agent_id
  mode: { type: String, default: 'invite' }, // invite=拉进当前会话 / create=选人开新会话
  title: { type: String, default: '' },
  manage: { type: Boolean, default: false }, // 成员管理：已在群的可点击移除
})
const emit = defineEmits(['close', 'invited', 'confirm'])

const headTitle = computed(() => props.title || (props.mode === 'create' ? '选数字员工，开多人会话' : '拉数字员工进会话'))
const subText = computed(() => (props.mode === 'create'
  ? '勾选谁，就和谁开一场多人会话——你和分身照旧在，多的是这些数字员工。'
  : '勾选谁，就把谁拉进当前会话——会话会从「你和分身」升级成多人协作群。'))

const inTeam = computed(() => new Set((props.memberIds || []).map(String)))
const query = ref('')

// 我的员工：现有数字员工（排除分身本体）
const myEmployees = computed(() => (window.__optMock?.employees || [])
  .filter((e) => !e.is_default && String(e.agent_id) !== '9001'))
const filteredEmployees = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return myEmployees.value
  return myEmployees.value.filter((m) => {
    const hay = `${m.name || ''} ${m.title || m.role_desc || ''}`.toLowerCase()
    return hay.includes(q)
  })
})

// 市场"广告位"候选池（demo：实际是后台可配置的推荐池，这里不体现，只随机洗牌模拟）
const MARKET_POOL = [
  { agent_id: 8001, name: '数据分析师 · Alice', title: '数据接入 / 指标拆解 / 结论输出' },
  { agent_id: 8002, name: '增长运营 · Ben', title: '拉新 / 转化 / 复盘' },
  { agent_id: 8003, name: '视觉设计 · Coco', title: '品牌 / 海报 / 动效' },
  { agent_id: 8004, name: '资深文案 · Dan', title: '卖点提炼 / 长短文案 / 脚本' },
  { agent_id: 8005, name: '用户研究 · Ella', title: '深访 / 问卷 / 用户画像' },
  { agent_id: 8006, name: '测试工程师 · Finn', title: '用例设计 / 自动化 / 缺陷复盘' },
  { agent_id: 8007, name: '算法工程师 · Gina', title: '模型选型 / 训练 / 效果评估' },
  { agent_id: 8008, name: '商业分析 · Hank', title: '市场测算 / 竞品对标 / 定价' },
]
const PROMO_TAGS = ['🔥 热招', '✨ 新上架', '⭐ 高口碑', '🚀 上手快']
// 每次打开随机推荐 3 个 + 随机促销标，做出"广告位"的感觉
const market = (() => {
  const avatars = (window.__optMock?.employees || [])
    .filter((e) => !e.is_default && String(e.agent_id) !== '9001')
    .map((e) => e.avatar)
    .filter(Boolean)
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)]
  return [...MARKET_POOL]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((m) => ({ ...m, avatar: avatars.length ? rand(avatars) : fallbackAvatar, promo: rand(PROMO_TAGS) }))
})()

const picks = reactive(new Map()) // agent_id → {agent_id,name,avatar}
const selected = computed(() => new Set([...picks.keys()]))

function toggle(m) {
  const id = String(m.agent_id)
  if (inTeam.value.has(id)) return
  if (picks.has(id)) picks.delete(id)
  else picks.set(id, { agent_id: m.agent_id, name: m.name, avatar: m.avatar || fallbackAvatar })
}

async function confirmInvite() {
  if (!picks.size) return
  const list = [...picks.values()]
  emit('close')
  if (props.mode === 'create') {
    // 新建多人会话：交给父组件建会话，再由它拉人
    emit('confirm', list)
    return
  }
  await inviteMembers(props.teamId, props.mainThreadId, list)
  emit('invited', list)
}

function goMarket() {
  emit('close')
  uiStore.setActiveNavigation?.('market', 'market-avatar')
  uiStore.expandSidebar?.()
  router.push('/market/avatar').catch(() => {})
}
</script>

<style scoped>
.invite-mask {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(31, 35, 41, 0.36);
  display: flex; align-items: center; justify-content: center;
}
.invite-panel {
  width: 440px; max-width: calc(100vw - 48px); max-height: 78vh;
  display: flex; flex-direction: column;
  background: #fff; border-radius: 16px;
  box-shadow: 0 20px 60px rgba(31, 35, 41, 0.22);
  overflow: hidden;
}
.ip-head { display: flex; align-items: center; padding: 18px 20px 4px; flex-shrink: 0; }
.ip-title { font-size: 16px; font-weight: 600; color: #2f3547; }
.ip-close {
  margin-left: auto; width: 28px; height: 28px; border: none; border-radius: 8px;
  background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
}
.ip-close:hover { background: #f2f3f5; }
.ip-sub { margin: 0; padding: 0 20px 10px; font-size: 12.5px; line-height: 1.6; color: #8b8f9a; flex-shrink: 0; }

/* 顶部搜索 */
.ip-search {
  flex-shrink: 0; box-sizing: border-box;
  display: flex; align-items: center; gap: 8px; margin: 2px 16px 12px;
  padding: 0 13px; height: 40px; border-radius: 12px;
  background: #f4f5f7; border: 1px solid transparent; transition: border-color 0.15s ease, background 0.15s ease;
}
.ip-search:focus-within { background: #fff; border-color: #ffc9a8; }
.ip-search__icon { color: #a8adb8; flex-shrink: 0; }
.ip-search__input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-size: 13.5px; color: #2f3547;
}
.ip-search__input::placeholder { color: #b0b4bf; }
.ip-search__clear {
  flex-shrink: 0; width: 18px; height: 18px; border: none; border-radius: 50%; padding: 0;
  background: #e5e7eb; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
}
.ip-search__clear:hover { background: #d8dbe0; }

.ip-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 12px; }
.ip-section { margin-bottom: 6px; }
.ip-section__label { padding: 8px 8px 6px; font-size: 12px; color: #8c93a6; font-weight: 500; }
.ip-section__hint { color: #b6bac4; font-weight: 400; }

.ip-item {
  display: flex; align-items: center; gap: 11px; width: 100%;
  padding: 9px 10px; border: none; border-radius: 10px; background: transparent;
  cursor: pointer; text-align: left; transition: background 0.14s ease;
}
.ip-item:hover:not(.is-disabled) { background: #f6f7f9; }
.ip-item.is-picked { background: #fff3ec; }
.ip-item.is-disabled { cursor: default; opacity: 0.62; }
.ip-avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #f0f1f4; }
.ip-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ip-name { font-size: 13.5px; color: #2f3547; font-weight: 500; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ip-desc { font-size: 11.5px; color: #9a9fab; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 广告位推荐 */
.ip-section__label--promo { color: #a070ff; }
.ip-item--promo { background: linear-gradient(135deg, #faf7ff, #fff6f0); margin-bottom: 4px; }
.ip-item--promo:hover:not(.is-disabled) { background: linear-gradient(135deg, #f4ecff, #ffefe4); }
.ip-item--promo.is-picked { background: #fff3ec; }
.ip-promo {
  flex-shrink: 0; font-size: 10px; font-weight: 600; color: #ff7a1f;
  background: #fff0e6; border-radius: 6px; padding: 1px 6px;
}
.ip-tag--in { flex-shrink: 0; font-size: 11px; color: #8c93a6; background: #f1f3f6; border-radius: 999px; padding: 2px 9px; }
.ip-tag--remove { flex-shrink: 0; font-size: 11px; color: #ff5a4a; background: #fff1f0; border-radius: 999px; padding: 2px 9px; }
.ip-item:hover .ip-tag--remove { background: #ffe3e0; }
.ip-check {
  flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
  border: 1.5px solid #d1d5db; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
}
.ip-check.is-on { background: #ff621f; border-color: #ff621f; }
.ip-empty { padding: 18px 10px; text-align: center; font-size: 12.5px; color: #b6bac4; }

.ip-foot {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px 16px; border-top: 0.5px solid #f0f1f5;
}
.ip-market-link {
  flex: 1; min-width: 0; text-align: left; border: none; background: transparent;
  color: #ff621f; font-size: 12.5px; cursor: pointer; padding: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ip-market-link:hover { text-decoration: underline; }
.ip-confirm {
  flex-shrink: 0; height: 36px; padding: 0 20px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #ff9a3d, #ff621f); color: #fff;
  font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s ease;
}
.ip-confirm:disabled { background: #e5e6eb; color: #b6bac4; cursor: not-allowed; }
.ip-confirm:not(:disabled):hover { opacity: 0.92; }
</style>
