<template>
  <div class="empty-guide">
    <div class="eg-inner">
      <!-- 标题 + 手绘橙色波浪下划线 -->
      <h1 class="eg-title">
        你和你的一人团队，从这儿开始
        <svg class="eg-squiggle" viewBox="0 0 120 14" fill="none" aria-hidden="true" preserveAspectRatio="none">
          <path d="M2 9C14 3 22 3 34 8s20 5 32 0 20-5 32 0 18 3 20 1" stroke="url(#eg-sq)" stroke-width="4" stroke-linecap="round" />
          <defs>
            <linearGradient id="eg-sq" x1="0" y1="0" x2="120" y2="0" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FFB05A" /><stop offset="1" stop-color="#FF6A2B" />
            </linearGradient>
          </defs>
        </svg>
      </h1>
      <p class="eg-sub">随口说件事 —— Kooky（个人助理）来拆解、组队、派活。缺人当场从市场聘，你只管围观和拍板。</p>

      <!-- 场景切换 -->
      <div class="eg-tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="eg-tab"
          :class="{ 'is-active': activeTab === t.key }"
          role="tab"
          :aria-selected="activeTab === t.key"
          @click="activeTab = t.key"
        >
          <svg class="eg-tab__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <template v-if="t.key === 'work'"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></template>
            <template v-else-if="t.key === 'dev'"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></template>
            <template v-else><path d="M18 8h1a3 3 0 0 1 0 6h-1"/><path d="M4 8h14v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M7 2v2M11 2v2M15 2v2"/></template>
          </svg>
          <span>{{ t.label }}</span>
        </button>
      </div>

      <!-- 场景卡片：白色圆角面板内的 3 列网格 -->
      <div class="eg-panel">
        <div class="eg-cards">
          <button
            v-for="s in activeScenes"
            :key="s.title"
            type="button"
            class="eg-card"
            @click="$emit('pick', s)"
          >
            <span class="eg-card__icon" aria-hidden="true">{{ s.emoji }}</span>
            <span class="eg-card__title">{{ s.title }}</span>
            <span class="eg-card__desc">{{ s.desc }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

defineOptions({ name: 'OnePersonEmptyGuide' })
defineEmits(['pick'])

const tabs = [
  { key: 'work', label: '日常办公' },
  { key: 'dev', label: '项目开发' },
  { key: 'life', label: '个人生活' },
]

const activeTab = ref('work')

// 日常办公：照设计稿；项目开发 / 个人生活：默认场景（可随时替换文案）
const scenesByTab = {
  work: [
    { emoji: '📋', title: '整理周报', desc: '把零散记录汇总成一份周报', prompt: '把我这周飞书上的工作记录汇总成一份周报' },
    { emoji: '✍🏻', title: '写文案', desc: '一组能直接用的推广 / 运营文案', prompt: '帮我写一组产品上线的推广文案，公众号 + 朋友圈各一版' },
    { emoji: '📈', title: '数据分析', desc: '接数据源，跑出结论和图表', prompt: '分析下上周的用户活跃数据，给我关键结论和图表' },
    { emoji: '📃', title: '文档处理', desc: '写一份结构化的汇报文档', prompt: '帮我把这些素材整理成一份结构化的汇报文档' },
    { emoji: '🎨', title: 'PPT 制作', desc: '制作一份特定主题的精美 PPT', prompt: '帮我做一份「AI 周报助手」产品介绍的精美 PPT' },
    { emoji: '🔍', title: '竞品调研', desc: '搜索同类竞品，输出结构化分析', prompt: '帮我调研同类的周报 / 汇报工具，出一份结构化竞品分析' },
  ],
  dev: [
    { emoji: '🧩', title: '需求拆解', desc: '把一句话需求拆成任务清单', prompt: '把「AI 周报助手」这个需求拆成一份可执行的任务清单' },
    { emoji: '⌨️', title: '写代码', desc: '实现一个功能，给可运行代码', prompt: '帮我实现一个贪吃蛇小游戏，给可直接运行的代码' },
    { emoji: '🖼️', title: '出个原型', desc: '把方案画成低保真交互原型', prompt: '帮我给「AI 周报助手」画一版低保真交互原型', solo: true },
    { emoji: '🧭', title: '技术选型', desc: '对比方案，给一份选型建议', prompt: '帮我对比几种前端状态管理方案，给一份选型建议' },
    { emoji: '🐞', title: 'Bug 排查', desc: '贴上报错，定位原因给修法', prompt: '我这段代码报错了，帮我定位原因并给出修法' },
    { emoji: '📑', title: '接口文档', desc: '按代码生成结构化 API 文档', prompt: '根据这份后端代码生成一份结构化的 API 接口文档' },
  ],
  life: [
    { emoji: '✈️', title: '旅行规划', desc: '定好目的地，排一份行程单', prompt: '帮我规划一趟 3 天 2 晚的周边游，排一份行程单' },
    { emoji: '💰', title: '记账复盘', desc: '汇总本月开销，给出结论', prompt: '把我这个月的开销汇总一下，给我消费结构和结论' },
    { emoji: '🏋️', title: '健身计划', desc: '按目标排一周训练 + 饮食', prompt: '按增肌目标帮我排一周的训练和饮食计划' },
    { emoji: '🍳', title: '菜谱推荐', desc: '看冰箱有啥，给你几道菜', prompt: '我冰箱里有鸡蛋、番茄、青椒，帮我想几道菜' },
    { emoji: '📖', title: '读书笔记', desc: '把一本书整理成结构化笔记', prompt: '帮我把《原则》这本书整理成一份结构化读书笔记' },
    { emoji: '🎉', title: '活动策划', desc: '攒个局，出流程和物料清单', prompt: '帮我策划一场 10 人的周末桌游局，出流程和物料清单' },
  ],
}

const activeScenes = computed(() => scenesByTab[activeTab.value] || [])
</script>

<style scoped>
.empty-guide {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 28px 12px;
  overflow-y: auto;
}
.eg-inner {
  width: 100%;
  max-width: 928px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* 标题 42/700/#000 + 波浪线（真值：Alibaba PuHuiTi 42 Bold #000） */
.eg-title {
  position: relative;
  margin: 0 0 16px;
  font-size: 42px;
  font-weight: 700;
  color: #000;
  line-height: 1.2;
  letter-spacing: 0;
}
.eg-squiggle {
  position: absolute;
  left: 55%;
  bottom: -6px;
  width: 150px;
  height: 14px;
  pointer-events: none;
}

/* 副标题 14/#606572（二级文本色） */
.eg-sub {
  margin: 0 0 26px;
  font-size: 14px;
  line-height: 1.7;
  color: #606572;
  max-width: 62ch;
}

/* 场景切换 tab：三色渐变胶囊底 + 白色选中态 */
.eg-tabs {
  display: inline-flex;
  gap: 4px;
  margin-bottom: 20px;
  padding: 4px;
  border-radius: 12px;
  background: linear-gradient(270deg, rgba(255, 125, 102, 0.1) 9%, rgba(153, 155, 255, 0.1) 66%, rgba(96, 175, 255, 0.1) 100%);
}
.eg-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #2f3547;
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
}
.eg-tab__ico { width: 18px; height: 18px; }
.eg-tab:hover:not(.is-active) { color: #495164; }
.eg-tab.is-active {
  background: #fff;
  border-color: #eceef3;
  color: #ff621f;
  font-weight: 500;
}

/* 卡片面板：白色圆角 16，内 24 留白 */
.eg-panel {
  width: 100%;
  padding: 24px;
  border-radius: 16px;
  background: #fff;
  border: 0.5px solid #eef0f3;
  box-sizing: border-box;
}
.eg-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

/* 单卡：#F7F8FA / 圆角 12 / 图标+标题一行、描述缩进对齐标题 */
.eg-card {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  row-gap: 8px;
  align-content: center;
  min-height: 76px;
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  background: #f7f8fa;
  cursor: pointer;
  text-align: left;
  transition: background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}
.eg-card:hover {
  background: #fff;
  box-shadow: 0 6px 18px rgba(31, 35, 41, 0.07);
  transform: translateY(-1px);
}
.eg-card__icon {
  grid-column: 1;
  grid-row: 1;
  font-size: 16px;
  line-height: 22px;
}
.eg-card__title {
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  font-size: 14px;
  font-weight: 500;
  color: #2f3547;
  line-height: 22px;
}
.eg-card__desc {
  grid-column: 2;
  grid-row: 2;
  font-size: 14px;
  font-weight: 400;
  color: #606572;
  line-height: 22px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .eg-cards { grid-template-columns: repeat(2, 1fr); }
  .eg-title { font-size: 34px; }
}
</style>
