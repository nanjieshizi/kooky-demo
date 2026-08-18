<template>
  <aside v-if="member" class="cp-panel">
    <header class="cp-head">
      <span class="cp-head-title">{{ isAgent ? '企业数字人档案' : '员工档案' }}</span>
      <button type="button" class="cp-close" aria-label="关闭" @click="store.closeProfile()">✕</button>
    </header>

    <div class="cp-body">
      <div class="cp-hero">
        <img v-if="member.avatar" :src="member.avatar" class="cp-avatar" alt="" @error="onAvatarError" />
        <span v-else class="cp-avatar cp-avatar--letter">{{ (member.name || '?').slice(0, 1) }}</span>
        <div class="cp-idline">
          <span class="cp-name">{{ member.name }}</span>
          <span v-if="member.account" class="cp-account">{{ member.account }}</span>
        </div>
        <div v-if="isAgent" class="cp-tagline">
          <span class="cp-tag">企业数字人</span>
          <span v-for="t in (member.tags || []).slice(0, 2)" :key="t" class="cp-tag cp-tag--plain">{{ t }}</span>
        </div>
        <p v-if="subtitle" class="cp-sign">{{ subtitle }}</p>
      </div>

      <div class="cp-actions">
        <button type="button" class="cp-act" @click="onChat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.3-.5L3 21l1.7-4.4A8.2 8.2 0 0 1 3.6 11 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
          </svg>
          {{ isAgent ? '对话' : '私聊' }}
        </button>
      </div>

      <!-- 真人和企业数字人共用同一套字段：数字人没有的给「-」，别各长各的样子。
           手机号取不到、办公地点没取、备注不做 —— 都不列，列了全是空行 -->
      <dl class="cp-fields">
        <div v-for="f in fields" :key="f.label" class="cp-field">
          <dt>{{ f.label }}</dt>
          <dd v-if="f.value" :class="f.wrap ? 'cp-dept' : ''">
            {{ f.value }}<span v-if="f.sub" class="cp-sub">{{ f.sub }}</span>
          </dd>
          <dd v-else class="cp-empty">-</dd>
        </div>
      </dl>

      <p class="cp-foot-note">
        {{ isAgent
          ? '企业统一部署的企业数字人，配置由管理员维护，你只能找他干活。'
          : '资料来自组织架构，改不了 —— 要改找 HR，不是找我。' }}
      </p>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useContactsStore } from '@/modules/contacts/store'
import { chatWithDigitalColleague } from '@/modules/contacts/actions'
import { useStartPrivateChat } from '@/modules/private/composables/useStartPrivateChat'
import profileDefaultAvatar from '@/assets/default-avatar.png'

defineOptions({ name: 'ContactsProfilePanel' })

const store = useContactsStore()
const { startChat } = useStartPrivateChat()

const member = computed(() => store.activeProfile)
const isAgent = computed(() => member.value?.kind === 'agent')
const subtitle = computed(() => (isAgent.value ? member.value?.desc : member.value?.title))

/**
 * 档案字段：真人和企业数字人共用一套，取不到的显示「-」。
 * 参照讯飞名片的字段序（工号 / 部门 / 职务 / 邮箱），数字人的工号走 AI- 号段。
 * 不列的：手机号（接口取不到）、办公地点（没取）、备注（先不做）、直属上级（先不展示，
 * 数据链路已经通到 managerName/managerAccount，要恢复加一行就行）。
 */
const fields = computed(() => {
  const m = member.value || {}
  return [
    { label: '工号', value: m.employeeId || '' },
    { label: '部门', value: m.department || '', wrap: true },
    { label: '职务', value: m.title || '' },
    ...(m.projectRole ? [{ label: '专项角色', value: m.projectRole }] : []),
    { label: '邮箱', value: m.email || '' },
  ]
})

function onChat() {
  const m = member.value
  if (!m) return
  if (isAgent.value) {
    chatWithDigitalColleague(m)
    return
  }
  startChat({ account: m.account, userName: m.account })
}

function onAvatarError(e) {
  e.target.src = profileDefaultAvatar
}
</script>

<style lang="scss" scoped>
.cp-panel {
  width: 320px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
}

.cp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
}

.cp-head-title {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
}

.cp-close {
  width: 24px;
  height: 24px;
  color: #a8b0c0;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.cp-close:hover {
  color: #2f3547;
  background: #f2f3f6;
}

.cp-body {
  flex: 1;
  min-height: 0;
  padding: 0 16px 18px;
  overflow-y: auto;
}

.cp-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 6px 0 14px;
}

.cp-avatar {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  object-fit: cover;
  background: #f2f3f6;
}

.cp-avatar--letter {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #8478fa, #5b7fff);
}

.cp-idline {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 10px;
}

.cp-name {
  font-size: 17px;
  font-weight: 700;
  color: #2f3547;
}

.cp-account {
  font-size: 12px;
  color: #a8b0c0;
}

.cp-tagline {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 8px;
}

.cp-tag {
  padding: 1px 8px;
  font-size: 11px;
  color: #6a5df0;
  background: #f0eeff;
  border-radius: 6px;
}

.cp-tag--plain {
  color: #6b7280;
  background: #f2f3f6;
}

.cp-sign {
  margin: 8px 0 0;
  font-size: 12.5px;
  line-height: 19px;
  color: #91949e;
}

.cp-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f2f3f6;
}

.cp-act {
  flex: 1;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: #2f3547;
  background: #f5f6f9;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cp-act:hover {
  color: #6a5df0;
  background: #f0eeff;
}

.cp-fields {
  margin: 14px 0 0;
}

.cp-field {
  display: flex;
  gap: 12px;
  padding: 7px 0;
}

.cp-field dt {
  width: 44px;
  flex: none;
  font-size: 13px;
  color: #91949e;
}

.cp-field dd {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  color: #2f3547;
  word-break: break-all;
}

.cp-dept {
  color: #436ff6;
}

.cp-empty {
  color: #c2c7d0;
}

/* 直属上级的账号：跟在名字后面，浅一档 */
.cp-sub {
  margin-left: 5px;
  color: #a8b0c0;
}

.cp-foot-note {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid #f2f3f6;
  font-size: 11.5px;
  line-height: 18px;
  color: #a8b0c0;
}
</style>
