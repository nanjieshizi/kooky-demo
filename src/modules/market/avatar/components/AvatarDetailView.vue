<template>
  <div class="avatar-detail">
    <Loading :visible="detailLoading" text="加载中..." />
    <Breadcrumb :items="breadcrumbItems" back-url="/market/avatar" />

    <div v-if="currentAvatar" class="detail-layout">
      <section class="detail-main scroll-pane">
        <header class="hero-card">
          <div class="hero-meta">
            <div class="hero-avatar">
              <img :src="currentAvatar.avatar" class="hero-avatar__img" />
              <img v-if="currentAvatar.isHired" :src="isHiredIcon" class="hero-hired-badge" alt="" />
            </div>

            <div class="hero-content">
              <div class="hero-title-row">
                <h1 class="hero-title">{{ currentAvatar.name }}</h1>
                <span class="hero-version">{{ currentAvatar.version }}</span>
              </div>

              <div class="hero-tags">
                <div class="hero-tags__chips">
                  <span v-if="currentAvatar.qualityLevel" class="tag tag-quality">
                    {{ currentAvatar.qualityLevel }}
                  </span>
                  <ElTooltip v-if="currentAvatar.extraTagCount" placement="top" :show-after="200"
                    :disabled="!heroExtraTagsTooltip">
                    <template #content>
                      <span>{{ heroExtraTagsTooltip }}</span>
                    </template>
                    <span class="tag tag-extra">+{{ currentAvatar.extraTagCount }}</span>
                  </ElTooltip>
                </div>
                <p class="hero-publisher">
                  由 <span class="hero-publisher__name">{{ currentAvatar.author }}</span> 上传，
                  更新于 {{ currentAvatar.updatedAt }}
                </p>
              </div>
            </div>
          </div>

          <!-- 非我的上传来源，或我的上传且当前版本已发布，才展示 hero-side -->
          <div v-if="!isFromMyUploads || isCurrentVersionOnline" class="hero-side">
            <div class="hero-stats">
              <span class="hero-stat">
                <img class="hero-stat-icon hero-stat-icon--download" :src="downloadIcon" alt="" />
                {{ formatCount(currentAvatar.stats_hires) }}
              </span>
              <CollectButton type="avatar" :resource-id="currentAvatar.id"
                :initial-collected="currentAvatar.isCollected" :initial-count="currentAvatar.favorites" />
            </div>

            <div class="hero-actions">
              <template v-if="!isFromMyUploads">
                <ChatButton :id="currentAvatar.id" :agent-display-name="currentAvatar.name"
                  :agent-name="currentAvatar.name" :agent-avatar-url="currentAvatar.avatar || ''" />
                <AvatarHireButton :avatar="currentAvatar"
                  :version-id="currentVersionItem?.versionId ?? currentAvatar.latestVersionId ?? null"
                  @hired="onHeroHired" />
              </template>
              <MarketCustomButton v-if="isFromMyUploads" variant="dark" @click="goToMarketDetail">
                去市场查看
              </MarketCustomButton>
            </div>
          </div>
          <!-- 我的上传且当前版本非已发布：不显示「去市场查看」按钮 -->
        </header>

        <nav v-if="isFromMyUploads" class="up-tabs">
          <button v-for="t in upTabs" :key="t.key" type="button" class="up-tab"
            :class="{ active: activeTab === t.key }" @click="activeTab = t.key">{{ t.label }}</button>
        </nav>

        <template v-if="!isFromMyUploads || activeTab === 'detail'">
        <section class="content-section">
          <h2 class="section-title">基本信息</h2>
          <div class="section-block">
            <div class="block-label">描述</div>
            <p class="block-text">{{ currentAvatar.description || '-' }}</p>
          </div>

          <!-- <div class="section-block">
            <div class="block-label">模拟对话案例</div>
            <div v-if="currentAvatar.simulatedConversationUrl" class="case-image-wrap">
              <el-image
                class="case-image"
                :src="currentAvatar.simulatedConversationUrl"
                :preview-src-list="[currentAvatar.simulatedConversationUrl]"
                fit="contain"
                alt="模拟对话案例"
              />
            </div>
            <p v-else class="block-text">-</p>
          </div> -->
        </section>

        <section class="content-section">
          <h2 class="section-title">更新日志</h2>
          <div class="section-block">
            <div class="block-label">描述</div>
            <p class="block-text">{{ currentAvatar.changelog || '-' }}</p>
          </div>
        </section>

        <section class="content-section">
          <h2 class="section-title">Skill 列表</h2>
          <div class="pkg-skill-list" v-if="currentAvatar.skillsInfo?.length">
            <div v-for="skill in currentAvatar.skillsInfo" :key="skill.id" class="pkg-skill-item">
              <div class="pkg-skill-item__avatar">
                <img :src="skill.icon" alt="" />
              </div>
              <div class="pkg-skill-item__info">
                <div class="pkg-skill-item__name">{{ skill.name }}</div>
                <div class="pkg-skill-item__desc">{{ skill.description }}</div>
              </div>
            </div>
          </div>
          <div v-else class="empty-skills">暂无关联 Skill</div>
        </section>

        <!-- 聘用概览：从市场来始终显示；从我的上传来且当前版本已发布才显示 -->
        <section v-if="(!isFromMyUploads || isCurrentVersionOnline)" class="content-section">
          <h2 class="section-title">聘用概览</h2>
          <div v-if="currentAvatar.hiresInfos?.length" class="hires-grid">
            <div v-for="item in currentAvatar.hiresInfos" :key="item.version_id || item.name" class="hires-card">
              <div class="hires-card__top">
                <div class="hires-card__media">
                  <img :src="item.avatar_url || defaultHiresAvatar" :alt="item.display_name || item.name"
                    class="hires-card__cover" @error="(e) => (e.target.src = defaultHiresAvatar)" />
                </div>
                <div class="hires-card__meta">
                  <div class="hires-card__title-row">
                    <span class="hires-card__title">{{ item.display_name || item.name }}</span>
                    <span class="hires-card__version">{{ item.version }}</span>
                  </div>
                  <div class="hires-card__tag-row">
                    <template v-if="item.tags?.length">
                      <span class="hires-card__tag">{{ item.tags[0] }}</span>
                      <span v-if="item.tags.length > 1" class="hires-card__tag">+{{ item.tags.length - 1 }}</span>
                    </template>
                    <span v-if="item.author" class="hires-card__org">@{{ item.author }}</span>
                  </div>
                </div>
              </div>
              <p class="hires-card__desc">{{ item.description || '-' }}</p>
              <div class="hires-card__footer">
                <ChatButton size="small" :id="item.agent_id" :agent-display-name="item.display_name || item.name"
                  :agent-name="item.name" :agent-avatar-url="item.avatar_url || ''" />
              </div>
            </div>
          </div>
          <div v-else class="empty-skills">暂无聘用数据</div>
        </section>
        </template>

        <!-- ══ 效能 Tab（V1 规则统计 / V2 AI 评估 切换）══ -->
        <div v-if="isFromMyUploads && activeTab === 'eff'" class="up-pane">
          <div class="up-pane__bar">
            <div class="up-pane__hint">🔒 效能数据仅你（发布者）可见</div>
            <div class="eff-mode">
              <button v-for="p in PERIODS" :key="p" type="button" :class="{ active: effPeriod === p }" @click="effPeriod = p">{{ p }}</button>
            </div>
            <div class="eff-mode">
              <button type="button" :class="{ active: effMode === 'v1' }" @click="effMode = 'v1'">V1 · 规则统计</button>
              <button type="button" :class="{ active: effMode === 'v2' }" @click="effMode = 'v2'">V2 · AI 评估</button>
            </div>
          </div>
          <div class="eff-mode-note">{{ effData.note }} · 本期样本：{{ sampleShown }}</div>

          <section class="content-section">
            <h2 class="section-title">核心指标</h2>
            <div class="eff-kpis">
              <div v-for="k in statsShown" :key="k.label" class="eff-kpi eff-kpi--clickable"
                :class="{ 'eff-kpi--active': trendMetric === k.key }" @click="trendMetric = k.key">
                <div class="eff-kpi__label">{{ k.label }}</div>
                <div class="eff-kpi__value">{{ k.value }}<span class="eff-kpi__unit">{{ k.unit }}</span></div>
                <div class="eff-kpi__delta" :class="{ up: k.up }">{{ k.delta }}</div>
              </div>
            </div>
          </section>

          <section class="content-section">
            <h2 class="section-title">{{ trendMeta.title }} <span class="eff-hint">{{ trendSubShown }} · 点上方指标卡切换</span></h2>
            <div class="trend">
              <div v-for="(b, i) in trendBars" :key="effMode + effPeriod + trendMetric + i" class="trend__bar"
                :class="{ 'trend__bar--mark': i === trendMarkShown }" :style="{ height: b.h + 'px' }">
                <span class="trend__tip">{{ b.v }}%</span>
              </div>
            </div>
            <div class="trend__axis"><span>{{ trendAxis[0] }}</span><span class="trend__axis-mark">{{ trendAxis[1] }}</span><span>{{ trendAxis[2] }}</span></div>
          </section>

          <section class="content-section">
            <h2 class="section-title">技能效能明细 <span class="eff-hint">{{ effData.skillHint }}</span></h2>
            <div class="eff-table">
              <div class="eff-tr eff-tr--head eff-tr--skill">
                <span>技能</span>
                <span class="eff-th" @click="setSkillSort('pct')">调用占比 {{ skillSort.key === 'pct' ? (skillSort.dir === 1 ? '▲' : '▼') : '' }}</span>
                <span class="eff-th" @click="setSkillSort('rate')">{{ effData.rateCol }} {{ skillSort.key === 'rate' ? (skillSort.dir === 1 ? '▲' : '▼') : '' }}</span>
                <span class="eff-th" @click="setSkillSort('turns')">平均轮次 {{ skillSort.key === 'turns' ? (skillSort.dir === 1 ? '▲' : '▼') : '' }}</span>
                <span class="eff-th" @click="setSkillSort('dur')">平均耗时 {{ skillSort.key === 'dur' ? (skillSort.dir === 1 ? '▲' : '▼') : '' }}</span>
              </div>
              <div v-for="s in skillsShown" :key="s.name" class="eff-tr eff-tr--skill">
                <span>{{ s.name }}</span>
                <span class="eff-dept">{{ s.pct }}%</span>
                <span class="eff-rate"><i class="eff-led" :class="'eff-led--' + s.cls"></i>{{ s.rate }}%</span>
                <span>{{ s.turns }}</span>
                <span class="eff-dept">{{ s.dur }}</span>
              </div>
            </div>
          </section>

          <section class="content-section">
            <h2 class="section-title">失败分析 <span class="eff-hint">失败与中断 trace 按大类归并（完成 91.8 + 中断 5.3 + 失败 2.9 = 100%）· 先修高频项</span></h2>
            <div class="eff-issues">
              <div v-for="(f, i) in failsShown" :key="f.cat" class="eff-issue">
                <span class="eff-issue__rank">{{ i + 1 }}</span>
                <span class="eff-issue__title">{{ f.cat }}<i class="eff-src" :class="f.src === 'AI' ? 'eff-src--ai' : 'eff-src--rule'">{{ f.src }}判定</i></span>
                <span class="eff-issue__count">{{ f.count }} 起 · {{ f.pct }}%</span>
                <button type="button" class="eff-issue__btn" @click="failCase = f; expandedCase = 0">查看案例 →</button>
              </div>
            </div>
          </section>
        </div>

        <!-- ══ 用量 Tab ══ -->
        <div v-if="isFromMyUploads && activeTab === 'usage'" class="up-pane">
          <div class="up-pane__bar">
            <div class="up-pane__hint">🔒 用量数据仅你（发布者）可见 · 集团统一计费</div>
            <div class="eff-mode">
              <button v-for="p in PERIODS" :key="p" type="button" :class="{ active: effPeriod === p }" @click="effPeriod = p">{{ p }}</button>
            </div>
          </div>

          <section class="content-section">
            <h2 class="section-title">服务贡献 <span class="eff-hint">{{ effPeriod }}</span></h2>
            <div class="contrib">
              <div class="contrib__stat"><b>{{ contribShown.calls }}</b><span>总调用次数</span></div>
              <div class="contrib__stat"><b>{{ contribShown.users }}</b><span>服务用户数</span></div>
              <div class="contrib__stat"><b>86</b><span>累计聘用</span></div>
              <div class="contrib__stat"><b>{{ contribShown.tokens }}M</b><span>token 规模</span></div>
              <div class="contrib__note">{{ effPeriod }}你的数字人服务 {{ contribShown.users }} 名用户，完成 {{ contribShown.calls }} 次任务。<i>🔗 贡献值将用于未来生态激励结算</i></div>
            </div>
          </section>

          <!-- 用量概览 + 趋势（点卡切换） -->
          <section class="content-section">
            <h2 class="section-title">用量概览 <span class="eff-hint">{{ effPeriod }} · 点击指标卡切换下方趋势</span></h2>
            <div class="eff-kpis">
              <div v-for="k in usageStatsShown" :key="k.key" class="eff-kpi eff-kpi--clickable"
                :class="{ 'eff-kpi--active': usageTrendMetric === k.key }" @click="usageTrendMetric = k.key">
                <div class="eff-kpi__label">{{ k.label }}</div>
                <div class="eff-kpi__value">{{ k.value }}<span class="eff-kpi__unit">{{ k.unit }}</span></div>
                <div class="eff-kpi__delta" :class="{ up: k.up }">{{ k.delta }}</div>
              </div>
            </div>
            <div class="usage-trend-head">{{ usageTrendMeta.title }} <span class="eff-hint">{{ effPeriod }} · 单位：{{ usageTrendMeta.unit }}</span></div>
            <div class="trend trend--blue">
              <div v-for="(b, i) in usageTrendBars" :key="usageTrendMetric + effPeriod + i" class="trend__bar" :style="{ height: b.h + 'px' }">
                <span class="trend__tip">{{ b.v }}{{ usageTrendMeta.unit }}</span>
              </div>
            </div>
            <div class="trend__axis"><span>{{ trendAxis[0] }}</span><span></span><span>{{ trendAxis[2] }}</span></div>
          </section>

          <!-- 聘用概况 -->
          <section class="content-section">
            <h2 class="section-title">聘用概况 <span class="eff-hint">聘用 = 用户将数字人雇为私有数字员工</span></h2>
            <div class="eff-kpis" style="grid-template-columns: repeat(3, 1fr);">
              <div class="eff-kpi">
                <div class="eff-kpi__label">累计聘用</div>
                <div class="eff-kpi__value">86<span class="eff-kpi__unit">人次</span></div>
                <div class="eff-kpi__delta up">较上月 +12</div>
              </div>
              <div class="eff-kpi">
                <div class="eff-kpi__label">本期新增聘用</div>
                <div class="eff-kpi__value">{{ HIRE_NEW[effPeriod] }}<span class="eff-kpi__unit">人次</span></div>
                <div class="eff-kpi__delta up">{{ PERIOD_DELTA_LABEL[effPeriod] }} +4</div>
              </div>
              <div class="eff-kpi">
                <div class="eff-kpi__label">当前在聘</div>
                <div class="eff-kpi__value">61<span class="eff-kpi__unit">人</span></div>
                <div class="eff-kpi__delta">已解聘 25 · 在聘留存 71%</div>
              </div>
            </div>
            <div class="eff-mode-note">🔒 聘用后即为用户私有数字员工，其对话与 token 消耗属于用户本人，不归集到创作者视图（隐私边界）· 各版本聘用数见「详情」页版本历史</div>
          </section>

          <!-- 调用方排名：全量分页 -->
          <section class="content-section">
            <h2 class="section-title">调用方排名 <span class="eff-hint">🔒 同租户显真实身份，跨租户按企业聚合脱敏 · 全量 {{ sortedCallers.length }} 方 · 点表头排序</span></h2>
            <div class="eff-table">
              <div class="eff-tr eff-tr--head eff-tr--caller">
                <span>排名</span><span>调用方</span><span>来源</span>
                <span class="eff-th" @click="setCallerSort('calls')">调用次数 {{ callerSort.key === 'calls' ? (callerSort.dir === -1 ? '▼' : '▲') : '' }}</span>
                <span class="eff-th" @click="setCallerSort('tokensK')">token {{ callerSort.key === 'tokensK' ? (callerSort.dir === -1 ? '▼' : '▲') : '' }}</span>
              </div>
              <div v-for="c in pagedCallers" :key="c.name" class="eff-tr eff-tr--caller" :class="{ 'eff-tr--ext': c.ext }">
                <span>{{ c.rank <= 3 ? ['🥇', '🥈', '🥉'][c.rank - 1] : c.rank }}</span>
                <span>{{ c.name }}<i v-if="c.ext" class="eff-ext">聚合</i></span>
                <span class="eff-dept">{{ c.dept }}</span>
                <span>{{ c.calls }} 次</span>
                <span>{{ c.tokensK }}K</span>
              </div>
            </div>
            <div class="pager">
              <button type="button" class="eff-issue__btn" :disabled="callerPage === 1" @click="callerPage--">‹ 上一页</button>
              <span class="pager__info">{{ callerPage }} / {{ callerPages }} 页</span>
              <button type="button" class="eff-issue__btn" :disabled="callerPage === callerPages" @click="callerPage++">下一页 ›</button>
            </div>
          </section>
        </div>
        <!--
          <div class="capabilities-grid" v-if="hiredAgents?.length">
            <AvatarCard
              v-for="capability in hiredAgents"
              :key="capability.id"
              :ocAgentId="capability.ocAgentId"
              :avatar="capability"
              :view-only="true"
              @view-detail="handleCapabilityDetail"
              @collect-change="onCapabilityCollectChange"
              @hired="onCapabilityHired"
            />
          </div>
          <div v-else class="empty-skills">暂无聘用概览</div>
        -->
      </section>

      <aside v-if="!isFromMyUploads || activeTab === 'detail'" ref="versionPaneRef" class="detail-side scroll-pane" @scroll="handleVersionScroll">
        <div class="side-title-row">
          <h2 class="side-title side-title--inline">版本历史</h2>
          <div v-if="isFromMyUploads" class="version-actions">
            <el-tooltip content="上传新版本" placement="top" :show-after="200">
              <img class="version-action-icon" :src="uploadBtnIcon" alt="上传新版本" @click="handleUploadNewVersion" />
            </el-tooltip>
            <el-tooltip content="删除" placement="top" :show-after="200">
              <img class="version-action-icon" :src="deleteBinIcon" alt="删除" @click="handleDeleteAllVersions" />
            </el-tooltip>
          </div>
        </div>
        <div class="version-list">
          <article v-for="item in visibleVersions" :key="item.cardKey" class="version-card"
            :class="{ 'is-active': item.versionId != null && item.versionId === selectedVersionId, 'is-clickable': !!item.rawVersion }"
            @click="handleVersionChange(item)">
            <div class="version-card__header">
              <div class="version-card__title-wrap">
                <h3 class="version-card__title">
                  {{ item.version }}
                  <img v-if="item.isNew" class="version-card__new-img" :src="skillNewPngUrl" alt="" />
                </h3>
              </div>
              <span v-if="item.statusMeta && isFromMyUploads" class="version-card__status"
                :class="`version-card__status--${item.statusMeta.mod}`" :style="item.statusMeta.color || item.statusMeta.bgColor ? {
                  color: item.statusMeta.color,
                  backgroundColor: item.statusMeta.bgColor
                } : undefined">
                <el-tooltip v-if="isVersionRejected(item) && item.rejectReason" :content="item.rejectReason"
                  placement="top" :show-after="200">
                  <span>{{ item.statusMeta.text }}</span>
                </el-tooltip>
                <span v-else>{{ item.statusMeta.text }}</span>
              </span>
            </div>

            <div class="version-card__meta">
              <span>{{ item.publisher }}</span>
              <span class="version-card__meta-divider" aria-hidden="true"></span>
              <span>{{ item.date }}</span>
            </div>
            <p class="version-card__summary">{{ item.summary }}</p>


            <div v-if="isFromMyUploads" class="version-card__footer">
              <div class="version-card__hire-count">
                <template v-if="item.stats_hires">
                  <span class="version-card__hire-count-label">当前聘用数：</span>
                  <span class="version-card__hire-count-value">
                    {{ item.stats_hires }}
                  </span>
                </template>
              </div>
              <div class="version-card__actions">
                <!-- 编辑：未发布、已驳回 -->
                <el-tooltip v-if="isVersionDraft(item) || isVersionRejected(item)" content="编辑" placement="top"
                  effect="dark" :show-after="200">
                  <span class="version-card__icon-host">
                    <button type="button" class="version-card__icon-btn" aria-label="编辑"
                      @click.stop="handleVersionEdit(item)">
                      <img :src="editIcon" class="version-card__icon-img" width="14" height="14" alt="" />
                    </button>
                  </span>
                </el-tooltip>
                <!-- 下架：已发布 -->
                <el-tooltip v-if="versionIsPublished(item)" content="下架" placement="top" effect="dark"
                  :show-after="200">
                  <span class="version-card__icon-host">
                    <img :src="shelfDownIcon" class="version-card__icon-img" width="14" height="14" alt=""
                      @click.stop="handleVersionUnpublish(item)" />
                  </span>
                </el-tooltip>
                <!-- 删除：所有状态都显示 -->
                <el-tooltip content="删除" placement="top" effect="dark" :show-after="200">
                  <span class="version-card__icon-host">
                    <button type="button" class="version-card__icon-btn" aria-label="删除"
                      @click.stop="handleVersionDelete(item)">
                      <img :src="deleteBinIcon" class="version-card__icon-img" width="14" height="14" alt="" />
                    </button>
                  </span>
                </el-tooltip>
              </div>
            </div>
          </article>
        </div>
      </aside>
    </div>

    <div v-else-if="!detailLoading" class="detail-empty">
      <p class="detail-empty__text">未找到对应的数字人详情。</p>
    </div>

    <!-- 删除确认弹窗（删除整个 agent） -->
    <MarketConfirmDialog ref="confirmDialogRef" :title="deleteDialogTitle" :content="deleteDialogContent"
      confirm-text="删除" confirm-variant="danger" @confirm="handleConfirmDelete" />
    <!-- 版本删除确认弹窗 -->
    <MarketConfirmDialog ref="versionDeleteDialogRef" :title="deleteDialogTitle" :content="deleteDialogContent"
      confirm-text="删除" confirm-variant="danger" @confirm="handleConfirmDeleteVersion" />
    <!-- 发布确认弹窗 -->
    <MarketConfirmDialog ref="publishDialogRef" :title="`确认发布版本 v${pendingShelfVersion?.version} 吗?`"
      content="发布并审核成功后将在广场可见。" confirm-text="确认发布" confirm-variant="dark" @confirm="handleConfirmPublish" />
    <!-- 下架确认弹窗 -->
    <MarketConfirmDialog ref="unpublishDialogRef" :title="`确认下架版本 v${pendingShelfVersion?.version} 吗?`"
      content="下架后，市场不可见，且无法再次发布该版本，请确认后操作。" confirm-text="确认下架" confirm-variant="danger"
      @confirm="handleConfirmUnpublish" />

    <!-- 失败案例抽屉 -->
    <div v-if="failCase" class="case-mask" @click="failCase = null"></div>
    <div v-if="failCase" class="case-drawer">
      <div class="case-drawer__head">
        <span class="case-drawer__title">失败案例 · {{ failCase.cat }}</span>
        <button type="button" class="case-drawer__close" @click="failCase = null">✕</button>
      </div>
      <div class="case-drawer__body">
        <div class="eff-mode-note" style="margin-bottom: 12px;">🔒 不展示用户原文 · 对话内容为系统脱敏摘要（V2 由 Judge 生成，V1 失败类仅含系统元数据）</div>
        <div class="case-stats">
          <div class="case-stats__item"><b>{{ failCase.count }}</b><span>本月总计（起）</span></div>
          <div class="case-stats__item"><b>{{ failCase.pct }}%</b><span>占全部失败</span></div>
          <div class="case-stats__item"><b>{{ failCase.delta }}</b><span>环比</span></div>
          <i class="eff-src case-stats__src" :class="failCase.src === 'AI' ? 'eff-src--ai' : 'eff-src--rule'">{{ failCase.src }}判定</i>
        </div>
        <div class="case-list-label">失败记录 <span>点击展开对话回放</span></div>
        <div v-for="(c, i) in failCase.records" :key="i" class="case-rec" :class="{ open: expandedCase === i }">
          <div class="case-rec__row" @click="expandedCase = expandedCase === i ? null : i">
            <span class="case-rec__time">{{ c.time }}</span>
            <span class="case-rec__user">{{ c.user }}</span>
            <span class="case-rec__skill">{{ c.skill }}</span>
            <span class="case-rec__q">{{ c.q }}</span>
            <span class="case-rec__arrow">{{ expandedCase === i ? '▾' : '▸' }}</span>
          </div>
          <div v-if="expandedCase === i" class="case-rec__detail">
            <div class="case-bubble case-bubble--u">{{ c.q }}</div>
            <div class="case-bubble case-bubble--a">{{ c.a }}</div>
            <div class="case-verdict">⚠️ {{ c.why }}</div>
          </div>
        </div>
        <p class="case-drawer__foot">已展示最近 {{ failCase.records.length }} 起 · 全部 {{ failCase.count }} 起支持导出</p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElTooltip, ElImage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import deleteBinIcon from '@/assets/market/myupload/skill-version-delete.svg'
import editIcon from '@/assets/market/edit.png'
import uploadBtnIcon from '@/assets/market/myupload/upload-btn.svg'
import shelfUpIcon from '@/assets/market/myupload/skill-version-shelf-up.svg'
import shelfDownIcon from '@/assets/market/myupload/skill-version-shelf-down.svg'
import { deleteAgent, setAgentVisibility } from '@/modules/market/my-uploads/services/myUploadsApi'
import Breadcrumb from '@/shared/components/Breadcrumb.vue'
import exampleCaseImage from './images/exampleCase.png'
import downloadIcon from './images/download.svg'
import isHiredIcon from './images/isHired.png'
import defaultHiresAvatar from './images/m01@2x.png'
import { fetchAgentDetail, followAgent, getHiredAgents, deleteAgentVersion, offlineAgentVersion, hireAgentVersion } from '../services/avatarApi'
// 我的资产 demo 兜底头像（与 MyAssetsView 的发布 mock 对应）
import paImg1 from './images/m01@2x.png'
import paImg2 from './images/m04@2x.png'
import paImg3 from './images/m05@2x.png'
import paImg4 from './images/m07@2x.png'
import paImg5 from './images/w04@2x.png'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import MarketConfirmDialog from '@/modules/market/components/MarketConfirmDialog.vue'
import CollectButton from '@/modules/market/components/CollectButton.vue'
import AvatarHireButton from '@/modules/market/components/AvatarHireButton.vue'
import AvatarCard from './AvatarCard.vue'
import SkillMarketCard from '@/modules/market/skill/components/SkillMarketCard.vue'
import skillNewPngUrl from '@/assets/skill/skill-new.png'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import Loading from '@/shared/components/Loading/index.vue'
import ChatButton from "@/modules/market/components/ChatButton.vue"

const route = useRoute()
const router = useRouter()
const avatarId = computed(() => String(route.params.id || ''))

const confirmDialogRef = ref(null)
const versionDeleteDialogRef = ref(null)
const publishDialogRef = ref(null)
const unpublishDialogRef = ref(null)
const deleteDialogTitle = ref('')
const deleteDialogContent = ref('')
const pendingDeleteData = ref(null)
const pendingShelfVersion = ref(null)

/** 从「我的上传」经 MyAvatarDetail 进入时带 query.from=my-uploads */
const isFromMyUploads = computed(() => String(route.query.from || '') === 'my-uploads')

const breadcrumbItems = computed(() => {
  const first = isFromMyUploads.value
    ? { label: '我的上传', to: '/market/my-uploads?type=avatar' }
    : { label: '数字人市场', to: '/market/avatar' }
  const detailLabel = `${currentAvatar.value?.name || `数字人 ${avatarId.value}`} ${currentAvatar.value?.version || ''} 详情`.trim()
  // return [first, { label: detailLabel }]
  return [{ label: detailLabel }]
})

/** 与 Skill 市场列表跳转详情一致，供 history.state 传递头图 */
const COVER_FALLBACK = 'https://picsum.photos/seed/101/200/200'

/** 与 SkillMarketView 中 resolveSkillCoverUrl / resolveSkillCoverForCard 行为对齐 */
function resolveSkillCoverUrl(path) {
  const raw = String(path ?? '').trim()
  if (!raw) return ''
  if (/^data:/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  const base = getOneBaseUrl().replace(/\/$/, '')
  if (!base) return raw
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

function isPlaceholderSkillImage(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return true
  if (/^data:/i.test(s)) return false
  return /default-avatar\.png$/i.test(s) || /\/default-avatar\.png(\?|$)/i.test(s)
}

function resolveSkillCoverForCard(raw) {
  if (isPlaceholderSkillImage(raw)) return COVER_FALLBACK
  const resolved = resolveSkillCoverUrl(raw)
  if (!resolved.trim()) return COVER_FALLBACK
  if (isPlaceholderSkillImage(resolved)) return COVER_FALLBACK
  return resolved
}

const VERSION_BATCH_SIZE = 4
const visibleVersionCount = ref(VERSION_BATCH_SIZE)
const versionPaneRef = ref(null)
const selectedVersionId = ref(null)
const hiredAgents = ref([])
// 我的资产 demo：发布 mock 的详情兜底（fetch 失败时用，让效能/用量 tab 能进）
const fallbackAvatarList = [
  { id: 'pa1', name: '小销 · 销售助理', version: 'v3', avatar: paImg1, qualityLevel: '销售', extraTagCount: 0, extraTagLabels: [], tags: ['销售'], author: '我', updatedAt: '2026-06-10', stats_hires: 128, favorites: 42, isCollected: false, isHired: false, description: '外呼话术 + 异议处理 + CRM 自动写回，跟进不掉链子。', changelog: 'v3：多轮跟进 + CRM 写回', relatedSkills: [], skillsInfo: [], hiresInfos: [], versions: [], latestVersionId: null },
  { id: 'pa2', name: '合同审查官', version: 'v5', avatar: paImg2, qualityLevel: '法务', extraTagCount: 0, extraTagLabels: [], tags: ['法务'], author: '我', updatedAt: '2026-06-08', stats_hires: 210, favorites: 88, isCollected: true, isHired: false, description: '劳动法 / 知识产权 / 数据合规三件套，逐条挑风险。', changelog: 'v5：数据合规模块', relatedSkills: [], skillsInfo: [], hiresInfos: [], versions: [], latestVersionId: null },
  { id: 'pa3', name: '面试官 Max', version: 'v4', avatar: paImg3, qualityLevel: '人力', extraTagCount: 0, extraTagLabels: [], tags: ['人力'], author: '我', updatedAt: '2026-06-12', stats_hires: 0, favorites: 3, isCollected: false, isHired: false, description: '结构化追问 + 能力评分，初筛效率拉满。', changelog: 'v4：结构化追问', relatedSkills: [], skillsInfo: [], hiresInfos: [], versions: [], latestVersionId: null },
  { id: 'pa4', name: '招商顾问', version: 'v2', avatar: paImg4, qualityLevel: '商务', extraTagCount: 0, extraTagLabels: [], tags: ['商务'], author: '我', updatedAt: '2026-06-05', stats_hires: 0, favorites: 1, isCollected: false, isHired: false, description: '招商话术与政策匹配，含敏感表述需调整。', changelog: 'v2：政策匹配', relatedSkills: [], skillsInfo: [], hiresInfos: [], versions: [], latestVersionId: null },
  { id: 'pa5', name: '旧版客服', version: 'v6', avatar: paImg5, qualityLevel: '客服', extraTagCount: 0, extraTagLabels: [], tags: ['客服'], author: '我', updatedAt: '2026-05-20', stats_hires: 540, favorites: 120, isCollected: false, isHired: false, description: '上一代客服话术，已被新版替代。', changelog: 'v6：话术优化', relatedSkills: [], skillsInfo: [], hiresInfos: [], versions: [], latestVersionId: null },
]
const detailLoading = ref(false)

const currentAvatar = ref(null)

/* ── 我的上传：详情/效能/用量 Tab ── */
const activeTab = ref('detail')
const upTabs = [
  { key: 'detail', label: '详情' },
  { key: 'eff', label: '效能' },
  { key: 'usage', label: '用量' },
]

/* ── 效能演示数据：V1 规则统计 / V2 AI 评估 双版本（仅发布者视角，mock）── */
const effMode = ref('v1')
const failCase = ref(null)
const expandedCase = ref(0)

/* 失败记录（按大类，V1/V2 共用规则类）*/
const FAIL_RECS = {
  error: [
    { time: '06-09 18:44', user: '张思远', skill: '需求分析', q: '帮我把这周的磐石需求拉出来看看', a: '（调用 panshi_list 接口返回 500，重试 2 次均失败，无兜底回复）', why: '规则判定：status=error · error_code=PANSHI_500 · 无成功重试' },
    { time: '06-09 11:20', user: '李静雯', skill: 'PRD 撰写', q: '把评审意见同步到 PRD 文档', a: '（doc_write 鉴权失败，返回 401）', why: '规则判定：status=error · error_code=DOC_AUTH_401' },
    { time: '06-08 16:05', user: '陈雨婷', skill: '竞品对比', q: '拉一下竞品 A 的最新版本号', a: '（crawler 接口返回 503）', why: '规则判定：status=error · error_code=CRAWLER_503' },
    { time: '06-07 10:32', user: '王建国', skill: '需求分析', q: '把需求状态同步回磐石', a: '（写回接口超出配额）', why: '规则判定：status=error · error_code=QUOTA_EXCEEDED' },
  ],
  timeout: [
    { time: '06-09 15:10', user: '周鑫宇', skill: '竞品对比', q: '生成一份竞品对比表', a: '（web_search 工具 30s 无返回，任务中止）', why: '规则判定：status=timeout · tool_duration_ms > 30000' },
    { time: '06-08 14:40', user: '张思远', skill: '用户旅程', q: '基于这份调研生成旅程图', a: '（图表渲染 45s 未完成）', why: '规则判定：status=timeout · 渲染超时' },
    { time: '06-06 09:55', user: '李静雯', skill: '需求分析', q: '汇总三个迭代的需求清单', a: '（分页拉取卡在第 3 页无响应）', why: '规则判定：status=timeout · 分页请求无响应' },
  ],
  tool: [
    { time: '06-09 17:58', user: '字节跳动', skill: 'PRD 撰写', q: '把这份 PRD 导出成 Word', a: '抱歉，导出服务暂时不可用，请稍后再试。', why: '规则判定：export_docx 连续失败 · error_code=TOOL_UNAVAILABLE' },
    { time: '06-08 13:22', user: '林美华', skill: '用户旅程', q: '把旅程图存到团队空间', a: '（存储工具不可用）', why: '规则判定：storage_put 失败 · error_code=TOOL_UNAVAILABLE' },
    { time: '06-05 19:01', user: '吴明华', skill: '竞品对比', q: '报告里附上竞品页面截图', a: '（截图服务未部署）', why: '规则判定：screenshot 工具缺失' },
  ],
  abandon: [
    { time: '06-09 12:18', user: '陈雨婷', skill: '用户旅程', q: '帮我梳理用户旅程', a: '（Agent 执行中，用户 10 分钟内无任何后续操作）', why: '规则判定：静默窗口到期 · 末步为 action · 无最终回复' },
    { time: '06-07 18:47', user: '王建国', skill: '需求分析', q: '分析下这批需求的依赖关系', a: '（用户发起后切走，再未返回）', why: '规则判定：静默窗口到期 · 无最终回复' },
    { time: '06-04 16:33', user: '周鑫宇', skill: 'PRD 撰写', q: '按模板起草一份 PRD', a: '（进行到一半用户关闭会话）', why: '规则判定：会话关闭 · 末步为 thought' },
  ],
  misread: [
    { time: '06-09 14:02', user: '张思远', skill: '需求分析', q: '帮我看下这个需求的优先级排得合理吗', a: '已为你创建了一条新需求并设置为 P0。', why: 'AI 判定：用户要的是「评估优先级」，Agent 理解成「创建需求」· 置信度 0.92' },
    { time: '06-08 10:45', user: '李静雯', skill: 'PRD 撰写', q: '这段验收标准帮我改得更可测一点', a: '已将这段移动到「非功能需求」章节。', why: 'AI 判定：要求「改写」，执行了「移动」· 置信度 0.87' },
    { time: '06-06 15:21', user: '吴明华', skill: '竞品对比', q: '对比下我们和竞品 B 的定价', a: '竞品 B 的定价如下：基础版 99 元/月…', why: 'AI 判定：遗漏「我们」一方，未形成对比 · 置信度 0.85' },
  ],
  offtopic: [
    { time: '06-09 16:30', user: '陈雨婷', skill: '竞品对比', q: 'A 方案和 B 方案的成本差多少？', a: 'A 方案的成本构成如下：人力 40%、采购 35%、运维 25%。', why: 'AI 判定：仅回答 A 方案构成，未对比 B 方案，未回应「差多少」· 置信度 0.88' },
    { time: '06-07 11:12', user: '王建国', skill: '需求分析', q: '这个需求会影响哪些线上模块？', a: '这个需求的背景是这样的：…', why: 'AI 判定：答背景不答影响面 · 置信度 0.90' },
    { time: '06-05 14:50', user: '林美华', skill: '用户旅程', q: '旅程里流失最严重的是哪一步？', a: '完整旅程共 7 步，分别是：…', why: 'AI 判定：罗列全部步骤，未回答「哪一步流失最严重」· 置信度 0.86' },
  ],
}

const EFF_V1 = {
  note: '判定来源：埋点规则 + 用户显式反馈（点赞/踩）· 零模型成本 ·「答得准不准」需 V2 AI 评估',
  stats: [
    { key: 'quality', label: '正向反馈率', value: '78.4', unit: '%', delta: '覆盖 12% 会话 · 较上月 +3.0pt', up: true },
    { key: 'complete', label: '完成率', value: '91.8', unit: '%', delta: '较上月 +0.6pt', up: true },
    { key: 'fail', label: '失败率', value: '2.9', unit: '%', delta: '较上月 -0.4pt', up: true },
    { key: 'abort', label: '任务中断率', value: '5.3', unit: '%', delta: '较上月 -0.8pt', up: true },
  ],
  rateCol: '完成率',
  skillHint: '按完成率升序 · 待优化置顶 · 轮次按就近技能归属（规则）',
  skills: [
    { name: '需求分析', pct: 18, rate: 89, turns: 4.2, dur: '8.7s', cls: 'r' },
    { name: 'PRD 撰写', pct: 28, rate: 93, turns: 3.4, dur: '5.1s', cls: 'y' },
    { name: '用户旅程', pct: 9, rate: 96, turns: 2.6, dur: '3.9s', cls: 'g' },
    { name: '竞品对比', pct: 45, rate: 98, turns: 2.1, dur: '2.3s', cls: 'g' },
  ],
  fails: [
    { cat: '系统报错', count: 18, pct: 40, delta: '较上月 -3 起', src: '规则', records: FAIL_RECS.error },
    { cat: '调用超时', count: 10, pct: 22, delta: '较上月 +2 起', src: '规则', records: FAIL_RECS.timeout },
    { cat: '工具调用失败', count: 9, pct: 20, delta: '较上月 -1 起', src: '规则', records: FAIL_RECS.tool },
    { cat: '用户中途放弃', count: 8, pct: 18, delta: '较上月 持平', src: '规则', records: FAIL_RECS.abandon },
  ],
}

const EFF_V2 = {
  note: '判定来源：LLM Judge 离线采样评估（采样率 10%）· 人工抽检校准 · 规则兜底',
  stats: [
    { key: 'quality', label: '准确率（AI 评估）', value: '91.2', unit: '%', delta: '较上月 +1.2pt', up: true },
    { key: 'complete', label: '完成率', value: '91.8', unit: '%', delta: '较上月 +0.6pt', up: true },
    { key: 'fail', label: '失败率', value: '2.9', unit: '%', delta: '较上月 -0.4pt', up: true },
    { key: 'abort', label: '任务中断率', value: '5.3', unit: '%', delta: '较上月 -0.8pt', up: true },
  ],
  rateCol: '准确率',
  skillHint: '按准确率升序 · 待优化置顶 · 轮次由 AI 语义归属',
  skills: [
    { name: '需求分析', pct: 18, rate: 68, turns: 4.2, dur: '8.7s', cls: 'r' },
    { name: 'PRD 撰写', pct: 28, rate: 82, turns: 3.4, dur: '5.1s', cls: 'y' },
    { name: '用户旅程', pct: 9, rate: 88, turns: 2.6, dur: '3.9s', cls: 'y' },
    { name: '竞品对比', pct: 45, rate: 94, turns: 2.1, dur: '2.3s', cls: 'g' },
  ],
  fails: [
    { cat: '系统报错', count: 18, pct: 26, delta: '较上月 -3 起', src: '规则', records: FAIL_RECS.error },
    { cat: '理解有误', count: 14, pct: 20, delta: '较上月 -5 起', src: 'AI', records: FAIL_RECS.misread },
    { cat: '答非所问', count: 11, pct: 16, delta: '较上月 -2 起', src: 'AI', records: FAIL_RECS.offtopic },
    { cat: '调用超时', count: 10, pct: 14, delta: '较上月 +2 起', src: '规则', records: FAIL_RECS.timeout },
    { cat: '工具调用失败', count: 9, pct: 13, delta: '较上月 -1 起', src: '规则', records: FAIL_RECS.tool },
    { cat: '用户中途放弃', count: 8, pct: 11, delta: '较上月 持平', src: '规则', records: FAIL_RECS.abandon },
  ],
}

const effData = computed(() => (effMode.value === 'v1' ? EFF_V1 : EFF_V2))
const effTrendMark = 16

/* ── 时间聚合维度 ── */
const PERIODS = ['今日', '近7天', '近30天']
const effPeriod = ref('近30天')
const PERIOD_RATE_OFFSET = { '今日': 0.7, '近7天': 0.3, '近30天': 0 }
const PERIOD_COUNT_FACTOR = { '今日': 0.06, '近7天': 0.25, '近30天': 1 }
const PERIOD_DELTA_LABEL = { '今日': '较昨日', '近7天': '较上周', '近30天': '较上月' }
const statsShown = computed(() => effData.value.stats.map((s) => {
  const deltaLabel = PERIOD_DELTA_LABEL[effPeriod.value]
  if (s.unit === '%') {
    const sign = s.label.includes('中断') || s.label.includes('失败') ? -1 : 1
    const v = parseFloat(s.value) + PERIOD_RATE_OFFSET[effPeriod.value] * sign
    return { ...s, value: v.toFixed(1), delta: s.delta.replace('较上月', deltaLabel) }
  }
  return { ...s, delta: s.delta.replace('较上月', deltaLabel) }
}))

/* 各指标趋势（complete/fail/abort 与状态机同源，V1/V2 共用）*/
const COMMON_TRENDS = {
  complete: { title: '完成率趋势', sub: '三态口径：完成 + 失败 + 中断 = 100% · 告警型指标，平时波动小', data: [90.8, 91.2, 90.6, 91.5, 91.0, 91.8, 91.3, 90.9, 91.6, 91.2, 91.9, 91.4, 91.0, 91.7, 91.3, 92.0, 91.5, 91.8, 92.1, 91.6, 91.9, 92.2, 91.7, 92.0, 91.8, 92.3, 91.9, 92.1, 91.8, 91.8] },
  fail: { title: '失败率趋势', sub: 'status=error 的 trace 占比 · 越低越好', data: [3.8, 3.6, 3.9, 3.4, 3.7, 3.2, 3.5, 3.8, 3.3, 3.6, 3.1, 3.4, 3.7, 3.2, 3.5, 3.0, 3.3, 3.1, 2.9, 3.2, 3.0, 2.8, 3.1, 2.9, 2.7, 3.0, 2.8, 2.9, 2.9, 2.9] },
  abort: { title: '中断率趋势', sub: '超时 + 用户放弃的 trace 占比 · 越低越好', data: [6.4, 6.6, 6.2, 6.5, 6.1, 6.3, 5.9, 6.2, 6.0, 5.8, 6.1, 5.7, 5.9, 5.6, 5.8, 5.5, 5.7, 5.4, 5.6, 5.3, 5.5, 5.2, 5.4, 5.6, 5.3, 5.1, 5.4, 5.2, 5.3, 5.3] },
}
const TRENDS = {
  v1: { quality: { title: '正向反馈率趋势', sub: '点赞 ÷（点赞 + 点踩）· 覆盖约 12% 会话 · v3.2 上线后回升', data: [71, 70, 72, 71, 73, 72, 71, 72, 70, 72, 71, 73, 72, 71, 73, 72, 75, 77, 78, 77, 79, 78, 77, 79, 78, 80, 78, 79, 78, 78] }, ...COMMON_TRENDS },
  v2: { quality: { title: '准确率趋势', sub: 'LLM Judge 采样评估 · v3.2 上线后回升', data: [84, 83, 85, 84, 86, 85, 84, 85, 83, 85, 84, 86, 85, 84, 86, 85, 88, 90, 91, 90, 92, 91, 90, 92, 91, 93, 91, 92, 91, 91] }, ...COMMON_TRENDS },
}
const trendMetric = ref('quality')
const trendMeta = computed(() => TRENDS[effMode.value][trendMetric.value] || TRENDS[effMode.value].quality)
const TODAY_OFFSETS = [-1.1, -0.7, -1.3, -0.4, -0.9, -0.2, -0.6, 0.1, -0.4, 0.3, -0.1, 0.5, 0.2, 0.7, 0.4, 0.9, 0.6, 1.0, 0.7, 1.2, 0.9, 1.3, 1.0, 1.4]
const trendValues = computed(() => {
  const arr = trendMeta.value.data
  if (effPeriod.value === '近7天') return arr.slice(-7)
  if (effPeriod.value === '今日') {
    const base = arr[arr.length - 1]
    return TODAY_OFFSETS.map((o) => Math.round((base + o) * 10) / 10)
  }
  return arr
})
const trendBars = computed(() => {
  const arr = trendValues.value
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  return arr.map((v) => ({ v, h: Math.round(24 + (max === min ? 0.5 : (v - min) / (max - min)) * 70) }))
})
const trendMarkShown = computed(() => (effPeriod.value === '近30天' && trendMetric.value === 'quality' ? effTrendMark : -1))
const trendAxis = computed(() => {
  if (effPeriod.value === '今日') return ['00:00', '', '现在']
  if (effPeriod.value === '近7天') return ['6/3', '', '今日']
  return ['5/10', trendMetric.value === 'quality' ? '● v3.2 上线' : '', '今日']
})
const trendSubShown = computed(() => `${effPeriod.value === '近30天' ? '近 30 天' : effPeriod.value} · ${trendMeta.value.sub}`)
const sampleShown = computed(() => ({ '今日': '48 活跃用户 / 196 次调用', '近7天': '156 活跃用户 / 1,073 次调用', '近30天': '320 活跃用户 / 4,286 次调用' }[effPeriod.value]))

const failsShown = computed(() => effData.value.fails.map((f) => ({
  ...f,
  count: Math.max(1, Math.round(f.count * PERIOD_COUNT_FACTOR[effPeriod.value])),
  delta: f.delta.replace('较上月', PERIOD_DELTA_LABEL[effPeriod.value]),
})))

/* ── 技能表排序 ── */
const skillSort = ref({ key: 'rate', dir: 1 })
function setSkillSort(key) {
  if (skillSort.value.key === key) skillSort.value.dir = -skillSort.value.dir
  else skillSort.value = { key, dir: 1 }
}
const skillsShown = computed(() => {
  const { key, dir } = skillSort.value
  const num = (s) => (key === 'dur' ? parseFloat(s.dur) : Number(s[key]))
  return [...effData.value.skills].sort((a, b) => (num(a) - num(b)) * dir)
})
/* ── 用量：按时间维度聚合（演示数据）── */
const USAGE_KPIS = {
  '今日': { calls: '196', tokens: '0.34', cost: '¥14', users: '82' },
  '近7天': { calls: '1,073', tokens: '1.9', cost: '¥76', users: '413' },
  '近30天': { calls: '4,286', tokens: '7.4', cost: '¥296', users: '1,200' },
}
const usageStatsShown = computed(() => {
  const v = USAGE_KPIS[effPeriod.value]
  const d = PERIOD_DELTA_LABEL[effPeriod.value]
  return [
    { key: 'calls', label: '调用量', value: v.calls, unit: '次', delta: `${d} +23%`, up: true },
    { key: 'tokens', label: 'token 消耗', value: v.tokens, unit: 'M', delta: `${d} +18%`, up: true },
    { key: 'cost', label: '折算成本', value: v.cost, unit: '', delta: '¥0.04 / 1K tokens' },
    { key: 'users', label: '服务用户数', value: v.users, unit: '人', delta: `${d} +96`, up: true },
  ]
})
const contribShown = computed(() => USAGE_KPIS[effPeriod.value])
const HIRE_NEW = { '今日': '1', '近7天': '4', '近30天': '12' }

const USAGE_TRENDS = {
  calls: { title: '调用量趋势', unit: '次', data: [128, 134, 142, 130, 150, 144, 158, 150, 166, 160, 170, 164, 174, 182, 170, 188, 178, 196, 204, 192, 200, 188, 196, 184, 192, 178, 188, 204, 200, 212] },
  tokens: { title: 'token 消耗趋势', unit: 'K', data: [218, 228, 242, 221, 255, 245, 269, 255, 282, 272, 289, 279, 296, 309, 289, 320, 303, 333, 347, 326, 340, 320, 333, 313, 326, 303, 320, 347, 340, 360] },
  cost: { title: '成本趋势', unit: '¥', data: [8.7, 9.1, 9.7, 8.8, 10.2, 9.8, 10.8, 10.2, 11.3, 10.9, 11.6, 11.2, 11.8, 12.4, 11.6, 12.8, 12.1, 13.3, 13.9, 13.0, 13.6, 12.8, 13.3, 12.5, 13.0, 12.1, 12.8, 13.9, 13.6, 14.4] },
  users: { title: '服务用户数趋势', unit: '人', data: [28, 30, 33, 29, 35, 33, 37, 35, 39, 38, 40, 39, 41, 43, 40, 45, 42, 47, 49, 46, 48, 45, 47, 44, 46, 42, 45, 49, 48, 51] },
}
const usageTrendMetric = ref('calls')
const usageTrendMeta = computed(() => USAGE_TRENDS[usageTrendMetric.value])
const usageTrendValues = computed(() => {
  const arr = usageTrendMeta.value.data
  if (effPeriod.value === '近7天') return arr.slice(-7)
  if (effPeriod.value === '今日') {
    const base = arr[arr.length - 1] / 12
    return TODAY_OFFSETS.map((o, i) => Math.round((base + o * 2 + i * 0.3) * 10) / 10)
  }
  return arr
})
const usageTrendBars = computed(() => {
  const arr = usageTrendValues.value
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  return arr.map((v) => ({ v, h: Math.round(24 + (max === min ? 0.5 : (v - min) / (max - min)) * 70) }))
})

/* 调用方排名：全量分页表（Top3 奖牌随当前排序）*/
const CALLERS = [
  { name: '张思远', dept: '技术研发部', calls: 234, tokensK: 128, ext: false },
  { name: '李静雯', dept: '产品设计部', calls: 178, tokensK: 92, ext: false },
  { name: '字节跳动', dept: '外部租户 · 聚合', calls: 156, tokensK: 210, ext: true },
  { name: '陈雨婷', dept: '市场运营部', calls: 123, tokensK: 64, ext: false },
  { name: '腾讯', dept: '外部租户 · 聚合', calls: 98, tokensK: 140, ext: true },
  { name: '王建国', dept: '市场运营部', calls: 87, tokensK: 45, ext: false },
  { name: '周鑫宇', dept: '技术研发部', calls: 76, tokensK: 41, ext: false },
  { name: '林美华', dept: '人力行政部', calls: 64, tokensK: 33, ext: false },
  { name: '吴明华', dept: '人力行政部', calls: 58, tokensK: 30, ext: false },
  { name: '阿里巴巴', dept: '外部租户 · 聚合', calls: 52, tokensK: 71, ext: true },
  { name: '郑晓东', dept: '技术研发部', calls: 47, tokensK: 24, ext: false },
  { name: '孙丽娟', dept: '市场运营部', calls: 41, tokensK: 21, ext: false },
]
const CALLER_PAGE_SIZE = 5
const callerSort = ref({ key: 'calls', dir: -1 })
const callerPage = ref(1)
function setCallerSort(key) {
  if (callerSort.value.key === key) callerSort.value.dir = -callerSort.value.dir
  else callerSort.value = { key, dir: -1 }
  callerPage.value = 1
}
const sortedCallers = computed(() => {
  const { key, dir } = callerSort.value
  const f = PERIOD_COUNT_FACTOR[effPeriod.value]
  return [...CALLERS]
    .map((c) => ({ ...c, calls: Math.max(1, Math.round(c.calls * f)), tokensK: Math.max(1, Math.round(c.tokensK * f)) }))
    .sort((a, b) => (a[key] - b[key]) * dir)
    .map((c, i) => ({ ...c, rank: i + 1 }))
})
const callerPages = computed(() => Math.ceil(sortedCallers.value.length / CALLER_PAGE_SIZE))
const pagedCallers = computed(() => sortedCallers.value.slice((callerPage.value - 1) * CALLER_PAGE_SIZE, callerPage.value * CALLER_PAGE_SIZE))

const visibleVersions = computed(() => {
  return currentAvatar.value?.versions || []
})

/** 当前选中的版本数据 */
const currentVersionItem = computed(() =>
  visibleVersions.value.find((v) => v.versionId != null && v.versionId === selectedVersionId.value) || visibleVersions.value[0] || null
)

/** 当前选中版本是否已发布（status === 'online'） */
const isCurrentVersionOnline = computed(() =>
  currentVersionItem.value?.status === 'online'
)

/** 与 AvatarCard 中「+N」tooltip 文案逻辑一致 */
function formatHeroExtraTagsTooltip(a) {
  if (!a) return ''
  const from = a.extraTagLabels
  if (Array.isArray(from) && from.length) {
    return from.map((x) => String(x ?? '').trim()).filter(Boolean).join('、')
  }
  const tgs = a.tags
  if (Array.isArray(tgs) && tgs.length > 1) {
    return tgs
      .slice(1)
      .map((t) => String(typeof t === 'string' ? t : (t?.name ?? t?.title ?? t?.label ?? '')).trim())
      .filter(Boolean)
      .join('、')
  }
  return ''
}

const heroExtraTagsTooltip = computed(() => {
  try {
    return formatHeroExtraTagsTooltip(currentAvatar.value)
  } catch {
    return ''
  }
})

function formatCount(num) {
  if (!num) return '0'
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return String(num)
}

function onCollectChange(payload) {
  if (!currentAvatar.value) return
  currentAvatar.value.isCollected = Boolean(payload?.collected)
  currentAvatar.value.favorites = Number(payload?.count) || 0
}

async function onHeroHired() {
  if (currentAvatar.value) currentAvatar.value.isHired = true
  await loadDetail('', true)
}

function handleCapabilityDetail(id) {
  if (!id) return

  const name = currentAvatar.value?.name || `数字人 ${avatarId.value}`
  const version = currentAvatar.value?.version || ''
  const currentHistory = router.options.history.state.breadcrumbHistory || []

  // 构建新的历史：保留当前历史 + 添加当前详情页（带 to）
  const newHistory = currentHistory.length > 0
    ? [
      ...currentHistory,
      { label: `${name} ${version} 详情`.trim(), to: `/market/avatar/${avatarId.value}` },
    ]
    : [
      { label: '数字人市场', to: '/market/avatar' },
      { label: `${name} ${version} 详情`.trim(), to: `/market/avatar/${avatarId.value}` },
    ]

  router.push({
    name: 'AvatarDetail',
    params: { id },
    state: {
      breadcrumbHistory: newHistory,
    },
  })
}

/** 与 my-uploads `AvatarVersionHistory.handleUploadVersion` 一致 */
function handleUploadNewVersion() {
  const agentId = avatarId.value
  const latestVersionId = currentAvatar.value?.latestVersionId
  router.push({
    name: 'AvatarCreate',
    query: {
      ...(agentId ? { agentId } : {}),
      ...(latestVersionId != null ? { latestVersionId: String(latestVersionId) } : {}),
    },
  })
}

/** 从「我的上传」跳转到市场详情页查看 */
function goToMarketDetail() {
  const item = currentVersionItem.value
  const id = item?.marketAgentId ?? avatarId.value
  const versionId = item?.marketVersionId ?? item?.versionId
  router.push({
    name: 'AvatarDetail',
    params: { id: String(id) },
    query: versionId != null ? { versionId: String(versionId) } : {},
  })
}

/** 删除所有版本（删除整个数字人） */
function handleDeleteAllVersions() {
  const agentNumericId = Number(avatarId.value)
  if (!Number.isFinite(agentNumericId) || agentNumericId <= 0) {
    ElMessage.error('无法解析数字人 ID，请返回列表重试')
    return
  }

  deleteDialogTitle.value = '确认删除当前数字人？'
  deleteDialogContent.value = '删除后该数字人所有版本将在市场同步下架，无法被搜索访问，且操作不可撤回，请谨慎操作。'
  pendingDeleteData.value = { agentNumericId }
  confirmDialogRef.value?.open()
}

function versionIsPublished(item) {
  return String(item.status ?? '').toLowerCase() === 'online'
}

function isVersionDraft(item) {
  return String(item.status ?? '').toLowerCase() === 'draft'
}

function isVersionRejected(item) {
  return String(item.status ?? '').toLowerCase() === 'reject'
}

function isVersionTesting(item) {
  return String(item.status ?? '').toLowerCase() === 'testing'
}

function isVersionOffline(item) {
  return String(item.status ?? '').toLowerCase() === 'offline'
}

/** 可上架：未发布、已下线、已驳回 */
function canShelfUp(item) {
  const st = String(item.status ?? '').toLowerCase()
  return st === 'draft' || st === 'offline' || st === 'reject'
}

/** 可下架：已发布 */
function canShelfDown(item) {
  return versionIsPublished(item)
}

function isShelfActionDisabled(item) {
  return String(item.status ?? '').toLowerCase() === 'testing'
}

function handleShelfToggle(item) {
  if (isShelfActionDisabled(item)) {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  if (versionIsPublished(item)) {
    handleVersionUnpublish(item)
  } else {
    handleVersionPublish(item)
  }
}

function handleVersionPublish(item) {
  if (isVersionTesting(item)) {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  pendingShelfVersion.value = item
  publishDialogRef.value?.open()
}

function handleVersionUnpublish(item) {
  if (isVersionTesting(item)) {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  pendingShelfVersion.value = item
  unpublishDialogRef.value?.open()
}

async function handleConfirmPublish() {
  const item = pendingShelfVersion.value
  if (!item) return
  await doShelfAction(item, true, '发布成功')
  pendingShelfVersion.value = null
}

async function handleConfirmUnpublish() {
  const item = pendingShelfVersion.value
  if (!item) return

  const raw = currentAvatar.value?.raw
  const agentNumericId = Number(raw?.id)
  const versionId = item.versionId

  if (!Number.isFinite(agentNumericId) || versionId == null) {
    ElMessage.error('无法解析版本信息')
    pendingShelfVersion.value = null
    return
  }

  try {
    await offlineAgentVersion(agentNumericId, versionId)
    ElMessage.success('下架成功')
    await loadDetail()
  } catch (e) {
    console.error(e)
    ElMessage.error('下架失败')
  } finally {
    pendingShelfVersion.value = null
  }
}

async function doShelfAction(item, isPublic, successMsg = '操作成功') {
  const raw = currentAvatar.value?.raw
  const agentNumericId = Number(raw?.id)
  if (!Number.isFinite(agentNumericId)) {
    ElMessage.error('无法解析数字人 ID')
    return
  }
  try {
    await setAgentVisibility(agentNumericId, isPublic)
    ElMessage.success(successMsg)
    await loadDetail()
  } catch (e) {
    console.error(e)
    ElMessage.error('操作失败')
  }
}

function versionDeleteTooltip(item) {
  if (isVersionTesting(item)) return '审核中，暂不可删除'
  return '删除'
}

function isVersionDeleteDisabled(item) {
  return isVersionTesting(item)
}

function handleVersionEdit(item) {
  const agentNumericId = Number(avatarId.value)
  if (!Number.isFinite(agentNumericId) || agentNumericId <= 0) {
    ElMessage.error('无法解析数字人 ID，请返回列表重试')
    return
  }
  const versionId = item.versionId
  if (versionId == null) {
    ElMessage.error('无法获取版本 ID')
    return
  }
  router.push({
    name: 'AvatarEdit',
    params: { id: String(agentNumericId) },
    query: {
      editVersionId: String(versionId),
      editVersion: String(item.version || '').replace(/^v/i, ''),
      from: 'my-uploads',
    },
  })
}

/**
 * 与「我的上传」UploadAgentDetail 中 delete 行为一致：接口按 Agent 维度，确认后删除并回列表
 */
function handleVersionDelete(item) {
  // if (isVersionDeleteDisabled(item)) {
  //   ElMessage.warning('已经在审核中啦~')
  //   return
  // }
  const agentNumericId = Number(avatarId.value)
  if (!Number.isFinite(agentNumericId) || agentNumericId <= 0) {
    ElMessage.error('无法解析数字人 ID，请返回列表重试')
    return
  }
  const verLabel = String(item.version || '').replace(/^v/i, '') || item.rawVersion || ''
  const versionId = item.versionId

  deleteDialogTitle.value = `确认删除版本 v${verLabel}？`
  deleteDialogContent.value = '删除后该版本将在市场同步下架，无法被搜索访问，且操作不可撤回，请谨慎操作。'
  pendingDeleteData.value = { agentNumericId, versionId }
  versionDeleteDialogRef.value?.open()
}

async function handleConfirmDelete() {
  const { agentNumericId } = pendingDeleteData.value || {}
  if (!agentNumericId) return

  try {
    await deleteAgent(agentNumericId)
    ElMessage.success('删除成功')
    router.push({ name: 'MarketAvatar' })
  } catch (e) {
    console.error('[AvatarDetailView] deleteAgent failed:', e)
    ElMessage.error('删除失败')
  } finally {
    pendingDeleteData.value = null
  }
}

async function handleConfirmDeleteVersion() {
  const { agentNumericId, versionId } = pendingDeleteData.value || {}
  if (!agentNumericId || versionId == null) return

  try {
    await deleteAgentVersion(agentNumericId, versionId)
    ElMessage.success('版本删除成功')
    const remaining = currentAvatar.value.versions.filter((v) => v.versionId !== versionId)

    // 只有 1 个版本：删除后回数字人市场列表
    if (remaining.length === 0) {
      router.push({ name: 'MarketAvatar' })
      return
    }

    // 有多个版本：删除后刷新详情接口
    const deletedIndex = currentAvatar.value.versions.findIndex((v) => v.versionId === versionId)
    let targetVersion = null

    if (selectedVersionId.value === versionId) {
      // 删的是当前选中版本：选中下一个（如果是最后一个则选第一个）
      targetVersion = remaining[deletedIndex] ?? remaining[0]
    } else {
      // 删的不是当前选中版本：保持当前选中
      targetVersion = remaining.find((v) => v.versionId === selectedVersionId.value) || remaining[0]
    }

    await loadDetail('', false, targetVersion.versionId)
  } catch (e) {
    console.error('[AvatarDetailView] deleteAgentVersion failed:', e)
    ElMessage.error('版本删除失败')
  } finally {
    pendingDeleteData.value = null
  }
}

function handleSkillOpen(skill) {
  /** 详情页 GET /skills/:slug 使用 slug；与 SkillMarketView.goToDetail 一致 */
  const slug = String(skill?.slug ?? '').trim()
  const legacyId = skill?.id != null ? String(skill.id).trim() : ''
  const routeId = slug || legacyId
  if (!routeId) return
  const cover = String(skill?.coverUrl || COVER_FALLBACK).trim() || COVER_FALLBACK

  const name = currentAvatar.value?.name || `数字人 ${avatarId.value}`
  const version = currentAvatar.value?.version || ''
  const currentHistory = router.options.history.state.breadcrumbHistory || []

  // 构建新的历史：保留当前历史 + 添加当前详情页（带 to）
  const newHistory = currentHistory.length > 0
    ? [
      ...currentHistory,
      { label: `${name} ${version} 详情`.trim(), to: `/market/avatar/${avatarId.value}` },
    ]
    : [
      { label: '数字人市场', to: '/market/avatar' },
      { label: `${name} ${version} 详情`.trim(), to: `/market/avatar/${avatarId.value}` },
    ]

  router.push({
    name: 'SkillDetail',
    params: { id: routeId },
    state: {
      skillHeroCover: cover,
      skillHeroForSlug: routeId,
      breadcrumbHistory: newHistory,
    },
  })
}

function onCapabilityCollectChange({ id, collected }) {
  const capability = currentAvatar.value?.capabilities?.find(item => item.id === id)
  if (capability) capability.isCollected = collected
}

function onCapabilityHired({ avatar }) {
  if (!avatar?.id || !currentAvatar.value?.capabilities?.length) return
  const cap = currentAvatar.value.capabilities.find((item) => item.id === avatar.id)
  if (cap) cap.isHired = true
}

async function handleVersionChange(item) {
  const nextVersionId = item?.versionId
  if (nextVersionId == null) return
  if (nextVersionId === selectedVersionId.value) return

  await loadDetail('', false, nextVersionId)
}

function formatDate(dateValue) {
  if (!dateValue) return ''

  let date
  if (typeof dateValue === 'string') {
    date = new Date(dateValue)
  } else {
    date = new Date(Number(dateValue))
  }

  if (Number.isNaN(date.getTime())) return String(dateValue)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function cloneFallbackDetail(id) {
  const item = fallbackAvatarList.find(entry => entry.id === id)
  return item ? JSON.parse(JSON.stringify(item)) : null
}

function mapSkill(skill, index) {
  const skillTags = Array.isArray(skill.tags) ? skill.tags : []
  const slug = String(skill.slug ?? '').trim()
  const legacyId = skill.id != null ? String(skill.id).trim() : ''
  /** 路由与 SkillDetail 使用 slug；无 slug 时退回数字 id */
  const routeKey = slug || legacyId || `skill-${index}`

  const ver = skill.version != null ? String(skill.version).trim() : ''
  const versionLabel =
    ver && !/^v\d/i.test(ver) && /^\d/.test(ver) ? `v${ver}` : ver

  const displayName = String(skill.displayName || '').trim()
  const legacyName = String(skill.name || '').trim()
  const title = displayName || legacyName || slug || '未命名 Skill'

  const ownerName = String(skill.ownerName || '').trim()
  const orgFromAuthor =
    skill.author?.displayName || skill.author?.name || skill.author?.handle || ''

  return {
    id: routeKey,
    slug: slug || legacyId,
    displayName: title,
    name: title,
    version: versionLabel || 'v1.0.0',
    tags: skillTags,
    sourceOrg: ownerName || orgFromAuthor,
    summary: String(skill.summary || skill.description || '').trim(),
    description: String(skill.summary || skill.description || '').trim(),
    stats_hires: Number(skill.stats_hires ?? skill.installCount) || 0,
    statsStars: Number(skill.statsStars ?? skill.stars) || 0,
    installed: Number(skill.stats_hires) || 0,
    favorites: Number(skill.statsStars ?? skill.stars) || 0,
    coverUrl: resolveSkillCoverForCard(skill.coverUrl || skill.avatar || skill.image || skill.icon),
  }
}

function mapCapability(capability, index) {
  if (typeof capability === 'string') {
    return {
      id: `capability-${index}`,
      name: capability,
      version: '',
      qualityLevel: '能力概览',
      extraTagCount: 0,
      sourceOrg: '',
      description: '',
      avatar: '',
      installed: 0,
      favorites: 0,
      isCollected: false,
      isHired: false,
    }
  }

  const tags = Array.isArray(capability?.tags) ? capability.tags : []
  const nestedCapabilities = Array.isArray(capability?.capabilities) ? capability.capabilities : []

  return {
    id: String(capability?.id || `capability-${index}`),
    name: capability?.displayName || capability?.name || `能力 ${index + 1}`,
    version: capability?.latestVersion?.version
      ? `v${String(capability.latestVersion.version).replace(/^v/i, '')}`
      : capability?.version
        ? `v${String(capability.version).replace(/^v/i, '')}`
        : '',
    qualityLevel: tags[0] || '-',
    extraTagCount: nestedCapabilities.length || Math.max(tags.length - 1, 0),
    sourceOrg: capability?.official ? '技术中心运营' : '',
    description: capability?.summary || capability?.description || capability?.functions || '',
    avatar: capability?.avatar || capability?.author?.avatar || '',
    installed: capability?.stats_hires || 0,
    favorites: capability?.statsStars || 0,
    isCollected: !!capability?.isFollowed,
    isHired: !!capability?.isInstalled,
    raw: capability,
  }
}

function versionItemStatusMeta(item) {
  if (!item || typeof item !== 'object') return null
  const st = item.status != null ? String(item.status).trim().toLowerCase() : ''

  if (st === 'online') return { text: '已发布', mod: 'published' }
  if (st === 'draft') return { text: '未发布', mod: 'unpublished' }
  if (st === 'testing') return { text: '审核中', mod: 'reviewing' }
  if (st === 'reject') return { text: '已驳回', mod: 'rejected' }
  if (st === 'offline') return { text: '已下线', mod: 'offline' }
  return null
}

function mapVersion(version, index, marketAgentId = null) {
  const versionValue = version.version || ''
  const vid = version.id ?? version.version_id ?? null
  const row = {
    cardKey: vid != null ? `ver-${vid}` : `ver-idx-${index}`,
    versionId: vid != null ? vid : null,
    marketAgentId: marketAgentId ?? null,
    marketVersionId: version.market_version_id ?? null,
    version: versionValue || 'v1.0.0',
    rawVersion: String(versionValue).replace(/^v/i, ''),
    isNew: index === 0,
    status: version.status || null,
    reviewStatus: version.reviewStatus || null,
    statusLabel: version.statusLabel || null,
    statusColor: version.statusColor || null,
    statusBgColor: version.statusBgColor || null,
    rejectReason: version.rejection || version.rejectReason || null,
    publisher: version.ownerName || version.author || '',
    date: formatDate(version.createdAt || version.updatedAt),
    summary: version.changelog || '-',
    stats_hires: Number(version.stats_hires ?? 0),
  }

  const statusMeta = row.statusLabel
    ? {
      text: row.statusLabel,
      mod: versionItemStatusMeta(row)?.mod ?? 'default',
      color: row.statusColor || undefined,
      bgColor: row.statusBgColor || undefined,
    }
    : versionItemStatusMeta(row)

  return { ...row, statusMeta }
}

function mapAgentDetailResponse(payload) {
  const entity = payload || {}
  if (!entity || typeof entity !== 'object') return null

  const tags = Array.isArray(entity.tags) ? entity.tags : []
  const skills = Array.isArray(entity.skills) ? entity.skills : []
  const rawVersions = Array.isArray(entity.versions) ? entity.versions : []

  return {
    id: String(entity.id || avatarId.value),
    name: entity.display_name || entity.name || '',
    version: entity.latest_version_label || '',
    avatar: entity.avatar_url || '',
    qualityLevel: tags[0] || '',
    extraTagCount: Math.max(tags.length - 1, 0),
    extraTagLabels: tags.slice(1),
    tags,
    author: entity.author || '',
    updatedAt: formatDate(entity.updated_at || entity.updatedAt),
    stats_hires: entity.stats_hires || 0,
    favorites: entity.stats_stars || 0,
    isCollected: !!entity.favorited,
    isHired: !!(entity.isInstalled ?? entity.is_installed),
    description: entity.description || '',
    changelog: entity.changelog || '',
    simulatedConversationUrl: entity.simulatedConversationUrl || '',
    relatedSkills: skills.map(mapSkill),
    skillsInfo: Array.isArray(entity.skillsInfo) ? entity.skillsInfo
      : Array.isArray(entity.skills_info) ? entity.skills_info : [],
    hiresInfos: Array.isArray(entity.hires_infos) ? entity.hires_infos : [],
    versions: rawVersions.map((v, i) => mapVersion(v, i, entity.market_agent_id ?? null)),
    latestVersionId: entity.latest_version_id ?? null,
    raw: entity,
  }
}

function mergeDetailWithFallback(detail, fallback) {
  if (!detail) return fallback
  if (!fallback) return detail

  return {
    ...fallback,
    ...detail,
    relatedSkills: detail.relatedSkills?.length ? detail.relatedSkills : fallback.relatedSkills,
    versions: detail.versions?.length ? detail.versions : fallback.versions,
  }
}

function mapHiredAgent(item) {
  const tags = Array.isArray(item.tags) ? item.tags : []
  return {
    id: String(item.agentId || item.id || ''),
    name: item.agentname || item.displayName || item.name || '',
    version: item.version ? `v${String(item.version).replace(/^v/i, '')}` : '',
    qualityLevel: tags[0] || '',
    extraTagCount: Math.max(tags.length - 1, 0),
    sourceOrg: item.official ? '技术中心运营' : '',
    description: item.summary || item.description || '',
    avatar: item.avatar || '',
    installed: item.stats_hires || 0,
    favorites: item.statsStars || 0,
    isCollected: !!item.isFollowed,
    isHired: true,
    tags,
    raw: item,
  }
}

/** 与 GET .../installed/agents/{id} 路径参数一致，使用市场 Agent 数字 id */
async function loadHiredAgents(agentId) {
  if (!agentId) return
  try {
    const res = await getHiredAgents(agentId)
    const items = Array.isArray(res) ? res : (res?.items || res?.list || [])
    hiredAgents.value = items.map(mapHiredAgent)
  } catch (error) {
    console.error('[AvatarDetailView] getHiredAgents failed:', error)
    hiredAgents.value = []
  }
}

/**
 * 计算应选中的版本 id：优先取显式指定，其次取 latestVersionId，最后兜底首项
 */
function resolveSelectedVersionId(preferredVersionId) {
  const versions = currentAvatar.value?.versions || []
  if (!versions.length) return null
  if (preferredVersionId != null && versions.some((v) => v.versionId === preferredVersionId)) {
    return preferredVersionId
  }
  const latestId = currentAvatar.value?.latestVersionId
  if (latestId != null && versions.some((v) => v.versionId === latestId)) {
    return latestId
  }
  return versions[0]?.versionId ?? null
}

/** 切换版本：重新请求详情，版本列表从新响应取 */
async function loadDetail(version = '', silent = false, preferredVersionId = null) {
  const fallback = cloneFallbackDetail(avatarId.value)
  let fallbackVersionId = null
  if (!preferredVersionId && selectedVersionId.value != null) {
    const cur = currentAvatar.value?.versions?.find((v) => v.versionId === selectedVersionId.value)
    if (cur) fallbackVersionId = cur.versionId
  }
  const requestVersionId = preferredVersionId ?? fallbackVersionId

  if (!silent) detailLoading.value = true
  try {
    const res = await fetchAgentDetail(avatarId.value, {
      marketplace: !isFromMyUploads.value,
      ...(requestVersionId != null ? { version_id: requestVersionId } : {}),
    })
    const mapped = mapAgentDetailResponse(res)
    currentAvatar.value = mergeDetailWithFallback(mapped, fallback)
    selectedVersionId.value = resolveSelectedVersionId(preferredVersionId, '')
    const installedAgentId = String(res?.name ?? '').trim()
    // await loadHiredAgents(installedAgentId)
  } catch (error) {
    console.error('[AvatarDetailView] fetchAgentDetail failed:', error)
    currentAvatar.value = fallback
    selectedVersionId.value = resolveSelectedVersionId(null, '')
  } finally {
    if (!silent) detailLoading.value = false
  }
}

/** 初始化：请求详情，版本列表直接从详情响应的 versions 字段取 */
async function initDetail() {
  const fallback = cloneFallbackDetail(avatarId.value)
  detailLoading.value = true
  try {
    const versionId = route.query.versionId ? Number(route.query.versionId) : null
    const res = await fetchAgentDetail(avatarId.value, {
      marketplace: !isFromMyUploads.value,
      ...(versionId != null ? { version_id: versionId } : {})
    })
    const mapped = mapAgentDetailResponse(res)
    currentAvatar.value = mergeDetailWithFallback(mapped, fallback)
    selectedVersionId.value = resolveSelectedVersionId(versionId, '')
    const installedAgentId = String(res?.name ?? '').trim()
    // await loadHiredAgents(installedAgentId)
  } catch (error) {
    console.error('[AvatarDetailView] initDetail failed:', error)
    currentAvatar.value = fallback
    selectedVersionId.value = resolveSelectedVersionId(null, '')
  } finally {
    detailLoading.value = false
  }
}

function loadMoreVersions() {
  if (!currentAvatar.value) return
  if (visibleVersionCount.value >= currentAvatar.value.versions.length) return
  visibleVersionCount.value += VERSION_BATCH_SIZE
}

function handleVersionScroll(event) {
  const target = event.target
  if (!target) return

  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  if (distanceToBottom < 60) {
    loadMoreVersions()
  }
}

watch(
  avatarId,
  async () => {
    visibleVersionCount.value = VERSION_BATCH_SIZE
    selectedVersionId.value = null
    if (versionPaneRef.value) versionPaneRef.value.scrollTop = 0
    await initDetail()
  },
  { immediate: true }
)
watch(isFromMyUploads, () => {
  initDetail()
})
</script>

<style lang="scss" scoped>
.avatar-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #ffffff;
}

.detail-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.scroll-pane {
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
}

.detail-main {
  flex: 1;
  min-width: 0;
  padding: 18px 14px 28px 20px;
}

.detail-side {
  width: 264px;
  flex-shrink: 0;
  padding: 18px 16px 24px;
  border-left: 1px solid #ECEEF3;
}

.hero-card {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.hero-meta {
  display: flex;
  flex: 1 1 auto;
  gap: 14px;
  min-width: 0;
}

.hero-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: visible;
  flex-shrink: 0;
  // background: linear-gradient(135deg, #f0eaff 0%, #fbf8ff 100%);
  // border: 1px solid rgba(132, 120, 250, 0.18);
  position: relative;
}

.hero-avatar__img,
.hero-avatar__placeholder {
  width: 100%;
  height: 100%;
}

.hero-avatar__img {
  object-fit: cover;
  border-radius: 50%;
}

.hero-hired-badge {
  position: absolute;
  left: -8px;
  bottom: -8px;
  width: 51px;
  height: 30px;
  z-index: 2;
}

.hero-avatar__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: #8478fa;
}

.hero-content {
  min-width: 0;
}

.hero-title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.hero-title {
  font-family: PingFang SC;
  margin: 0;
  font-weight: 500;
  line-height: 28px;
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}

.hero-version {
  font-size: 13px;
  color: #91949e;
}

.hero-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

/* 与 AvatarCard .card-tags / .tag 视觉对齐 */
.hero-tags__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.hero-tags__chips .tag {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  color: #606572;
  white-space: nowrap;
}

.hero-tags__chips .tag-quality {
  background: #eceef3;
}

.hero-tags__chips .tag-extra {
  background: #eceef3;
  cursor: pointer;
}

.hero-publisher {
  margin: 0;
  font-size: 13px;
  line-height: 22px;
  color: #91949e;
}

.hero-publisher__name {
  color: #606572;
}

.hero-side {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  flex-shrink: 0;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 6px;
}

.hero-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #606572;
}

.hero-stat-icon {
  display: block;
  flex-shrink: 0;
  object-fit: contain;
}

.hero-stat-icon--download {
  width: 14px;
  height: 14px;
}

.hero-stat-icon--star {
  width: 14px;
  height: 14px;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-action-btn.market-custom-button {
  height: 34px;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.hero-action-btn--hire .avatar-hire-button.market-custom-button {
  min-width: 72px;
  height: 34px;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 8px;
}

.content-section {
  margin-bottom: 28px;
}

.section-title {
  position: relative;
  margin: 0 0 18px;
  padding-left: 8px;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  text-align: justify;
  /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 5px;
    width: 3px;
    height: 14px;
    border-radius: 99px;
    background: #FF684E;
  }
}

.section-block {
  margin-bottom: 22px;
}

.empty-skills {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: #91949e;
}

/* ── 效能 / 用量 ── */
.eff-lock,
.eff-hint {
  font-size: 12px;
  font-weight: 400;
  color: #a0a4b0;
  margin-left: 8px;
}

.eff-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 22px;
}

.eff-kpi {
  border: 1px solid #eceef3;
  border-radius: 12px;
  padding: 14px 16px;
}

.eff-kpi__label {
  font-size: 12px;
  color: #91949e;
  margin-bottom: 8px;
}

.eff-kpi__value {
  font-size: 24px;
  font-weight: 700;
  color: #2f3547;
  line-height: 1;
}

.eff-kpi__unit {
  font-size: 13px;
  font-weight: 500;
  color: #606572;
  margin-left: 2px;
}

.eff-kpi__delta {
  font-size: 12px;
  color: #91949e;
  margin-top: 6px;
}

.eff-kpi__delta.up {
  color: #24bcad;
}

.eff-subtitle {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
  margin: 6px 0 12px;
}

.eff-table {
  border: 1px solid #eceef3;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 22px;
}

.eff-tr {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  align-items: center;
  padding: 11px 16px;
  font-size: 13px;
  color: #2f3547;
  border-bottom: 1px solid #f2f3f5;
}

.eff-tr:last-child {
  border-bottom: none;
}

.eff-tr--head {
  background: #fafbfc;
  color: #91949e;
  font-size: 12px;
}

.eff-tr--caller {
  grid-template-columns: 0.5fr 1.6fr 1.4fr 1fr 0.8fr;
}

.eff-tr--ext {
  background: #fbfaff;
}

.eff-rate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.eff-led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.eff-led--r {
  background: #ed4543;
}

.eff-led--y {
  background: #f5b400;
}

.eff-led--g {
  background: #24bcad;
}

.eff-dept {
  color: #91949e;
}

.eff-ext {
  font-style: normal;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f1ebff;
  color: #a070ff;
  margin-left: 6px;
}

.eff-issues {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eff-issue {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid #eceef3;
  border-radius: 12px;
}

.eff-issue__rank {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: #fef0f0;
  color: #ed4543;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.eff-issue__title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #2f3547;
}

.eff-issue__count {
  font-size: 12px;
  color: #91949e;
  white-space: nowrap;
}

.eff-issue__btn {
  border: none;
  background: transparent;
  color: #436ff6;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

/* ── 详情/效能/用量 Tab ── */
.up-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid #eceef3;
}

.up-tab {
  position: relative;
  padding: 10px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #91949e;
  cursor: pointer;
  font-family: inherit;
}

.up-tab:hover {
  color: #606572;
}

.up-tab.active {
  color: #2f3547;
  font-weight: 600;
}

.up-tab.active::after {
  content: '';
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: #ff684e;
}

.up-pane__hint {
  font-size: 12px;
  color: #a0a4b0;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 18px;
}

/* 趋势柱 */
.trend {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 110px;
  padding: 18px 4px 0;
}

.trend__bar {
  flex: 1;
  min-width: 0;
  background: linear-gradient(180deg, #ffb4a3, #ff684e);
  border-radius: 3px 3px 0 0;
  position: relative;
  transition: opacity 0.15s;
}

.trend--blue .trend__bar {
  background: linear-gradient(180deg, #9cc4ff, #436ff6);
}

.trend__bar--mark {
  background: linear-gradient(180deg, #ffd54a, #ff9a3e);
}

.trend__bar:hover {
  opacity: 0.8;
}

.trend__bar:hover .trend__tip {
  opacity: 1;
}

.trend__tip {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #606572;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s;
}

.trend__axis {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #91949e;
}

.trend__axis-mark {
  color: #ff9a3e;
}

/* 服务贡献 */
.contrib {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
  background: linear-gradient(120deg, #eef3ff, #f5f1ff);
  border: 1px solid #e0e7ff;
  border-radius: 14px;
  padding: 18px 22px;
}

.contrib__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.contrib__stat b {
  font-size: 26px;
  font-weight: 800;
  color: #4f63d8;
  line-height: 1;
}

.contrib__stat span {
  font-size: 12px;
  color: #6b7894;
}

.contrib__note {
  margin-left: auto;
  max-width: 280px;
  font-size: 13px;
  line-height: 1.6;
  color: #3a4663;
}

.contrib__note i {
  display: block;
  margin-top: 6px;
  font-style: normal;
  font-size: 11px;
  color: #9aa6c4;
}

/* 表格变体 */
.eff-tr--skill {
  grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr;
}

.eff-tr--detail {
  grid-template-columns: 0.9fr 1.2fr 1.2fr 1fr 0.8fr;
}

.eff-status {
  font-style: normal;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.eff-status--g {
  background: #eefcfa;
  color: #24bcad;
}

.eff-status--y {
  background: #fffaeb;
  color: #f5b400;
}

.eff-status--r {
  background: #fef0f0;
  color: #ed4543;
}

/* ── V1/V2 模式切换 ── */
.up-pane__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.up-pane__bar .up-pane__hint {
  margin-bottom: 0;
  flex: 1;
}

.eff-mode {
  display: flex;
  background: #f2f3f5;
  border-radius: 8px;
  padding: 2px;
  flex-shrink: 0;
}

.eff-mode button {
  border: none;
  background: transparent;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #606572;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.eff-mode button.active {
  background: #fff;
  color: #ff684e;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(47, 53, 71, 0.1);
}

.eff-mode-note {
  font-size: 12px;
  color: #91949e;
  margin-bottom: 18px;
  padding-left: 2px;
}

/* 判定来源标签 */
.eff-src {
  font-style: normal;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 8px;
  vertical-align: middle;
}

.eff-src--rule {
  background: #eceef3;
  color: #606572;
}

.eff-src--ai {
  background: #f1ebff;
  color: #a070ff;
}

.eff-th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.eff-kpi--clickable {
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.eff-kpi--clickable:hover {
  border-color: rgba(255, 104, 78, 0.4);
}

.eff-kpi--active {
  border-color: #ff684e;
  box-shadow: 0 2px 8px rgba(255, 104, 78, 0.12);
}

.usage-trend-head {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
  margin: 18px 0 4px;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 4px 0;
}

.pager__info {
  font-size: 12px;
  color: #91949e;
}

.pager .eff-issue__btn:disabled {
  color: #c1c5cf;
  cursor: not-allowed;
}

.eff-th:hover {
  color: #2f3547;
}

/* ── 失败案例抽屉 ── */
.case-mask {
  position: fixed;
  inset: 0;
  background: rgba(47, 53, 71, 0.32);
  z-index: 2000;
}

.case-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 440px;
  max-width: 92vw;
  background: #f7f8fa;
  box-shadow: -8px 0 24px rgba(47, 53, 71, 0.14);
  z-index: 2001;
  display: flex;
  flex-direction: column;
}

.case-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #eceef3;
}

.case-drawer__title {
  font-size: 15px;
  font-weight: 600;
  color: #2f3547;
}

.case-drawer__close {
  border: none;
  background: #f2f3f5;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 14px;
  color: #606572;
  cursor: pointer;
}

.case-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
}

.case-item {
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
}

.case-item__meta {
  margin-bottom: 10px;
}

.case-item__meta .eff-src {
  margin-left: 0;
}

.case-bubble {
  max-width: 92%;
  padding: 9px 13px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 8px;
}

.case-bubble--u {
  background: #ff684e;
  color: #fff;
  margin-left: auto;
  border-bottom-right-radius: 3px;
}

.case-bubble--a {
  background: #f2f3f5;
  color: #2f3547;
  border-bottom-left-radius: 3px;
}

.case-verdict {
  margin-top: 10px;
  padding: 9px 12px;
  background: #fef0f0;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #b42318;
}

.case-drawer__foot {
  margin: 4px 0 12px;
  text-align: center;
  font-size: 12px;
  color: #a0a4b0;
}

/* 抽屉统计条 */
.case-stats {
  display: flex;
  align-items: center;
  gap: 22px;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 16px;
}

.case-stats__item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.case-stats__item b {
  font-size: 18px;
  font-weight: 700;
  color: #2f3547;
  line-height: 1.2;
  white-space: nowrap;
}

.case-stats__item span {
  font-size: 11px;
  color: #91949e;
}

.case-stats__src {
  margin-left: auto;
}

.case-list-label {
  font-size: 13px;
  font-weight: 600;
  color: #2f3547;
  margin-bottom: 10px;
}

.case-list-label span {
  font-size: 11px;
  font-weight: 400;
  color: #a0a4b0;
  margin-left: 6px;
}

/* 失败记录行 */
.case-rec {
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 10px;
  margin-bottom: 8px;
  overflow: hidden;
}

.case-rec.open {
  border-color: rgba(255, 104, 78, 0.4);
}

.case-rec__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 12px;
}

.case-rec__row:hover {
  background: #f7f8fa;
}

.case-rec__time {
  color: #91949e;
  flex-shrink: 0;
  white-space: nowrap;
}

.case-rec__user {
  color: #606572;
  flex-shrink: 0;
  white-space: nowrap;
}

.case-rec__skill {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #eceef3;
  color: #606572;
  white-space: nowrap;
}

.case-rec__q {
  flex: 1;
  min-width: 0;
  color: #2f3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.case-rec__arrow {
  color: #c1c5cf;
  flex-shrink: 0;
}

.case-rec__detail {
  padding: 12px 14px 14px;
  border-top: 1px solid #f2f3f5;
  background: #fafbfc;
}

.block-label {
  margin-bottom: 10px;
  font-size: 14px;
  line-height: 22px;
  color: #91949e;
}

.block-text {
  margin: 0;
  font-size: 14px;
  line-height: 24px;
  color: #2f3547;
}

.case-image-wrap {
  margin-left: -16px;
  padding-left: 0;
  border: none;
  box-shadow: none;
  padding-left: 17px;
}

.case-image {
  display: block;
  width: 290px;
  height: 246px;
  border-radius: 16px;
  box-sizing: border-box;
  border: 1px solid #ECEEF3;
  box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);
  overflow: hidden;

  :deep(.el-image-viewer__img) {
    max-width: 70% !important;
    max-height: 70% !important;
  }
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(296px, 1fr));
  gap: 16px;
}

.pkg-skill-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(318px, 1fr));
  gap: 12px;
}

.pkg-skill-item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  // width: 318px;
  border-radius: 16px;
  padding: 16px;
  background: #ffffff;
  box-sizing: border-box;
  border: 1px solid #eceef3;
  transition: all 0.2s ease;

  &:hover {
    border: 1px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);
  }
}

.pkg-skill-item__avatar {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
}

.pkg-skill-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pkg-skill-item__name {
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: #2F3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pkg-skill-item__desc {
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  color: #91949E;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.capabilities-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(280px, 1fr));
  column-gap: 12px;
  row-gap: 32px;
}

/* ---- 聘用概览 ---- */
.hires-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.hires-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #ECEEF3;
  transition: border 0.2s, box-shadow 0.2s;

  &:hover {
    border: 1px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);

    .hires-card__footer {
      opacity: 1;
    }
  }
}

.hires-card__top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.hires-card__media {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  margin: -32px 0 0;
  overflow: visible;
  position: relative;
  z-index: 1;
}

.hires-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hires-card__meta {
  min-width: 0;
  flex: 1;
}

.hires-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  min-width: 0;
  margin-bottom: 4px;
}

.hires-card__title {
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: #2f3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.hires-card__version {
  font-size: 12px;
  color: #91949e;
  flex-shrink: 0;
}

.hires-card__tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.hires-card__tag {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #606572;
  background: #eceef3;
  white-space: nowrap;
}

.hires-card__org {
  font-size: 12px;
  color: #91949e;
}

.hires-card__desc {
  flex: 1;
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 21px;
  color: #91949e;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hires-card__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.side-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.side-title {
  margin: 0 0 18px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  color: #2f3547;
}

.side-title--inline {
  margin: 0;
}

.version-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.version-action-icon {
  width: 24px;
  height: 24px;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(47, 53, 71, 0.06);
  }
}

.version-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  // border-top: 1px solid rgba(215, 218, 227, 0.6);
}

.version-card__footer-spacer {
  flex: 1;
  min-width: 0;
}

.version-card__icon-host {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.version-card__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 0;
  transition: opacity 0.15s;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.version-card__icon-img {
  display: block;
  width: 14px;
  height: 14px;
  object-fit: contain;
  cursor: pointer;

  &--disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.version-card__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-card {
  padding: 16px 16px;
  border-radius: 12px;
  background: rgba(247, 248, 250, 0.8);
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-card.is-clickable {
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.version-card.is-clickable:hover {
  background: #fff;
  border: 1px solid rgba(255, 104, 78, 0.5);
}

.version-card.is-active {
  background: #fff;
  border: 1px solid rgba(255, 104, 78, 0.5);
}

.version-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  // margin-bottom: 8px;
  gap: 8px;
}

.version-card__status {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  flex-shrink: 0;
  white-space: nowrap;
}

.version-card__status--unpublished {
  color: #f5b400;
  background: #fffaeb;
}

.version-card__status--published {
  color: #24bcad;
  background: #eefcfa;
}

.version-card__status--reviewing {
  color: #00b4e0;
  background: #ebfbff;
}

.version-card__status--rejected {
  color: #ed4543;
  background: #fef0f0;
}

.version-card__status--offline {
  color: #a070ff;
  background: #f1ebff;
}

.version-card__title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.version-card__title {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  text-align: justify;
  /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}

/** 与 SkillDetailView `.skill-detail__version-new-img` 一致：图内已含 NEW 文案 */
.version-card__new-img {
  display: block;
  flex-shrink: 0;
  width: 28px;
  height: 16px;
  object-fit: cover;
  transform: scale(1.2);
  transform-origin: center;
}

.version-card__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  // margin-bottom: 10px;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  text-align: justify;
  /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/三级文本色 */
  color: #91949E;
}

.version-card__meta-divider {
  display: inline-block;
  width: 1px;
  height: 12px;
  background: #D7DAE3;
  flex-shrink: 0;
  align-self: center;
}

.version-card__summary {
  margin: 0;
  font-size: 13px;
  font-weight: normal;
  line-height: 21px;
  text-align: justify;
  /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: 42px;
}

.version-card__hire-count {
  display: inline-flex;
  align-items: center;
  // gap: 4px;
  // margin-top: 12px;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  text-align: justify;
  /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 主色/橘-07 */
  color: #FF684E;
}

.version-card__hire-count-label,
.version-card__hire-count-value {
  color: inherit;
}

.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-empty__text {
  margin: 0;
  font-size: 14px;
  color: #606572;
}

@media (max-width: 900px) {
  .hero-card {
    flex-direction: column;
  }

  .hero-side {
    justify-content: space-between;
  }

  .related-grid {
    grid-template-columns: 1fr;
  }

  .capabilities-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style lang="scss">
.danger-confirm-dialog {
  .el-button--primary {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 5px 16px;
    border-radius: 6px;
    background: #ed4543;
    border-color: #ed4543;

    &:hover,
    &:focus {
      background: #ed4543;
      border-color: #ed4543;
    }
  }
}

@media (max-width: 1024px) {
  .detail-layout {
    flex-direction: column;
  }

  .detail-side {
    width: 100% !important;
    max-height: 40%;
    padding: 20px 0 0;
    border-left: none;
    border-top: 1px solid #e5e7eb;
  }
}
</style>