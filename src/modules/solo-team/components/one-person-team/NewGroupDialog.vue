<template>
  <div class="ng-mask" @click.self="$emit('close')">
    <div class="ng-panel">
      <div class="ng-head">
        <span class="ng-title">新建多人会话</span>
        <button type="button" class="ng-close" @click="$emit('close')" aria-label="关闭">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.6" stroke-linecap="round" /></svg>
        </button>
      </div>

      <!-- 顶部固定：3 个推荐数字员工（数据来源市场，待同步） -->
      <div class="ng-reco">
        <div class="ng-reco__label">✨ 为你推荐</div>
        <div class="ng-reco__row">
          <button
            v-for="m in recommended"
            :key="m.agent_id"
            type="button"
            class="ng-reco__card"
            :class="{ 'is-picked': picks.has(String(m.agent_id)) }"
            @click="toggle(m)"
          >
            <img class="ng-reco__av" :src="m.avatar || fallbackAvatar" alt="" draggable="false" />
            <span class="ng-reco__name">{{ shortName(m.name) }}</span>
            <span class="ng-reco__add">{{ picks.has(String(m.agent_id)) ? '✓' : '＋' }}</span>
          </button>
        </div>
      </div>

      <div class="ng-body">
        <!-- 左：搜索 + 我的员工 -->
        <div class="ng-col ng-col--list">
          <div class="ng-search">
            <svg class="ng-search__ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input v-model="query" class="ng-search__input" type="text" placeholder="搜索我的数字员工" spellcheck="false" />
          </div>
          <div class="ng-col__label">我的员工</div>
          <div class="ng-list">
            <button
              v-for="m in filteredEmployees"
              :key="m.agent_id"
              type="button"
              class="ng-item"
              :class="{ 'is-picked': picks.has(String(m.agent_id)) }"
              @click="toggle(m)"
            >
              <img class="ng-avatar" :src="m.avatar || fallbackAvatar" alt="" draggable="false" />
              <span class="ng-name">{{ m.name }}</span>
              <span class="ng-check" :class="{ 'is-on': picks.has(String(m.agent_id)) }">
                <svg v-if="picks.has(String(m.agent_id))" width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </button>
            <div v-if="!filteredEmployees.length" class="ng-empty">没找到「{{ query }}」相关的员工</div>
          </div>
        </div>

        <!-- 右：已选（团队助理锁定，其余可移除） -->
        <div class="ng-col ng-col--picked">
          <div class="ng-col__label">已选 <span class="ng-count">{{ selectedList.length }}</span></div>
          <div class="ng-list">
            <div class="ng-item ng-item--locked">
              <img class="ng-avatar" :src="crabIcon" alt="" draggable="false" />
              <span class="ng-name">团队助理</span>
              <span class="ng-lock">默认</span>
            </div>
            <div v-for="m in selectedList" :key="m.agent_id" class="ng-item ng-item--sel">
              <img class="ng-avatar" :src="m.avatar || fallbackAvatar" alt="" draggable="false" />
              <span class="ng-name">{{ m.name }}</span>
              <button type="button" class="ng-remove" @click="remove(m)" aria-label="移除">
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="ng-foot">
        <button type="button" class="ng-market" @click="goMarket">没有合适的数字员工？前往数字人市场探索 ➡️</button>
        <button type="button" class="ng-create" @click="onCreate">创建会话</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/modules/space/uiStore'
import fallbackAvatar from '@/assets/default-agent-avatar.svg'
import crabIcon from '@/assets/crab-pixel.png'

defineOptions({ name: 'NewGroupDialog' })
const emit = defineEmits(['close', 'confirm'])
const router = useRouter()
const uiStore = useUIStore()

const query = ref('')
const myEmployees = computed(() => (window.__optMock?.employees || []).filter((e) => !e.is_default && String(e.agent_id) !== '9001'))
const filteredEmployees = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return myEmployees.value
  return myEmployees.value.filter((m) => String(m.name || '').toLowerCase().includes(q))
})

// 推荐（市场，demo 固定 3 个；待市场同步）
const MARKET_POOL = [
  { agent_id: 8001, name: '数据分析师 · Alice' },
  { agent_id: 8002, name: '增长运营 · Ben' },
  { agent_id: 8003, name: '视觉设计 · Coco' },
  { agent_id: 8004, name: '资深文案 · Dan' },
  { agent_id: 8005, name: '用户研究 · Ella' },
]
const recommended = (() => {
  const avs = (window.__optMock?.employees || []).filter((e) => !e.is_default).map((e) => e.avatar).filter(Boolean)
  const rand = (a) => a[Math.floor(Math.random() * a.length)]
  return [...MARKET_POOL].sort(() => Math.random() - 0.5).slice(0, 3).map((m) => ({ ...m, avatar: avs.length ? rand(avs) : fallbackAvatar }))
})()

const picks = reactive(new Map())
const selectedList = computed(() => [...picks.values()])
function shortName(n) { return String(n || '').split('·')[0].trim() || n }
function toggle(m) {
  const id = String(m.agent_id)
  if (picks.has(id)) picks.delete(id)
  else picks.set(id, { agent_id: m.agent_id, name: m.name, avatar: m.avatar || fallbackAvatar })
}
function remove(m) { picks.delete(String(m.agent_id)) }

function onCreate() {
  emit('close')
  emit('confirm', [...picks.values()]) // 团队助理默认在群，不放进 picks
}
function goMarket() {
  emit('close')
  uiStore.setActiveNavigation?.('market', 'market-avatar')
  uiStore.expandSidebar?.()
  router.push('/market/avatar').catch(() => {})
}
</script>

<style scoped>
.ng-mask { position: fixed; inset: 0; z-index: 10000; background: rgba(31,35,41,0.36); display: flex; align-items: center; justify-content: center; }
.ng-panel { width: 680px; max-width: calc(100vw - 48px); height: 560px; max-height: 86vh; display: flex; flex-direction: column; background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(31,35,41,0.22); overflow: hidden; }
.ng-head { flex-shrink: 0; display: flex; align-items: center; padding: 18px 20px; border-bottom: 0.5px solid #f0f1f5; }
.ng-title { font-size: 16px; font-weight: 600; color: #2f3547; }
.ng-close { margin-left: auto; width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.ng-close:hover { background: #f2f3f5; }

/* 推荐 */
.ng-reco { flex-shrink: 0; padding: 12px 20px; background: #fcfaff; border-bottom: 0.5px solid #f0f1f5; }
.ng-reco__label { font-size: 12px; font-weight: 600; color: #a070ff; margin-bottom: 8px; }
.ng-reco__row { display: flex; gap: 8px; }
.ng-reco__card { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; padding: 7px 9px; border: 0.5px solid #efe8fb; border-radius: 10px; background: #fff; cursor: pointer; transition: border-color 0.14s ease; }
.ng-reco__card:hover { border-color: #d9c6ff; }
.ng-reco__card.is-picked { border-color: #ff9a5a; background: #fff6f0; }
.ng-reco__av { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.ng-reco__name { flex: 1; min-width: 0; font-size: 12px; color: #2f3547; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ng-reco__add { flex-shrink: 0; font-size: 13px; color: #a070ff; font-weight: 600; }

/* 两栏 */
.ng-body { flex: 1; min-height: 0; display: flex; }
.ng-col { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.ng-col--picked { border-left: 0.5px solid #f0f1f5; }
.ng-col__label { padding: 12px 14px 6px; font-size: 12px; color: #8c93a6; font-weight: 500; flex-shrink: 0; }
.ng-count { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: #ff621f; color: #fff; font-size: 10px; font-weight: 700; }
.ng-search { flex-shrink: 0; display: flex; align-items: center; gap: 8px; margin: 12px 14px 4px; padding: 0 12px; height: 38px; border-radius: 10px; background: #f4f5f7; border: 1px solid transparent; box-sizing: border-box; }
.ng-search:focus-within { background: #fff; border-color: #ffc9a8; }
.ng-search__ic { color: #a8adb8; flex-shrink: 0; }
.ng-search__input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 13px; color: #2f3547; }
.ng-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 8px; }
.ng-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: none; border-radius: 10px; background: transparent; cursor: pointer; text-align: left; transition: background 0.14s ease; }
.ng-item:hover { background: #f6f7f9; }
.ng-item.is-picked { background: #fff3ec; }
.ng-item--locked, .ng-item--sel { cursor: default; }
.ng-item--locked:hover, .ng-item--sel:hover { background: transparent; }
.ng-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #f0f1f4; }
.ng-name { flex: 1; min-width: 0; font-size: 13.5px; color: #2f3547; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ng-check { flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #d1d5db; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; }
.ng-check.is-on { background: #ff621f; border-color: #ff621f; }
.ng-lock { flex-shrink: 0; font-size: 11px; color: #8c93a6; background: #f1f3f6; border-radius: 999px; padding: 2px 9px; }
.ng-remove { flex-shrink: 0; width: 22px; height: 22px; border: none; border-radius: 50%; padding: 0; background: transparent; color: #b6bac4; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.ng-remove:hover { background: #fdece0; color: #ff621f; }
.ng-empty { padding: 18px 10px; text-align: center; font-size: 12.5px; color: #b6bac4; }

.ng-foot { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 12px 20px 16px; border-top: 0.5px solid #f0f1f5; }
.ng-market { flex: 1; min-width: 0; text-align: left; border: none; background: transparent; color: #ff621f; font-size: 12.5px; cursor: pointer; padding: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ng-market:hover { text-decoration: underline; }
.ng-create { flex-shrink: 0; height: 36px; padding: 0 22px; border: none; border-radius: 10px; background: linear-gradient(135deg, #ff9a3d, #ff621f); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s ease; }
.ng-create:hover { opacity: 0.92; }
</style>
