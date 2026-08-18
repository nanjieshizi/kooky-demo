<template>
  <div class="factory-onboarding-card">
    <!-- 顶部 -->
    <div class="onboarding-header">
      <span class="header-emoji">✨</span>
      <div class="header-text">
        <div class="header-title">告诉我你想创建什么样的 Agent</div>
        <div class="header-sub">回答几个问题，帮我快速理解你的需求</div>
      </div>
    </div>

    <!-- Q1：用途定位（始终展示） -->
    <div class="question-block">
      <div class="question-label"><span class="q-num">01</span>这个 Agent 主要是做什么的？</div>
      <div class="tag-row">
        <button
          v-for="tag in Q1_TAGS"
          :key="tag"
          type="button"
          class="tag-chip"
          :class="{ selected: q1Tag === tag }"
          @click="toggleQ1Tag(tag)"
        >{{ tag }}</button>
      </div>
      <input
        v-model="q1Input"
        class="tag-input"
        type="text"
        maxlength="60"
        placeholder="或用一句话描述，例如：帮员工请假、查销售数据…"
      />
    </div>

    <!-- Q2-Q4：Q1 有值后展开 -->
    <div class="expandable" :class="{ expanded: q1HasValue }">
      <!-- Q2：核心能力（多选） -->
      <div class="question-block">
        <div class="question-label"><span class="q-num">02</span>你希望它能做哪几件事？</div>
        <div class="tag-row">
          <button
            v-for="tag in Q2_TAGS"
            :key="tag"
            type="button"
            class="tag-chip"
            :class="{ selected: q2Tags.includes(tag) }"
            @click="toggleMultiTag(q2Tags, tag)"
          >{{ tag }}</button>
        </div>
        <input
          v-model="q2Input"
          class="tag-input"
          type="text"
          maxlength="60"
          placeholder="还有其他能力？"
        />
      </div>

      <!-- Q3：数据需求（单选，无输入） -->
      <div class="question-block">
        <div class="question-label"><span class="q-num">03</span>它需要记住用户数据吗？</div>
        <div class="radio-row">
          <button
            v-for="opt in Q3_OPTIONS"
            :key="opt.value"
            type="button"
            class="radio-option"
            :class="{ selected: q3 === opt.value }"
            @click="q3 = opt.value"
          >
            <span class="radio-dot"></span>
            <span class="radio-main">{{ opt.label }}</span>
            <span class="radio-hint">{{ opt.hint }}</span>
          </button>
        </div>
      </div>

      <!-- Q4：集成需求（多选） -->
      <div class="question-block">
        <div class="question-label"><span class="q-num">04</span>需要打通哪些系统吗？</div>
        <div class="tag-row">
          <button
            v-for="tag in Q4_TAGS"
            :key="tag"
            type="button"
            class="tag-chip"
            :class="{ selected: q4Tags.includes(tag) }"
            @click="toggleMultiTag(q4Tags, tag)"
          >{{ tag }}</button>
        </div>
        <input
          v-model="q4Input"
          class="tag-input"
          type="text"
          maxlength="60"
          placeholder="还有其他系统？"
        />
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="onboarding-footer">
      <button type="button" class="btn-skip" @click="handleSkip">跳过，直接对话</button>
      <button
        type="button"
        class="btn-confirm"
        :disabled="!q1HasValue"
        @click="handleConfirm"
      >开始创建 →</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactoryOnboardingCard' })

const factoryStore = useFactoryStore()

const Q1_TAGS = ['内部工具', '客服助手', '数据分析', '流程审批', '知识问答', '其他']
const Q2_TAGS = ['查询 / 问答', '提交申请', '发送通知', '数据统计', '文件处理', '自动审批']
const Q3_OPTIONS = [
  { value: 'yes', label: '需要', hint: '记录历史、查余额、追踪状态' },
  { value: 'no', label: '不需要', hint: '每次对话独立，无需存储' },
  { value: 'unsure', label: '不确定', hint: '先生成，之后再调整' },
]
const Q4_TAGS = ['OA 审批', '飞书（i讯飞）', '邮件', '内部业务系统', '暂不需要']

const q1Tag = ref('')
const q1Input = ref('')
const q2Tags = ref([])
const q2Input = ref('')
const q3 = ref('')
const q4Tags = ref([])
const q4Input = ref('')

const q1HasValue = computed(() => !!q1Tag.value || q1Input.value.trim().length >= 2)

function toggleQ1Tag(tag) {
  q1Tag.value = q1Tag.value === tag ? '' : tag
}

function toggleMultiTag(list, tag) {
  const idx = list.indexOf(tag)
  if (idx === -1) list.push(tag)
  else list.splice(idx, 1)
}

function buildPrompt() {
  const parts = []

  const purpose = [q1Tag.value, q1Input.value.trim()].filter(Boolean).join('，')
  if (purpose) parts.push(`用途：${purpose}`)

  const abilities = [...q2Tags.value, q2Input.value.trim()].filter(Boolean).join('、')
  if (abilities) parts.push(`需要具备：${abilities}`)

  const dataMap = { yes: '需要记录用户数据', no: '不需要持久化数据', unsure: '数据需求待定' }
  if (q3.value) parts.push(dataMap[q3.value])

  const integrations = [...q4Tags.value, q4Input.value.trim()].filter(Boolean).join('、')
  if (integrations) parts.push(`需要打通：${integrations}`)

  return `请帮我打造一个 Agent，${parts.join('；')}。`
}

function handleSkip() {
  factoryStore.skipOnboarding()
}

function handleConfirm() {
  if (!q1HasValue.value) return
  factoryStore.completeOnboarding({
    q1: { tag: q1Tag.value, input: q1Input.value.trim() },
    q2: { tags: q2Tags.value, input: q2Input.value.trim() },
    q3: q3.value,
    q4: { tags: q4Tags.value, input: q4Input.value.trim() },
  })
  factoryStore.sendCreatorMessage(buildPrompt())
}
</script>

<style scoped lang="scss">
.factory-onboarding-card {
  width: 100%;
  margin: 12px 0 16px;
  padding: 18px 20px;
  background: linear-gradient(180deg, #fbfbff, #f7f8fb);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 14px;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.04);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.onboarding-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  .header-emoji { font-size: 20px; line-height: 1.2; }
  .header-title { font-size: 14px; font-weight: 600; color: #2f3547; }
  .header-sub { font-size: 12px; color: #91949e; margin-top: 2px; line-height: 1.5; }
}

.question-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-label {
  font-size: 13px;
  font-weight: 500;
  color: #2f3547;
  display: flex;
  align-items: center;
  gap: 6px;
}

.q-num {
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
  background: #eef2ff;
  border-radius: 5px;
  padding: 1px 6px;
  line-height: 1.6;
  flex-shrink: 0;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  padding: 5px 11px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #fff;
  color: #4b5563;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1.4;

  &:hover {
    border-color: #a5b4fc;
    color: #4f46e5;
  }

  &.selected {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
  }
}

.tag-input {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 11px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #2f3547;
  outline: none;
  font-family: inherit;
  background: #fff;
  transition: border-color 0.15s;

  &:focus { border-color: #a5b4fc; }
  &::placeholder { color: rgba(10, 14, 35, 0.25); }
}

.radio-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;

  &:hover {
    border-color: #a5b4fc;
  }

  &.selected {
    border-color: #6366f1;
    background: #fbfbff;

    .radio-dot {
      background: #6366f1;
      border-color: #6366f1;

      &::after {
        opacity: 1;
      }
    }

    .radio-main { color: #4f46e5; }
  }
}

.radio-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid #d1d5db;
  background: #fff;
  flex-shrink: 0;
  position: relative;
  transition: all 0.15s;

  &::after {
    content: '';
    position: absolute;
    inset: 3px;
    border-radius: 50%;
    background: #fff;
    opacity: 0;
    transition: opacity 0.15s;
  }
}

.radio-main {
  font-size: 12px;
  font-weight: 500;
  color: #2f3547;
  flex-shrink: 0;
}

.radio-hint {
  font-size: 11px;
  color: #9ca3af;
}

// Q2-Q4 展开动画
.expandable {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  flex-shrink: 0; // 关键：别被外层 flex 压扁，撑满内容高，让卡片自身滚动
  transition: max-height 0.35s ease, opacity 0.25s ease;

  &.expanded {
    // 窄栏里 Q2-Q4 换行后会超过 800px,放宽上限避免裁掉
    max-height: 2000px;
    opacity: 1;
  }
}

.onboarding-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px dashed rgba(0, 0, 0, 0.06);
}

.btn-skip {
  background: none;
  border: none;
  font-size: 13px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  transition: color 0.15s;

  &:hover { color: #6366f1; }
}

.btn-confirm {
  height: 32px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: #6366f1;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;

  &:hover { background: #4f46e5; }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}
</style>
