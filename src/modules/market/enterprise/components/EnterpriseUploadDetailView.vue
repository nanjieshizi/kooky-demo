<template>
  <section class="ent-detail" v-if="agent">
    <header class="ent-detail__bar">
      <button class="ent-detail__back" @click="goBack">‹ 返回</button>
      <span class="ent-detail__bar-title">{{ agent.name }} · 我的上传</span>
      <span class="ent-status" :class="`ent-status--${agent.status}`">{{ statusLabel(agent.status) }}</span>
      <div class="ent-detail__bar-actions">
        <button class="ent-btn" @click="editInFactory">去工厂编辑</button>
        <button v-if="agent.status === 'online'" class="ent-btn" @click="offline">下架</button>
        <button v-else class="ent-btn ent-btn--dark" @click="publish">发布</button>
      </div>
    </header>

    <div class="ent-detail__body">
      <!-- Hero -->
      <div class="ent-hero">
        <div class="ent-hero__avatar">{{ agent.icon }}</div>
        <div class="ent-hero__info">
          <div class="ent-hero__title-row">
            <h1 class="ent-hero__title">{{ agent.name }}</h1>
            <span class="ent-hero__db">🗄️ 带数据库</span>
          </div>
          <div class="ent-hero__tags"><span v-for="t in agent.tags" :key="t" class="ent-tag">{{ t }}</span></div>
          <div class="ent-hero__meta">由 <b>{{ agent.author.displayName }}</b> 维护 · 👥 {{ agent.subscribers }} 订阅 · 更新于 {{ agent.updatedAt }}</div>
        </div>
      </div>

      <!-- 仅 owner 可见提示 -->
      <div class="ent-owner-note">🔒「数据库 / 代码」仅你（发布者）可见，消费者在公开详情页看不到</div>

      <!-- Tab 切换 -->
      <div class="ent-tabs">
        <button v-for="t in sectionTabs" :key="t.key" class="ent-tabs__btn" :class="{ 'is-active': activeSection === t.key }" @click="activeSection = t.key">{{ t.label }}</button>
      </div>

      <!-- 概览 Tab -->
      <div v-show="activeSection === 'overview'">
      <!-- 基本信息 -->
      <section class="ent-sec">
        <h2 class="ent-sec__title">基本信息</h2>
        <p class="ent-sec__text">{{ agent.description }}</p>
      </section>

      <!-- 技能 -->
      <section class="ent-sec">
        <h2 class="ent-sec__title">技能</h2>
        <div class="ent-skill-list">
          <div v-for="s in agent.skills" :key="s.id" class="ent-skill">
            <span class="ent-skill__icon">🧩</span>
            <div><div class="ent-skill__name">{{ s.name }}</div><div class="ent-skill__desc">{{ s.desc }}</div></div>
          </div>
        </div>
      </section>

      <!-- 知识库 -->
      <section class="ent-sec">
        <h2 class="ent-sec__title">知识库</h2>
        <div class="ent-know-list">
          <div v-for="k in agent.knowledge" :key="k.id" class="ent-know">
            <span>{{ k.type === 'url' ? '🔗' : '📄' }}</span><span>{{ k.name }}</span>
          </div>
        </div>
      </section>

      </div><!-- /概览 -->

      <!-- 数据库 Tab -->
      <div v-show="activeSection === 'database'">
      <section class="ent-sec">
        <h2 class="ent-sec__title">🗄️ 数据库</h2>
        <div class="ent-db">
          <div class="ent-db__tabs">
            <button
              v-for="t in agent.dbTables"
              :key="t.name"
              class="ent-db__tab"
              :class="{ 'is-active': activeTable === t.name }"
              @click="activeTable = t.name"
            >{{ t.name }} <span class="ent-db__rows">{{ t.rows }}行</span></button>
          </div>
          <div v-if="curTable" class="ent-db__panel">
            <div class="ent-db__desc">{{ curTable.desc }}</div>
            <div class="ent-db__sub">字段结构</div>
            <table class="ent-tbl">
              <thead><tr><th>字段</th><th>类型</th><th>说明</th><th>主键</th></tr></thead>
              <tbody>
                <tr v-for="c in curTable.columns" :key="c.name">
                  <td class="mono">{{ c.name }}</td><td><span class="ent-type">{{ c.type }}</span></td>
                  <td>{{ c.desc }}</td><td>{{ c.pk ? '🔑' : '' }}</td>
                </tr>
              </tbody>
            </table>
            <div class="ent-db__sub">数据记录（样例）</div>
            <table class="ent-tbl">
              <thead><tr><th v-for="c in curTable.columns" :key="c.name">{{ c.name }}</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in curTable.sampleRows" :key="i">
                  <td v-for="c in curTable.columns" :key="c.name" class="mono">{{ r[c.name] ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      </div><!-- /数据库 -->

      <!-- 代码 Tab -->
      <div v-show="activeSection === 'code'">
      <section class="ent-sec">
        <h2 class="ent-sec__title">💻 代码 <span class="ent-readonly">只读 · 改回工厂</span></h2>
        <div class="ent-code">
          <div class="ent-code__tree">
            <div
              v-for="f in agent.codeFiles"
              :key="f.path"
              class="ent-code__file"
              :class="{ 'is-active': activeFile === f.path }"
              @click="activeFile = f.path"
            >{{ f.path }}</div>
          </div>
          <pre class="ent-code__content">{{ curFile ? curFile.content : '' }}</pre>
        </div>
      </section>
      </div><!-- /代码 -->
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'EnterpriseUploadDetailView' })
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getEnterpriseAgent } from '@/dev-mocks/data/enterprise-agents'

const route = useRoute()
const router = useRouter()
const agent = computed(() => getEnterpriseAgent(route.params.id))

const activeSection = ref('overview')
const sectionTabs = [
  { key: 'overview', label: '概览' },
  { key: 'database', label: '数据库' },
  { key: 'code', label: '代码' },
]
const activeTable = ref(agent.value?.dbTables?.[0]?.name || '')
const activeFile = ref(agent.value?.codeFiles?.[0]?.path || '')
const curTable = computed(() => (agent.value?.dbTables || []).find((t) => t.name === activeTable.value))
const curFile = computed(() => (agent.value?.codeFiles || []).find((f) => f.path === activeFile.value))

const statusLabelMap = { online: '已发布', testing: '审核中', draft: '未发布', reject: '已驳回', offline: '已下架' }
function statusLabel(s) { return statusLabelMap[s] || s }

function goBack() { router.back() }
function editInFactory() { ElMessage.info('跳转「工厂」编辑该企业数字人（占位）') }
function publish() { if (agent.value) { agent.value.status = 'testing'; ElMessage.success('已提交发布，进入审核中') } }
function offline() { if (agent.value) { agent.value.status = 'offline'; ElMessage.info('已下架，订阅者不再可见') } }
</script>

<style lang="scss" scoped>
.ent-detail { flex: 1; display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow-y: auto; }
.ent-detail__bar { height: 52px; display: flex; align-items: center; gap: 12px; padding: 0 20px; border-bottom: 1px solid #eceef3; position: sticky; top: 0; background: #fff; z-index: 5; }
.ent-detail__back { border: none; background: transparent; color: #6b7280; font-size: 14px; cursor: pointer; }
.ent-detail__bar-title { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.ent-detail__bar-actions { margin-left: auto; display: flex; gap: 8px; }
.ent-detail__body { padding: 24px 32px; max-width: 920px; }

.ent-btn { height: 30px; padding: 0 14px; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; font-size: 13px; color: #2f3547; cursor: pointer; &:hover { border-color: #ff684e; color: #ff684e; } &--dark { background: #1c1a21; color: #fff; border-color: #1c1a21; &:hover { background: #2e323c; color: #fff; } } }

.ent-hero { display: flex; gap: 16px; align-items: flex-start; padding-bottom: 20px; border-bottom: 1px solid #eceef3; }
.ent-hero__avatar { width: 64px; height: 64px; flex-shrink: 0; border-radius: 16px; background: linear-gradient(135deg, #eef2ff, #f5f3ff); display: flex; align-items: center; justify-content: center; font-size: 34px; }
.ent-hero__info { flex: 1; min-width: 0; }
.ent-hero__title-row { display: flex; align-items: center; gap: 10px; }
.ent-hero__title { margin: 0; font-size: 22px; font-weight: 700; color: #1a1a1a; }
.ent-hero__db { font-size: 12px; color: #6366f1; background: rgba(99,102,241,0.1); padding: 2px 8px; border-radius: 6px; }
.ent-hero__tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.ent-hero__meta { font-size: 13px; color: #9ca3af; }
.ent-tag { font-size: 11px; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 5px; }

.ent-owner-note { margin: 16px 0 0; padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #b45309; }

.ent-tabs { display: flex; gap: 4px; margin: 18px 0 4px; border-bottom: 1px solid #eceef3; }
.ent-tabs__btn { padding: 9px 18px; border: none; background: transparent; font-size: 14px; color: #6b7280; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; &:hover { color: #1a1a1a; } &.is-active { color: #ff684e; font-weight: 600; border-bottom-color: #ff684e; } }

.ent-sec { padding: 22px 0; border-bottom: 1px solid #f3f4f6; }
.ent-sec__title { margin: 0 0 14px; font-size: 16px; font-weight: 600; color: #1a1a1a; border-left: 3px solid #ff684e; padding-left: 8px; display: flex; align-items: center; gap: 10px; }
.ent-sec__text { margin: 0; font-size: 14px; color: #4b5563; line-height: 1.8; }
.ent-readonly { font-size: 11px; font-weight: normal; color: #9ca3af; background: #f3f4f6; padding: 1px 8px; border-radius: 5px; }

.ent-skill-list { display: flex; flex-direction: column; gap: 10px; }
.ent-skill { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; background: #f9fafb; border-radius: 10px; }
.ent-skill__icon { font-size: 18px; }
.ent-skill__name { font-size: 14px; font-weight: 500; color: #1a1a1a; }
.ent-skill__desc { font-size: 12px; color: #9ca3af; margin-top: 2px; }
.ent-know-list { display: flex; flex-direction: column; gap: 8px; }
.ent-know { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #f9fafb; border-radius: 10px; font-size: 13px; color: #374151; }

/* 数据库 */
.ent-db__tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.ent-db__tab { padding: 6px 12px; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; font-size: 13px; color: #374151; cursor: pointer; font-family: 'SF Mono', Menlo, monospace; &.is-active { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,0.06); } }
.ent-db__rows { font-size: 10px; color: #9ca3af; }
.ent-db__panel { background: #f9fafb; border-radius: 10px; padding: 14px; }
.ent-db__desc { font-size: 12px; color: #6b7280; margin-bottom: 12px; }
.ent-db__sub { font-size: 11px; color: #9ca3af; margin: 14px 0 6px; }
.ent-tbl { width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; border-radius: 8px; overflow: hidden; }
.ent-tbl th { text-align: left; padding: 7px 10px; background: #f3f4f6; color: #6b7280; font-weight: 500; font-size: 11px; white-space: nowrap; }
.ent-tbl td { padding: 6px 10px; border-top: 1px solid #f3f4f6; color: #374151; }
.ent-tbl .mono { font-family: 'SF Mono', Menlo, monospace; }
.ent-type { font-family: 'SF Mono', Menlo, monospace; font-size: 10px; background: #f3f4f6; color: #6b7280; padding: 1px 6px; border-radius: 4px; }

/* 代码 */
.ent-code { display: flex; border: 1px solid #eceef3; border-radius: 10px; overflow: hidden; min-height: 200px; }
.ent-code__tree { width: 220px; flex-shrink: 0; background: #f9fafb; border-right: 1px solid #eceef3; padding: 8px; }
.ent-code__file { padding: 6px 10px; font-size: 12px; color: #374151; border-radius: 6px; cursor: pointer; font-family: 'SF Mono', Menlo, monospace; word-break: break-all; &:hover { background: #f3f4f6; } &.is-active { background: rgba(99,102,241,0.1); color: #6366f1; } }
.ent-code__content { flex: 1; margin: 0; padding: 14px; font-size: 12px; font-family: 'SF Mono', Menlo, monospace; color: #374151; white-space: pre-wrap; overflow-x: auto; line-height: 1.7; }

.ent-status { font-size: 11px; padding: 2px 8px; border-radius: 5px; }
.ent-status--online { color: #16a34a; background: #dcfce7; }
.ent-status--testing { color: #b45309; background: #fef3c7; }
.ent-status--draft { color: #6b7280; background: #f3f4f6; }
.ent-status--reject { color: #dc2626; background: #fee2e2; }
.ent-status--offline { color: #6b7280; background: #f3f4f6; }
</style>
