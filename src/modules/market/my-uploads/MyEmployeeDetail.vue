<template>
  <section class="emp-detail">
    <div class="emp-head">
      <button class="emp-back" @click="goBack">‹</button>
      <span class="emp-head-title">{{ data.name }} · 详情</span>
    </div>

    <div v-if="data" class="emp-body">
      <!-- hero -->
      <div class="emp-hero">
        <div class="emp-ava" :class="{ skill: data.kind === 'skill' }">
          <span v-if="data.kind === 'skill'">{{ data.icon }}</span>
          <img v-else-if="data.avatar" :src="data.avatar" alt="" />
          <span v-else>{{ (data.name || '?').slice(0, 1) }}</span>
        </div>
        <div class="emp-hero-info">
          <div class="emp-hero-name">{{ data.name }} <span class="emp-ver">{{ data.version }}</span></div>
          <div class="emp-hero-sub">
            <span class="emp-tag">{{ data.origin }}</span>
            <span class="emp-domain">{{ data.domain }}</span>
          </div>
        </div>
      </div>

      <!-- tabs -->
      <nav class="emp-tabs">
        <button v-for="t in TABS" :key="t.key" class="emp-tab" :class="{ active: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
      </nav>

      <!-- 详情 -->
      <div v-if="tab === 'detail'" class="emp-pane">
        <section class="emp-sec">
          <h3 class="emp-sec-title">描述</h3>
          <p class="emp-text">{{ data.description }}</p>
        </section>
        <section class="emp-sec">
          <h3 class="emp-sec-title">关联来源</h3>
          <p class="emp-text">{{ data.link }}</p>
        </section>
        <section class="emp-sec">
          <h3 class="emp-sec-title">{{ data.kind === 'skill' ? '装配关系' : '能力 / Skill' }}</h3>
          <p class="emp-text">{{ data.capability }}</p>
        </section>
      </div>

      <!-- 工作表现（私有口径）-->
      <div v-else class="emp-pane">
        <div class="emp-hint">🔒 工作表现仅你可见 · 是「它替你干得怎么样」的私有口径（不是生态用量）</div>
        <div class="emp-kpis">
          <div v-for="k in data.kpis" :key="k.label" class="emp-kpi">
            <div class="emp-kpi-val">{{ k.value }}</div>
            <div class="emp-kpi-label">{{ k.label }}</div>
          </div>
        </div>
        <div class="emp-v2">成功率 / 质量分 —— 接入 AI 评估后开放（当前为埋点客观口径：完成率 / 失败率）</div>
        <section class="emp-sec">
          <h3 class="emp-sec-title">近期任务 <span class="emp-sec-note">近 30 天</span></h3>
          <div class="emp-task-list">
            <div v-for="(t, i) in data.tasks" :key="i" class="emp-task">
              <span class="emp-task-dot" :class="t.ok ? 'ok' : 'fail'"></span>
              <span class="emp-task-name">{{ t.name }}</span>
              <span class="emp-task-time">{{ t.time }}</span>
              <span class="emp-task-res" :class="t.ok ? 'ok' : 'fail'">{{ t.ok ? '完成' : '失败' }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import av1 from '@/modules/market/avatar/components/images/m01@2x.png'
import av2 from '@/modules/market/avatar/components/images/w01@2x.png'
import av3 from '@/modules/market/avatar/components/images/m03@2x.png'

const route = useRoute()
const router = useRouter()

const TABS = [
  { key: 'detail', label: '详情' },
  { key: 'perf', label: '工作表现' },
]
const tab = ref('perf') // 默认进工作表现（这页的主角）

// 在用资产的私有详情 mock，按 id
const MAP = {
  m1: { kind: 'agent', name: '小销 · 销售助理', avatar: av1, version: 'v3', origin: '自建', domain: '销售域',
    description: '外呼话术 + 异议处理 + CRM 自动写回，跟进不掉链子。', link: '🏭 小销·工厂蓝图', capability: '网页搜索 · 数据可视化 · CRM 写入',
    kpis: [{ label: '我的对话', value: '342' }, { label: '完成率', value: '91.8%' }, { label: '失败率', value: '3.1%' }, { label: '平均耗时', value: '6.2s' }, { label: '记忆条数', value: '418' }],
    tasks: [{ name: '整理本周客户跟进清单', time: '今天 09:12', ok: true }, { name: '生成报价单 · A 客户', time: '昨天 16:40', ok: true }, { name: '同步 CRM 失败（鉴权过期）', time: '昨天 11:03', ok: false }, { name: '外呼话术演练', time: '06-13', ok: true }] },
  m2: { kind: 'agent', name: '数据分析师 D', avatar: av2, version: 'v1', origin: '市场聘用', domain: '来自市场',
    description: '多源数据整合、SQL 查询与可视化看板，业务洞察一把抓。', link: '🛒 数据分析大师 Pro', capability: '数据可视化 · 数据库查询 · 网页搜索',
    kpis: [{ label: '我的对话', value: '156' }, { label: '完成率', value: '86.4%' }, { label: '失败率', value: '6.0%' }, { label: '平均耗时', value: '9.4s' }, { label: '记忆条数', value: '203' }],
    tasks: [{ name: '上月营收同比看板', time: '今天 10:30', ok: true }, { name: '渠道转化漏斗分析', time: '06-14', ok: true }, { name: '查询失败（库连接超时）', time: '06-12', ok: false }] },
  m3: { kind: 'agent', name: '周报小助手', avatar: av3, version: 'v2', origin: '自建', domain: '效率域',
    description: '自动汇总本周进展、生成结构化周报，周五不用熬夜。', link: '— 自己上传', capability: '文档读取 · 网页搜索',
    kpis: [{ label: '我的对话', value: '88' }, { label: '完成率', value: '95.2%' }, { label: '失败率', value: '1.1%' }, { label: '平均耗时', value: '4.1s' }, { label: '记忆条数', value: '95' }],
    tasks: [{ name: '生成本周周报', time: '今天 18:00', ok: true }, { name: '汇总团队进展', time: '06-13', ok: true }] },
  s1: { kind: 'skill', icon: '🔍', name: '网页搜索', version: 'v4', origin: '自建', domain: '能力 Skill',
    description: '实时检索互联网，给数字人补充最新信息。', link: '— 自己上传', capability: '已装配到 5 个数字人',
    kpis: [{ label: '被调用', value: '1,204' }, { label: '装配数字人', value: '5' }, { label: '完成率', value: '98.6%' }, { label: '平均耗时', value: '1.3s' }, { label: '近 7 天调用', value: '286' }],
    tasks: [{ name: '小销 调用 · 查行业资讯', time: '今天 09:14', ok: true }, { name: '数据分析师D 调用 · 查汇率', time: '今天 10:31', ok: true }, { name: '调用超时（外网抖动）', time: '06-14', ok: false }] },
  s2: { kind: 'skill', icon: '📊', name: '数据可视化', version: 'v2', origin: '市场订阅', domain: '能力 Skill',
    description: '一键把结果生成图表与看板。', link: '🛒 图表大师 Skill', capability: '已装配到 3 个数字人',
    kpis: [{ label: '被调用', value: '432' }, { label: '装配数字人', value: '3' }, { label: '完成率', value: '96.8%' }, { label: '平均耗时', value: '2.0s' }, { label: '近 7 天调用', value: '96' }],
    tasks: [{ name: '数据分析师D 调用 · 生成漏斗图', time: '今天 10:32', ok: true }, { name: '小销 调用 · 业绩柱状图', time: '06-14', ok: true }] },
  s3: { kind: 'skill', icon: '🗄️', name: '数据库查询', version: 'v1', origin: '自建', domain: '能力 Skill',
    description: '安全连接并查询业务库，支持只读。', link: '— 自己上传', capability: '暂未装配',
    kpis: [{ label: '被调用', value: '0' }, { label: '装配数字人', value: '0' }, { label: '完成率', value: '—' }, { label: '平均耗时', value: '—' }, { label: '近 7 天调用', value: '0' }],
    tasks: [] },
  s4: { kind: 'skill', icon: '⚙️', name: '代码执行', version: 'v3', origin: '自建', domain: '能力 Skill',
    description: '沙箱里跑 Python / JS，验证逻辑与产出。', link: '— 自己上传', capability: '已装配到 2 个数字人',
    kpis: [{ label: '被调用', value: '210' }, { label: '装配数字人', value: '2' }, { label: '完成率', value: '94.0%' }, { label: '平均耗时', value: '3.6s' }, { label: '近 7 天调用', value: '44' }],
    tasks: [{ name: '小销 调用 · 跑测算脚本', time: '06-14', ok: true }, { name: '执行失败（依赖缺失）', time: '06-12', ok: false }] },
}
const FALLBACK = { kind: 'agent', name: '数字员工', avatar: '', version: '', origin: '自建', domain: '', description: '-', link: '—', capability: '-', kpis: [], tasks: [] }

const data = computed(() => MAP[String(route.params.id)] || FALLBACK)
function goBack() {
  router.back()
}
</script>

<style scoped>
.emp-detail {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f9fafa 0%, #fff 25%);
  overflow: hidden;
}
.emp-head {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 24px;
  border-bottom: 1px solid #eceef3;
  flex-shrink: 0;
}
.emp-back {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 22px;
  color: #606572;
  cursor: pointer;
  border-radius: 7px;
}
.emp-back:hover {
  background: #f2f3f5;
}
.emp-head-title {
  font-size: 16px;
  font-weight: 700;
  color: #2f3547;
}
.emp-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  max-width: 880px;
}
.emp-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.emp-ava {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #eef3ff, #f3f0ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  color: #436ff6;
  flex-shrink: 0;
}
.emp-ava.skill {
  background: linear-gradient(135deg, #fff4e0, #ffe3c2);
}
.emp-ava img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.emp-hero-name {
  font-size: 18px;
  font-weight: 700;
  color: #2f3547;
  display: flex;
  align-items: center;
  gap: 8px;
}
.emp-ver {
  font-size: 13px;
  color: #91949e;
  font-weight: 500;
}
.emp-hero-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.emp-tag {
  font-size: 11px;
  font-weight: 600;
  color: #436ff6;
  background: #eef3ff;
  border-radius: 9px;
  padding: 2px 8px;
}
.emp-domain {
  font-size: 12px;
  color: #91949e;
}
.emp-tabs {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid #eceef3;
  margin-bottom: 18px;
}
.emp-tab {
  height: 38px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: #8a8f99;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.emp-tab.active {
  color: #436ff6;
  border-bottom-color: #436ff6;
}
.emp-hint {
  font-size: 12px;
  color: #99580a;
  background: #fff7e6;
  border: 1px solid #ffe2b0;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 18px;
}
.emp-kpis {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 22px;
}
.emp-kpi {
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}
.emp-kpi-val {
  font-size: 22px;
  font-weight: 700;
  color: #2f3547;
  font-variant-numeric: tabular-nums;
}
.emp-kpi-label {
  font-size: 12px;
  color: #91949e;
  margin-top: 4px;
}
.emp-v2 {
  font-size: 11px;
  color: #c0c4cc;
  margin: -10px 0 22px;
}
.emp-sec {
  margin-bottom: 20px;
}
.emp-sec-title {
  font-size: 14px;
  font-weight: 700;
  color: #2f3547;
  margin: 0 0 10px;
}
.emp-sec-note {
  font-size: 11px;
  font-weight: 500;
  color: #a8b0c0;
}
.emp-text {
  font-size: 13px;
  line-height: 1.7;
  color: #4e5969;
  margin: 0;
}
.emp-task-list {
  display: flex;
  flex-direction: column;
  border: 1px solid #eceef3;
  border-radius: 12px;
  overflow: hidden;
}
.emp-task {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  font-size: 13px;
  border-bottom: 1px solid #f2f3f5;
}
.emp-task:last-child {
  border-bottom: none;
}
.emp-task-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.emp-task-dot.ok {
  background: #52c41a;
}
.emp-task-dot.fail {
  background: #e54545;
}
.emp-task-name {
  flex: 1;
  color: #2f3547;
}
.emp-task-time {
  color: #91949e;
  font-size: 12px;
}
.emp-task-res {
  font-size: 12px;
  font-weight: 600;
}
.emp-task-res.ok {
  color: #3a9e0a;
}
.emp-task-res.fail {
  color: #e54545;
}
</style>
