<script setup>
import { ref, computed, watch } from 'vue'
import { useUIStore } from '@/modules/space/uiStore'
import {
  getToolDescription,
  getToolPath,
  getToolCommand,
  getToolQuery,
  getToolUrl,
  isFileTool,
  ToolType
} from '../utils/employeeToolCallsUi'
import MarkdownContent from '@/shared/components/MarkdownContent.vue'

const props = defineProps({
  steps: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false }
})

const uiStore = useUIStore()
const showAllSteps = ref(false)

const lastToolCallStep = computed(() => {
  const toolCallSteps = props.steps.filter(s => s.type === 'toolCall')
  return toolCallSteps[toolCallSteps.length - 1] || null
})

const aboveLastToolCallSteps = computed(() => {
  if (!lastToolCallStep.value) return []
  const idx = props.steps.findIndex(s => s.id === lastToolCallStep.value.id)
  return idx > 0 ? props.steps.slice(0, idx) : []
})

const hiddenStepsCount = computed(() => aboveLastToolCallSteps.value.length)

// FlipDisplay：监听最后一个 step 的 id 变化，触发翻转动画
const flipKey = ref(lastToolCallStep.value?.id || '')
watch(lastToolCallStep, (next) => {
  if (next?.id !== flipKey.value) {
    flipKey.value = next?.id || ''
  }
})

function toggleShowAll() {
  showAllSteps.value = !showAllSteps.value
}

function openFilePreview(filePath) {
  if (!filePath) return
  uiStore.openFilePreview(filePath)
}

const collapsedTexts = ref({})

function shouldCollapseCode(result) {
  if (!result) return false
  return result.split('\n').length > 20
}

function getCollapsedCode(result) {
  return result.split('\n').slice(0, 20).join('\n') + '\n...'
}

function toggleCollapse(id) {
  collapsedTexts.value[id] = !collapsedTexts.value[id]
}

function shouldCollapseText(result) {
  if (!result) return false
  return result.split('\n').length > 10
}

function getCollapsedText(result) {
  return result.split('\n').slice(0, 10).join('\n') + '\n...'
}

// 工具名称映射（中文）
const toolNameMap = {
  [ToolType.WEB_SEARCH]: '搜索网页',
  [ToolType.IMAGE_SEARCH]: '搜索图片',
  [ToolType.WEB_FETCH]: '获取网页内容',
  [ToolType.LS]: '列出文件夹',
  [ToolType.READ_FILE]: '读取文件',
  [ToolType.WRITE_FILE]: '写入文件',
  [ToolType.STR_REPLACE]: '替换文件内容',
  [ToolType.BASH]: '执行命令',
  [ToolType.ASK_CLARIFICATION]: '需要您的帮助',
  [ToolType.WRITE_TODOS]: '更新待办事项',
  [ToolType.PRESENT_FILES]: '展示文件',
  [ToolType.DOWNLOAD_SKILL]: '下载技能',
}

function getToolLabel(step) {
  if (!step) return ''
  const desc = getToolDescription(step.args)
  if (desc) return desc
  switch (step.name) {
    case ToolType.WEB_SEARCH: {
      const q = getToolQuery(step.args)
      return q ? `在网络上搜索: ${q}` : '搜索相关信息'
    }
    case ToolType.IMAGE_SEARCH: {
      const q = getToolQuery(step.args)
      return q ? `搜索相关图片: ${q}` : '搜索相关图片'
    }
    case ToolType.WEB_FETCH: return '查看网页内容'
    case ToolType.LS: return '列出文件夹内容'
    case ToolType.READ_FILE: return '读取文件'
    case ToolType.WRITE_FILE:
    case ToolType.STR_REPLACE: return '写入文件'
    case ToolType.BASH: return '执行命令'
    case ToolType.ASK_CLARIFICATION: return '需要您的帮助'
    case ToolType.WRITE_TODOS: return '更新待办事项'
    default: return toolNameMap[step.name] || `使用工具: ${step.name}`
  }
}

// 结果渲染类型
// 对齐 deer-flow：工具卡片只展示"做了什么（args）"，不展示执行结果（result）
// 仅 web_search / image_search / download_skill 例外，因为结果本身就是展示内容
function getResultRenderType(name) {
  switch (name) {
    case ToolType.WEB_SEARCH: return 'search-links'
    case ToolType.IMAGE_SEARCH: return 'image-grid'
    case ToolType.DOWNLOAD_SKILL: return 'skill-download'
    default: return 'none'
  }
}

// SVG 图标组件
function getToolIcon(name) {
  const iconMap = {
    search: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search size-4" aria-hidden="true"><path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg>',
    globe: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe size-4" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>',
    folder: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-open size-4" aria-hidden="true"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"></path></svg>',
    book: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open-text size-4" aria-hidden="true"><path d="M12 7v14"></path><path d="M16 12h2"></path><path d="M16 8h2"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path><path d="M6 12h2"></path><path d="M6 8h2"></path></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-notebook-pen size-4" aria-hidden="true"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"></path><path d="M2 6h4"></path><path d="M2 10h4"></path><path d="M2 14h4"></path><path d="M2 18h4"></path><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"></path></svg>',
    terminal: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-terminal size-4" aria-hidden="true"><path d="m7 11 2-2-2-2"></path><path d="M11 13h4"></path><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect></svg>',
    question: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.0558,2.9441848999999998Q10.9616089,0.85000002,7.9999995,0.85000002Q5.0383713,0.8500005,2.9441857000000002,2.944186Q0.85000002,5.0383718,0.85000044,7.9999967Q0.8500005,10.961607,2.9441853,13.055799Q5.0383756,15.149999,7.9999967,15.149999Q10.9616022,15.149999,13.0558,13.055801Q15.149999,10.9616041,15.149999,7.9999995Q15.149999,5.0383756,13.0558,2.9441848999999998ZM3.8634243,3.863425Q5.5768495,2.15000027,7.9999995,2.15000033Q10.4231319,2.14999998,12.136563,3.8634253Q13.849998,5.5768547,13.849998,7.9999995Q13.849998,10.4231262,12.136562,12.136562Q10.4231253,13.849998,7.9999967,13.849998Q5.5768547,13.849998,3.8634257,12.136562Q2.15000027,10.42313,2.15000033,7.9999967Q2.14999998,5.576849,3.8634243,3.863425ZM7.3501301,5.4000001Q7.3501296,5.3359933,7.3626165,5.2732162Q7.375103,5.2104397,7.3995972,5.1513051999999995Q7.4240913,5.0921707000000005,7.4596519,5.0389512Q7.4952126,4.985731599999999,7.540472,4.9404724Q7.5857315,4.8952127,7.6389508,4.8596525Q7.6921701,4.8240924,7.7513046,4.7995982Q7.8104391,4.775104,7.8732162,4.7626171Q7.9359932,4.7501299,8,4.7501299Q8.0640068,4.7501299,8.1267829,4.762616899999999Q8.189559899999999,4.775104,8.2486939,4.7995982Q8.3078279,4.8240924,8.3610477,4.8596525Q8.414267500000001,4.8952127,8.459527,4.9404721Q8.5047865,4.985731599999999,8.5403466,5.0389512Q8.5759068,5.0921707000000005,8.6004009,5.1513051999999995Q8.6248956,5.2104397,8.637382500000001,5.2732162Q8.649869899999999,5.3359933,8.649869899999999,5.4000001L8.649999600000001,5.3999999L8.649999600000001,7.9999995L8.649869899999999,7.9999995Q8.649869899999999,8.0640059,8.637383,8.1267824Q8.624896,8.189559,8.600401399999999,8.2486935Q8.5759068,8.3078279,8.5403471,8.3610477Q8.5047865,8.4142671,8.459527,8.459527Q8.414267500000001,8.5047865,8.3610477,8.5403466Q8.3078279,8.5759068,8.2486935,8.6004009Q8.1895595,8.6248956,8.1267829,8.637382500000001Q8.0640068,8.649869899999999,8,8.649869899999999Q7.9359932,8.649869899999999,7.8732162,8.637383Q7.8104391,8.624896,7.7513046,8.600401399999999Q7.6921701,8.5759068,7.6389508,8.5403471Q7.5857315,8.5047865,7.540472,8.459527Q7.4952126,8.414267500000001,7.4596524,8.3610477Q7.4240918,8.3078279,7.3995976,8.2486935Q7.375103,8.1895595,7.3626165,8.1267829Q7.3501296,8.0640068,7.3501301,8L7.3499994,7.9999995L7.3499994,5.3999999L7.3501301,5.3999999L7.3501301,5.4000001ZM7.9999995,11.2498693L7.9999995,11.249999L8.0064998,11.249999L8.0064998,11.2498693Q8.0705061,11.2498684,8.1332822,11.237381Q8.1960588,11.2248936,8.2551932,11.2003994Q8.314327200000001,11.1759052,8.367547,11.1403456Q8.420766799999999,11.1047859,8.4660263,11.0595264Q8.5112858,11.014267,8.546845399999999,10.9610472Q8.582405999999999,10.9078283,8.6069002,10.8486938Q8.6313944,10.7895594,8.643881799999999,10.7267828Q8.6563692,10.6640053,8.656369699999999,10.5999994Q8.6563692,10.5359926,8.643881799999999,10.4732161Q8.6313944,10.4104385,8.6069002,10.351305Q8.582405999999999,10.2921705,8.546845399999999,10.2389507Q8.5112858,10.1857319,8.4660263,10.1404724Q8.420766799999999,10.0952129,8.367547,10.0596523Q8.3143277,10.0240917,8.2551937,9.9995975Q8.1960592,9.9751034,8.1332822,9.962616Q8.0705061,9.9501295,8.0064998,9.9501295L8.0064998,9.9499989L7.9999995,9.9499989L7.9999995,9.9501295Q7.9359922,9.9501295,7.8732152,9.962616Q7.8104386,9.9751034,7.7513046,9.9995975Q7.6921701,10.0240917,7.6389503,10.0596523Q7.585731,10.095212,7.540472,10.1404715Q7.4952126,10.1857309,7.4596524,10.2389507Q7.4240918,10.2921696,7.3995976,10.351305Q7.375103,10.4104385,7.3626165,10.4732161Q7.3501296,10.5359926,7.3501301,10.5999994Q7.3501296,10.6640053,7.3626165,10.7267828Q7.375103,10.7895594,7.3995972,10.8486938Q7.4240913,10.9078283,7.4596519,10.9610481Q7.4952126,11.014267,7.540472,11.0595264Q7.585731,11.1047859,7.6389503,11.1403456Q7.6921701,11.1759052,7.7513046,11.2003994Q7.8104386,11.2248936,7.8732157,11.237381Q7.9359922,11.2498684,7.9999995,11.2498693Z"/></svg>',
    todo: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.0558,2.944185Q10.9616089,0.85000002,7.9999995,0.85000002Q5.0383718,0.8499999,2.9441859,2.944186Q0.85000002,5.0383718,0.85000002,7.9999967Q0.85000008,10.961606,2.9441853,13.055799Q5.0383761,15.149999,7.9999967,15.149999Q10.9616022,15.149999,13.0558,13.055801Q15.149999,10.9616041,15.149999,7.9999995Q15.149999,5.0383756,13.0558,2.944185ZM3.8634248,3.863425Q5.5768499,2.14999992,7.9999995,2.14999998Q10.4231319,2.14999998,12.136563,3.8634255Q13.849998,5.5768552,13.849998,7.9999995Q13.849998,10.4231262,12.136562,12.136562Q10.4231253,13.849998,7.9999967,13.849998Q5.5768557,13.849998,3.8634257,12.136562Q2.14999992,10.42313,2.14999998,7.9999967Q2.14999998,5.5768495,3.8634248,3.863425ZM11.3845263,6.5095277Q11.4759312,6.4181218,11.5254,6.2986946Q11.574869,6.1792669,11.574869,6.0500002Q11.574869,5.9859934,11.562382,5.9232168Q11.549894,5.8604398,11.5254,5.8013053Q11.500906,5.7421713,11.4653454,5.6889515Q11.4297848,5.6357317,11.3845263,5.5904722Q11.3392658,5.5452127,11.286047,5.5096526Q11.2328262,5.474092499999999,11.1736927,5.4495983Q11.1145582,5.4251041,11.0517817,5.4126172Q10.989006,5.4001303,10.9249992,5.4001303Q10.7957325,5.4001303,10.6763048,5.4495988Q10.5568771,5.4990670999999995,10.4654722,5.5904727L10.4653797,5.5903807L7.0249996,9.0307612L5.5346189,7.5403805L5.5345268,7.5404725Q5.4431212,7.4490666,5.3236938,7.3995981Q5.2042668,7.3501301,5.0749998000000005,7.3501301Q5.010993,7.3501301,4.9482162,7.362617Q4.8854394,7.375104,4.8263049,7.3995981Q4.7671703999999995,7.4240923,4.7139511,7.4596519Q4.660731800000001,7.4952126,4.6154723,7.540472Q4.5702128,7.5857315,4.5346525,7.6389508Q4.4990923,7.6921701,4.4745982,7.7513046Q4.4501038,7.8104391,4.4376168,7.8732162Q4.4251299,7.9359932,4.4251299,8Q4.4251299,8.129267200000001,4.4745984,8.2486944Q4.524066400000001,8.3681216,4.6154718,8.459527L4.6153803,8.459618599999999L6.5653806,10.4096193Q6.6106491,10.4548874,6.6638794,10.4904537Q6.7171087,10.526021,6.7762551,10.5505199Q6.8354011,10.5750198,6.8981905,10.5875092Q6.9609799,10.5999985,7.0249996,10.5999985Q7.0890188,10.5999985,7.1518083,10.5875092Q7.2145967,10.5750198,7.2737432,10.5505199Q7.3328896,10.526021,7.3861198,10.4904537Q7.4393501,10.4548874,7.4846191,10.4096193L11.3846178,6.5096192L11.3845263,6.5095277Z"/></svg>',
    tool: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench size-4" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"></path></svg>',
    download: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download size-4" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>',
  }

  switch (name) {
    case ToolType.WEB_SEARCH:
    case ToolType.IMAGE_SEARCH: return iconMap.search
    case ToolType.WEB_FETCH: return iconMap.globe
    case ToolType.LS: return iconMap.folder
    case ToolType.READ_FILE: return iconMap.book
    case ToolType.WRITE_FILE:
    case ToolType.STR_REPLACE: return iconMap.edit
    case ToolType.BASH: return iconMap.terminal
    case ToolType.ASK_CLARIFICATION: return iconMap.question
    case ToolType.WRITE_TODOS: return iconMap.todo
    case ToolType.DOWNLOAD_SKILL: return iconMap.download
    default: return iconMap.tool
  }
}

// 解析搜索结果链接
function parseSearchLinks(result) {
  if (!result) return []
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result
    if (Array.isArray(parsed)) return parsed.slice(0, 5)
    if (parsed.results && Array.isArray(parsed.results)) return parsed.results.slice(0, 5)
  } catch (e) {
    console.warn('Failed to parse search links:', e)
  }
  return []
}

// 解析图片搜索结果
function parseImageGrid(result) {
  if (!result) return []
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result
    if (Array.isArray(parsed)) return parsed.slice(0, 8)
    if (parsed.images && Array.isArray(parsed.images)) return parsed.images.slice(0, 8)
  } catch (e) {
    console.warn('Failed to parse image grid:', e)
  }
  return []
}

// 解析 download_skill 结果，生成 Markdown 表格
function parseSkillDownloadResult(result) {
  if (!result) return null
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result
    if (typeof parsed === 'object') {
      // 生成 Markdown 格式
      let md = ''

      // 添加消息
      if (parsed.message) {
        md += `> ${parsed.message}\n\n`
      }

      // 添加表格
      if (Array.isArray(parsed.skills) && parsed.skills.length > 0) {
        md += `| 图标 | 名称 | 描述 |\n`
        md += `|------|------|------|\n`
        for (const skill of parsed.skills) {
          const name = skill.name || skill.display_name || ''
          const iconMd = skill.icon
            ? `<img src="${skill.icon}" width="24" height="24"/>`
            : '🔧'
          const slugMd = skill.slug ? ` **${name}** (${skill.slug})` : ` **${name}**`
          const desc = skill.description || '-'
          md += `| ${iconMd} |${slugMd}| ${desc} |\n`
        }
      }

      return md || null
    }
    return null
  } catch (e) {
    console.warn('[EmployeeStreamToolCallCard] Failed to parse skill download result:', e)
    return null
  }
}
</script>

<template>
  <div v-if="steps.length > 0" class="tool-calls-timeline">
    <!-- 折叠按钮 -->
    <button
      v-if="hiddenStepsCount > 0"
      class="expand-btn"
      @click="toggleShowAll"
    >
      <span class="expand-icon" :class="{ rotated: showAllSteps }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up size-4 opacity-60 transition-transform duration-200 rotate-180" aria-hidden="true"><path d="m18 15-6-6-6 6"></path></svg>
      </span>
      <span>{{ showAllSteps ? '隐藏步骤' : `查看更多 ${hiddenStepsCount} 步` }}</span>
    </button>

    <!-- 时间线容器 -->
    <div class="timeline-container">
      <!-- 展开的历史步骤 -->
      <template v-if="showAllSteps">
        <div
          v-for="step in aboveLastToolCallSteps"
          :key="step.id"
          class="timeline-step"
        >
          <div class="step-icon-wrapper">
            <div class="step-icon" v-html="getToolIcon(step.name)"></div>
            <div class="step-line"></div>
          </div>
          <div class="step-content">
            <div class="step-header">
              <span class="step-label">{{ getToolLabel(step) }}</span>
            </div>
            <pre v-if="getToolCommand(step.args)" class="step-command">{{ getToolCommand(step.args) }}</pre>
            <div v-else-if="getToolPath(step.args)" class="step-meta">
              <code>{{ getToolPath(step.args) }}</code>
            </div>
            <div v-else-if="getToolUrl(step.args)" class="step-meta">
              <code>{{ getToolUrl(step.args) }}</code>
            </div>

            <!-- 历史步骤的结果渲染（download_skill 等需要展示结果的工具） -->
            <div v-if="step.result && getResultRenderType(step.name) !== 'none'" class="step-result">
              <!-- 技能下载结果 -->
              <template v-if="getResultRenderType(step.name) === 'skill-download'">
                <div class="skill-download-result">
                  <MarkdownContent
                    v-if="parseSkillDownloadResult(step.result)"
                    :content="parseSkillDownloadResult(step.result)"
                  />
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- 最后一个步骤（带 FlipDisplay 动画） -->
      <div
        v-if="lastToolCallStep"
        :key="flipKey"
        class="timeline-step last-step flip-display"
      >
        <div class="step-icon-wrapper">
          <div class="step-icon" v-html="getToolIcon(lastToolCallStep.name)"></div>
        </div>
        <div class="step-content">
          <div class="step-header">
            <span class="step-label">{{ getToolLabel(lastToolCallStep) }}</span>
            <span v-if="isLoading" class="loading-spinner"></span>
          </div>
          <!-- command：bash 优先用代码块样式展示，对齐 deer-flow CodeBlock -->
          <pre v-if="getToolCommand(lastToolCallStep.args)" class="step-command">{{ getToolCommand(lastToolCallStep.args) }}</pre>
          <!-- path：本地路径可点击打开预览，容器内路径（/开头）仅展示 -->
          <div
            v-else-if="getToolPath(lastToolCallStep.args)"
            class="step-meta"
            :class="{ clickable: isFileTool(lastToolCallStep.name) && !getToolPath(lastToolCallStep.args).startsWith('/') }"
            @click="isFileTool(lastToolCallStep.name) && !getToolPath(lastToolCallStep.args).startsWith('/') && openFilePreview(getToolPath(lastToolCallStep.args))"
          >
            <code>{{ getToolPath(lastToolCallStep.args) }}</code>
          </div>
          <div v-else-if="getToolUrl(lastToolCallStep.args)" class="step-meta">
            <code>{{ getToolUrl(lastToolCallStep.args) }}</code>
          </div>

          <!-- 结果渲染 -->
          <div v-if="lastToolCallStep.result && getResultRenderType(lastToolCallStep.name) !== 'none'" class="step-result">
            <!-- 搜索链接 -->
            <template v-if="getResultRenderType(lastToolCallStep.name) === 'search-links'">
              <div class="search-links">
                <a
                  v-for="(link, idx) in parseSearchLinks(lastToolCallStep.result)"
                  :key="idx"
                  :href="link.url"
                  target="_blank"
                  class="search-link"
                >
                  <div class="link-title">{{ link.title }}</div>
                  <div class="link-url">{{ link.url }}</div>
                </a>
              </div>
            </template>

            <!-- 图片网格 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'image-grid'">
              <div class="image-grid">
                <img
                  v-for="(img, idx) in parseImageGrid(lastToolCallStep.result)"
                  :key="idx"
                  :src="img.url || img"
                  :alt="img.title || ''"
                  class="grid-image"
                />
              </div>
            </template>

            <!-- 技能下载结果 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'skill-download'">
              <div class="skill-download-result">
                <MarkdownContent
                  v-if="parseSkillDownloadResult(lastToolCallStep.result)"
                  :content="parseSkillDownloadResult(lastToolCallStep.result)"
                />
              </div>
            </template>

            <!-- 代码块 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'code-block'">
              <div class="code-block-wrapper">
                <pre class="code-block">{{
                  collapsedTexts[lastToolCallStep.id] || !shouldCollapseCode(lastToolCallStep.result)
                    ? lastToolCallStep.result
                    : getCollapsedCode(lastToolCallStep.result)
                }}</pre>
                <button
                  v-if="shouldCollapseCode(lastToolCallStep.result)"
                  class="toggle-btn"
                  @click="toggleCollapse(lastToolCallStep.id)"
                >
                  {{ collapsedTexts[lastToolCallStep.id] ? '收起' : '展开全部' }}
                </button>
              </div>
            </template>

            <!-- 可折叠文本 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'collapsible-text'">
              <div class="collapsible-text">
                <pre>{{
                  collapsedTexts[lastToolCallStep.id] || !shouldCollapseText(lastToolCallStep.result)
                    ? lastToolCallStep.result
                    : getCollapsedText(lastToolCallStep.result)
                }}</pre>
                <button
                  v-if="shouldCollapseText(lastToolCallStep.result)"
                  class="toggle-btn"
                  @click="toggleCollapse(lastToolCallStep.id)"
                >
                  {{ collapsedTexts[lastToolCallStep.id] ? '收起' : '展开' }}
                </button>
              </div>
            </template>

            <!-- 文件路径 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'file-path'">
              <div class="file-path">
                <code class="clickable" @click="openFilePreview(lastToolCallStep.result)">
                  {{ lastToolCallStep.result }}
                </code>
              </div>
            </template>

            <!-- 文件列表 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'plain-pre'">
              <pre class="plain-pre">{{ lastToolCallStep.result }}</pre>
            </template>

            <!-- 默认文本 -->
            <template v-else>
              <div class="result-text">{{ lastToolCallStep.result }}</div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tool-calls-timeline {
  margin: 0px 0px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: #f9fafb;
  border: none;
  // border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  transition: background 0.15s;

  &:hover {
    background: #f3f4f6;
  }

  .expand-icon {
    font-size: 10px;
    transition: transform 0.2s;
    height: 16px;
    &.rotated {
      transform: rotate(90deg);
    }
  }
}

.timeline-container {
  padding: 16px;
}

.timeline-step {
  display: flex;
  gap: 12px;
  animation: fadeIn 0.3s ease;

  &:not(:last-child) {
    margin-bottom: 4px;
  }

  &.last-step {
    margin-bottom: 0;
  }
}

.step-icon-wrapper {
  position: relative;
  flex-shrink: 0;
  width: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 50%;
  flex-shrink: 0;

  :deep(svg) {
    width: 14px;
    height: 14px;
  }
}

.step-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  background: #e5e7eb;
  margin-top: 4px;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.step-label {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.step-meta {
  margin-top: 4px;
  code {
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #6b7280;
    background: #f9fafb;
    padding: 2px 6px;
    border-radius: 4px;
  }
  &.clickable {
    cursor: pointer;
    code {
      color: #2563eb;
      background: #eff6ff;
      &:hover {
        background: #dbeafe;
      }
    }
  }
}

// bash 命令代码块（对齐 deer-flow CodeBlock 样式）
.step-command {
  margin: 6px 0 0;
  padding: 8px 10px;
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
}

.step-result {
  margin-top: 12px;
}

// 搜索链接
.search-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-link {
  display: block;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
  text-decoration: none;
  transition: background 0.15s;

  &:hover {
    background: #f3f4f6;
  }

  .link-title {
    font-size: 13px;
    color: #3b82f6;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .link-url {
    font-size: 12px;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// 图片网格
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.grid-image {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  background: #f3f4f6;
}

// 代码块
.code-block-wrapper {
  position: relative;

  .toggle-btn {
    margin-top: 8px;
    padding: 4px 12px;
    background: #f3f4f6;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: #e5e7eb;
    }
  }
}

.code-block {
  margin: 0;
  padding: 12px;
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

// 可折叠文本
.collapsible-text {
  pre {
    margin: 0;
    padding: 12px;
    background: #f9fafb;
    border-radius: 6px;
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .toggle-btn {
    margin-top: 8px;
    padding: 4px 12px;
    background: #f3f4f6;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: #e5e7eb;
    }
  }
}

// 文件路径
.file-path {
  code {
    font-size: 13px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #374151;
    background: #f9fafb;
    padding: 8px 12px;
    border-radius: 6px;
    display: block;

    &.clickable {
      cursor: pointer;
      transition: background 0.15s;
      &:hover {
        background: #e5e7eb;
      }
    }
  }
}

// 文件列表
.plain-pre {
  margin: 0;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #374151;
  white-space: pre;
  overflow-x: auto;
}

// 默认文本
.result-text {
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

// FlipDisplay 翻转动画
.flip-display {
  animation: flipIn 0.4s ease;
}

@keyframes flipIn {
  0% {
    opacity: 0;
    transform: perspective(400px) rotateX(-90deg);
  }
  40% {
    transform: perspective(400px) rotateX(20deg);
  }
  100% {
    opacity: 1;
    transform: perspective(400px) rotateX(0deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

