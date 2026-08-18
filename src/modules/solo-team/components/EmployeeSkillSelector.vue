<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="top-start"
    :width="280"
    :offset="4"
    trigger="click"
    popper-class="skill-selector-popper"
    @show="onPopoverShow"
    @hide="onPopoverHide"
  >
    <template #reference>
      <button class="skill-selector-btn" :class="{ active: popoverVisible }">
        <SvgIcon name="icon-Skill1" :size="16" color="#606572" />
      </button>
    </template>

    <div class="skill-selector-panel">
      <div class="skill-selector-panel__search">
        <el-input
          v-model="keyword"
          class="skill-selector-search-input"
          placeholder="搜索技能"
          size="small"
          clearable
        >
          <template #prefix>
            <SvgIcon name="icon-sousuo1" :size="16" color="#91949E" />
          </template>
        </el-input>
      </div>

      <div
        class="skill-selector-panel__list"
        ref="listRef"
        @scroll.passive="onListScroll"
      >
        <div v-if="loading" class="skill-selector-panel__status">加载中...</div>

        <div v-else-if="skills.length === 0" class="skill-selector-panel__status">
          <template v-if="keyword.trim()">未找到匹配的技能</template>
          <template v-else>暂无已安装技能</template>
        </div>

        <template v-else>
          <div
            v-for="skill in skills"
            :key="skill.slug || skill.id"
            class="skill-selector-panel__item"
            :class="{ 'is-disabled': skill.enabled === false }"
            @click="skill.enabled !== false && (skill.isInstalled !== false) && selectSkill(skill)"
          >
            <img :src="skillIconItem(skill)" class="skill-selector-panel__item-icon" alt="" />
            <span class="skill-selector-panel__item-name">{{ skill.displayName || skill.slug }}</span>
            <span v-if="skill.enabled === false" class="skill-selector-panel__item-tag">已禁用</span>
            <!-- 已安装显示绿色对勾 -->
            <span v-if="skill.isInstalled === true" class="skill-selector-panel__item-installed">
              <SvgIcon name="icon-chenggong" :size="16" color="#52C41A" />
            </span>
            <!-- 未安装显示安装按钮 -->
            <button
              v-if="skill.isInstalled === false"
              class="skill-selector-panel__item-download"
              :class="{ 'is-downloading': downloadingSkillIds.has(skill.slug || skill.id) }"
              :disabled="downloadingSkillIds.has(skill.slug || skill.id)"
              @click.stop="onInstall(skill)"
            >
              <img
                v-if="downloadingSkillIds.has(skill.slug || skill.id)"
                :src="downloadingIcon"
                class="skill-selector-panel__item-download-icon"
                alt="安装中"
              />
              <SvgIcon v-else name="icon-anzhuang" :size="16" color="#91949E" />
            </button>
          </div>
        </template>
      </div>

      <div v-if="showMarket" class="skill-selector-panel__footer" :class="{ 'is-scrolled': isListScrolled }">
        <button class="skill-selector-panel__market-btn" @click="openMarket">
          <img :src="skillMarketIcon" class="skill-selector-panel__market-icon" alt="" />
          <span>Skill 市场</span>
        </button>
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import skillIcon from '@/assets/chat/skillDefault.png'
import skillMarketIcon from '@/assets/chat/skillpath.svg'
import downloadingIcon from '@/assets/chat/downloading.png'
import { fetchEmployeeInstalledSkills, listEmployeeAgentsMy } from '../services/employeeInstalledSkillsApi'
import { fetchSkillMarketList, installSkillToAgent } from '@/modules/market/skill/skillMarketApi'

// 防抖函数
function debounce(fn, delay) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

const props = defineProps({
  scope: { type: String, default: 'global' },
  agentName: { type: String, default: '' },
  agentId: { type: [Number, String], default: null },
  showMarket: { type: Boolean, default: true },
})

const emit = defineEmits(['select'])

const router = useRouter()
const popoverVisible = ref(false)
const keyword = ref('')
const loading = ref(false)
const allSkills = ref([])
const agentInfo = ref(null)
const listRef = ref(null)
const isListScrolled = ref(false)
const downloadingSkillIds = ref(new Set())

// 按 agent_config.enabled_skills 过滤，与 PersonaManagePanel 逻辑一致；搜索时不过滤
const skills = computed(() => {
  if (keyword.value.trim()) return allSkills.value

  const agent = agentInfo.value
  if (!agent) return allSkills.value

  const enabledSkills = agent.agent_config?.enabled_skills
  if (enabledSkills === null || enabledSkills === undefined) return allSkills.value
  if (Array.isArray(enabledSkills)) {
    return allSkills.value.filter(s => enabledSkills.includes(s.slug))
  }
  return []
})

const skillIconItem = (item) => {
  // 兼容不同接口的图片字段：avatar（市场接口）或 image（已安装接口）
  return item?.avatar || item?.image || skillIcon
}

async function loadSkills() {
  // 未登录时跳过（避免登出时 selectedAgentId 重置触发 watch 调接口）
  try {
    const raw = localStorage.getItem('super-assistant-userInfo')
    if (!raw || !JSON.parse(raw)?.access_token) return
  } catch {
    return
  }
  loading.value = true
  try {
    const hasKeyword = keyword.value.trim()

    if (!hasKeyword) {
      // 搜索框为空时，使用当前接口查询已安装技能，并并行加载 agent 信息以做 enabled_skills 过滤
      const options = { scope: props.scope }
      if (props.agentName) options.agentName = props.agentName
      if (props.agentId !== null && props.agentId !== undefined && props.agentId !== '') {
        options.agentId = props.agentId
      }
      const [items, agents] = await Promise.all([
        fetchEmployeeInstalledSkills(options),
        props.agentId ? listEmployeeAgentsMy({ stateful: true, status: 'online' }) : Promise.resolve(null),
      ])
      // 已安装接口返回的技能默认标记为已安装
      allSkills.value = items.map(item => ({ ...item, isInstalled: true }))
      if (agents !== null) {
        let list = []
        if (Array.isArray(agents)) list = agents
        else if (Array.isArray(agents?.items)) list = agents.items
        else if (Array.isArray(agents?.agents)) list = agents.agents
        else if (Array.isArray(agents?.data)) list = agents.data
        else if (Array.isArray(agents?.data?.agents)) list = agents.data.agents
        agentInfo.value = list.find(a => String(a.id) === String(props.agentId)) ?? null
      } else {
        agentInfo.value = null
      }
    } else {
      // 搜索框不为空时，使用 search 字段调市场接口查询（搜索结果不受 enabled_skills 过滤）
      const agentId = props.agentId !== null && props.agentId !== undefined && props.agentId !== ''
        ? props.agentId
        : 'main'
      const params = {
        search: hasKeyword,
        agentId,
        includeInstallStatus: true,
      }
      const { results } = await fetchSkillMarketList(params)
      allSkills.value = results ?? []
    }
  } catch (e) {
    console.error('[DeerflowSkillSelector] 加载技能失败:', e)
    allSkills.value = []
    agentInfo.value = null
    ElMessage.error('加载技能失败')
  } finally {
    loading.value = false
  }
}

function onListScroll() {
  const el = listRef.value
  if (!el) return
  isListScrolled.value = el.scrollTop > 0
}

async function onPopoverShow() {
  keyword.value = ''
  await loadSkills()
}

function onPopoverHide() {
  isListScrolled.value = false
  keyword.value = ''
}

function selectSkill(skill) {
  emit('select', skill)
  popoverVisible.value = false
  keyword.value = ''
}

async function onInstall(skill) {
  const skillId = skill.slug || skill.id
  if (downloadingSkillIds.value.has(skillId)) return
  downloadingSkillIds.value = new Set(downloadingSkillIds.value).add(skillId)

  function cleanup() {
    const next = new Set(downloadingSkillIds.value)
    next.delete(skillId)
    downloadingSkillIds.value = next
    loadSkills()
  }

  try {
    const agentId = props.agentId !== null && props.agentId !== undefined && props.agentId !== ''
      ? props.agentId
      : 'main'
    await installSkillToAgent(skillId, agentId)
    ElMessage.success('安装成功')
    cleanup()
  } catch (e) {
    console.error('[DeerflowSkillSelector] 安装失败:', e)
    ElMessage.error(e?.message || '安装失败')
    cleanup()
  }
}

function openMarket() {
  popoverVisible.value = false
  router.push({ name: 'MarketSkill' })
}

// 防抖搜索
const debouncedSearch = debounce(() => {
  loadSkills()
}, 300)

// 监听搜索关键词变化
watch(keyword, () => {
  if (popoverVisible.value) {
    debouncedSearch()
  }
})

// 监听 agentId 变化（含初始值），自动加载技能列表
// 使用 immediate 确保挂载时也触发；agentId 由父组件异步提供时也能正确响应
watch(
  () => props.agentId,
  () => {
    loadSkills()
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.skill-selector-btn {
  width: 28px;
  height: 28px;
  background: #FFFFFF;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  box-sizing: border-box;
  border: 1px solid #E3E3E3;
  margin-left: 8px;
  transition: background 0.15s;

  &:hover,
  &.active {
    background: #F7F8FA;
  }
}

.skill-selector-panel {
  display: flex;
  flex-direction: column;
  max-height: 378px;

  &__search {
    padding: 8px 8px 4px;
    flex-shrink: 0;

    :deep(.skill-selector-search-input.el-input) {
      .el-input__wrapper {
        height: 32px;
        border-radius: 8px;
        background: #F7F8FA;
        box-sizing: border-box;
        border: 1px solid transparent;
        box-shadow: none;
      }

      .el-input__wrapper:hover {
        box-shadow: none;
      }

      .el-input__wrapper.is-focus {
        border-color: #FF8670;
        box-shadow: none;
      }

      .el-input__inner::placeholder {
        font-size: 14px;
      }
    }
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    min-height: 60px;
    max-height: 320px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: #DFE2EA;
      border-radius: 3px;
      border-right: 1px solid transparent;
      background-clip: padding-box;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #c4c8d4;
      background-clip: padding-box;
    }
  }

  &__status {
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
    padding: 24px 0;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 8px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.12s;
    margin: 0 4px;
    color: #1f2937;

    &:hover {
      border-radius: 8px;
      background: #F5F6F9;
    }

    &-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    &-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
    }

    &-tag {
      flex-shrink: 0;
      font-size: 11px;
      color: #9ca3af;
      padding: 2px 6px;
      border-radius: 4px;
      background: #f3f4f6;
    }

    &-installed {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &-download {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.12s;

      &:hover {
        background: #e5e7eb;
      }

      &.is-downloading {
        cursor: default;
        opacity: 0.7;

        .skill-selector-panel__item-download-icon {
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
        }
      }

      &.is-downloading:hover {
        background: none;
      }
    }
  }

  &__footer {
    background: #FFFFFF;
    padding: 6px 8px;
    flex-shrink: 0;
    position: relative;
    transition: box-shadow 0.2s ease;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 16px;
      right: 16px;
      height: 1px;
      background: #ECEEF3;
    }

    &.is-scrolled {
      box-shadow: 0px -4px 6px 0px rgba(47, 53, 71, 0.06);
    }
  }

  &__market-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border: none;
    background: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: #374151;
    transition: background 0.12s;

    &:hover {
      background: #f3f4f6;
    }
  }

  &__market-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
