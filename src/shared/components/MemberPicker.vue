<template>
  <section class="member-picker" aria-label="选择团队成员">
    <div class="member-picker__toolbar">
      <div>
        <strong>选择成员</strong>
        <span>可选择真人联系人或数字人协作者</span>
      </div>
      <button type="button" class="member-picker__recommend" @click="recommendMembers">
        <span class="member-picker__recommend-icon" :style="{ maskImage: `url(${aiRecommendIcon})`, WebkitMaskImage: `url(${aiRecommendIcon})` }" aria-hidden="true"></span>
        AI 推荐组合
      </button>
    </div>

    <div class="member-picker__body">
      <div class="member-picker__available">
        <label class="member-picker__search">
          <span aria-hidden="true">⌕</span>
          <input v-model.trim="query" type="search" placeholder="搜索成员" aria-label="搜索成员" />
        </label>
        <div class="member-picker__tabs" role="tablist" aria-label="成员类型">
          <button type="button" role="tab" :aria-selected="activeTab === 'contact'" :class="{ active: activeTab === 'contact' }" @click="activeTab = 'contact'">联系人</button>
          <button type="button" role="tab" :aria-selected="activeTab === 'agent'" :class="{ active: activeTab === 'agent' }" @click="activeTab = 'agent'">数字人</button>
        </div>
        <div class="member-picker__list">
          <button v-for="member in filteredMembers" :key="member.id" type="button" class="member-picker__option" :class="{ selected: isSelected(member.id) }" @click="toggleMember(member)">
            <span class="member-picker__checkbox" aria-hidden="true">{{ isSelected(member.id) ? '✓' : '' }}</span>
            <span class="member-picker__avatar" :class="{ 'is-image': member.avatar }">
              <img v-if="member.avatar" :src="member.avatar" :alt="`${member.name}头像`" />
              <span v-else>{{ member.initial }}</span>
            </span>
            <span class="member-picker__identity"><strong>{{ member.name }}</strong><small>{{ member.meta }}</small></span>
          </button>
          <p v-if="!filteredMembers.length" class="member-picker__empty">没有找到匹配成员</p>
        </div>
      </div>

      <div class="member-picker__selected">
        <div class="member-picker__selected-head"><strong>已选 {{ modelValue.length }} 个</strong><span>可随时移除</span></div>
        <div class="member-picker__selected-list">
          <div v-for="member in selectedMembers" :key="member.id" class="member-picker__selected-item">
            <span class="member-picker__avatar member-picker__avatar--large" :class="{ 'is-image': member.avatar }">
              <img v-if="member.avatar" :src="member.avatar" :alt="`${member.name}头像`" />
              <span v-else>{{ member.initial }}</span>
            </span>
            <span class="member-picker__identity"><strong>{{ member.name }}</strong><small>{{ member.type === 'agent' ? '数字人' : '联系人' }} · {{ member.meta }}</small></span>
            <button type="button" class="member-picker__remove" :aria-label="`移除${member.name}`" @click="removeMember(member.id)">×</button>
          </div>
          <p v-if="!modelValue.length" class="member-picker__empty member-picker__empty--selected">尚未选择成员</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import ownerAvatar from '@/assets/avatar-wang-jingbo.webp'
import assistantAvatar from '@/assets/soloTeam/default_agent.svg'
import aiRecommendIcon from '@/assets/icons/ai-recommend.svg'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])
const activeTab = ref('contact')
const query = ref('')

const members = [
  { id: 'contact-owner', name: '王靖博', initial: '王', type: 'contact', meta: '项目负责人', avatar: ownerAvatar },
  { id: 'contact-product', name: '产品同学', initial: '产', type: 'contact', meta: '产品团队' },
  { id: 'contact-design', name: '设计同学', initial: '设', type: 'contact', meta: '设计团队' },
  { id: 'contact-engineering', name: '研发同学', initial: '研', type: 'contact', meta: '研发团队' },
  { id: 'agent-assistant', name: '团队助理', initial: '助', type: 'agent', meta: '任务拆解与协作同步', avatar: assistantAvatar },
  { id: 'agent-product', name: '产品数字人', initial: '产', type: 'agent', meta: '竞品调研与需求分析', avatar: assistantAvatar },
  { id: 'agent-design', name: '设计数字人', initial: '设', type: 'agent', meta: '原型与体验评审', avatar: assistantAvatar },
  { id: 'agent-engineering', name: '研发数字人', initial: '研', type: 'agent', meta: '技术方案与风险评估', avatar: assistantAvatar },
]

const filteredMembers = computed(() => members.filter((member) => member.type === activeTab.value && `${member.name}${member.meta}`.includes(query.value)))
const selectedMembers = computed(() => props.modelValue.map((member) => ({ ...member, avatar: member.avatar || members.find((item) => item.id === member.id)?.avatar })))
const isSelected = (id) => props.modelValue.some((member) => member.id === id)
function toggleMember(member) {
  const next = isSelected(member.id) ? props.modelValue.filter((item) => item.id !== member.id) : [...props.modelValue, member]
  emit('update:modelValue', next)
}
function removeMember(id) { emit('update:modelValue', props.modelValue.filter((member) => member.id !== id)) }
function recommendMembers() {
  emit('update:modelValue', [members[0], members[4], members[5], members[6]])
}
</script>

<style scoped>
.member-picker { color: #303746; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; }
.member-picker__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 14px; background: #fff; border-bottom: 1px solid #e5e5e5; }
.member-picker__toolbar > div { display: flex; flex-direction: column; gap: 3px; }.member-picker__toolbar strong { font-size: 12px; }.member-picker__toolbar > div > span { color: #87909d; font-size: 10px; }
.member-picker__recommend { display: inline-flex; align-items: center; gap: 5px; padding: 7px 10px; color: #d75c2c; background: #fff; border: 1px solid #ffd8c8; border-radius: 7px; font-size: 10px; cursor: pointer; transition: background .18s, border-color .18s, transform .18s; }.member-picker__recommend-icon { display: inline-block; width: 12px; height: 12px; flex: 0 0 12px; background-color: currentColor; mask-position: center; -webkit-mask-position: center; mask-repeat: no-repeat; -webkit-mask-repeat: no-repeat; mask-size: contain; -webkit-mask-size: contain; }.member-picker__recommend:hover { background: #fff0e9; border-color: #ffbda3; transform: translateY(-1px); }
.member-picker__body { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr); min-height: 270px; }.member-picker__available { min-width: 0; padding: 12px; border-right: 1px solid #eef1f3; }.member-picker__selected { min-width: 0; padding: 14px; background: #fafafa; }
.member-picker__search { display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 10px; color: #9ba3ad; background: #f7f7f7; border-radius: 7px; }.member-picker__search input { width: 100%; height: 100%; padding: 0; color: #303746; background: transparent; border: 0; outline: 0; font: inherit; font-size: 11px; }.member-picker__search input::placeholder { color: #b1b7c0; }
.member-picker__tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; margin: 10px 0 8px; background: #f1f2f4; border-radius: 7px; }.member-picker__tabs button { appearance: none; -webkit-appearance: none; padding: 6px; color: #87909d; background: transparent; border: 0; outline: 0; border-radius: 5px; font-size: 11px; cursor: pointer; }.member-picker__tabs button:hover { color: #d75c2c; background: #fff8f4; }.member-picker__tabs button:focus-visible { outline: 2px solid #ffbda3; outline-offset: 1px; }.member-picker__tabs button.active { color: #d75c2c; background: #fff; box-shadow: 0 1px 3px rgba(48,55,70,.08); font-weight: 650; }
.member-picker__list, .member-picker__selected-list { display: grid; gap: 5px; max-height: 194px; overflow-y: auto; }.member-picker__option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 6px; color: #303746; text-align: left; background: transparent; border: 1px solid transparent; border-radius: 7px; cursor: pointer; transition: background .18s, border-color .18s; }.member-picker__option:hover { background: #fff8f4; border-color: #ffe2d5; }.member-picker__option.selected { background: #fff0e9; border-color: #ffd8c8; }
.member-picker__checkbox { display: grid; place-items: center; width: 16px; height: 16px; flex: 0 0 16px; color: #fff; border: 1px solid #d9dee4; border-radius: 4px; font-size: 10px; }.selected .member-picker__checkbox { background: #ff621f; border-color: #ff621f; }
.member-picker__avatar { display: grid; place-items: center; width: 29px; height: 29px; flex: 0 0 29px; overflow: hidden; color: #fff; background: #ff9a73; border-radius: 50%; font-size: 10px; font-weight: 700; }.member-picker__avatar.is-image { background: #f2f3f5; }.member-picker__avatar img { width: 100%; height: 100%; object-fit: cover; }.member-picker__avatar--large { width: 34px; height: 34px; flex-basis: 34px; }
.member-picker__identity { display: flex; min-width: 0; flex-direction: column; gap: 3px; }.member-picker__identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 650; }.member-picker__identity small { overflow: hidden; color: #9aa2ad; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; }.member-picker__selected-head { display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #eef1f3; }.member-picker__selected-head strong { font-size: 13px; }.member-picker__selected-head span { color: #a0a8b2; font-size: 9px; }.member-picker__selected-list { padding-top: 9px; max-height: 226px; }.member-picker__selected-item { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 7px 3px; }.member-picker__remove { appearance: none; -webkit-appearance: none; margin-left: auto; padding: 2px 4px; color: #a6adb5; background: transparent; border: 0; outline: 0; font-size: 18px; line-height: 1; cursor: pointer; }.member-picker__remove:hover { color: #d75c2c; }.member-picker__remove:focus-visible { outline: 0; color: #d75c2c; background: #fff0e9; border-radius: 4px; }.member-picker__empty { padding: 16px 4px; margin: 0; color: #a0a8b2; text-align: center; font-size: 10px; }.member-picker__empty--selected { padding-top: 34px; }
@media (max-width: 620px) { .member-picker__body { grid-template-columns: 1fr; }.member-picker__available { border-right: 0; border-bottom: 1px solid #eef1f3; }.member-picker__selected-list { max-height: 180px; } }
@media (prefers-reduced-motion: reduce) { .member-picker__recommend, .member-picker__option { transition: none; } }
</style>
