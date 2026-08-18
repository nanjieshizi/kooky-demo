<template>
  <el-dialog
    :model-value="showPublishModal"
    title="发布到市场"
    width="520px"
    align-center
    append-to-body
    class="factory-publish-modal"
    @close="factoryStore.closePublishModal()"
  >
    <div class="publish-form">
      <div class="publish-agent">
        <div class="pa-avatar">
          <img v-if="agent.icon" :src="agent.icon" alt="" />
          <span v-else>🤖</span>
        </div>
        <div>
          <div class="pa-name">{{ agent.name }}</div>
          <div class="pa-ver">展示版本 {{ agent.version }}</div>
        </div>
      </div>

      <div class="form-row">
        <label class="form-label required">选择代码提交</label>
        <el-select
          v-model="form.commitId"
          class="full"
          placeholder="选择要发布的 Git 提交记录"
          filterable
        >
          <el-option
            v-for="c in commits"
            :key="c.id"
            :label="`${c.hash} · ${c.message}`"
            :value="c.id"
          >
            <div class="commit-option">
              <span class="co-hash">{{ c.hash }}</span>
              <span class="co-msg">{{ c.message }}</span>
              <span class="co-time">{{ c.time }}</span>
            </div>
          </el-option>
        </el-select>
        <p class="form-hint">发布将锁定该提交对应的代码快照到市场（与「版本管理」中的记录一致）。</p>
      </div>

      <div class="form-row">
        <label class="form-label">市场分类</label>
        <el-select v-model="form.category" class="full" placeholder="选择分类">
          <el-option label="办公协同" value="办公协同" />
          <el-option label="人事行政" value="人事行政" />
          <el-option label="客户服务" value="客户服务" />
          <el-option label="数据分析" value="数据分析" />
          <el-option label="其他" value="其他" />
        </el-select>
      </div>

      <div class="form-row">
        <label class="form-label">市场简介</label>
        <el-input
          v-model="form.summary"
          type="textarea"
          :rows="3"
          maxlength="120"
          show-word-limit
          placeholder="一句话介绍这个 Agent 能帮用户做什么"
        />
      </div>

      <div v-if="publishedRelease" class="publish-warn">
        当前已发布提交 <b>{{ publishedRelease.commitHash }}</b>，发布新提交将自动替换。
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <button type="button" class="btn-cancel" @click="factoryStore.closePublishModal()">取消</button>
        <button
          type="button"
          class="btn-confirm"
          :disabled="!canPublish"
          @click="handlePublish"
        >
          确认发布
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { ElDialog, ElSelect, ElOption, ElInput, ElMessage } from 'element-plus'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactoryPublishModal' })

const factoryStore = useFactoryStore()
const showPublishModal = computed(() => factoryStore.showPublishModal)
const agent = computed(() => factoryStore.currentAgent)
const commits = computed(() => factoryStore.codeCommits)
const publishedRelease = computed(() => factoryStore.publishedRelease)

const form = reactive({
  commitId: '',
  category: '人事行政',
  summary: '面向企业员工的请假助手，自然语言申请、余额校验、自动走 OA 审批。',
})

const canPublish = computed(() => !!form.commitId && !!form.category && !!form.summary.trim())

watch(showPublishModal, (visible) => {
  if (visible) {
    const head = commits.value[0]
    const active = factoryStore.publishedRelease
    form.commitId = active?.commitId || head?.id || ''
    if (active?.marketSummary) form.summary = active.marketSummary
    if (active?.marketCategory) form.category = active.marketCategory
  }
})

function handlePublish() {
  if (!canPublish.value) return
  const commit = commits.value.find(c => c.id === form.commitId)
  factoryStore.publishCommit(form.commitId, {
    category: form.category,
    summary: form.summary.trim(),
  })
  factoryStore.closePublishModal()
  ElMessage.success(`${agent.value.name} 已发布提交 ${commit?.hash || ''} 到市场`)
}
</script>

<style scoped lang="scss">
.publish-form { display: flex; flex-direction: column; gap: 16px; }

.publish-agent {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f7f8fb;
  border-radius: 10px;
}

.pa-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  img { width: 100%; height: 100%; object-fit: cover; }
}

.pa-name { font-size: 14px; font-weight: 600; color: #2f3547; }
.pa-ver { font-size: 12px; color: #6366f1; margin-top: 2px; }

.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; font-weight: 500; color: #2f3547; }
.form-label.required::after { content: ' *'; color: #ef4444; }
.form-hint { margin: 4px 0 0; font-size: 12px; color: #9ca3af; line-height: 1.5; }
.full { width: 100%; }

.commit-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}
.co-hash {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #6366f1;
}
.co-msg { font-size: 13px; color: #374151; }
.co-time { font-size: 11px; color: #9ca3af; }

.publish-warn {
  font-size: 12px;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 8px 10px;
  line-height: 1.6;
}

.dialog-footer { display: flex; justify-content: flex-end; gap: 12px; }

.btn-cancel,
.btn-confirm {
  padding: 7px 18px;
  border-radius: 7px;
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel { background: #f2f3f5; color: #2f3547; &:hover { background: #e6e8eb; } }
.btn-confirm {
  background: #1c1a21;
  color: #fff;
  &:not(:disabled):hover { background: #2e323c; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}
</style>
