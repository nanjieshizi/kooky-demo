<template>
  <section class="ma-page">
    <div class="ma-panel">
      <!-- 嵌入版（右上角抽屉）自带资源切换；页面版由左侧 nav 二级驱动 -->
      <div v-if="embedded" class="res-switch">
        <button class="res-seg" :class="{ active: resType === 'agent' }" @click="switchResType('agent')">数字人</button>
        <button class="res-seg" :class="{ active: resType === 'skill' }" @click="switchResType('skill')">Skill</button>
      </div>
      <!-- 数字人分支：本体 + 我的数字人 -->
      <template v-if="resType === 'agent'">
        <div class="sec-label">
          <span class="sec-bar"></span>我的分身
          <span class="sec-note">本体 · 唯一</span>
        </div>
        <div class="twin-card">
          <div class="twin-glow"></div>
          <div class="twin-ava">
            <img v-if="twin.avatar" :src="twin.avatar" alt="" />
            <span v-else>{{ (twin.name || '我').slice(0, 1) }}</span>
          </div>
          <div class="twin-info">
            <div class="twin-name">{{ twin.name }}<span class="twin-badge">本体 · 唯一</span></div>
            <div class="twin-desc">你的数字分身 —— 代表你本人，天生在岗、不可发布到市场。所有资产里最特殊的一个。</div>
          </div>
          <div class="twin-actions">
            <button class="act act-primary" @click="actChat(twin)">💬 对话</button>
            <button class="act act-ghost" @click="actEdit(twin)">⚙ 配置</button>
          </div>
        </div>

        <div class="sec-label sec-label-2">
          <span class="sec-bar"></span>我的数字人
          <span class="sec-note">员工与发布是两个独立状态，可交叉</span>
        </div>
      </template>
      <template v-else>
        <div class="sec-label">
          <span class="sec-bar"></span>我的 Skill
          <span class="sec-note">能力零件 · 可装配到数字人</span>
        </div>
      </template>

      <!-- 状态 tab + 新建入口 -->
      <div class="tab-row">
        <div class="seg-tabs">
          <template v-for="t in tabDefs" :key="t.key">
            <!-- 「我开发的」和「员工/发布」之间的竖线分隔:左源右去向 -->
            <span v-if="t.sep" class="seg-divider"></span>
            <div
              class="seg-tab"
              :class="[
                't-' + (t.key === 'pub' ? 'pub' : 'use'),
                { active: tab === t.key, 'seg-primary': t.primary },
              ]"
              @click="tab = t.key"
            >
              <span v-if="t.icon" class="st-ico">{{ t.icon }}</span>
              <span v-else class="st-dot"></span>{{ t.label }}<span class="st-count">{{ countFor(t.key) }}</span>
            </div>
          </template>
        </div>
        <div class="tab-row-right">
          <el-dropdown trigger="click" @command="onCreate">
            <button class="create-btn">＋ {{ createLabel }} ⌄</button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="o in createOptions" :key="o.cmd" :command="o.cmd">{{ o.label }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div class="tab-cap">{{ tabCap }}</div>

      <!-- 概览：跟着当前 tab 走；「我开发的」不需要统计横条 -->
      <div v-if="!(resType === 'agent' && tab === 'mine')" class="ov-bar">
        <template v-if="resType === 'agent' && tab === 'mine'">
          <div class="ov-stats">
            <div class="ov-stat"><b>{{ ov.mine.total }}</b><span>源文件</span></div>
            <div class="ov-stat"><b>{{ ov.mine.building }}</b><span>工厂在建</span></div>
            <div class="ov-stat"><b>{{ ov.mine.published }}</b><span>已发布</span></div>
            <div class="ov-stat"><b>{{ ov.mine.hired }}</b><span>已聘用</span></div>
          </div>
          <span class="ov-v2">工厂里持续迭代 · 任意版本可发布到市场 / 聘用为员工</span>
        </template>
        <template v-else-if="resType === 'agent' && tab === 'emp'">
          <div class="ov-stats">
            <div class="ov-stat"><b>{{ ov.emp.online }}</b><span>在岗</span></div>
            <div class="ov-stat"><b>{{ ov.emp.calls }}</b><span>本月调用</span></div>
            <div class="ov-stat"><b>{{ ov.emp.complete }}</b><span>完成率</span></div>
            <div class="ov-stat"><b>{{ ov.emp.fail }}</b><span>失败率</span></div>
            <div class="ov-stat"><b>{{ ov.emp.memory }}</b><span>记忆条数</span></div>
          </div>
          <span class="ov-v2">成功率 / 质量分 —— AI 评估接入后开放</span>
          <span v-if="ov.emp.upgradable" class="ov-alert plain">{{ ov.emp.upgradable }} 个有新版可升</span>
        </template>
        <template v-else-if="resType === 'agent'">
          <div class="ov-stats">
            <div class="ov-stat"><b>{{ ov.pub.listed }}</b><span>已上架</span></div>
            <div class="ov-stat"><b>{{ ov.pub.hired }}</b><span>累计被聘</span></div>
            <div class="ov-stat"><b>{{ ov.pub.calls }}</b><span>本月调用</span></div>
            <div class="ov-stat"><b>{{ ov.pub.revenue }}</b><span>折算收益</span></div>
          </div>
          <span class="ov-v2">跨用户口径 · 集团统一计费</span>
          <span v-if="ov.pub.reviewing" class="ov-alert" @click="pubFilter = 'online_review'">{{ ov.pub.reviewing }} 个审核中 →</span>
          <span v-if="ov.pub.rejected" class="ov-alert red" @click="pubFilter = 'rejected'">⚠️ {{ ov.pub.rejected }} 个已驳回 →</span>
        </template>
        <template v-else-if="tab === 'use'">
          <div class="ov-stats">
            <div class="ov-stat"><b>{{ ov.skill.total }}</b><span>拥有</span></div>
            <div class="ov-stat"><b>{{ ov.skill.assigned }}</b><span>装配次数</span></div>
            <div class="ov-stat"><b>{{ ov.skill.calls }}</b><span>本月调用</span></div>
            <div class="ov-stat"><b>{{ ov.skill.complete }}</b><span>完成率</span></div>
          </div>
          <span class="ov-v2">成功率 / 质量分 —— AI 评估接入后开放</span>
          <span v-if="ov.skill.upgradable" class="ov-alert plain">{{ ov.skill.upgradable }} 个有新版</span>
        </template>
        <template v-else>
          <div class="ov-stats">
            <div class="ov-stat"><b>{{ ov.skill.assigned }}</b><span>已发布调用</span></div>
          </div>
          <span class="ov-v2">Skill 发布概况 · 集团统一计费</span>
          <span v-if="ov.skill.rejected" class="ov-alert red" @click="pubFilter = 'rejected'">⚠️ {{ ov.skill.rejected }} 个已驳回 →</span>
        </template>
      </div>

      <!-- 发布 tab：真实 6 态筛选（复用生产 StatusFilter） -->
      <StatusFilter v-if="tab === 'pub'" v-model="pubFilter" class="pub-filter" />

      <!-- 网格 -->
      <div class="ma-scroll">
        <!-- 发布 tab：真实数据（vendor 生产 useAgentList/useSkillList + 真卡片） -->
        <template v-if="tab === 'pub'">
          <div v-if="pubLoading" class="ma-empty">加载中…</div>
          <div v-else-if="pubEmpty" class="ma-empty">该状态下没有发布记录</div>
          <div v-else class="card-grid">
            <template v-if="resType === 'agent'">
              <!-- 卡片本体点击仍进效能/用量详情；外挂一行「聘用 / 对话」按钮 -->
              <div v-for="it in pubAgentCards" :key="it.id" class="pub-wrap">
                <MarketAvatarCard
                  :avatar="it"
                  :status-tag="it.statusTag"
                  view-only-emit-open
                  @view-detail="openAgentDetail"
                />
                <div class="pub-acts" @click.stop>
                  <button class="act act-mini" @click="openCollabDigitalHumanChat(it)">对话</button>
                  <button class="act act-mini act-primary" @click="actHire(it)">聘用</button>
                </div>
              </div>
            </template>
            <SkillCard v-for="it in pubSkillCards" v-else :key="it.id" :item="it" view-mode="list" />
          </div>
        </template>

        <!-- 在用 tab：暂 mock（S2-2 接真员工/Skill 数据） -->
        <template v-else>
        <div v-if="!visibleList.length" class="ma-empty">{{ emptyText }}</div>
        <div v-else class="card-grid">
          <article v-for="a in visibleList" :key="a.id" class="avatar-card clickable" @click="openEmployeeDetail(a)">
            <div v-if="canUpgrade(a)" class="update-badge" @click.stop="openUpgrade(a)">↑ 有更新</div>
            <div class="avatar-card__top">
              <div class="avatar-card__media">
                <span v-if="a.kind === 'skill'" class="skill-icon">{{ a.icon }}</span>
                <img v-else-if="a.avatar" :src="a.avatar" class="avatar-card__cover" alt="" />
                <span v-else class="avatar-card__fallback">{{ (a.name || '?').slice(0, 1) }}</span>
              </div>
              <div class="avatar-card__meta">
                <div class="avatar-card__title-row">
                  <span class="avatar-card__title">{{ a.name }}</span>
                  <span class="avatar-card__version">{{ a.latestVersionLabel || 'v—' }}</span>
                  <span v-if="tab !== 'emp'" class="avatar-card__status" :class="statusChip(a).cls">{{ statusChip(a).text }}</span>
                </div>
                <div class="avatar-card__tag-row">
                  <span class="avatar-card__tag" :class="originClass(a)">{{ originLabel(a) }}</span>
                  <span class="avatar-card__org">{{ a.job_title || a.team_name || (a.kind === 'skill' ? '能力 Skill' : '私有数字人') }}</span>
                </div>
              </div>
            </div>

            <p class="avatar-card__desc">{{ a.description || '-' }}</p>

            <div v-if="a.kind === 'skill'" class="assign-line">🔗 已装配到 <b>{{ a.assignedCount }}</b> 个数字人</div>

            <div class="avatar-card__link">
              <span class="link-k">关联</span>
              <span class="link-v" :class="{ none: a.linkType === 'upload' }">{{ linkText(a) }}</span>
            </div>

            <!-- 已驳回：显示原因 -->
            <div v-if="a.marketStatus === 'rejected'" class="reject-line">驳回原因：{{ a.rejectReason || '内容需调整' }}</div>

            <div class="avatar-card__footer">
              <div class="avatar-card__stats">
                <span class="avatar-card__stat"><img class="stat-icon" :src="downloadIcon" alt="" />{{ a.statN || 0 }}</span>
                <span class="avatar-card__stat"><img class="stat-icon" :src="starIcon" alt="" />{{ a.starN || 0 }}</span>
              </div>
              <div class="avatar-card__actions" @click.stop>
                <!-- Skill · 我的 Skill：保持原样（编辑 / 发布 / 装配）-->
                <template v-if="a.kind === 'skill'">
                  <button class="act act-mini" @click="actEdit(a)">编辑</button>
                  <button class="act act-mini" :disabled="isPublished(a)" @click="actPublish(a)">
                    {{ isPublished(a) ? '已发布' : '发布' }}
                  </button>
                  <button class="act act-mini act-primary" @click="actAssign(a)">装配</button>
                </template>
                <!-- 数字人 · 我的员工：发布(常驻可点) + 对话(真跳一人团队单聊) -->
                <template v-else-if="tab === 'emp'">
                  <button class="act act-mini" @click="actPublish(a)">发布</button>
                  <button class="act act-mini act-primary" @click="openSoloTeamEmployeeChat(a)">对话</button>
                </template>
                <!-- 数字人 · 我开发的：单动作「去工厂」 -->
                <template v-else-if="tab === 'mine'">
                  <button class="act act-mini act-primary" @click="goFactory(a)">前往 Kode 编辑</button>
                </template>
              </div>
            </div>
          </article>
        </div>
        </template>
      </div>
    </div>

    <!-- 覆盖式更新确认 -->
    <div v-if="upgradeTarget" class="upd-overlay" @click.self="upgradeTarget = null">
      <div class="upd-modal">
        <div class="upd-ic">↑</div>
        <div class="upd-title">「{{ upgradeTarget.name }}」有新版本 {{ upgradeTarget.linkLatest }}</div>
        <div class="upd-src">来源：关联{{ upgradeTarget.linkType === 'market' ? '市场源' : '工厂蓝图' }}「{{ upgradeTarget.linkName }}」</div>
        <div class="upd-note">本次为<b>覆盖式更新</b>：</div>
        <div class="upd-row upd-keep"><span>✅ 保留</span>记忆 · 对话历史 · 工龄绩效</div>
        <div class="upd-row upd-over"><span>⚠️ 覆盖</span>版本 · 能力（Skill 装配）· 角色定义与提示词 · 性格风格</div>
        <div class="upd-actions">
          <button class="act act-mini" @click="upgradeTarget = null">暂不更新</button>
          <button class="act act-mini act-primary" @click="confirmUpgrade">确认更新</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/modules/auth/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import StatusFilter from './components/StatusFilter.vue'
import MarketAvatarCard from '@/modules/market/avatar/components/AvatarCard.vue'
import SkillCard from './components/SkillCard.vue'
import { getListCardStatusMeta } from './utils/listCardStatusMeta'
import { useAgentList } from './composables/useAgentList'
import { useSkillList } from './composables/useSkillList'
import defaultAvatarSrc from '@/assets/default-avatar.svg'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import downloadIcon from '@/modules/market/avatar/components/images/download.svg'
import starIcon from '@/modules/market/avatar/components/images/star.svg'
import av1 from '@/modules/market/avatar/components/images/m01@2x.png'
import av2 from '@/modules/market/avatar/components/images/w01@2x.png'
import av3 from '@/modules/market/avatar/components/images/m03@2x.png'
import av4 from '@/modules/market/avatar/components/images/m04@2x.png'
import av5 from '@/modules/market/avatar/components/images/m05@2x.png'
import av6 from '@/modules/market/avatar/components/images/w02@2x.png'
import av7 from '@/modules/market/avatar/components/images/m07@2x.png'
import av8 from '@/modules/market/avatar/components/images/w04@2x.png'

// embedded：右上角抽屉复用同一组件时置 true —— 顶部自带「数字人|Skill」切换、不依赖路由
const props = defineProps({
  embedded: { type: Boolean, default: false },
})

const route = useRoute()
const userStore = useUserStore()
const uiStore = useUIStore()
const soloTeamStore = useSoloTeamStore()
const digitalHumanStore = useDigitalHumanStore()
const collabEmpChatStore = useCollaborationEmployeeChatStore()

// 资源类型：页面版跟随路由 ?type；嵌入版默认数字人、由顶部切换驱动
const resType = ref(!props.embedded && route.query.type === 'skill' ? 'skill' : 'agent')
// 数字人默认进「我的员工」(在岗/最高频);Skill 没有工厂概念,默认「我的 Skill」
const tab = ref(resType.value === 'skill' ? 'use' : 'emp')
const pubFilter = ref('all')
const tabDefs = computed(() =>
  resType.value === 'agent'
    // 按使用价值降序:员工(在岗,默认) → 发布(去向) → 我开发的(源/半成品,排最后,sep 分隔)
    ? [
        { key: 'emp', label: '我的员工' },
        { key: 'pub', label: '我的发布' },
        { key: 'mine', label: '我开发的', icon: '🏭', sep: true },
      ]
    : [{ key: 'use', label: '我的 Skill' }, { key: 'pub', label: '我的发布' }],
)
watch(
  () => route.query.type,
  (t) => {
    if (props.embedded) return // 嵌入版不吃路由，由顶部切换驱动
    resType.value = t === 'skill' ? 'skill' : 'agent'
    tab.value = tabDefs.value[0].key
    pubFilter.value = 'all'
  },
)
// 嵌入版顶部「数字人|Skill」切换
function switchResType(t) {
  if (resType.value === t) return
  resType.value = t
  tab.value = tabDefs.value[0].key
  pubFilter.value = 'all'
}

const twin = computed(() => ({
  id: '__twin__',
  name: (userStore.userName || '我') + ' 的分身',
  avatar: userStore.avatar || '',
}))

// ─── Mock。marketStatus: active/online_review/draft/rejected/offline/null ──
const MOCK_AGENT = [
  { id: 'm1', kind: 'agent', name: '小销 · 销售助理', description: '外呼话术 + 异议处理 + CRM 自动写回，跟进不掉链子。', job_title: '销售域', avatar: av1,
    onlineVersionId: 'v3', latestVersionLabel: 'v3', origin: 'self', marketStatus: 'active', linkType: 'factory', linkName: '小销·工厂蓝图', linkLatest: 'v5', statN: 128, starN: 42 },
  { id: 'm2', kind: 'agent', name: '数据分析师 D', description: '多源数据整合、SQL 查询与可视化看板，业务洞察一把抓。', job_title: '来自市场', avatar: av2,
    onlineVersionId: 'v1', latestVersionLabel: 'v1', origin: 'hire', marketStatus: null, linkType: 'market', linkName: '数据分析大师 Pro', linkLatest: 'v2', statN: 64, starN: 18 },
  { id: 'm3', kind: 'agent', name: '周报小助手', description: '自动汇总本周进展、生成结构化周报，周五不用熬夜。', job_title: '效率域', avatar: av3,
    onlineVersionId: 'v2', latestVersionLabel: 'v2', origin: 'self', marketStatus: null, linkType: 'upload', linkName: '-', linkLatest: null, statN: 30, starN: 6 },
  { id: 'm4', kind: 'agent', name: '合同审查官', description: '劳动法 / 知识产权 / 数据合规三件套，逐条挑风险。', job_title: '法务域', avatar: av4,
    onlineVersionId: null, latestVersionLabel: 'v5', origin: 'self', marketStatus: 'active', linkType: 'factory', linkName: '合同审查官·工厂蓝图', linkLatest: 'v5', statN: 210, starN: 88 },
  { id: 'm5', kind: 'agent', name: '面试官 Max', description: '结构化追问 + 能力评分，初筛效率拉满。', job_title: '人力域', avatar: av5,
    onlineVersionId: null, latestVersionLabel: 'v4', origin: 'self', marketStatus: 'online_review', linkType: 'factory', linkName: '面试官·工厂蓝图', linkLatest: 'v4', statN: 0, starN: 3 },
  { id: 'm6', kind: 'agent', name: '招聘文案官', description: '一句话生成 JD 与吸引力文案，还在打磨中。', job_title: '人力域', avatar: av6,
    onlineVersionId: null, latestVersionLabel: 'v1·dev', origin: 'self', marketStatus: null, linkType: 'upload', linkName: '-', linkLatest: null, statN: 0, starN: 0 },
  { id: 'm7', kind: 'agent', name: '招商顾问', description: '招商话术与政策匹配，含敏感表述需调整。', job_title: '商务域', avatar: av7,
    onlineVersionId: null, latestVersionLabel: 'v2', origin: 'self', marketStatus: 'rejected', rejectReason: '含未核实的政策承诺，请修改后重新提交', linkType: 'upload', linkName: '-', linkLatest: null, statN: 0, starN: 1 },
  { id: 'm8', kind: 'agent', name: '旧版客服', description: '上一代客服话术，已被新版替代。', job_title: '客服域', avatar: av8,
    onlineVersionId: null, latestVersionLabel: 'v6', origin: 'self', marketStatus: 'offline', linkType: 'upload', linkName: '-', linkLatest: null, statN: 540, starN: 120 },
]

const MOCK_SKILL = [
  { id: 's1', kind: 'skill', icon: '🔍', name: '网页搜索', description: '实时检索互联网，给数字人补充最新信息。', latestVersionLabel: 'v4',
    assignedCount: 5, origin: 'self', marketStatus: 'active', linkType: 'upload', linkName: '-', linkLatest: null, statN: 320, starN: 120 },
  { id: 's2', kind: 'skill', icon: '📊', name: '数据可视化', description: '一键把结果生成图表与看板。', latestVersionLabel: 'v2',
    assignedCount: 3, origin: 'hire', marketStatus: null, linkType: 'market', linkName: '图表大师 Skill', linkLatest: 'v3', statN: 88, starN: 30 },
  { id: 's3', kind: 'skill', icon: '🗄️', name: '数据库查询', description: '安全连接并查询业务库，支持只读。', latestVersionLabel: 'v1',
    assignedCount: 0, origin: 'self', marketStatus: 'online_review', linkType: 'upload', linkName: '-', linkLatest: null, statN: 210, starN: 64 },
  { id: 's4', kind: 'skill', icon: '⚙️', name: '代码执行', description: '沙箱里跑 Python / JS，验证逻辑与产出。', latestVersionLabel: 'v3',
    assignedCount: 2, origin: 'self', marketStatus: null, linkType: 'upload', linkName: '-', linkLatest: null, statN: 0, starN: 9 },
]

// 发布 tab 兜底 mock（真实环境暂无发布数据时用，喂给真 AvatarCard / SkillCard）
const MOCK_PUB_AGENTS = [
  { id: 'pa1', name: '小销 · 销售助理', version: 'v3', qualityLevel: '销售', author: '我', description: '外呼话术 + 异议处理 + CRM 自动写回。', avatar: av1, stats_hires: 128, stats_stars: 42, favorited: false, is_installed: false, marketStatus: 'active', statusTag: { text: '已发布', mod: 'published' } },
  { id: 'pa2', name: '合同审查官', version: 'v5', qualityLevel: '法务', author: '我', description: '劳动法 / 知识产权 / 数据合规三件套，逐条挑风险。', avatar: av4, stats_hires: 210, stats_stars: 88, favorited: true, is_installed: false, marketStatus: 'active', statusTag: { text: '已发布', mod: 'published' } },
  { id: 'pa3', name: '面试官 Max', version: 'v4', qualityLevel: '人力', author: '我', description: '结构化追问 + 能力评分，初筛效率拉满。', avatar: av5, stats_hires: 0, stats_stars: 3, favorited: false, is_installed: false, marketStatus: 'online_review', statusTag: { text: '审核中', mod: 'reviewing' } },
  { id: 'pa4', name: '招商顾问', version: 'v2', qualityLevel: '商务', author: '我', description: '招商话术与政策匹配，含敏感表述需调整。', avatar: av7, stats_hires: 0, stats_stars: 1, favorited: false, is_installed: false, marketStatus: 'rejected', statusTag: { text: '已驳回', mod: 'rejected', rejection: '含未核实的政策承诺，请修改后重新提交' } },
  { id: 'pa5', name: '旧版客服', version: 'v6', qualityLevel: '客服', author: '我', description: '上一代客服话术，已被新版替代。', avatar: av8, stats_hires: 540, stats_stars: 120, favorited: false, is_installed: false, marketStatus: 'offline', statusTag: { text: '已下架', mod: 'offline' } },
]
const MOCK_PUB_SKILLS = [
  { id: 'ps1', slug: 'ps1', displayName: '网页搜索', version: '4', status: 'active', tags: ['工具', '检索'], author: { displayName: '我' }, summary: '实时检索互联网，给数字人补充最新信息。', downloads: 320, stars: 120, isStarred: false, marketStatus: 'active' },
  { id: 'ps2', slug: 'ps2', displayName: '数据库查询', version: '1', status: 'online_review', tags: ['数据', '只读'], author: { displayName: '我' }, summary: '安全连接并查询业务库，支持只读。', downloads: 210, stars: 64, isStarred: false, marketStatus: 'online_review' },
  { id: 'ps3', slug: 'ps3', displayName: '代码执行', version: '3', status: 'rejected', reviewStatus: 'rejected', reviewComment: '沙箱权限需收敛后重新提交', tags: ['执行'], author: { displayName: '我' }, summary: '沙箱里跑 Python / JS，验证逻辑与产出。', downloads: 0, stars: 9, isStarred: false, marketStatus: 'rejected' },
]

const agentList = computed(() => MOCK_AGENT)
const items = computed(() => (resType.value === 'skill' ? MOCK_SKILL : agentList.value))

// ─── S2-1：发布 tab 接真实数据（vendor 生产 composable + 真卡片）──
const router = useRouter()
const searchKeyword = ref('')
const agentPub = useAgentList(searchKeyword, pubFilter)
const skillPub = useSkillList(searchKeyword, pubFilter)
watch(pubFilter, () => {
  if (resType.value === 'agent') agentPub.loadList()
  else skillPub.loadList()
})
function resolveAgentAvatarUrl(rawAvatar) {
  const raw = String(rawAvatar ?? '').trim()
  if (!raw) return ''
  if (/^data:/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (/default-avatar\.png/i.test(raw)) return defaultAvatarSrc
  const base = getOneBaseUrl().replace(/\/$/, '')
  if (!base) return raw
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}
const pubAgentCards = computed(() => {
  const real = (agentPub.list.value || []).map((item) => {
    const tags = Array.isArray(item.tags) ? item.tags : []
    const verRaw = String(item.latestVersion?.version ?? item.version ?? '').trim()
    const version = verRaw ? (verRaw.startsWith('v') ? verRaw : `v${verRaw}`) : ''
    return {
      id: String(item.id ?? ''),
      name: String(item.displayName ?? ''),
      version,
      qualityLevel: String(tags[0] ?? '').trim(),
      author: String(item.author?.displayName ?? ''),
      description: String(item.summary ?? ''),
      avatar: resolveAgentAvatarUrl(String(item.avatar ?? item.author?.avatar ?? '').trim()),
      stats_hires: Number(item.installCount ?? item.statsDownloads ?? 0),
      stats_stars: Number(item.statsStars ?? 0),
      favorited: Boolean(item.isFollowed),
      is_installed: Boolean(item.isInstalled),
      statusTag: getListCardStatusMeta(item),
      slug: item.slug,
      raw: item,
    }
  })
  if (real.length) return real
  return MOCK_PUB_AGENTS.filter((a) => pubFilter.value === 'all' || a.marketStatus === pubFilter.value)
})
const pubSkillCards = computed(() => {
  const real = skillPub.list.value || []
  if (real.length) return real
  return MOCK_PUB_SKILLS.filter((s) => pubFilter.value === 'all' || s.marketStatus === pubFilter.value)
})
const pubLoading = computed(() => false) // mock 兜底即时，无加载态
const pubEmpty = computed(() => (resType.value === 'agent' ? pubAgentCards.value.length === 0 : pubSkillCards.value.length === 0))

function openAgentDetail(id) {
  if (!id) return
  // 真跳详情：效能/用量在 AvatarDetailView 里是 mock，照常渲染；详情 tab 走真接口（mock id 可能为空）
  const row = (agentPub.list.value || []).find((it) => String(it.id) === String(id))
  const routeId = row ? String(row.slug ?? row.id ?? '').trim() : String(id)
  router.push({ name: 'MyAvatarDetail', params: { id: routeId }, query: { from: 'my-uploads' } })
}

// ─── 状态判定 ──────────────────────────────────────────────
function isDeployed(a) {
  return !!a.onlineVersionId
}
function isInUse(a) {
  return a.kind === 'skill' ? a.assignedCount > 0 : isDeployed(a)
}
function isPublished(a) {
  return !!a.marketStatus // 进入过发布流程（6 态里非空）
}
function isDraft(a) {
  return !isInUse(a) && !isPublished(a)
}

function inTab(a, t) {
  // 我开发的 = 工厂源文件(蓝图),不管下游是否已发布/已聘用,都收在这
  if (t === 'mine') return a.linkType === 'factory'
  if (t === 'emp') return isDeployed(a)
  if (t === 'use') return true
  if (t === 'pub') return isPublished(a)
  return false
}
function countFor(t) {
  if (t === 'pub') return resType.value === 'agent' ? pubAgentCards.value.length : pubSkillCards.value.length
  return items.value.filter((a) => inTab(a, t)).length
}
const visibleList = computed(() => {
  let list = items.value.filter((a) => inTab(a, tab.value))
  if (tab.value === 'pub' && pubFilter.value !== 'all') {
    list = list.filter((a) => a.marketStatus === pubFilter.value)
  }
  return list
})
const draftCount = computed(() => agentList.value.filter(isDraft).length)

// 团队概览（V1 客观口径；告警从 mock 真算，统计串先 mock）
const ov = computed(() => {
  const empUpgradable = MOCK_AGENT.filter((a) => isDeployed(a) && a.linkType !== 'upload' && a.linkLatest && a.linkLatest !== a.latestVersionLabel).length
  const skillUpgradable = MOCK_SKILL.filter((s) => s.linkType === 'market' && s.linkLatest && s.linkLatest !== s.latestVersionLabel).length
  const factory = MOCK_AGENT.filter((a) => a.linkType === 'factory')
  return {
    mine: {
      total: factory.length,
      building: factory.filter(isDraft).length,
      published: factory.filter(isPublished).length,
      hired: factory.filter(isDeployed).length,
    },
    emp: { online: MOCK_AGENT.filter(isDeployed).length, calls: '1.2k', complete: '89%', fail: '4%', memory: '716', upgradable: empUpgradable },
    pub: {
      listed: MOCK_PUB_AGENTS.filter((a) => a.marketStatus === 'active').length,
      hired: '86', calls: '4.3k', revenue: '¥296',
      reviewing: MOCK_PUB_AGENTS.filter((a) => a.marketStatus === 'online_review').length,
      rejected: MOCK_PUB_AGENTS.filter((a) => a.marketStatus === 'rejected').length,
    },
    skill: {
      total: MOCK_SKILL.length,
      assigned: MOCK_SKILL.reduce((s, x) => s + x.assignedCount, 0),
      calls: '1.7k', complete: '97%', upgradable: skillUpgradable,
      rejected: MOCK_PUB_SKILLS.filter((s) => s.marketStatus === 'rejected').length,
    },
  }
})

// ─── 来源 ──────────────────────────────────────────────────
function originKey(a) {
  if (a.origin === 'hire') return 'hire'
  if (isDraft(a)) return 'draft'
  return 'self'
}
function originLabel(a) {
  const hireWord = a.kind === 'skill' ? '市场订阅' : '市场聘用'
  return { self: '自建', hire: hireWord, draft: '工厂在建' }[originKey(a)] || '自建'
}
function originClass(a) {
  return 'tag-' + originKey(a)
}

// ─── 状态 chip ─────────────────────────────────────────────
const PUB_META = {
  active: { cls: 'st-live', text: '已发布' },
  online_review: { cls: 'st-review', text: '审核中' },
  draft: { cls: 'st-draft', text: '未发布' },
  rejected: { cls: 'st-reject', text: '已驳回' },
  offline: { cls: 'st-offline', text: '已下架' },
}
function statusChip(a) {
  if (tab.value === 'emp' || tab.value === 'use') {
    if (a.kind === 'skill') return { cls: 'st-on', text: '已装配 ' + a.assignedCount }
    return { cls: 'st-on', text: '在岗 ' + (a.onlineVersionId || '') }
  }
  return PUB_META[a.marketStatus] || { cls: 'st-draft', text: '未发布' }
}

// ─── 关联 & 升级 ───────────────────────────────────────────
function linkText(a) {
  if (a.linkType === 'market') return '🛒 ' + a.linkName
  if (a.linkType === 'factory') return '🏭 ' + a.linkName
  return '—'
}
function canUpgrade(a) {
  const inUseTab = tab.value === 'emp' || tab.value === 'use'
  return inUseTab && a.linkType && a.linkType !== 'upload' && a.linkLatest && a.linkLatest !== a.latestVersionLabel
}

// ─── 聘用：只对真·已上架 ────────────────────────────────────
function canHire(a) {
  return a.marketStatus === 'active' && !isDeployed(a)
}
function hireLabel(a) {
  if (isDeployed(a)) return '已在员工'
  if (a.marketStatus !== 'active') return '未上架·不可聘'
  return '聘用'
}

const tabCap = computed(() => {
  if (resType.value === 'skill') {
    return tab.value === 'use' ? '装配在你数字人上的 Skill · 有新版会提示升级' : '发布到市场的 Skill（6 态）'
  }
  return tab.value === 'emp' ? '在一人团队里上岗干活的数字员工 · 有新版会提示升级' : '发布到市场的数字人（6 态）· 仅已上架可被聘用'
})
const emptyText = computed(() => {
  if (resType.value === 'skill') return tab.value === 'use' ? '还没有 Skill' : '该状态下没有发布记录'
  return tab.value === 'emp' ? '还没有上岗的数字员工' : '该状态下没有发布记录'
})

// ─── 新建入口（动词跟着 tab）────────────────────────────────
const createLabel = computed(() => {
  if (tab.value === 'pub') return '发布'
  return resType.value === 'agent' ? '创建员工' : '添加 Skill'
})
const createOptions = computed(() => {
  if (tab.value === 'pub') {
    return [
      { cmd: 'pick-publish', label: '📤 从我的库选一个发布' },
      { cmd: 'upload-publish', label: '⬆ 上传并发布' },
    ]
  }
  if (resType.value === 'agent') {
    return [
      { cmd: 'deploy', label: '🏭 从工厂上岗' },
      { cmd: 'hire', label: '🛒 从市场聘用' },
      { cmd: 'upload-deploy', label: '⬆ 上传并上岗' },
    ]
  }
  return [
    { cmd: 'new-skill', label: '✏️ 新建 Skill' },
    { cmd: 'upload-skill', label: '⬆ 上传导入' },
    { cmd: 'subscribe', label: '🛒 从市场订阅' },
  ]
})
function onCreate(cmd) {
  const map = {
    deploy: '从工厂挑一个上岗为员工',
    hire: '前往市场聘用',
    'upload-deploy': '上传数字人并直接上岗',
    'pick-publish': '从我的库选一个发布到市场',
    'upload-publish': '上传并发布到市场',
    'new-skill': '新建 / 编写 Skill',
    'upload-skill': '上传 Skill 导入到我的库',
    subscribe: '前往市场订阅 Skill',
  }
  ElMessage.info(map[cmd] || '新建')
}

// ─── 动作 ──────────────────────────────────────────────────
function actChat(a) {
  ElMessage.info(`打开「${a.name}」会话`)
}
function actEdit(a) {
  ElMessage.info(`编辑「${a.name}」`)
}
// 去 Kode 创建一个 Agent 开发任务来迭代此数字人（切到 Kode → 弹新建任务弹窗，预选关联数字人）
function actIterateInKode(a) {
  uiStore.openClaudeCode?.()
  setTimeout(() => {
    window.__kookyMock?.openKodeNewTaskWithPrefill?.({
      taskType: 'Agent开发',
      mode: 'kode',
      agentId: a.id,
      agentName: a.name,
      preferredWsId: 'pf',
      prefilledDesc: `迭代「${a.name}」：\n（在工厂里对该数字人做一次改动，写清目标 / 验收标准）`,
      sourceMeta: `来自「我的资产 · 数字人」· ${a.name}`,
    })
  }, 250)
}
function actAssign(a) {
  ElMessage.info(`把「${a.name}」装配到数字人`)
}
function actPublish(a) {
  if (isPublished(a)) return
  ElMessage.success(`「${a.name}」已提交发布到市场 · 进入审核`)
}
function actHire(a) {
  ElMessage.success(`聘用「${a.name}」进我的员工（从已发布版本拷一份）`)
}
// 我开发的 / 工厂在建 → 真跳工厂（Kode 产研工作台）
function goFactory() {
  uiStore.openClaudeCode?.()
}

// 我的员工·对话 → 真跳「一人团队」单聊（落到首位真实员工，demo 数据不一致无妨）
async function openSoloTeamEmployeeChat() {
  try {
    await soloTeamStore.loadEmployeeItems().catch(() => {})
    const emp = soloTeamStore.employeeChatEmployees?.[0]
    const empId = emp?.id ?? 1001
    if (!soloTeamStore.getEmployeeThreads(empId)?.length) {
      await soloTeamStore.fetchEmployeeThreads(empId)
    }
    const first = soloTeamStore.getEmployeeThreads(empId)?.[0]
    const threadId = first?.id ?? (await soloTeamStore.createEmployeeThread(empId))?.id
    if (!threadId) { ElMessage.warning('暂无可用员工会话'); return }
    await soloTeamStore.selectEmployeeThread(empId, threadId)
    uiStore.setActiveNavigation('solo-team', `employee:${empId}:${threadId}`)
    uiStore.expandSidebar?.()
  } catch (e) {
    console.error('[MyAssets] 打开一人团队员工单聊失败', e)
  }
}

// 我的发布·对话 → 真跳「协作」企业数字人单聊（固定落产品数字人 1001）
async function openCollabDigitalHumanChat(a) {
  const agentId = 1001
  try {
    await digitalHumanStore.openAgent(agentId, '新对话')
    const payload = digitalHumanStore.currentThreadPayload
    if (!payload?.id) { ElMessage.warning('会话创建失败'); return }
    digitalHumanStore.upsertAgentInList?.({
      agent_id: agentId,
      agent_name: a?.name || '企业数字人',
      agent_display_name: a?.name || '企业数字人',
      agent_avatar_url: a?.avatar || '',
    })
    await collabEmpChatStore.applyCollaborationDigitalHumanSession(
      agentId, payload, digitalHumanStore.currentAgent || null,
    )
    uiStore.setActiveNavigation('collaboration', `digital-human-${agentId}`)
    uiStore.expandSidebar?.()
  } catch (e) {
    console.error('[MyAssets] 打开协作企业数字人单聊失败', e)
  }
}
// 在用 tab 卡片 → 员工详情（详情 + 工作表现）
function openEmployeeDetail(a) {
  router.push({ name: 'MyEmployeeDetail', params: { id: a.id } })
}

// ─── 覆盖式更新 ────────────────────────────────────────────
const upgradeTarget = ref(null)
function openUpgrade(a) {
  upgradeTarget.value = a
}
function confirmUpgrade() {
  const a = upgradeTarget.value
  if (a) ElMessage.success(`「${a.name}」已更新到 ${a.linkLatest} —— 记忆保留，其余覆盖`)
  upgradeTarget.value = null
}
</script>

<style scoped>
.ma-page {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f9fafa 0%, #ffffff 25%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ma-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* 嵌入版顶部资源切换（数字人|Skill）*/
.res-switch {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  margin-bottom: 16px;
  background: #f2f3f5;
  border-radius: 10px;
  align-self: flex-start;
}
.res-seg {
  height: 30px;
  padding: 0 20px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: #8a8f99;
  cursor: pointer;
  transition: all 0.15s;
}
.res-seg.active {
  background: #fff;
  color: #2f3547;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.sec-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #2f3547;
  margin-bottom: 12px;
}
.sec-label-2 {
  margin-top: 22px;
}
.sec-bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, #436ff6, #7b61ff);
}
.sec-note {
  font-size: 11px;
  font-weight: 500;
  color: #a8b0c0;
}
.tab-row-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.factory-link {
  font-size: 12px;
  font-weight: 600;
  color: #d4843c;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.factory-link:hover {
  background: #ffefd0;
}

/* 概览横条（跟着当前 tab） */
.ov-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding: 12px 16px;
  background: #fafbfc;
  border: 1px solid #eceef3;
  border-radius: 12px;
}
.ov-alert.plain {
  color: #436ff6;
  background: #eef3ff;
  border-color: #c7d6ff;
  cursor: default;
}

/* 团队概览 */
.ov-grid {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.ov-card {
  flex: 1;
  min-width: 340px;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 14px;
  padding: 14px 16px;
}
.ov-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
  color: #2f3547;
  margin-bottom: 14px;
}
.ov-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.ov-dot.on {
  background: #52c41a;
}
.ov-dot.pub {
  background: #9b6bff;
}
.ov-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
.ov-stat {
  display: flex;
  flex-direction: column;
}
.ov-stat b {
  font-size: 19px;
  font-weight: 700;
  color: #2f3547;
  font-variant-numeric: tabular-nums;
}
.ov-stat span {
  font-size: 11px;
  color: #91949e;
  margin-top: 2px;
}
.ov-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 13px;
  padding-top: 11px;
  border-top: 1px dashed #f0f1f4;
  flex-wrap: wrap;
}
.ov-v2 {
  flex: 1;
  min-width: 180px;
  font-size: 11px;
  color: #c0c4cc;
}
.ov-alert {
  font-size: 12px;
  font-weight: 600;
  color: #d46b08;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 8px;
  padding: 3px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.ov-alert.red {
  color: #e54545;
  background: #fef0f0;
  border-color: #ffc9c9;
}
.ov-alert:hover {
  filter: brightness(0.97);
}

.tab-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 1px solid #eceef3;
}
.create-btn {
  height: 30px;
  padding: 0 14px;
  margin-bottom: 6px;
  border: none;
  border-radius: 6px;
  background: #171b26;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.create-btn:hover {
  background: #2e323c;
}
.seg-tabs {
  display: flex;
  gap: 22px;
}
.seg-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  font-size: 14px;
  font-weight: 600;
  color: #8a8f99;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.15s;
}
.seg-tab:hover {
  color: #606572;
}
.seg-tab .st-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c9cdd4;
}
.seg-tab.t-use.active {
  color: #3a9e0a;
  border-bottom-color: #52c41a;
}
.seg-tab.t-use.active .st-dot {
  background: #52c41a;
}
.seg-tab.t-pub.active {
  color: #7b41e0;
  border-bottom-color: #9b6bff;
}
.seg-tab.t-pub.active .st-dot {
  background: #9b6bff;
}
.seg-tab .st-count {
  font-size: 12px;
  font-weight: 700;
  color: #bcc0c9;
}
.seg-tab.active .st-count {
  color: inherit;
}

/* 「我开发的」主 tab：工厂橙强调,盖过 t-use 的绿色 */
.seg-tab.seg-primary .st-ico {
  font-size: 14px;
}
.seg-tab.seg-primary.active {
  color: #f0792e;
  border-bottom-color: #FF9566;
}
.seg-tab.seg-primary.t-use.active {
  color: #f0792e;
  border-bottom-color: #FF9566;
}

/* 「我开发的」与「员工/发布」之间的竖线分隔:左源右去向 */
.seg-divider {
  width: 1px;
  height: 16px;
  background: #e3e6eb;
  align-self: center;
  margin: 0 4px;
}
.tab-cap {
  font-size: 11px;
  color: #a8b0c0;
  margin: 10px 0 0;
}
.pub-filter {
  margin-top: 12px;
}

/* 发布卡外挂动作行（卡片本体点击进详情，按钮走聘用/对话）*/
.pub-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pub-acts {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 4px;
}

.ma-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.ma-empty {
  text-align: center;
  color: #c0c4cc;
  padding: 40px 0;
  font-size: 13px;
}

/* 我的分身 hero */
.twin-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px 22px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #1a1f3a 0%, #2d3561 52%, #1e3a5f 100%);
  box-shadow: 0 6px 22px rgba(67, 111, 246, 0.22);
}
.twin-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 82% 50%, rgba(123, 97, 255, 0.32) 0%, transparent 60%),
    radial-gradient(ellipse at 18% 90%, rgba(67, 111, 246, 0.22) 0%, transparent 55%);
  pointer-events: none;
}
.twin-ava {
  position: relative;
  z-index: 1;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ffd27a, #ff9f43);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 25px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  overflow: hidden;
}
.twin-ava img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.twin-info {
  flex: 1;
  z-index: 1;
  min-width: 0;
}
.twin-name {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 9px;
}
.twin-badge {
  font-size: 10px;
  font-weight: 600;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.18);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  padding: 2px 8px;
}
.twin-desc {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 5px;
  line-height: 1.5;
}
.twin-actions {
  display: flex;
  gap: 9px;
  z-index: 1;
  flex-shrink: 0;
}
.twin-actions .act-primary {
  background: linear-gradient(135deg, #436ff6, #5b7fff);
  color: #fff;
  border: none;
}
.twin-actions .act-ghost {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.22);
}
.twin-actions .act {
  height: 32px;
  padding: 0 16px;
}

/* 卡片：对齐市场 AvatarCard */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(296px, 1fr));
  row-gap: 32px;
  column-gap: 16px;
  padding-top: 22px;
}
.avatar-card {
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #eceef3;
  transition: all 0.15s;
}
.avatar-card.clickable {
  cursor: pointer;
}
.avatar-card:hover {
  border: 1px solid transparent;
  background: linear-gradient(#fff, #fff) padding-box,
    linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
}
.avatar-card:hover .avatar-card__actions {
  opacity: 1;
  pointer-events: auto;
}
.update-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 3;
  font-size: 11px;
  font-weight: 600;
  color: #d46b08;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 10px;
  padding: 2px 9px;
  cursor: pointer;
}
.update-badge:hover {
  background: #ffe7ba;
}
.avatar-card__top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.avatar-card__media {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  margin: -32px 0 0;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-card__fallback {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: linear-gradient(135deg, #eef3ff, #f3f0ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 600;
  color: #436ff6;
}
.skill-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, #fff4e0, #ffe3c2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
}
.avatar-card__meta {
  min-width: 0;
  flex: 1;
}
.avatar-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-bottom: 4px;
}
.avatar-card__title {
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: #2f3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
.avatar-card__version {
  font-size: 12px;
  color: #91949e;
  flex-shrink: 0;
}
.avatar-card__status {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
}
.avatar-card__status.st-on { color: #3a9e0a; background: #f0fde4; }
.avatar-card__status.st-live { color: #7b41e0; background: #f3f0ff; }
.avatar-card__status.st-review { color: #d46b08; background: #fff7e6; }
.avatar-card__status.st-draft { color: #8a8f99; background: #f2f3f5; }
.avatar-card__status.st-reject { color: #e54545; background: #fef0f0; }
.avatar-card__status.st-offline { color: #8a8f99; background: #eceef3; }
.avatar-card__tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.avatar-card__tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #606572;
  background: #eceef3;
  white-space: nowrap;
}
.avatar-card__tag.tag-self { color: #436ff6; background: #eef3ff; }
.avatar-card__tag.tag-hire { color: #3a9e0a; background: #f0fff4; }
.avatar-card__tag.tag-draft { color: #d46b08; background: #fff7e6; }
.avatar-card__org {
  min-width: 0;
  font-size: 12px;
  color: #91949e;
}
.avatar-card__desc {
  flex: 1;
  margin: 8px 0;
  font-size: 13px;
  line-height: 21px;
  text-align: justify;
  color: #91949e;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: 42px;
}
.assign-line {
  font-size: 12px;
  color: #4e5969;
  margin: 0 0 6px;
}
.assign-line b {
  color: #436ff6;
}
.reject-line {
  font-size: 11.5px;
  color: #e54545;
  background: #fef0f0;
  border-radius: 6px;
  padding: 4px 8px;
  margin: 0 0 8px;
}
.avatar-card__link {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0 8px;
  font-size: 12px;
}
.avatar-card__link .link-k { color: #a8b0c0; }
.avatar-card__link .link-v {
  color: #4e5969;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.avatar-card__link .link-v.none { color: #c0c4cc; }
.avatar-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 28px;
  margin-top: auto;
}
.avatar-card__stats {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #606572;
}
.avatar-card__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.stat-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}
.avatar-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.act {
  border-radius: 6px;
  border: 1px solid #e2e6ee;
  background: #fff;
  font-size: 13px;
  font-weight: 500;
  color: #2f3547;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.act-mini {
  height: 28px;
  padding: 0 14px;
}
.act:hover {
  background: #f5f6f9;
}
.act:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.act:disabled:hover {
  background: #fff;
}
.act-primary {
  background: #171b26;
  border-color: transparent;
  color: #fff;
}
.act-primary:hover {
  background: #2e323c;
  color: #fff;
}
.act-primary:disabled {
  background: #c8ccd4;
}

/* 覆盖式更新弹窗 */
.upd-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(15, 20, 35, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}
.upd-modal {
  width: 440px;
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22);
}
.upd-ic {
  width: 46px;
  height: 46px;
  margin: 0 auto 12px;
  border-radius: 12px;
  background: #fff7e6;
  color: #d46b08;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upd-title {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: #2f3547;
}
.upd-src {
  text-align: center;
  font-size: 12px;
  color: #91949e;
  margin-top: 6px;
}
.upd-note {
  font-size: 13px;
  color: #4e5969;
  margin: 18px 0 10px;
}
.upd-note b {
  color: #d46b08;
}
.upd-row {
  display: flex;
  gap: 8px;
  font-size: 12.5px;
  line-height: 1.6;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
}
.upd-row span {
  font-weight: 600;
  flex-shrink: 0;
}
.upd-keep { background: #f0fde4; color: #3a7a0a; }
.upd-over { background: #fff7e6; color: #99580a; }
.upd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.upd-actions .act-mini {
  height: 34px;
  padding: 0 18px;
}
</style>
