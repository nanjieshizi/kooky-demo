<template>
  <section class="personal-task-chat">
    <header class="task-chat-header">
      <div><small>个人任务</small><strong>{{ task.title }}</strong></div>
      <button type="button" @click="backToProject">返回项目</button>
    </header>
    <div class="task-chat-scroll">
      <div class="task-origin">来自 {{ project.name }} · 项目底座 v{{ project.snapshot.version }}</div>
      <template v-for="message in task.messages" :key="message.id">
        <div v-if="message.type === 'system'" class="system-event">{{ message.text }}</div>
        <article v-else class="bridge-message" :class="`is-${message.type}`">
          <div class="message-avatar"><img :src="message.type === 'user' ? ownerAvatar : assistantAvatar" :alt="message.type === 'user' ? '我' : '团队助理'" /></div>
          <div class="message-content">
            <strong>{{ message.type === 'user' ? '我' : '团队助理' }}</strong>
            <p>{{ message.text }}</p>
            <div v-if="message.kind === 'file'" class="task-file-card"><span class="task-file-icon">M</span><div><strong>{{ message.file.name }}</strong><small>{{ message.file.type }} · {{ message.file.version }} · {{ message.file.status }}</small></div><button type="button">查看产物</button></div>
          </div>
        </article>
      </template>
      <section v-if="task.backfillDemoStep >= 1" class="task-backfill-card">
        <header><div><span>执行回填</span><strong>补充执行回填</strong></div><em>AI 建议</em></header>
        <p class="task-backfill-intro">团队助理已根据本次任务和产物起草回填，请确认并修改后提交。</p>
        <label>本次完成了什么<textarea v-model="backfill.completed" rows="2"></textarea></label>
        <label class="task-backfill-artifact-field">
          <span>产物</span>
          <div class="task-backfill-artifact">
            <div class="task-backfill-artifact-file"><span class="task-file-icon">M</span><div><strong>{{ backfill.deliverable || '添加产物文件' }}</strong><small>Markdown 文件</small></div></div>
            <button type="button" class="task-backfill-artifact-edit" aria-label="修改产物" title="修改产物" @click="editingBackfillArtifact = !editingBackfillArtifact"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1-1-4Z"/></svg></button>
          </div>
          <input v-if="editingBackfillArtifact" v-model="backfill.deliverable" placeholder="输入或修改产物名称" />
        </label>
        <label>哪些做法有效<textarea v-model="backfill.effective" rows="2"></textarea></label>
        <label>遇到了什么问题<textarea v-model="backfill.issues" rows="2"></textarea></label>
        <label>下次可以复用的经验<textarea v-model="backfill.reusable" rows="2"></textarea></label>
        <label class="task-backfill-check"><input v-model="backfill.updateBase" type="checkbox" /> 建议更新项目底座</label>
        <footer><button type="button" @click="saveBackfill">保存草稿</button><button type="button" class="task-backfill-primary" @click="submitBackfill">提交回填</button></footer>
      </section>
    </div>
    <form class="task-chat-composer" @submit.prevent="send">
      <textarea v-model="draft" rows="3" :readonly="task.backfillDemoStep >= 1" :placeholder="task.backfillDemoStep >= 1 ? '' : ''"></textarea>
      <button type="submit" :disabled="task.backfillDemoStep >= 1">发送</button>
    </form>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useUIStore } from '@/modules/space/uiStore'
import { useTaskBridgeStore } from '@/modules/task-bridge/store'
import ownerAvatar from '@/assets/avatar-wang-jingbo.webp'
import assistantAvatar from '@/assets/soloTeam/default_agent.svg'

const props = defineProps({ project: { type: Object, required: true }, task: { type: Object, required: true } })
const uiStore = useUIStore()
const bridgeStore = useTaskBridgeStore()
const draft = ref('')
const editingBackfillArtifact = ref(false)
const backfill = reactive({ completed: '', deliverable: '', effective: '', issues: '', reusable: '', updateBase: false })

if (!props.task.messages.some((message) => message.kind === 'file')) {
  props.task.messages.push({
    id: `task-file-${props.task.id}`,
    type: 'assistant',
    kind: 'file',
    text: '产物已生成，请提交验收。',
    file: { name: `${props.task.title}.md`, type: 'Markdown', version: 'v1', status: '待验收' },
  })
}

if (!props.task.backfillDemoStep) {
  props.task.backfillDemoStep = 0
}

function send() {
  if (props.task.backfillDemoStep >= 1) return
  const text = draft.value.trim()
  const preset = '@团队助理，任务完成，起草回填'
  props.task.messages.push({ id: `personal-task-${Date.now()}`, type: 'user', text: text || preset })
  props.task.messages.push({ id: `personal-task-assistant-${Date.now()}`, type: 'assistant', text: '回填已起草，请确认修改。' })
  props.task.backfillDemoStep = 1
  bridgeStore.prepareBackfill(props.project.id, props.task.id)
  backfill.completed = props.project.backfillDraft || ''
  backfill.deliverable = props.task.deliverable || `${props.task.title}.md`
  backfill.effective = '先明确比较维度，再收集证据并形成结论。'
  backfill.issues = '不同来源的信息口径需要额外核对。'
  backfill.reusable = props.project.echoDraft || ''
  draft.value = ''
}

function saveBackfill() {
  props.task.backfill = { ...backfill }
}

function submitBackfill() {
  saveBackfill()
  props.project.backfillDraft = backfill.completed
  props.project.echoDraft = backfill.reusable
  props.task.status = 'backfill'
  const current = bridgeStore.publishBackfill(props.project.id)
  if (!current) return
  current.echoPublished = true
  current.showPlanAfterBackfill = true
  bridgeStore.openTaskConversation(props.project.id, props.task.id)
  uiStore.setActiveNavigation('collaboration', props.project.id)
  ElMessage.success('回填已提交，团队计划已同步')
}

function backToProject() {
  bridgeStore.closeTaskConversation(props.project.id)
  uiStore.setActiveNavigation('collaboration', props.project.id)
}
</script>

<style scoped>
.personal-task-chat{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;background:#fff;color:#2f3547}.task-chat-header{display:flex;align-items:center;justify-content:space-between;min-height:68px;padding:0 28px;border-bottom:1px solid #edf0f3}.task-chat-header div{display:flex;flex-direction:column;gap:4px}.task-chat-header small{color:#ff621f;font-size:12px;font-weight:650}.task-chat-header strong{font-size:18px}.task-chat-header button{border:0;border-radius:8px;padding:7px 11px;background:#f4f5f7;color:#657080;cursor:pointer}.task-chat-scroll{flex:1;min-height:0;overflow:auto;padding:30px min(12vw,130px);background-image:radial-gradient(circle,rgba(255,151,133,.22) 1px,transparent 1.2px);background-size:18px 18px}.task-origin{max-width:620px;margin:0 auto 26px;padding:11px 13px;border:1px solid #f0dfd6;border-radius:10px;background:#fffaf7;color:#818a98;font-size:12px}.task-chat-message{display:flex;flex-direction:column;gap:6px;max-width:620px;margin:16px auto}.task-chat-message b{font-size:13px}.task-chat-message p{margin:0;padding:11px 13px;border-radius:5px 13px 13px;background:#fff;box-shadow:0 2px 8px rgba(47,53,71,.06);line-height:1.6;font-size:14px}.task-chat-message.is-user{align-items:flex-end}.task-chat-message.is-user p{background:#fff0e9;border-radius:13px 5px 13px 13px}.task-system{align-self:center;color:#a1a8b3;font-size:12px}.task-chat-composer{display:flex;gap:12px;align-items:flex-end;margin:0 28px 22px;padding:12px 14px;border:1px solid #dfe4eb;border-radius:14px;background:#fff;box-shadow:0 7px 20px rgba(69,83,105,.08)}.task-chat-composer textarea{flex:1;resize:none;border:0;outline:0;font:14px/1.5 PingFang SC,sans-serif}.task-chat-composer button{border:0;border-radius:8px;padding:8px 14px;background:#ff621f;color:#fff;cursor:pointer}.task-chat-composer button:disabled{opacity:.4;cursor:not-allowed}
.task-file-card{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #e5e8ed;border-radius:10px;background:#fff}.task-file-icon{display:grid;place-items:center;width:32px;height:38px;border-radius:7px;background:#d9f5f1;color:#1eaaa0;font-weight:800}.task-file-card>div{display:flex;flex:1;flex-direction:column;gap:4px}.task-file-card strong{font-size:13px}.task-file-card small{color:#8b93a0;font-size:11px}.task-file-card button{border:0;border-radius:7px;padding:6px 9px;background:#fff0e9;color:#d75c2c;font-size:11px;cursor:pointer}.task-backfill-card{max-width:680px;margin:20px auto;padding:16px;border:1px solid #dce6f4;border-radius:12px;background:#f5f9ff;box-shadow:0 6px 18px rgba(63,95,135,.08)}.task-backfill-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.task-backfill-card header div{display:flex;flex-direction:column;gap:4px}.task-backfill-card header span{color:#4f82c7;font-size:11px}.task-backfill-card header strong{font-size:16px}.task-backfill-card header em{padding:4px 7px;border-radius:5px;background:#e6f0ff;color:#4c81c8;font-size:10px;font-style:normal}.task-backfill-intro{color:#64748b;font-size:12px;line-height:1.5}.task-backfill-card label{display:flex;flex-direction:column;gap:5px;margin-top:10px;color:#667085;font-size:11px}.task-backfill-card textarea{box-sizing:border-box;width:100%;resize:vertical;border:1px solid #dce4ef;border-radius:7px;padding:8px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.task-backfill-card textarea:focus{border-color:#7ca8df;box-shadow:0 0 0 3px #eaf2ff}.task-backfill-check{flex-direction:row!important;align-items:center;gap:7px!important}.task-backfill-check input{accent-color:#4f82c7}.task-backfill-card footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.task-backfill-card footer button{border:1px solid #dce4ef;border-radius:7px;padding:7px 11px;background:#fff;color:#657080;cursor:pointer;font-size:11px}.task-backfill-card footer .task-backfill-primary{border-color:#4f82c7;background:#4f82c7;color:#fff}

/* 与协作对话统一：头像、角色名与左右气泡 */
.bridge-message { display: flex; gap: 10px; max-width: 720px; margin: 18px auto; }
.bridge-message.is-user { flex-direction: row-reverse; }
.message-avatar { width: 30px; height: 30px; overflow: hidden; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; background: #eee8ff; color: #7257d9; font-size: 12px; font-weight: 700; }
.message-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.message-content { min-width: 0; }
.message-content strong { font-size: 13px; }
.message-content p { margin: 5px 0 0; padding: 10px 12px; border-radius: 4px 12px 12px 12px; background: rgba(255,255,255,.9); line-height: 1.65; font-size: 13px; box-shadow: 0 1px 5px rgba(47,53,71,.05); white-space: pre-wrap; }
.bridge-message.is-user .message-content p { border-radius: 12px 4px 12px 12px; background: #fff0e9; }
.system-event { margin: 0 auto 12px; text-align: center; color: #a0a6b2; font-size: 12px; }
 .task-backfill-artifact-field{gap:6px!important}.task-backfill-artifact{display:flex;align-items:center;gap:8px}.task-backfill-artifact-file{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:9px 10px;border:1px solid #dce4ef;border-radius:8px;background:#fff}.task-backfill-artifact-file>div{display:flex;flex-direction:column;gap:3px;min-width:0}.task-backfill-artifact-file strong{overflow:hidden;color:#303746;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.task-backfill-artifact-file small{color:#98a0ad;font-size:10px}.task-backfill-artifact-edit{display:grid;place-items:center;width:30px;height:30px;flex:0 0 30px;padding:0;border:1px solid #dce4ef;border-radius:7px;background:#fff;color:#657080;cursor:pointer}.task-backfill-artifact-edit:hover{border-color:#7ca8df;color:#4f82c7;background:#f7fbff}.task-backfill-artifact-field>input{box-sizing:border-box;width:100%;border:1px solid #dce4ef;border-radius:7px;padding:8px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.task-backfill-artifact-field>input:focus{border-color:#7ca8df;box-shadow:0 0 0 3px #eaf2ff}
</style>
