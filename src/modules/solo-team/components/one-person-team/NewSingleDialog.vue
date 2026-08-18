<template>
  <div class="ns-mask" @click.self="$emit('close')">
    <div class="ns-panel">
      <div class="ns-head">
        <span class="ns-title">新建会话</span>
        <button type="button" class="ns-close" @click="$emit('close')" aria-label="关闭">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.6" stroke-linecap="round" /></svg>
        </button>
      </div>
      <p class="ns-sub">和数字员工进行一对一单聊 —— 点谁就和谁开一条会话。</p>
      <div class="ns-search">
        <svg class="ns-search__ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input v-model="query" class="ns-search__input" type="text" placeholder="搜索数字员工" spellcheck="false" />
      </div>
      <div class="ns-list">
        <button v-for="m in filteredEmployees" :key="m.agent_id" type="button" class="ns-item" @click="pick(m)">
          <img class="ns-avatar" :src="m.avatar || fallbackAvatar" alt="" draggable="false" />
          <span class="ns-info">
            <span class="ns-name">{{ m.name }}</span>
            <span class="ns-desc">{{ m.title || m.role_desc || '数字员工' }}</span>
          </span>
          <svg class="ns-go" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c0c4cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <div v-if="!filteredEmployees.length" class="ns-empty">没找到「{{ query }}」相关的员工</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import fallbackAvatar from '@/assets/default-agent-avatar.svg'

defineOptions({ name: 'NewSingleDialog' })
const emit = defineEmits(['close', 'pick'])

const query = ref('')
const myEmployees = computed(() => (window.__optMock?.employees || []).filter((e) => !e.is_default && String(e.agent_id) !== '9001'))
const filteredEmployees = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return myEmployees.value
  return myEmployees.value.filter((m) => `${m.name || ''} ${m.title || ''}`.toLowerCase().includes(q))
})
function pick(m) {
  emit('close')
  emit('pick', { agent_id: m.agent_id, name: m.name, avatar: m.avatar })
}
</script>

<style scoped>
.ns-mask { position: fixed; inset: 0; z-index: 10000; background: rgba(31,35,41,0.36); display: flex; align-items: center; justify-content: center; }
.ns-panel { width: 440px; max-width: calc(100vw - 48px); max-height: 76vh; display: flex; flex-direction: column; background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(31,35,41,0.22); overflow: hidden; }
.ns-head { flex-shrink: 0; display: flex; align-items: center; padding: 18px 20px 4px; }
.ns-title { font-size: 16px; font-weight: 600; color: #2f3547; }
.ns-close { margin-left: auto; width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.ns-close:hover { background: #f2f3f5; }
.ns-sub { flex-shrink: 0; margin: 0; padding: 0 20px 10px; font-size: 12.5px; line-height: 1.6; color: #8b8f9a; }
.ns-search { flex-shrink: 0; display: flex; align-items: center; gap: 8px; margin: 2px 16px 12px; padding: 0 13px; height: 40px; border-radius: 12px; background: #f4f5f7; border: 1px solid transparent; box-sizing: border-box; }
.ns-search:focus-within { background: #fff; border-color: #ffc9a8; }
.ns-search__ic { color: #a8adb8; flex-shrink: 0; }
.ns-search__input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 13.5px; color: #2f3547; }
.ns-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 12px; }
.ns-item { display: flex; align-items: center; gap: 11px; width: 100%; padding: 9px 10px; border: none; border-radius: 10px; background: transparent; cursor: pointer; text-align: left; transition: background 0.14s ease; }
.ns-item:hover { background: #f6f7f9; }
.ns-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #f0f1f4; }
.ns-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ns-name { font-size: 13.5px; color: #2f3547; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ns-desc { font-size: 11.5px; color: #9a9fab; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ns-go { flex-shrink: 0; }
.ns-empty { padding: 18px 10px; text-align: center; font-size: 12.5px; color: #b6bac4; }
</style>
