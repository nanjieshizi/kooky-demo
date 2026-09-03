<template>
  <div v-if="project" class="bridge-shell">
    <header class="bridge-header">
      <div class="bridge-title">
        <span>{{ isTaskConversation ? activeTask.title : project.name }}</span>
      </div>
      <div class="bridge-actions">
        <button type="button" :class="{ active: activePanel === 'plan' }" @click="activePanel = 'plan'">团队计划<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h8"/></svg></button>
        <button type="button" :class="{ active: activePanel === 'base' }" @click="activePanel = 'base'">{{ isTaskConversation ? '任务背景' : '协作背景' }}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg></button>
      </div>
    </header>

    <main class="bridge-body">
      <section class="bridge-conversation" aria-label="项目讨论">
        <div v-if="statePreview === 'ready'" ref="conversationScrollRef" class="conversation-scroll">
          <div v-if="!isTaskConversation && project.discussion.length === 0" class="bridge-conversation-empty" role="status">
            <strong>开始一次协作讨论</strong>
            <span>围绕项目目标发起对话，团队助理会帮助识别行动项并生成任务。</span>
          </div>
          <section v-if="isTaskConversation" class="task-conversation">
            <div class="task-conversation-context">
              <span>任务对话</span><b>{{ activeTask.title }}</b><small>挂载于 {{ project.name }} · 任务背景 v{{ project.snapshot.version }}</small>
            </div>
            <template v-for="item in activeTask.messages" :key="item.id">
              <div v-if="item.type === 'system'" class="system-event">{{ item.text }}</div>
              <article v-else class="bridge-message" :class="`is-${item.type}`">
                <div class="message-avatar"><img :src="item.type === 'user' ? ownerAvatar : assistantAvatar" :alt="item.type === 'user' ? '我' : '团队助理'" /></div>
                <div class="message-content">
                  <strong v-if="item.type !== 'user'">团队助理</strong>
                  <p>{{ item.text }}</p>
                  <div v-if="item.kind === 'file'" class="task-file-card"><span class="task-file-icon">M</span><div><strong>{{ item.file.name }}</strong><small>{{ item.file.type }} · {{ item.file.version }} · {{ item.file.status }}</small></div><button type="button">查看产物</button></div>
                </div>
              </article>
            </template>
            <section v-if="activeTask && activeTask.backfillDemoStep >= 1" class="task-backfill-card" :class="activeTaskBackfillState ? `is-${activeTaskBackfillState}` : ''">
              <header class="backfill-card-header"><div><div class="backfill-card-kicker"><strong>交付回填</strong><em>{{ activeBackfillMeta.label }}</em></div><small>{{ activeBackfillMeta.description }}</small></div></header>
              <div v-if="taskBackfillError" class="task-backfill-feedback is-error" role="alert">{{ taskBackfillError }}</div>
              <div v-if="taskBackfillSubmitting" class="task-backfill-feedback is-loading" role="status">正在提交并同步团队计划，请勿重复操作。</div>
              <div v-if="activeTaskBackfillState === 'pending_acceptance' || activeTaskBackfillState === 'accepted' || activeTaskBackfillState === 'project_backfilled'" class="task-backfill-outcome-shell"><div class="task-backfill-outcome" :class="`is-${activeTaskBackfillState}`"><strong>{{ activeBackfillMeta.outcomeTitle }}</strong><span>{{ activeBackfillMeta.outcomeDescription }}</span><button v-if="activeTaskBackfillState === 'accepted'" type="button" @click="syncTaskBackfill">回填至协作背景</button></div></div>
              <template v-if="activeBackfillEditable">
              <section class="backfill-section backfill-deliverable"><div class="backfill-section-heading"><div><span class="backfill-section-label">交付产物 <b>必填</b></span><small>用于接收方验收</small></div></div><div class="task-backfill-artifact"><div class="task-backfill-artifact-file" :class="{ 'is-empty': !activeTask.backfill.deliverable }"><span class="task-file-icon">M</span><div><strong>{{ activeTask.backfill.deliverable || '尚未添加交付产物' }}</strong><small>{{ activeTask.backfill.deliverable ? 'Markdown · v1 · 待提交' : '请从聊天文件中选择交付产物' }}</small></div><button v-if="activeTask.backfill.deliverable" type="button" class="task-backfill-artifact-remove" aria-label="移除交付产物" title="移除交付产物" @click="removeTaskBackfillArtifact">×</button></div><div class="task-backfill-artifact-actions"><button type="button" class="task-backfill-artifact-edit" aria-label="修改产物" title="从聊天文件中选择产物" @click="editingBackfillArtifact = !editingBackfillArtifact"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-1 4-4-1 1-4Z"/></svg></button></div></div><div v-if="editingBackfillArtifact" class="task-backfill-artifact-picker" role="listbox" aria-label="从聊天文件中选择交付产物"><span>选择聊天中的文件</span><button v-for="artifact in chatArtifacts" :key="artifact.id" type="button" role="option" :aria-selected="activeTask.backfill.deliverable === artifact.name" @click="selectTaskBackfillArtifact(artifact)"><span class="task-file-icon">M</span><span><strong>{{ artifact.name }}</strong><small>{{ artifact.type }} · {{ artifact.version }} · {{ artifact.status }}</small></span></button><small v-if="!chatArtifacts.length">当前对话暂无可选文件</small></div></section>
              <section class="backfill-section backfill-decision"><div class="backfill-section-heading"><div><span class="backfill-section-label">完成结果 <b>必填</b></span><small>选择最符合实际产出的状态</small></div></div><div class="completion-result"><div class="completion-result-labels" role="group" aria-label="完成结果"><button type="button" :class="{ active: completionResultValue === 0 }" :aria-pressed="completionResultValue === 0" @click="activeTask.backfill.completionResult = 0">已完成</button><button type="button" :class="{ active: completionResultValue === 1 }" :aria-pressed="completionResultValue === 1" @click="activeTask.backfill.completionResult = 1">部分完成</button><button type="button" :class="{ active: completionResultValue === 2 }" :aria-pressed="completionResultValue === 2" @click="activeTask.backfill.completionResult = 2">没完成</button></div><div class="completion-result-control" :style="{ '--completion-progress': completionResultValue === 0 ? '33.333%' : completionResultValue === 1 ? '66.666%' : '100%' }"><input v-model.number="activeTask.backfill.completionResult" class="completion-result-range" type="range" min="0" max="2" step="1" :aria-valuetext="completionResultInfo(activeTask.backfill.completionResult).label" aria-label="完成结果" /><span class="completion-result-control-label">{{ completionResultInfo(activeTask.backfill.completionResult).label }}</span></div><div class="completion-result-current" :class="`is-result-${completionResultValue}`"><strong>{{ completionResultInfo(activeTask.backfill.completionResult).label }}</strong><span>{{ completionResultInfo(activeTask.backfill.completionResult).description }}</span></div><div v-if="completionResultValue === 1" class="completion-result-fields"><label class="backfill-field"><span>已完成内容</span><textarea v-model="activeTask.backfill.completed" rows="2" placeholder="填写已完成的内容" /></label><label class="backfill-field"><span>未完成内容</span><textarea v-model="activeTask.backfill.incomplete" rows="2" placeholder="填写仍未完成的内容" /></label><label class="backfill-field"><span>下一步行动</span><textarea v-model="activeTask.backfill.nextAction" rows="2" placeholder="填写下一步处理方式" /></label></div><div v-else-if="completionResultValue === 2" class="completion-result-fields"><label class="backfill-field"><span>未完成原因</span><textarea v-model="activeTask.backfill.incompleteReason" rows="2" placeholder="填写未形成有效产出的原因" /></label><label class="backfill-field"><span>当前阻塞事项</span><textarea v-model="activeTask.backfill.blockers" rows="2" placeholder="填写当前阻塞事项" /></label><label class="backfill-field"><span>后续处理方式</span><textarea v-model="activeTask.backfill.nextAction" rows="2" placeholder="填写后续处理方式" /></label></div></div></section>
              <details class="backfill-extra"><summary>补充说明</summary><div><label class="backfill-field"><span>已知问题</span><textarea v-model="activeTask.backfill.issues" rows="2" placeholder="可填写未覆盖内容或后续风险" /></label><label class="backfill-field"><span>提交说明</span><textarea v-model="activeTask.backfill.effective" rows="2" placeholder="补充本次提交需要接收方关注的内容" /></label></div></details>
              <details class="backfill-section backfill-checklist"><summary class="backfill-section-heading"><div><span class="backfill-section-label">验收标准</span><small>提交后由接收方确认</small></div></summary><div class="backfill-checklist-items"><label v-for="item in acceptanceChecklist" :key="item.id"><input type="checkbox" disabled /><span>{{ item.statement }}</span></label></div></details>
              <footer class="backfill-card-footer"><div><button type="button" class="backfill-secondary" :disabled="taskBackfillSubmitting" @click="ignoreTaskBackfill">忽略</button><button type="button" class="backfill-primary" :disabled="taskBackfillSubmitting" @click="submitTaskBackfill">{{ taskBackfillSubmitting ? '正在提交…' : '提交并请求验收' }}</button></div></footer>
              </template>
            </section>
          </section>

          <template v-if="!isTaskConversation" v-for="item in project.discussion" :key="item.id">
            <div v-if="item.type === 'system'" class="system-event">{{ item.text }}</div>
            <article v-else class="bridge-message" :class="`is-${item.type}`">
              <div class="message-avatar"><img :src="item.type === 'user' ? ownerAvatar : assistantAvatar" :alt="item.type === 'user' ? '我' : '团队助理'" /></div>
              <div class="message-content">
                <strong v-if="item.type !== 'user'">{{ item.type === 'published' ? '项目回填' : item.type === 'echo' ? '执行回声' : '团队助理' }}</strong>
                <p>{{ item.text }}</p>
                <div v-if="item.kind === 'file'" class="task-file-card"><span class="task-file-icon">M</span><div><strong>{{ item.file.name }}</strong><small>{{ item.file.type }} · {{ item.file.version }} · {{ item.file.status }}</small></div><button type="button">查看产物</button></div>
              </div>
            </article>
          </template>

          <section v-if="!isTaskConversation && pendingTask" class="assignment-card" aria-label="当前任务快照">
            <header class="assignment-card-head">
              <div>
                <strong>调研任务分工</strong>
                <span :class="{ 'is-generating': project.phase !== 'draft' }" :aria-label="assignmentStatusLabel">
                  <template v-if="project.phase !== 'draft'">
                    <i v-for="(character, index) in assignmentStatusLabel" :key="`${character}-${index}`" :style="{ '--shimmer-index': index }" aria-hidden="true">{{ character }}</i>
                  </template>
                  <template v-else>{{ assignmentStatusLabel }}</template>
                </span>
              </div>
              <small>{{ project.phase === 'draft' ? '来自项目讨论 · 待确认' : `已生成 ${project.tasks.length} / 3 项` }}</small>
            </header>
            <div class="assignment-summary">
              <span class="assignment-summary-dot"></span>
              {{ project.phase === 'draft' ? `已基于任务背景 v${project.snapshot.version} 生成，确认后自动挂载项目并同步个人任务。` : `已生成 ${project.tasks.length} / 3 项任务。` }}
            </div>
            <article class="assignment-row assignment-snapshot-card">
              <span class="assignment-number">{{ String(project.tasks.indexOf(pendingTask) + 1).padStart(2, '0') }}</span>
              <div class="assignment-copy">
                <strong>{{ pendingTask.title }}</strong>
                <small v-if="pendingTask.goal">目标：{{ pendingTask.goal }}</small>
                <small v-if="pendingTask.deliverable">交付物：{{ pendingTask.deliverable }}</small>
                <small>{{ pendingTask.acceptance }}</small>
                <div class="assignment-meta"><span>{{ pendingTask.owner }}</span><span>{{ pendingTask.agent }}</span><span>{{ pendingTask.deadline }}</span></div>
              </div>
            </article>
            <footer v-if="pendingTask" class="assignment-actions">
              <button type="button" class="assignment-edit" @click="openAssignmentEditor">修改分工</button>
              <button v-if="!isEditingAssignments" type="button" class="assignment-confirm" @click="confirmCurrentTask">确认当前任务</button>
              <div v-else class="assignment-waiting" role="status"><i></i><span>当前任务修改中</span></div>
            </footer>
          </section>

          <section v-if="!isTaskConversation && (confirmedTasks.length || project.phase === 'planned')" class="project-task-list">
            <div class="section-heading">
              <span>项目任务</span>
              <small>{{ confirmedTasks.length }} 项 · 引用式挂载</small>
            </div>
            <article v-for="task in confirmedTasks" :key="task.id" class="task-row">
              <span class="task-state" :class="`is-${task.status}`"></span>
              <div><strong>{{ task.title }}</strong><small>{{ task.owner }} · {{ task.agent }} · {{ task.deadline }}</small></div>
              <span class="task-label">{{ task.status === 'done' ? '已完成' : task.status === 'in_progress' ? '执行中' : '待开始' }}</span>
            </article>
          </section>
        </div>
        <section v-else class="bridge-state-view" :class="`is-${statePreview}`" role="status" aria-live="polite">
          <template v-if="statePreview === 'loading'">
            <span class="bridge-state-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <strong>正在同步项目内容</strong>
            <p>正在加载讨论记录、任务状态与验收进度。</p>
            <div class="bridge-state-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
          </template>
          <template v-else-if="statePreview === 'error'">
            <span class="bridge-state-mark" aria-hidden="true">!</span>
            <strong>内容暂时未能加载</strong>
            <p>请检查网络后重新尝试；已编辑但未提交的内容不会丢失。</p>
            <small class="bridge-state-hint">可通过右侧团队计划的“更多 → 恢复正常”返回项目。</small>
          </template>
          <template v-else>
            <span class="bridge-state-mark" aria-hidden="true">⌁</span>
            <strong>你暂无查看此项目的权限</strong>
            <p>请联系项目负责人申请访问权限，或返回协作列表查看其他项目。</p>
            <small class="bridge-state-hint">可通过右侧团队计划的“更多 → 恢复正常”返回项目。</small>
          </template>
        </section>

        <form class="bridge-composer" @submit.prevent="sendDiscussion">
          <div class="bridge-composer-shell">
            <textarea v-model="messageText" rows="2" readonly placeholder=""></textarea>
            <div class="bridge-composer-bottom">
              <div class="bridge-composer-tools">
                <button type="button" aria-label="添加附件" title="添加附件">⌕</button>
                <button type="button" aria-label="技能" title="技能">✣</button>
              </div>
              <div class="bridge-composer-tools bridge-composer-tools--right">
                <button type="button" class="bridge-composer-pill"><span>♧</span> 思考 <i>⌄</i></button>
                <button type="button" class="bridge-composer-pill"><b>✳</b> Claude Opus 4.5 <i>⌄</i></button>
                <button type="submit" class="bridge-composer-send" :disabled="isTaskConversation ? activeTask.backfillDemoStep >= 1 : (!canAdvanceDemo || demoFlowIndex >= demoFlow.length)" :aria-label="demoFlowIndex >= demoFlow.length ? '演示完成' : '发送'"><span>➤</span></button>
              </div>
            </div>
          </div>
          <p class="bridge-composer-disclaimer">对话内容将由大模型处理，涉密及个人隐私信息请谨慎输入</p>
        </form>

      </section>

      <aside v-if="(isTaskConversation && ['plan', 'base'].includes(activePanel)) || (!isTaskConversation && (activePanel === 'plan' || activePanel === 'base' || isEditingAssignments))" class="bridge-panel">
        <template v-if="activePanel === 'base'">
          <header class="panel-head"><div><strong>{{ isTaskConversation ? '任务背景' : '协作背景' }}</strong><small>{{ isTaskConversation ? '当前任务引用的核心项目共识' : '当前项目长期共享的目标与协作规则' }}</small></div><div class="panel-head-actions"><button type="button" class="panel-close" aria-label="关闭侧边抽屉" title="关闭" @click="closeSidePanel">×</button><button type="button" class="base-detail-action" @click="openBaseEditor">{{ isTaskConversation ? '任务背景详情' : '协作背景详情' }}<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1-1-4Z"/></svg></button></div></header>
          <div class="base-card"><b>{{ isTaskConversation ? '任务背景' : '协作背景' }} v{{ project.snapshot.version }}</b><p>{{ project.snapshot.projectBase }}</p><small>已被 {{ project.tasks.length || 3 }} 个任务引用</small></div>
          <section class="base-preview-section"><span>项目目标</span><p>完成可追溯的任务桥 Demo 主流程，让讨论、执行与经验沉淀形成闭环。</p></section>
          <section class="base-preview-section"><span>阻塞约束</span><p>任务必须具备可验证交付物与验收标准。</p></section>
          <section class="base-preview-section"><span>团队成员</span><div class="base-member-stack" aria-label="团队成员头像"><span><img :src="memberAvatars.owner" alt="我" /></span><span><img :src="memberAvatars.research" alt="产品数字人" /></span><span><img :src="memberAvatars.design" alt="设计数字人" /></span><button type="button" class="base-member-add" aria-label="添加团队成员">+</button></div><div class="base-mini-people"><b>我 <small>项目负责人</small></b><b>产品数字人 <small>调研协作</small></b><b>设计数字人 <small>原型协作</small></b></div></section>
          <section class="base-preview-section"><span>AI 角色</span><div class="base-mini-people"><b>产品数字人 <small>收集证据并形成竞品结论</small></b><b>设计数字人 <small>产出核心流程与异常状态</small></b></div></section>
          <section class="base-preview-section"><span>工作约定</span><p>关键结论保留来源，进入评审后再沉淀。</p></section>
          <section class="base-preview-section"><span>关键决策</span><p>任务创建前必须确认快照；阻塞级约束自动带入。</p></section>
          <section class="base-preview-section"><span>方法论沉淀</span><p>调研先定比较维度，结论必须可回看来源。</p></section>
          <section class="base-preview-section"><span>本次引用</span><p>{{ project.snapshot.trigger }}</p></section>
          <div v-if="project.echoPublished" class="echo-success">执行回声已沉淀；下一次同类任务会自动携带这条经验。</div>
        </template>
        <template v-else-if="!isTaskConversation && pendingTask && isEditingAssignments">
          <header class="panel-head"><div><strong>确认任务快照</strong><small>来自项目讨论 · 任务背景 v{{ project.snapshot.version }}</small></div><div class="panel-head-actions"><button type="button" class="panel-close" aria-label="关闭侧边抽屉" title="关闭" @click="closeSidePanel">×</button></div></header>
          <div class="context-note"><b>任务背景 v{{ project.snapshot.version }}</b><span>当前项目：{{ project.name }}</span><span>{{ project.snapshot.projectBase }}</span></div>
          <article class="draft-task-card">
            <template v-if="pendingTask">
              <div class="draft-task-title"><strong>任务 {{ String(project.tasks.indexOf(pendingTask) + 1).padStart(2, '0') }}</strong><span>待确认快照</span></div>
              <label>任务标题<input v-model="pendingTask.title" /></label>
              <label>任务目标<textarea v-model="pendingTask.goal" rows="2"></textarea></label>
              <div class="draft-task-fields"><label>任务类型<input v-model="pendingTask.type" /></label><label>负责人<input v-model="pendingTask.owner" /></label></div>
              <div class="draft-task-fields"><label>协作方<input v-model="pendingTask.agent" /></label><label>截止时间<input v-model="pendingTask.deadline" /></label></div>
              <label>交付物<input v-model="pendingTask.deliverable" /></label>
              <label>验收标准<textarea v-model="pendingTask.acceptance" rows="2"></textarea></label>
              <section class="snapshot-context-editor">
                <div class="snapshot-context-editor__head"><div><strong>引用的消息链</strong><small>任务创建时带入的讨论内容，可在确认前调整</small></div><button type="button" class="snapshot-context-add" @click="addContextMessage">+ 消息</button></div>
                <div v-if="pendingTask.contextMessages.length" class="snapshot-context-messages">
                  <article v-for="(message, index) in pendingTask.contextMessages" :key="message.id || index" class="snapshot-context-message">
                    <div class="snapshot-context-message__meta"><span>{{ message.sender || '团队助理' }}</span><small>{{ message.date || '未标注日期' }}</small><button type="button" aria-label="移除引用消息" @click="removeContextMessage(index)">×</button></div>
                    <textarea v-model="message.text" rows="2" aria-label="引用消息内容"></textarea>
                  </article>
                </div>
                <p v-else class="snapshot-context-empty">未选择具体消息，将仅使用协作背景中的目标与约束。</p>
              </section>
              <section class="snapshot-context-editor">
                <div class="snapshot-context-editor__head"><div><strong>引用的约束</strong><small>这些约束会影响任务执行与验收，可直接修改</small></div><button type="button" class="snapshot-context-add" @click="addContextConstraint">+ 约束</button></div>
                <div class="snapshot-context-constraints">
                  <label v-for="(constraint, index) in pendingTask.contextConstraints" :key="index"><span>{{ String(index + 1).padStart(2, '0') }}</span><input v-model="pendingTask.contextConstraints[index]" aria-label="引用约束" /><button type="button" aria-label="移除引用约束" @click="removeContextConstraint(index)">×</button></label>
                </div>
              </section>
              <small class="snapshot-source">来源：项目讨论 · 已绑定任务背景 v{{ project.snapshot.version }}</small>
            </template>
          </article>
          <footer class="panel-footer"><button type="button" class="quiet" @click="isEditingAssignments = false">返回卡片</button><button type="button" class="primary" @click="confirmCurrentTask">确认当前任务</button></footer>
        </template>

        <template v-else>
          <header class="panel-head team-plan-head"><div class="team-plan-head__title"><strong>团队计划</strong></div><div class="team-plan-head__actions"><button type="button" class="dashboard-expand team-plan-head__expand" aria-label="展开完整团队计划仪表盘" title="展开仪表盘" @click="openDashboard"><span>展开总览</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></svg></button><button type="button" class="panel-close" aria-label="关闭侧边抽屉" title="关闭" @click="closeSidePanel">×</button></div></header>
          <section class="team-dashboard" aria-label="本周团队计划概览">
            <div class="team-dashboard-head"><div><strong>实时任务状态</strong></div><div class="dashboard-head-actions"><div class="dashboard-state-control"><button type="button" class="dashboard-more" aria-label="更多团队计划操作" :aria-expanded="showStatePreviewMenu" @click="showStatePreviewMenu = !showStatePreviewMenu">···</button><div v-if="showStatePreviewMenu" class="dashboard-state-menu"><span>体验状态</span><button type="button" @click="setStatePreview('loading')">加载中</button><button type="button" @click="setStatePreview('error')">加载失败</button><button type="button" @click="setStatePreview('permission')">权限不足</button><button type="button" @click="setStatePreview('ready')">恢复正常</button></div></div></div></div>
            <div class="dashboard-kpis">
              <div><span>任务</span><strong>{{ dashboardMetrics.total }}</strong></div>
              <div><span>进行中</span><strong>{{ dashboardMetrics.inProgress }}</strong></div>
              <div><span>待验收</span><strong>{{ dashboardMetrics.pendingAcceptance }}</strong></div>
            </div>
            <div class="dashboard-load"><div class="dashboard-section-title"><span>任务闭环进度</span><b>{{ dashboardMetrics.completed }} / {{ dashboardMetrics.total || 0 }}</b></div><div class="dashboard-progress"><span :style="{ width: `${dashboardMetrics.completionRate}%` }"></span></div><div class="dashboard-load-meta"><span>{{ dashboardMetrics.completionRate }}%</span><small>已完成 {{ dashboardMetrics.completed }} · 待开始 {{ dashboardMetrics.notStarted }}</small></div></div>
            <div class="dashboard-attention"><div class="dashboard-section-title"><span>需要关注</span><b>{{ dashboardMetrics.attention }}</b></div><p v-if="dashboardMetrics.pendingAcceptance"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg><span>{{ dashboardMetrics.pendingAcceptance }} 项任务等待验收</span></p><p v-if="dashboardMetrics.changesRequested"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg><span>{{ dashboardMetrics.changesRequested }} 项任务需要补充修改</span></p><p v-if="!dashboardMetrics.attention" class="is-safe"><span>所有任务当前无需处理</span></p></div>
          </section>
          <div v-if="confirmedTasks.length" class="plan-list">
            <article v-for="task in confirmedTasks" :key="task.id" class="plan-item" :class="{ 'is-expanded': expandedPlanTasks.has(task.id) }">
              <button type="button" class="plan-item-toggle" @click="togglePlanTask(task.id)">
                <span class="plan-item-dot"></span>
                <span class="plan-item-main"><b>{{ task.title }}</b><small>{{ task.owner }} · {{ task.deadline }}</small></span>
                <span class="plan-submit-status" :class="`is-${planStatus(task).tone}`">{{ planStatus(task).label }}</span>
                <span class="plan-item-chevron" aria-hidden="true">{{ expandedPlanTasks.has(task.id) ? '⌃' : '⌄' }}</span>
              </button>
              <div v-if="expandedPlanTasks.has(task.id)" class="plan-item-detail">
                <p v-if="task.goal"><span>任务目标</span>{{ task.goal }}</p>
                <p v-if="task.deliverable"><span>交付物</span>{{ task.deliverable }}</p>
                <p><span>负责人 / 协作方</span>{{ task.owner }} · {{ task.agent }}</p>
                <p v-if="task.acceptance"><span>验收标准</span>{{ task.acceptance }}</p><div v-if="task.workflowState === 'pending_acceptance'" class="plan-review-actions"><span>接收方验收</span><div><button type="button" @click="reviewTaskBackfill(task.id, 'changes_requested')">退回修改</button><button type="button" class="is-approve" @click="reviewTaskBackfill(task.id, 'accepted')">验收通过</button></div></div>
              </div>
            </article>
          </div>
          <div v-else class="panel-empty">还没有已确认任务</div>
        </template>
      </aside>
    </main>

    <Transition name="dashboard-workspace">
      <section v-if="isDashboardExpanded" class="dashboard-workspace" aria-label="完整团队计划仪表盘">
        <header class="dashboard-workspace__header">
          <div class="dashboard-workspace__title"><div><span>项目总览</span><small>项目执行全貌 · 数据随任务状态实时同步</small></div></div>
          <div class="dashboard-workspace__tools"><button type="button" class="dashboard-workspace__close" aria-label="关闭完整团队计划仪表盘" @click="closeDashboard">×</button></div>
        </header>
        <nav class="dashboard-tabs" aria-label="团队计划导航"><button v-for="tab in dashboardTabs" :key="tab.id" type="button" :class="{ active: dashboardTab === tab.id }" @click="dashboardTab = tab.id">{{ tab.label }}</button></nav>
        <div class="dashboard-workspace__scroll">
          <template v-if="dashboardTab === 'overview'">
            <div class="dashboard-v2-layout">
              <div class="dashboard-v2-main">
            <section class="dashboard-hero-grid">
              <article class="dashboard-metric-card is-progress"><div class="dashboard-metric-head"><span class="dashboard-card-icon is-blue">↗</span><span>进行中</span></div><strong>{{ dashboardMetrics.inProgress }}</strong><small>{{ dashboardMetrics.inProgress ? '任务正在推进' : '暂无执行中任务' }}</small><div class="dashboard-mini-bars" aria-hidden="true"><i v-for="index in 6" :key="index" :class="{ active: index <= dashboardMetrics.inProgress }"></i></div></article>
              <article class="dashboard-metric-card is-review"><div class="dashboard-metric-head"><span class="dashboard-card-icon is-cyan">✓</span><span>待验收</span></div><strong>{{ dashboardMetrics.pendingAcceptance }}</strong><small>{{ dashboardMetrics.pendingAcceptance ? '交付物等待确认' : '暂无待验收交付物' }}</small><div class="dashboard-mini-donut" role="img" :aria-label="`${dashboardMetrics.pendingAcceptance} 项任务待验收`"><span>{{ dashboardMetrics.pendingAcceptance }}</span></div></article>
              <article class="dashboard-metric-card is-attention"><div class="dashboard-metric-head"><span class="dashboard-card-icon is-orange">!</span><span>需处理</span></div><strong>{{ dashboardMetrics.attention }}</strong><small>{{ dashboardMetrics.changesRequested ? '包含退回修改任务' : '没有退回修改任务' }}</small><div class="dashboard-attention-bars" aria-hidden="true"><i v-for="index in 6" :key="index" :class="{ active: index <= dashboardMetrics.attention }"></i></div><button type="button" @click="dashboardTab = 'delivery'">查看处理项 →</button></article>
            </section>
            <section class="dashboard-section dashboard-curve-section">
              <header><div><span>任务分布曲线</span><small>按当前闭环阶段汇总，不表示虚构的历史趋势</small></div><b>{{ dashboardMetrics.total }} 项任务</b></header>
              <div class="dashboard-curve-layout">
                <div class="dashboard-curve-copy"><span>当前闭环率</span><strong>{{ dashboardMetrics.completionRate }}<i>%</i></strong><small>曲线每个节点对应当前处于该阶段的任务数量。</small></div>
                <div class="dashboard-curve-chart">
                  <svg viewBox="0 0 680 218" role="img" aria-label="各任务闭环阶段的任务数量曲线"><line v-for="line in [50, 88, 126, 164]" :key="line" x1="42" x2="654" :y1="line" :y2="line"/><path class="dashboard-curve-area" :d="dashboardCurve.areaPath"/><path class="dashboard-curve-line" :d="dashboardCurve.path"/><g v-for="point in dashboardCurve.points" :key="point.id"><circle :cx="point.x" :cy="point.y" r="5"/><text :x="point.x" y="203">{{ point.label }}</text><text class="dashboard-curve-value" :x="point.x" :y="point.y - 13">{{ point.count }}</text></g></svg>
                </div>
              </div>
            </section>
            <section class="dashboard-section dashboard-kanban-section"><header><div><span>任务执行流</span><small>按当前任务状态自动归类</small></div><button type="button" @click="dashboardTab = 'tasks'">进入任务工作台 →</button></header><div class="dashboard-kanban"><article v-for="column in dashboardColumns" :key="column.id" :class="`is-${column.id}`"><div class="dashboard-kanban__head"><span>{{ column.label }}</span><b>{{ column.tasks.length }}</b></div><button v-for="task in column.tasks" :key="task.id" type="button" class="dashboard-task-chip" @click="openDashboardTask(task)"><i></i><strong>{{ task.title }}</strong><small>{{ task.owner }} · {{ task.deadline }}</small><em>{{ planStatus(task).label }}</em></button><p v-if="!column.tasks.length">暂无任务</p></article></div></section>
              </div>
              <aside class="dashboard-insight-column" aria-label="待处理事项与任务时间线">
                <section class="dashboard-insight-rail"><header><div><span>待处理事项</span><small>根据当前任务状态整理</small></div><b>{{ dashboardAlerts.length }}</b></header><button v-for="task in dashboardAlerts" :key="task.id" type="button" class="dashboard-insight-item" @click="openDashboardTask(task)"><i :class="`is-${taskStage(task)}`"></i><span><strong>{{ task.title }}</strong><small>{{ planStatus(task).label }} · {{ task.owner }} · {{ task.deadline || '未设截止时间' }}</small></span><em>›</em></button><p v-if="!dashboardAlerts.length" class="dashboard-insight-empty">当前没有需要处理的任务。</p><button type="button" class="dashboard-insight-action" @click="dashboardTab = 'delivery'">查看交付与验收 →</button></section>
                <section class="dashboard-rail-timeline dashboard-timeline"><header><div><span>任务时间线</span><small>按当前截止时间排序</small></div></header><ol><li v-for="task in dashboardTimeline" :key="task.id"><time>{{ task.deadline || '未设置' }}</time><i :class="`is-${taskStage(task)}`"></i><button type="button" @click="openDashboardTask(task)"><b>{{ task.title }}</b><small>{{ planStatus(task).label }} · {{ task.owner }}</small></button></li><li v-if="!dashboardTimeline.length" class="is-empty">任务确认后会在这里显示时间安排。</li></ol></section>
                <section class="dashboard-rail-activity dashboard-activity"><header><div><span>项目记录</span><small>任务与协作背景的可追溯关系</small></div></header><div class="dashboard-activity__items"><p v-for="item in dashboardActivity" :key="item.key"><i :class="`is-${item.tone}`"></i><span><b>{{ item.title }}</b><small>{{ item.detail }}</small></span></p></div></section>
              </aside>
            </div>
          </template>
          <section v-else-if="dashboardTab === 'tasks'" class="dashboard-section dashboard-task-workbench"><header><div><span>任务工作台</span><small>点击任务进入对应对话处理</small></div></header><div class="dashboard-task-table"><button v-for="task in filteredDashboardTasks" :key="task.id" type="button" @click="openDashboardTask(task)"><span class="dashboard-task-table__state" :class="`is-${taskStage(task)}`"></span><span><b>{{ task.title }}</b><small>{{ task.goal || '尚未补充任务目标' }}</small></span><span>{{ task.owner }} / {{ task.agent }}</span><span>{{ task.deadline || '未设截止时间' }}</span><em :class="`is-${planStatus(task).tone}`">{{ planStatus(task).label }}</em><i>›</i></button><p v-if="!filteredDashboardTasks.length">当前筛选下暂无任务。</p></div></section>
          <section v-else-if="dashboardTab === 'delivery'" class="dashboard-section dashboard-delivery"><header><div><span>交付与验收</span><small>集中处理提交、验收与退回修改</small></div></header><div class="dashboard-delivery-grid"><article v-for="bucket in deliveryBuckets" :key="bucket.id"><div><span>{{ bucket.label }}</span><b>{{ bucket.tasks.length }}</b></div><button v-for="task in bucket.tasks" :key="task.id" type="button" @click="openDashboardTask(task)"><strong>{{ task.title }}</strong><small>{{ bucket.description }}</small><em>{{ planStatus(task).label }}</em></button><p v-if="!bucket.tasks.length">暂无任务</p></article></div></section>
          <section v-else-if="dashboardTab === 'timeline'" class="dashboard-section dashboard-timeline dashboard-timeline--full"><header><div><span>时间与风险</span><small>仅呈现已有截止时间和任务状态</small></div></header><ol><li v-for="task in dashboardTimeline" :key="task.id"><time>{{ task.deadline || '未设置' }}</time><i :class="`is-${taskStage(task)}`"></i><button type="button" @click="openDashboardTask(task)"><b>{{ task.title }}</b><small>{{ riskCopy(task) }}</small></button></li></ol></section>
          <section v-else class="dashboard-section dashboard-activity dashboard-activity--full"><header><div><span>项目记录</span><small>协作背景、任务与回填过程中的关键信息</small></div></header><div class="dashboard-activity__items"><p v-for="item in dashboardActivity" :key="item.key"><i :class="`is-${item.tone}`"></i><span><b>{{ item.title }}</b><small>{{ item.detail }}</small></span></p></div></section>
        </div>
      </section>
    </Transition>

    <Transition name="bridge-toast"><div v-if="notice" class="bridge-toast">{{ notice }}</div></Transition>

    <ProjectBaseWorkspace
      v-if="showBaseEditor"
      :project="project"
      :task="activeTask || project.tasks[0]"
      :full="true"
      @close="showBaseEditor = false"
      @saved="(message) => { showBaseEditor = false; flash(message) }"
    />

  </div>
  <div v-else class="bridge-empty-state" role="status">
    <strong>暂无项目</strong>
    <span>在左侧新建项目后，可在这里继续协作讨论与任务回填。</span>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useTodoStore } from '@/modules/todo/store/todoStore'
import { useTaskBridgeStore } from '@/modules/task-bridge/store'
import ProjectBaseWorkspace from '@/modules/task-bridge/components/ProjectBaseWorkspace.vue'
import ownerAvatar from '@/assets/avatar-wang-jingbo.webp'
import assistantAvatar from '@/assets/soloTeam/default_agent.svg'
import researchAvatar from '@/assets/collaboration/pmo-digital-human-avatar.png'
import designAvatar from '@/assets/collaboration/tapd-pmo-avatar.png'

const groupStore = useGroupStore()
const uiStore = useUIStore()
const todoStore = useTodoStore()
const bridgeStore = useTaskBridgeStore()
const memberAvatars = Object.freeze({ owner: ownerAvatar, research: researchAvatar, design: designAvatar })
const messageText = ref('')
const activePanel = ref('plan')
const isEditingAssignments = ref(false)
const showBaseEditor = ref(false)
const editingBackfillArtifact = ref(false)
const notice = ref('')
const taskBackfillSubmitting = ref(false)
const taskBackfillError = ref('')
const expandedPlanTasks = ref(new Set())
const conversationScrollRef = ref(null)
const statePreview = ref('ready')
const showStatePreviewMenu = ref(false)
const isDashboardExpanded = ref(false)
const dashboardTab = ref('overview')
const dashboardFilter = ref('all')
let noticeTimer = null
const acceptanceChecklist = [
  { id: 'acceptance_01', statement: '覆盖项目讨论生成任务和个人创建任务两条路径' },
  { id: 'acceptance_02', statement: '已定义空状态、错误状态和成功状态' },
  { id: 'acceptance_03', statement: '已通过产品体验评审' },
]
const completionResultMeta = {
  0: { label: '已完成', description: '任务目标和主要交付物均已完成' },
  1: { label: '部分完成', description: '已完成部分内容，仍有明确遗留项' },
  2: { label: '没完成', description: '未形成可验收的有效产出' },
}
const completionResultValue = computed(() => Number(activeTask.value?.backfill?.completionResult ?? 0))
const activeTaskBackfillState = computed(() => activeTask.value?.workflowState || 'backfill_editing')
const activeBackfillMeta = computed(() => ({
  backfill_editing: { label: '待提交', description: '确认任务完成情况，提交后由接收方验收。' },
  submitting: { label: '提交中', description: '正在保存回填内容并同步团队计划。' },
  pending_acceptance: { label: '提交待验收', description: '回填已提交，接收方将按验收标准核对产物。', outcomeTitle: '已提交，等待接收方验收', outcomeDescription: '提交内容已同步至团队计划，验收结论会留存在任务记录中。' },
  changes_requested: { label: '需修改', description: '接收方已退回，请补充内容后重新提交。' },
  accepted: { label: '已验收', description: '产物已验收通过，等待回填协作背景。', outcomeTitle: '验收通过', outcomeDescription: '你可以将关键结论回填到协作背景，供后续任务引用。' },
  project_backfilled: { label: '已回填', description: '关键结论已同步至协作背景。', outcomeTitle: '已回填协作背景', outcomeDescription: '本次任务已完成状态闭环。' },
}[activeTaskBackfillState.value] || { label: '待提交', description: '确认任务完成情况，提交后由接收方验收。' }))
const activeBackfillEditable = computed(() => ['backfill_editing', 'changes_requested', 'submitting'].includes(activeTaskBackfillState.value))
const chatArtifacts = computed(() => (activeTask.value?.messages || []).filter((message) => message.kind === 'file' && message.file).map((message) => ({ id: message.id, ...message.file })))
function completionResultInfo(value) {
  return completionResultMeta[Number(value)] || completionResultMeta[0]
}

function planStatus(task) {
  const states = {
    pending_acceptance: { label: '提交待验收', tone: 'review' },
    changes_requested: { label: '需修改', tone: 'changes' },
    accepted: { label: '已验收', tone: 'accepted' },
    project_backfilled: { label: '已回填', tone: 'completed' },
  }
  return states[task.workflowState] || { label: task.submitted ? '提交待验收' : '未提交', tone: task.submitted ? 'review' : 'pending' }
}
const demoFlow = [
  {
    user: '@团队助理，基于本次项目目标生成调研任务分工，明确负责人、协作数字人、截止时间和验收标准。',
    assistant: '收到。我已根据协作背景和当前讨论拆分出 3 项可执行工作，并预填负责人、协作方与验收标准。请核对任务快照后确认加入团队计划。',
  },
  {
    user: '请继续明确每项任务的交付物和验收标准。',
    assistant: '第一项任务已生成：调研报告。',
    revealTask: true,
  },
  {
    user: '请补充原型和技术评估任务，保持任务之间的协作关系。',
    assistant: '第二项任务已生成：绘制原型。',
    revealTask: true,
  },
  {
    user: '请完成最后一项任务，并整理完整的任务快照。',
    assistant: '第三项任务已生成：技术方案评估。任务快照已完成，请核对后确认。',
    revealTask: true,
  },
]

const conversationId = computed(() => String(groupStore.currentSpaceId || ''))
// 只读取已存在的项目。项目被删除后不能因页面渲染而被 ensureProject 自动创建回来。
const project = computed(() => bridgeStore.projectFor(conversationId.value))

watch(
  [() => uiStore.activePrimaryNav, () => groupStore.currentSpaceId],
  ([primaryNav, currentSpaceId]) => {
    if (primaryNav !== 'collaboration' || bridgeStore.projectFor(currentSpaceId)) return
    const firstProject = Object.values(bridgeStore.projects).find((item) => (
      !bridgeStore.deletedProjectIds[String(item.id)]
      && !item.isPersonalOnly
      && !String(item.id).startsWith('personal-task-')
    ))
    if (!firstProject) return
    groupStore.setCurrentSpaceId(firstProject.id)
    groupStore.currentConversationId = firstProject.id
    uiStore.setActiveNavigation('collaboration', firstProject.id)
  },
  { immediate: true },
)

const activeTask = computed(() => project.value?.tasks.find((task) => task.id === project.value.activeTaskId) || null)
const isTaskConversation = computed(() => Boolean(activeTask.value))
const demoFlowIndex = computed(() => Math.floor((project.value?.discussion.length || 0) / 2))
const pendingTask = computed(() => project.value?.tasks.find((task) => !task.confirmed) || null)
const canAdvanceDemo = computed(() => !pendingTask.value)
const confirmedTasks = computed(() => project.value?.tasks.filter((task) => task.confirmed) || [])
const assignmentStatusLabel = computed(() => project.value?.phase === 'draft' ? '确认任务快照' : '任务快照生成中')
const dashboardTabs = Object.freeze([
  { id: 'overview', label: '概览' },
  { id: 'tasks', label: '任务工作台' },
  { id: 'delivery', label: '交付与验收' },
  { id: 'timeline', label: '时间与风险' },
  { id: 'activity', label: '项目记录' },
])
const dashboardMetrics = computed(() => {
  const tasks = confirmedTasks.value
  const counts = tasks.reduce((result, task) => {
    const stage = taskStage(task)
    result[stage] += 1
    return result
  }, { not_started: 0, in_progress: 0, pending_acceptance: 0, changes_requested: 0, completed: 0 })
  const completed = counts.completed
  const total = tasks.length
  return {
    total,
    completed,
    inProgress: counts.in_progress,
    pendingAcceptance: counts.pending_acceptance,
    changesRequested: counts.changes_requested,
    notStarted: counts.not_started,
    attention: counts.pending_acceptance + counts.changes_requested,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
  }
})
const dashboardPipeline = computed(() => {
  const metric = dashboardMetrics.value
  const total = metric.total || 1
  return [
    { id: 'not_started', label: '待开始', count: metric.notStarted, share: (metric.notStarted / total) * 100 },
    { id: 'in_progress', label: '进行中', count: metric.inProgress, share: (metric.inProgress / total) * 100 },
    { id: 'pending_acceptance', label: '待验收', count: metric.pendingAcceptance, share: (metric.pendingAcceptance / total) * 100 },
    { id: 'completed', label: '已闭环', count: metric.completed, share: (metric.completed / total) * 100 },
  ]
})
const dashboardCurve = computed(() => {
  const stages = dashboardPipeline.value
  const maximum = Math.max(...stages.map((stage) => stage.count), 1)
  const points = stages.map((stage, index) => ({
    ...stage,
    x: 62 + (index * 192),
    y: 164 - ((stage.count / maximum) * 92),
  }))
  const path = points.reduce((result, point, index) => {
    if (!index) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    return `${result} C ${previous.x + 72} ${previous.y}, ${point.x - 72} ${point.y}, ${point.x} ${point.y}`
  }, '')
  return {
    points,
    path,
    areaPath: `${path} L ${points.at(-1)?.x || 638} 164 L ${points[0]?.x || 62} 164 Z`,
  }
})
const dashboardColumns = computed(() => [
  { id: 'not_started', label: '待开始', tasks: confirmedTasks.value.filter((task) => taskStage(task) === 'not_started') },
  { id: 'in_progress', label: '进行中', tasks: confirmedTasks.value.filter((task) => taskStage(task) === 'in_progress') },
  { id: 'pending_acceptance', label: '待验收', tasks: confirmedTasks.value.filter((task) => taskStage(task) === 'pending_acceptance' || taskStage(task) === 'changes_requested') },
  { id: 'completed', label: '已闭环', tasks: confirmedTasks.value.filter((task) => taskStage(task) === 'completed') },
])
const dashboardTimeline = computed(() => [...confirmedTasks.value].sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'))))
const dashboardAlerts = computed(() => {
  const attentionTasks = confirmedTasks.value.filter((task) => ['pending_acceptance', 'changes_requested'].includes(taskStage(task)))
  return (attentionTasks.length ? attentionTasks : dashboardTimeline.value).slice(0, 4)
})
const dashboardFilters = computed(() => [
  { id: 'all', label: '全部', count: dashboardMetrics.value.total },
  { id: 'mine', label: '我负责', count: confirmedTasks.value.filter((task) => task.owner === '我').length },
  { id: 'in_progress', label: '进行中', count: dashboardMetrics.value.inProgress },
  { id: 'pending_acceptance', label: '待验收', count: dashboardMetrics.value.pendingAcceptance },
  { id: 'changes_requested', label: '需修改', count: dashboardMetrics.value.changesRequested },
  { id: 'completed', label: '已完成', count: dashboardMetrics.value.completed },
])
const filteredDashboardTasks = computed(() => confirmedTasks.value.filter((task) => {
  if (dashboardFilter.value === 'all') return true
  if (dashboardFilter.value === 'mine') return task.owner === '我'
  return taskStage(task) === dashboardFilter.value
}))
const deliveryBuckets = computed(() => [
  { id: 'draft', label: '待提交', description: '尚未形成可验收交付物', tasks: confirmedTasks.value.filter((task) => ['not_started', 'in_progress'].includes(taskStage(task))) },
  { id: 'review', label: '待验收', description: '已提交，等待接收方结论', tasks: confirmedTasks.value.filter((task) => taskStage(task) === 'pending_acceptance') },
  { id: 'changes', label: '需修改', description: '请补充内容后重新提交', tasks: confirmedTasks.value.filter((task) => taskStage(task) === 'changes_requested') },
  { id: 'done', label: '已完成', description: '验收结论已留痕', tasks: confirmedTasks.value.filter((task) => taskStage(task) === 'completed') },
])
const dashboardActivity = computed(() => {
  const items = [{ key: 'background', tone: 'base', title: `协作背景 v${project.value?.snapshot.version || 1}`, detail: '当前任务会引用该版本中的目标与约束。' }]
  confirmedTasks.value.forEach((task) => {
    const stage = taskStage(task)
    const copy = { not_started: '任务已确认，等待开始执行。', in_progress: '任务正在推进。', pending_acceptance: '交付物已提交，等待验收。', changes_requested: '任务已退回，等待补充修改。', completed: '任务闭环完成，结果可回填协作背景。' }[stage]
    items.push({ key: task.id, tone: stage, title: task.title, detail: copy })
  })
  return items.slice(0, 6)
})

function taskStage(task) {
  if (['accepted', 'project_backfilled', 'done'].includes(task.workflowState) || task.status === 'done') return 'completed'
  if (task.workflowState === 'changes_requested') return 'changes_requested'
  if (task.workflowState === 'pending_acceptance' || task.submitted) return 'pending_acceptance'
  if (['in_progress', 'backfill', 'backfill_editing', 'submitting'].includes(task.workflowState) || ['in_progress', 'backfill'].includes(task.status)) return 'in_progress'
  return 'not_started'
}

function riskCopy(task) {
  const stage = taskStage(task)
  if (stage === 'changes_requested') return '需补充修改后重新提交'
  if (stage === 'pending_acceptance') return '交付物已提交，等待验收'
  if (stage === 'in_progress') return '任务正在执行中'
  if (stage === 'completed') return '任务已形成闭环'
  return '任务尚未开始'
}

function openDashboard() {
  dashboardTab.value = 'overview'
  dashboardFilter.value = 'all'
  isDashboardExpanded.value = true
  showStatePreviewMenu.value = false
}

function closeDashboard() {
  isDashboardExpanded.value = false
}

function openDashboardTask(task) {
  isDashboardExpanded.value = false
  activePanel.value = null
  bridgeStore.openTaskConversation(conversationId.value, task.id)
  uiStore.setActiveNavigation('collaboration', conversationId.value)
}

function ensureTaskArtifact(task) {
  if (!task || task.messages.some((message) => message.kind === 'file')) return
  task.messages.push({
    id: `task-file-${task.id}`,
    type: 'assistant',
    kind: 'file',
    text: '产物已生成，请提交验收。',
    file: { name: `${task.title}.md`, type: 'Markdown', version: 'v1', status: '待验收' },
  })
}

function ensureTaskSnapshotContext(task) {
  if (!task) return
  if (!Array.isArray(task.contextMessages)) task.contextMessages = []
  if (!Array.isArray(task.contextConstraints)) task.contextConstraints = ['交付物必须可访问、可评审，并与任务目标保持一致。', '关键结论保留来源，无法验证的信息需要明确标注。', '发现阻塞依赖时及时同步，不等待任务临近截止才处理。']
}

watch(pendingTask, ensureTaskSnapshotContext, { immediate: true })

watch(activeTask, ensureTaskArtifact, { immediate: true })

watch(isTaskConversation, (isTask) => {
  // 任务对话默认不展示右侧抽屉；仍可按需打开团队计划或任务背景。
  activePanel.value = isTask
    ? (project.value?.showPlanAfterBackfill ? 'plan' : null)
    : 'plan'
  if (isTask && project.value?.showPlanAfterBackfill) project.value.showPlanAfterBackfill = false
}, { immediate: true })

watch(() => bridgeStore.dashboardCloseRequest, () => {
  isDashboardExpanded.value = false
})

watch(
  [() => bridgeStore.dashboardOpenRequest, () => uiStore.activePrimaryNav, () => conversationId.value],
  ([, primaryNav, currentProjectId]) => {
    if (primaryNav !== 'collaboration' || !bridgeStore.dashboardOpenProjectId || currentProjectId !== bridgeStore.dashboardOpenProjectId) return
    openDashboard()
  },
  { immediate: true, flush: 'sync' },
)

watch(() => project.value?.phase, (phase) => {
  // 回填确认完成后直接回到当前项目的团队计划，不再经过中间确认抽屉。
  if (!isTaskConversation.value && ['backfill', 'published'].includes(phase)) activePanel.value = 'plan'
}, { immediate: true })

function closeSidePanel() {
  activePanel.value = null
  isEditingAssignments.value = false
}

function setStatePreview(state) {
  statePreview.value = state
  showStatePreviewMenu.value = false
}

function openAssignmentEditor() {
  showBaseEditor.value = false
  activePanel.value = null
  isEditingAssignments.value = true
}

function openBaseEditor() {
  isEditingAssignments.value = false
  showBaseEditor.value = true
}

function addContextMessage() {
  if (!pendingTask.value) return
  pendingTask.value.contextMessages.push({ id: `edited-context-message-${Date.now()}`, sender: '我', date: '今天', text: '' })
}

function removeContextMessage(index) {
  pendingTask.value?.contextMessages.splice(index, 1)
}

function addContextConstraint() {
  if (!pendingTask.value) return
  pendingTask.value.contextConstraints.push('')
}

function removeContextConstraint(index) {
  pendingTask.value?.contextConstraints.splice(index, 1)
}

function togglePlanTask(taskId) {
  const next = new Set(expandedPlanTasks.value)
  if (next.has(taskId)) next.delete(taskId)
  else next.add(taskId)
  expandedPlanTasks.value = next
}

function removeTaskBackfillArtifact() {
  if (!activeTask.value?.backfill) return
  activeTask.value.backfill.deliverable = ''
  editingBackfillArtifact.value = true
  taskBackfillError.value = ''
  flash('交付产物已移除，请重新添加后再提交')
}

function selectTaskBackfillArtifact(artifact) {
  if (!activeTask.value?.backfill) return
  activeTask.value.backfill.deliverable = artifact.name
  editingBackfillArtifact.value = false
  taskBackfillError.value = ''
  flash('已从聊天文件中选择交付产物')
}

function flash(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 2600)
}

function scrollToLatest() {
  nextTick(() => {
    const container = conversationScrollRef.value
    if (!container) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({ top: container.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  })
}

function generateAssignments() {
  const current = bridgeStore.generateAssignments(conversationId.value)
  syncPersonalTasks(current)
  activePanel.value = 'plan'
  flash('已生成任务快照，并同步新增个人任务')
}

function sendDiscussion() {
  const text = messageText.value.trim()
  if (activeTask.value) {
    if (activeTask.value.backfillDemoStep >= 1) return
    const preset = '@团队助理，任务完成，起草回填'
    activeTask.value.messages.push({ id: `task-user-${Date.now()}`, type: 'user', text: text || preset })
    activeTask.value.messages.push({ id: `task-assistant-backfill-${Date.now()}`, type: 'assistant', text: '回填已起草，请确认修改。' })
    activeTask.value.backfillDemoStep = 1
    activeTask.value.backfill = {
      completionResult: 0,
      completed: `「${activeTask.value.title}」已完成，产物已生成并提交验收。`,
      incomplete: '',
      incompleteReason: '',
      blockers: '',
      nextAction: '',
      deliverable: activeTask.value.deliverable || `${activeTask.value.title}.md`,
      effective: '先明确比较维度，再收集证据并形成结论。',
      issues: '不同来源的信息口径需要额外核对。',
      reusable: '先定比较维度，再收集证据，可显著减少返工。',
      updateBase: false,
    }
    bridgeStore.prepareBackfill(conversationId.value, activeTask.value.id)
    messageText.value = ''
    scrollToLatest()
    return
  }
  const preset = demoFlow[demoFlowIndex.value]
  if (!preset) return
  bridgeStore.addDiscussion(conversationId.value, preset.user, 'user')
  bridgeStore.addDiscussion(conversationId.value, preset.assistant, 'assistant')
  messageText.value = ''
  if (preset.revealTask) {
    const current = bridgeStore.revealNextAssignment(conversationId.value)
    if (current?.tasks.length === 3) flash('当前任务快照已生成，请先编辑并确认')
  }
  scrollToLatest()
}

function saveTaskBackfill() {
  if (!activeTask.value?.backfill) return
  project.value.backfillDraft = activeTask.value.backfill.completed
  project.value.echoDraft = activeTask.value.backfill.reusable
  flash('回填草稿已保存')
}

async function submitTaskBackfill() {
  if (!activeTask.value || taskBackfillSubmitting.value) return
  taskBackfillError.value = ''
  if (!activeTask.value.backfill?.deliverable?.trim()) {
    taskBackfillError.value = '请补充至少一个可供验收的交付产物。'
    return
  }
  if (completionResultValue.value === 1 && (!activeTask.value.backfill.completed?.trim() || !activeTask.value.backfill.incomplete?.trim() || !activeTask.value.backfill.nextAction?.trim())) {
    taskBackfillError.value = '部分完成时，请补充已完成内容、遗留项和下一步行动。'
    return
  }
  if (completionResultValue.value === 2 && (!activeTask.value.backfill.incompleteReason?.trim() || !activeTask.value.backfill.blockers?.trim() || !activeTask.value.backfill.nextAction?.trim())) {
    taskBackfillError.value = '未完成时，请补充原因、当前阻塞事项和后续处理方式。'
    return
  }
  taskBackfillSubmitting.value = true
  activeTask.value.workflowState = 'submitting'
  await new Promise((resolve) => window.setTimeout(resolve, 850))
  saveTaskBackfill()
  activeTask.value.status = 'backfill'
  const current = bridgeStore.publishBackfill(conversationId.value)
  taskBackfillSubmitting.value = false
  if (!current) {
    activeTask.value.workflowState = 'backfill_editing'
    taskBackfillError.value = '提交失败，已保留填写内容。请检查网络后重试。'
    return
  }
  current.echoPublished = true
  activePanel.value = 'plan'
  flash('回填已提交，团队计划已同步为“提交待验收”')
}

function ignoreTaskBackfill() {
  if (activeTask.value) {
    activeTask.value.backfillDemoStep = 0
    activeTask.value.status = 'in_progress'
    activeTask.value.workflowState = 'in_progress'
  }
  flash('已忽略本次回填')
}

function reviewTaskBackfill(taskId, decision) {
  const current = bridgeStore.reviewBackfill(conversationId.value, taskId, decision)
  if (!current) return
  flash(decision === 'accepted' ? '验收已通过，等待回填协作背景' : '已退回任务负责人补充修改')
}

function syncTaskBackfill() {
  if (!activeTask.value) return
  const current = bridgeStore.syncAcceptedBackfill(conversationId.value, activeTask.value.id)
  if (!current) return
  flash(`已回填至协作背景 v${current.snapshot.version}`)
}

function confirmCurrentTask() {
  const task = pendingTask.value
  if (!task) return
  const taskIndex = project.value.tasks.indexOf(task) + 1
  const current = bridgeStore.confirmTask(conversationId.value, task.id)
  if (!current) return
  syncPersonalTasks(current)
  window.dispatchEvent(new CustomEvent('task-mounted-to-personal', {
    detail: { taskId: task.id, projectId: conversationId.value },
  }))
  isEditingAssignments.value = false
  activePanel.value = 'plan'
  if (current.phase === 'planned') {
    flash('任务分工已全部确认，已加入团队计划')
  } else {
    flash(`第 ${taskIndex} 项任务已确认并加入团队计划`)
  }
}

function syncPersonalTasks(current) {
  if (!current) return
  // 初始化为空待办，但保留已经从任务桥写入的条目。
  todoStore.seed([])
  current.tasks.filter((task) => task.owner === '我').forEach((task) => {
    const todoId = `task-bridge-${conversationId.value}-${task.id}`
    if (todoStore.items.some((item) => item.id === todoId)) return
    todoStore.items.unshift({
      id: todoId,
      type: 'text',
      bucket: 'today',
      title: task.title,
      status: 'open',
      result: '',
      group: current.name,
      taskBridgeConversationId: conversationId.value,
      taskBridgeTaskId: task.id,
    })
  })
}

function publishBackfill() {
  const current = bridgeStore.publishBackfill(conversationId.value)
  if (!current) return
  // 回填确认后直接回到团队计划，不再经过“已发布”抽屉。
  current.echoPublished = true
  activePanel.value = 'plan'
  flash('回填已确认，已返回团队计划')
}

function publishEcho() {
  bridgeStore.publishEcho(conversationId.value)
  flash(`执行回声已写入任务背景 v${project.value.snapshot.version}`)
}
</script>

<style scoped>
.bridge-shell { width:100%; max-width:100%; height: 100%; min-height: 0; display: flex; flex-direction: column; background: #fff; color: #2f3547; position: relative; overflow: hidden; }
.bridge-empty-state { display:flex; flex:1; min-height:0; align-items:center; justify-content:center; flex-direction:column; gap:8px; background:#fff; color:#8b93a0; font-size:13px; text-align:center; }.bridge-empty-state strong{color:#3d4552;font-size:16px}.bridge-empty-state span{max-width:280px;line-height:1.6}
.bridge-shell::before { content: ''; position: absolute; inset: 0; pointer-events: none; background-image: radial-gradient(circle, rgba(255,151,133,.26) 1.1px, transparent 1.3px); background-size: 18px 18px; -webkit-mask-image: linear-gradient(to bottom, #000 0%, transparent 62%); mask-image: linear-gradient(to bottom, #000 0%, transparent 62%); }
.bridge-header,.bridge-body,.bridge-next-step { position: relative; z-index: 1; }
.bridge-header { min-height: 50px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; border-bottom: 1px solid rgba(229,230,235,.9); }
.bridge-title { display: flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 650; }
.bridge-actions { display: flex; gap: 8px; }.bridge-actions button { display:inline-flex; align-items:center; gap:5px; border: 0; border-radius: 7px; padding: 6px 9px; background: transparent; color: #697184; cursor: pointer; font-size: 12px; }.bridge-actions button svg{flex:0 0 auto;opacity:.8}.bridge-actions button:hover,.bridge-actions button.active { background: #f4f5f7; color: #2f3547; }
.bridge-body { position:relative; flex: 1; min-height: 0; min-width:0; display: flex; overflow:hidden; }.bridge-conversation { position:relative; flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }.conversation-scroll { flex: 1; min-height: 0; overflow: auto; padding: 26px min(9vw,120px); box-sizing:border-box; }
.bridge-conversation-empty { display:flex; min-height:100%; box-sizing:border-box; padding-bottom:54px; align-items:center; justify-content:center; flex-direction:column; gap:7px; color:#969daa; text-align:center; }
.bridge-conversation-empty strong { color:#3d4552; font-size:16px; font-weight:600; letter-spacing:-.01em; }
.bridge-conversation-empty span { max-width:420px; font-size:12px; line-height:1.6; }
.system-event { margin: 0 auto 12px; text-align: center; color: #a0a6b2; font-size: 12px; }.bridge-message { display: flex; gap: 10px; max-width: 720px; margin: 18px auto; }.bridge-message.is-user { flex-direction: row-reverse; }.message-avatar { width: 30px; height: 30px; overflow: hidden; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto; background: #eee8ff; color: #7257d9; font-size: 12px; font-weight: 700; }.message-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }.is-user .message-avatar { background: #ffede5; color: #ee6c37; }.message-content { min-width: 0; }.message-content strong { font-size: 13px; }.message-content p { margin: 5px 0 0; padding: 10px 12px; border-radius: 4px 12px 12px 12px; background: rgba(255,255,255,.9); line-height: 1.65; font-size: 13px; box-shadow: 0 1px 5px rgba(47,53,71,.05); white-space: pre-wrap; }.is-user .message-content p { border-radius: 12px 4px 12px 12px; background: #fff0e9; }
.discussion-hint { max-width: 520px; margin: 90px auto 0; text-align: center; display: flex; flex-direction: column; gap: 11px; color: #8a92a2; font-size: 13px; }.discussion-hint button { margin: 0 auto; border: 0; border-radius: 8px; padding: 8px 14px; background: #ff621f; color: #fff; font-weight: 600; cursor: pointer; }.discussion-hint small { color: #a5abb5; }
.assignment-card { width:min(100%, 560px); margin:26px auto 6px; overflow:hidden; border:1px solid #f1ded4; border-radius:16px; background:rgba(255,255,255,.97); box-shadow:0 14px 32px rgba(91,67,55,.10); }
.assignment-card-head { display:flex; align-items:center; justify-content:space-between; padding:16px 18px 13px; border-bottom:1px solid #f3e8e2; background:linear-gradient(115deg,#fff9f5,#fff); }.assignment-card-head div{display:flex;align-items:baseline;gap:9px}.assignment-card-head span{display:inline-flex;align-items:center;color:#ff621f;font-size:11px;font-weight:700;letter-spacing:.05em}.assignment-card-head span.is-generating i{display:inline-block;color:#ff9b73;font-style:normal;animation:assignment-shimmer-wave 1.25s ease-in-out infinite;animation-delay:calc(var(--shimmer-index) * 55ms)}@keyframes assignment-shimmer-wave{0%,100%{opacity:.58;transform:translateY(0) rotate(0deg);color:#ff9b73}50%{opacity:1;transform:translateY(-2px) rotate(-2deg);color:#ff621f}}.assignment-card-head strong{color:#313846;font-size:16px}.assignment-card-head small{padding:4px 8px;border-radius:999px;background:#fff0e9;color:#e96c38;font-size:11px;font-weight:650}
.assignment-summary { display:flex; align-items:flex-start; gap:8px; margin:13px 18px 4px; color:#8a92a0; font-size:11px; line-height:1.5; }.assignment-summary-dot{width:6px;height:6px;flex:0 0 auto;margin-top:5px;border-radius:50%;background:#ff8b55;box-shadow:0 0 0 3px #fff1ea}
.assignment-row { display:flex; gap:11px; margin:0 12px; padding:13px 6px; border-bottom:1px solid #f4f0ed; }.assignment-number{display:grid;place-items:center;flex:0 0 auto;width:25px;height:25px;margin-top:1px;border-radius:8px;background:#fff1e9;color:#ee733f;font-size:10px;font-weight:750}.assignment-copy{min-width:0;display:flex;flex:1;flex-direction:column;gap:4px}.assignment-copy>strong{color:#343b49;font-size:13px}.assignment-copy>small{color:#818a98;font-size:11px;line-height:1.5}.assignment-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}.assignment-meta span{padding:2px 6px;border-radius:5px;background:#f7f8fa;color:#798290;font-size:10px}.assignment-meta span:first-child{background:#eef5ff;color:#5679a9}
.assignment-actions{display:flex;justify-content:flex-end;gap:9px;padding:13px 18px 15px;background:#fffdfc}.assignment-actions button{border-radius:8px;padding:8px 12px;font-size:12px;font-weight:650;cursor:pointer}.assignment-edit{border:1px solid #e9e1dc;background:#fff;color:#69717e}.assignment-confirm{border:1px solid #ff621f;background:#ff621f;color:#fff;box-shadow:0 5px 12px rgba(255,98,31,.20)}.assignment-waiting{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid #f3ddd3;border-radius:8px;background:#fff8f4;color:#9b7466;font-size:11px;font-weight:600}.assignment-waiting i{width:12px;height:12px;border:2px solid #f0c3b2;border-top-color:#ff621f;border-radius:50%;animation:assignment-spin .8s linear infinite}.assignment-actions button:active{transform:translateY(1px)}.assignment-actions button:focus-visible{outline:2px solid #5d9cf7;outline-offset:2px}@keyframes assignment-spin{to{transform:rotate(360deg)}}
.task-conversation { max-width: 720px; margin: 4px auto 0; }.task-conversation-context { display:flex; flex-direction:column; gap:4px; margin:0 auto 20px; padding:12px 14px; border:1px solid #f0ded5; border-radius:10px; background:#fffaf7; color:#7f8795; font-size:12px; }.task-conversation-context span { color:#ff621f; font-size:11px; font-weight:650; }.task-conversation-context b { color:#303746; font-size:15px; }.task-conversation-context small { color:#949ba8; }.task-context-card { display:flex; flex-direction:column; gap:8px; margin-top:13px; padding:12px; border:1px solid #eceef2; border-radius:10px; background:#fff; }.task-context-card strong { font-size:14px; }.task-context-card small,.task-context-card p { margin:0; color:#87909d; font-size:12px; line-height:1.55; }.task-context-card p { color:#606a79; }
.project-task-list { max-width: 720px; margin: 26px auto 0; padding: 15px; background: rgba(255,255,255,.82); border: 1px solid #eceef1; border-radius: 12px; }.section-heading { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; font-weight: 650; }.section-heading small,.task-row small { color: #939aa7; font-size: 11px; font-weight: 400; }.task-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid #f1f2f4; }.task-row>div { display:flex; flex-direction:column; gap:3px; flex:1; }.task-row strong { font-size: 13px; }.task-state { width: 8px; height: 8px; border-radius: 50%; background:#bfc5ce; }.task-state.is-in_progress{background:#ff8b4d}.task-state.is-done{background:#26b56a}.task-label{font-size:11px;color:#8f97a5}
.bridge-composer { margin: 0 32px 20px; padding: 11px 14px 9px; border: 1.5px solid #dce2eb; border-radius: 15px; background: #fff; box-shadow: 0 8px 22px rgba(82,98,122,.10); }.bridge-composer:focus-within { border-color:#80b5ff; box-shadow:0 8px 22px rgba(67,130,226,.16); }.bridge-composer textarea { width:100%; resize:none; border:0; outline:0; color:#303746; font:13px/1.55 PingFang SC,sans-serif; background:transparent; box-sizing:border-box; }.composer-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; color:#a1a8b4; font-size:11px; }.composer-footer button { border:0; border-radius:7px; padding:6px 13px; background:#2f3547; color:white; cursor:pointer; }.composer-footer button:disabled { opacity:.4; cursor:not-allowed; }
.bridge-composer-shell{position:relative;max-width:780px;margin:0 auto;padding:11px 14px 9px;border:1.5px solid #dce2eb;border-radius:15px;background:#fff;box-shadow:0 8px 22px rgba(82,98,122,.10)}.bridge-composer-shell:focus-within{border-color:#80b5ff;box-shadow:0 8px 22px rgba(67,130,226,.16)}.bridge-composer textarea{display:block;width:100%;min-height:38px;box-sizing:border-box;resize:none;border:0;outline:0;background:transparent;color:#303746;font:13px/1.55 PingFang SC,sans-serif}.bridge-composer textarea::placeholder{color:#a1a8b4}.bridge-composer-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:7px}.bridge-composer-tools{display:flex;align-items:center;gap:7px}.bridge-composer-tools button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:1px solid #e0e5ee;border-radius:8px;background:#fff;color:#647084;cursor:pointer;font-size:16px;line-height:1}.bridge-composer-tools--right{gap:8px}.bridge-composer-pill{display:flex!important;align-items:center;gap:5px;width:auto!important;padding:0 10px!important;border:0!important;background:#f5f7fb!important;color:#344055!important;font-size:12px!important}.bridge-composer-pill span{font-size:15px;color:#56677e}.bridge-composer-pill b{color:#f5872f;font-size:15px}.bridge-composer-pill i{color:#8d96a5;font-style:normal;font-size:13px}.bridge-composer-send{width:32px!important;height:32px!important;border:0!important;border-radius:50%!important;background:#aab1bd!important;color:#fff!important;font-size:15px!important}.bridge-composer-send:not(:disabled){background:#6d7888!important;cursor:pointer}.bridge-composer-send:disabled{cursor:not-allowed;opacity:.85}.bridge-composer-disclaimer{max-width:780px;margin:8px auto 0;color:#a6acb9;text-align:center;font-size:11px;line-height:16px}.bridge-panel { width: 330px; flex: 0 0 330px; align-self:stretch; margin-left:auto; overflow: auto; box-sizing: border-box; border-left: 1px solid #eaecf0; background: #fff; padding: 18px 16px; }.panel-head { display:flex; justify-content:space-between; gap:10px; padding-bottom:13px; border-bottom:1px solid #eef0f2; }.panel-head div { display:flex; flex-direction:column; gap:4px; }.panel-head strong { font-size:15px; }.panel-head small { color:#9299a6; font-size:11px; line-height:1.4; }.panel-head button { border:0; background:transparent; color:#64748b; cursor:pointer; font-size:12px; }.context-note,.base-card { margin:13px 0; padding:10px; border-radius:9px; background:#fff8f4; color:#6f7683; font-size:12px; line-height:1.55; }.context-note b { display:block; color:#ff621f; margin-bottom:4px; }.draft-task-card { margin-top:12px; padding:12px; border:1px solid #eceef2; border-radius:10px; background:#fff; }.draft-task-title { display:flex; justify-content:space-between; gap:8px; margin-bottom:10px; }.draft-task-title strong{font-size:13px}.draft-task-title span{font-size:10px;color:#f17a46;background:#fff0e8;border-radius:4px;padding:2px 5px}.draft-task-card label,.long-field { display:flex; flex-direction:column; gap:5px; margin-top:9px; color:#8b93a0; font-size:11px; }.draft-task-card input,.draft-task-card textarea,.long-field textarea { box-sizing:border-box; width:100%; border:1px solid #e5e8ed; border-radius:6px; padding:7px; outline:0; color:#3b4250; font:12px/1.45 PingFang SC,sans-serif; resize:vertical; }.draft-task-card input:focus,.draft-task-card textarea:focus,.long-field textarea:focus { border-color:#f09a78; }.panel-footer { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }.panel-footer button { border:0; border-radius:7px; padding:8px 10px; cursor:pointer; font-size:12px; }.panel-footer .quiet{background:#f3f4f6;color:#6d7581}.panel-footer .primary{background:#ff621f;color:#fff}.plan-list{display:flex;flex-direction:column}.plan-item{display:flex;gap:9px;padding:12px 0;border-bottom:1px solid #f0f1f3}.plan-item>span{width:8px;height:8px;border-radius:50%;background:#ff8b4d;margin-top:5px}.plan-item div{display:flex;flex-direction:column;gap:3px}.plan-item b{font-size:13px}.plan-item small{font-size:11px;color:#949ba7}.panel-empty{padding:30px 12px;color:#a0a6b1;text-align:center;font-size:12px}.base-card b{color:#ff621f;font-size:12px}.base-card p{margin:6px 0}.base-card small{color:#959ca8}.echo-success{padding:10px;border-radius:8px;background:#ebf9f0;color:#228b55;font-size:12px;line-height:1.5}
.bridge-next-step { position:absolute; z-index:4; bottom:136px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid #f0dbcf; border-radius:10px; background:#fff; box-shadow:0 10px 24px rgba(47,53,71,.15); color:#647080; font-size:12px; white-space:nowrap; }.bridge-next-step button{border:0;border-radius:6px;padding:6px 9px;background:#ff621f;color:#fff;cursor:pointer;font-size:12px}.bridge-next-step .text-link{background:transparent;color:#596c98;text-decoration:underline;padding:4px}.bridge-toast{position:absolute;z-index:8;top:62px;left:50%;transform:translateX(-50%);padding:9px 14px;border-radius:8px;background:#2f3547;color:#fff;font-size:12px;box-shadow:0 8px 20px rgba(47,53,71,.2)}.bridge-toast-enter-active,.bridge-toast-leave-active{transition:opacity .18s,transform .18s}.bridge-toast-enter-from,.bridge-toast-leave-to{opacity:0;transform:translate(-50%,-6px)}
.snapshot-source{display:block;margin-top:8px;color:#a4aab5;font-size:10px;line-height:1.35;letter-spacing:.01em}
.base-preview-section{padding:13px 0;border-bottom:1px solid #eef0f3}.base-preview-section span{display:block;margin-bottom:5px;color:#8e97a5;font-size:11px}.base-preview-section p{margin:0;color:#535d6c;font-size:12px;line-height:1.55}
.base-member-stack{display:flex!important;align-items:center;min-height:32px;margin:2px 0 10px!important;padding-left:4px}.base-member-stack>span{display:block!important;width:30px;height:30px;margin:0 0 0 -6px!important;padding:2px;border:2px solid #fff;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(47,53,71,.12)}.base-member-stack>span:first-child{margin-left:0!important}.base-member-stack img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover}
.base-member-add{display:grid!important;place-items:center;width:30px;height:30px;margin-left:6px;padding:0;border:1px dashed #cbd2dd;border-radius:50%;background:#fff;color:#8993a3;font-size:19px;font-weight:400;line-height:1;cursor:pointer;transition:border-color .15s,color .15s,background .15s}.base-member-add:hover{border-color:#ff9a76;background:#fff8f4;color:#ff621f}
.team-dashboard{margin:12px 0 14px;padding:13px;border:1px solid #edf0f4;border-radius:12px;background:linear-gradient(145deg,#fff 0%,#fcfcfd 100%);box-shadow:0 5px 16px rgba(47,53,71,.05)}.team-dashboard-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:11px}.team-dashboard-head div{display:flex;align-items:baseline;gap:7px}.team-dashboard-head strong{color:#303746;font-size:13px}.team-dashboard-head span{color:#9299a6;font-size:10px}.dashboard-more{width:28px;height:24px;margin-top:-3px;padding:0;border:0;border-radius:6px;background:transparent;color:#8d96a5;font-size:16px;line-height:1;letter-spacing:1px;cursor:pointer}.dashboard-more:hover{background:#f2f4f7;color:#3b4453}.dashboard-kpis{display:grid;grid-template-columns:repeat(3,1fr);overflow:hidden;border:1px solid #edf0f4;border-radius:9px;background:#fff}.dashboard-kpis div{display:flex;flex-direction:column;gap:4px;padding:9px 8px;border-right:1px solid #edf0f4}.dashboard-kpis div:last-child{border-right:0}.dashboard-kpis span,.dashboard-section-title span{color:#8d96a5;font-size:10px}.dashboard-kpis strong{color:#303746;font-size:17px;font-weight:650;letter-spacing:-.02em}.dashboard-load{padding:12px 0 10px;border-bottom:1px solid #edf0f4}.dashboard-section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.dashboard-section-title b{color:#596273;font-size:10px;font-weight:600}.dashboard-progress{height:7px;overflow:hidden;border-radius:999px;background:#eef1f4}.dashboard-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff9a73,#ff621f)}.dashboard-load-meta{display:flex;align-items:center;justify-content:space-between;margin-top:6px}.dashboard-load-meta span{color:#ff621f;font-size:11px;font-weight:650}.dashboard-load-meta small{color:#9299a6;font-size:9px}.dashboard-attention{padding:11px 0 8px;border-bottom:1px solid #edf0f4}.dashboard-attention .dashboard-section-title{margin-bottom:6px}.dashboard-attention .dashboard-section-title b{min-width:17px;height:17px;display:inline-grid;place-items:center;border-radius:50%;background:#fff0e9;color:#e66a3c;font-size:10px}.dashboard-attention p{display:flex;align-items:center;gap:6px;margin:6px 0;color:#596273;font-size:10px;line-height:1.35}.dashboard-attention svg{width:13px;height:13px;flex:0 0 13px;fill:none;stroke:#e78b60;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.dashboard-members{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:11px}.dashboard-members div{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:7px 8px;border-radius:7px;background:#f7f8fa}.dashboard-members strong{color:#303746;font-size:11px}.dashboard-members span{color:#8d96a5;font-size:9px;white-space:nowrap}
.base-mini-people{display:flex;flex-direction:column;gap:6px}.base-mini-people b{display:flex;justify-content:space-between;gap:8px;color:#4c5565;font-size:12px;font-weight:600}.base-mini-people small{color:#969daa;font-size:10px;font-weight:400;text-align:right}
.base-detail-action{display:inline-flex;align-items:center;gap:5px;color:#64748b!important}.base-detail-action:hover{color:#ff621f!important}
.dashboard-attention{border-bottom:0}
.team-plan-head{border-bottom:0}
@media (max-width: 960px) { .bridge-panel{position:absolute;top:0;right:0;bottom:0;left:auto;z-index:5;width:min(360px,86%);max-width:100%;margin-left:0;box-shadow:-12px 0 28px rgba(47,53,71,.14)}.conversation-scroll{padding-left:24px;padding-right:24px}.bridge-next-step{max-width:calc(100% - 32px);white-space:normal;flex-wrap:wrap} }
.panel-head .panel-head-actions { display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; gap: 8px; flex: 0 0 auto; }
.context-note span { display: block; margin-top: 3px; }
.draft-task-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.panel-close { width: 24px; height: 24px; display: inline-grid; place-items: center; padding: 0; border-radius: 6px; color: #9aa1ad !important; font-size: 20px !important; line-height: 1; }
.panel-close:hover { color: #2f3547 !important; background: #f1f3f5 !important; }
.panel-close:focus-visible { outline: 2px solid #ffb092; outline-offset: 2px; }
.bridge-composer{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}.bridge-composer:focus-within{border:0;box-shadow:none}
.plan-item{display:block;padding:0}.plan-item-toggle{display:flex;align-items:center;width:100%;gap:9px;padding:12px 0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.plan-item-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:#ff8b4d}.plan-item-main{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.plan-item-main b{font-size:13px}.plan-item-main small{color:#949ba7;font-size:11px}.plan-submit-status{flex:0 0 auto;padding:3px 6px;border-radius:5px;font-size:10px}.plan-submit-status.is-submitted{background:#eaf7ef;color:#2c965d}.plan-submit-status.is-pending{background:#f1f2f4;color:#89919d}.plan-item-chevron{width:16px;color:#8f97a5;text-align:center;font-size:14px}.plan-item-detail{display:flex;flex-direction:column;gap:7px;margin:0 0 10px 17px;padding:10px 11px;border:1px solid #eceef2;border-radius:8px;background:#fafbfc;color:#586272;font-size:11px;line-height:1.5}.plan-item-detail p{margin:0}.plan-item-detail p span{display:block;margin-bottom:2px;color:#9aa1ad;font-size:10px}.plan-item.is-expanded .plan-item-toggle{color:#303746}
.bridge-panel{animation:bridge-panel-in .24s cubic-bezier(.22,1,.36,1) both}.bridge-message{animation:bridge-message-in .24s ease-out both}.assignment-card{animation:bridge-rise-in .28s cubic-bezier(.22,1,.36,1) both}.task-file-card{animation:bridge-rise-in .24s ease-out both}.task-backfill-card{animation:bridge-rise-in .28s cubic-bezier(.22,1,.36,1) both}.plan-item{animation:plan-item-in .22s ease-out both}.plan-item-toggle,.bridge-actions button,.assignment-actions button,.task-file-card button,.task-backfill-card footer button{transition:background-color .18s ease,color .18s ease,border-color .18s ease,box-shadow .18s ease,transform .18s ease}.bridge-actions button:active,.assignment-actions button:active,.task-file-card button:active,.task-backfill-card footer button:active{transform:scale(.96)}.bridge-composer-send{transition:transform .16s ease,background-color .18s ease,box-shadow .18s ease}.bridge-composer-send:active:not(:disabled){transform:scale(.94)}.plan-item-detail{animation:plan-detail-in .18s ease-out both}.plan-item-chevron{transition:transform .18s ease}.plan-item.is-expanded .plan-item-chevron{transform:rotate(180deg)}@keyframes bridge-panel-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}@keyframes bridge-message-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes bridge-rise-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes plan-item-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}@keyframes plan-detail-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion: reduce){.bridge-panel,.bridge-message,.assignment-card,.assignment-card-head span.is-generating i,.task-file-card,.task-backfill-card,.plan-item,.plan-item-detail{animation:none!important}.bridge-actions button,.assignment-actions button,.task-file-card button,.task-backfill-card footer button,.bridge-composer-send,.plan-item-toggle,.plan-item-chevron{transition:none!important}}
 .task-file-card{display:flex;align-items:center;gap:10px;margin-top:9px;padding:12px;border:1px solid #e5e8ed;border-radius:10px;background:#fff}.task-file-icon{display:grid;place-items:center;width:32px;height:38px;border-radius:7px;background:#d9f5f1;color:#1eaaa0;font-weight:800}.task-file-card>div{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.task-file-card strong{font-size:13px}.task-file-card small{color:#8b93a0;font-size:11px}.task-file-card button{border:0;border-radius:7px;padding:6px 9px;background:#fff0e9;color:#d75c2c;font-size:11px;cursor:pointer}.task-backfill-card{max-width:680px;margin:20px auto;padding:16px;border:1px solid #dce6f4;border-radius:12px;background:#f5f9ff;box-shadow:0 6px 18px rgba(63,95,135,.08)}.task-backfill-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.task-backfill-card header div{display:flex;flex-direction:column;gap:4px}.task-backfill-card header span{color:#4f82c7;font-size:11px}.task-backfill-card header strong{font-size:16px}.task-backfill-card header em{padding:4px 7px;border-radius:5px;background:#e6f0ff;color:#4c81c8;font-size:10px;font-style:normal}.task-backfill-intro{color:#64748b;font-size:12px;line-height:1.5}.task-backfill-card label{display:flex;flex-direction:column;gap:5px;margin-top:10px;color:#667085;font-size:11px}.task-backfill-card textarea{box-sizing:border-box;width:100%;resize:vertical;border:1px solid #dce4ef;border-radius:7px;padding:8px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.task-backfill-card textarea:focus{border-color:#7ca8df;box-shadow:0 0 0 3px #eaf2ff}.task-backfill-check{flex-direction:row!important;align-items:center;gap:7px!important}.task-backfill-check input{accent-color:#4f82c7}.task-backfill-card footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.task-backfill-card footer button{border:1px solid #dce4ef;border-radius:7px;padding:7px 11px;background:#fff;color:#657080;cursor:pointer;font-size:11px}.task-backfill-card footer .task-backfill-primary{border-color:#4f82c7;background:#4f82c7;color:#fff}
 .task-backfill-artifact-field{gap:6px!important}.task-backfill-artifact{display:flex;align-items:center;gap:8px}.task-backfill-artifact-file{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:9px 10px;border:1px solid #dce4ef;border-radius:8px;background:#fff}.task-backfill-artifact-file>div{display:flex;flex-direction:column;gap:3px;min-width:0}.task-backfill-artifact-file strong{overflow:hidden;color:#303746;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.task-backfill-artifact-file small{color:#98a0ad;font-size:10px}.task-backfill-artifact-edit{display:grid;place-items:center;width:30px;height:30px;flex:0 0 30px;padding:0;border:1px solid #dce4ef;border-radius:7px;background:#fff;color:#657080;cursor:pointer}.task-backfill-artifact-edit:hover{border-color:#7ca8df;color:#4f82c7;background:#f7fbff}.task-backfill-artifact-field>input{box-sizing:border-box;width:100%;border:1px solid #dce4ef;border-radius:7px;padding:8px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.task-backfill-artifact-field>input:focus{border-color:#7ca8df;box-shadow:0 0 0 3px #eaf2ff}
 .snapshot-context-editor{margin-top:14px;padding-top:13px;border-top:1px solid #f0f1f3}.snapshot-context-editor__head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:9px}.snapshot-context-editor__head>div{display:flex;flex-direction:column;gap:3px}.snapshot-context-editor__head strong{color:#4b5565;font-size:12px}.snapshot-context-editor__head small{color:#9aa1ad;font-size:10px;line-height:1.4}.snapshot-context-add{border:0;border-radius:5px;padding:4px 6px;background:#fff3ed;color:#e96c38;font-size:10px;cursor:pointer}.snapshot-context-add:hover{background:#ffe8dc}.snapshot-context-messages{display:flex;flex-direction:column;gap:8px}.snapshot-context-message{padding:8px;border:1px solid #eceef2;border-radius:8px;background:#fafbfc}.snapshot-context-message__meta{display:flex;align-items:center;gap:6px;margin-bottom:5px}.snapshot-context-message__meta span{color:#596273;font-size:10px;font-weight:650}.snapshot-context-message__meta small{flex:1;color:#a0a6b1;font-size:9px}.snapshot-context-message__meta button,.snapshot-context-constraints button{width:20px;height:20px;padding:0;border:0;border-radius:5px;background:transparent;color:#a0a6b1;font-size:16px;line-height:1;cursor:pointer}.snapshot-context-message__meta button:hover,.snapshot-context-constraints button:hover{background:#f1f3f5;color:#4b5565}.snapshot-context-message textarea{box-sizing:border-box;width:100%;resize:vertical;border:1px solid #e5e8ed;border-radius:6px;padding:7px;background:#fff;color:#3b4250;font:11px/1.45 PingFang SC,sans-serif;outline:0}.snapshot-context-message textarea:focus,.snapshot-context-constraints input:focus{border-color:#f09a78;box-shadow:0 0 0 2px rgba(240,154,120,.12)}.snapshot-context-empty{margin:0;padding:10px;border-radius:7px;background:#fafbfc;color:#9aa1ad;font-size:10px;line-height:1.5}.snapshot-context-constraints{display:flex;flex-direction:column;gap:7px}.snapshot-context-constraints label{display:grid;grid-template-columns:22px 1fr 20px;align-items:center;gap:6px;margin:0}.snapshot-context-constraints label>span{display:grid;place-items:center;width:20px;height:20px;border-radius:5px;background:#fff3ed;color:#e96c38;font-size:9px;font-weight:650}.snapshot-context-constraints input{box-sizing:border-box;width:100%;border:1px solid #e5e8ed;border-radius:6px;padding:7px;background:#fff;color:#3b4250;font:11px/1.35 PingFang SC,sans-serif;outline:0}
.backfill-card-header{background:#fff}.backfill-section{background:#fff}.backfill-summary{display:flex;flex-direction:column;gap:5px}.backfill-summary strong{color:#303746;font-size:14px}.backfill-summary small{color:#8b94a1;font-size:11px}.backfill-section-label{display:flex;align-items:center;gap:6px;margin-bottom:9px;color:#667180;font-size:11px;font-weight:650}.backfill-section-label b{color:#d85e4d;font-size:10px}.backfill-section-label small{color:#9aa3ad;font-weight:400}.backfill-field{display:flex;flex-direction:column;gap:5px;margin:0 0 14px}.backfill-field:last-child{margin-bottom:0}.backfill-field textarea,.backfill-inline-input{box-sizing:border-box;width:100%;resize:vertical;border:1px solid #dfe4e9;border-radius:8px;padding:9px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.backfill-field textarea:focus,.backfill-inline-input:focus{border-color:#3157d5;box-shadow:0 0 0 3px #eef2ff}.backfill-inline-input{margin-top:8px}.backfill-checklist{background:#fbfcfd}.backfill-checklist label{display:flex;align-items:flex-start;gap:8px;margin:10px 0 0;color:#505b6b;font-size:11px;line-height:1.45}.backfill-checklist input{margin:1px 0 0;accent-color:#3157d5}.backfill-checklist label em{margin-left:auto;padding:2px 6px;border-radius:999px;background:#f0f2f5;color:#8b94a0;font-size:9px;font-style:normal;white-space:nowrap}.backfill-card-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;background:#fff}.backfill-card-footer button{padding:8px 12px;border-radius:8px;font-size:11px;cursor:pointer}.backfill-secondary{border:1px solid #dfe4e9;background:#fff;color:#5e6875}.backfill-primary{border:1px solid #3157d5;background:#3157d5;color:#fff;box-shadow:0 4px 10px rgba(49,87,213,.18)}
.completion-result{display:flex;flex-direction:column}.completion-result-labels{display:grid;grid-template-columns:repeat(3,1fr);color:#5e6875;text-align:center;font-size:11px}.completion-result-range{width:100%;height:22px;margin:2px 0 5px;appearance:none;background:transparent;cursor:pointer}.completion-result-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:#d8dee8}.completion-result-range::-webkit-slider-thumb{width:14px;height:14px;margin-top:-5px;appearance:none;border:3px solid #3157d5;border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(49,87,213,.25)}.completion-result-current{display:flex;flex-direction:column;gap:4px;margin-top:3px;padding:10px 12px;border-radius:8px;background:#f7f8fa}.completion-result-current strong{color:#303746;font-size:12px}.completion-result-current span{color:#7d8794;font-size:11px}.completion-result-fields{margin-top:12px;padding-top:12px;border-top:1px solid #edf0f3}.completion-result-fields .backfill-field span{color:#667180;font-size:11px}
.completion-result-range::-webkit-slider-runnable-track{background:linear-gradient(to right,#ff7747 0 var(--completion-progress),#d8dee8 var(--completion-progress) 100%)}.completion-result-range::-webkit-slider-thumb{width:16px;height:16px;margin-top:-6px;border:3px solid #ff7747;box-shadow:0 2px 8px rgba(255,119,71,.25);transition:transform .18s ease,box-shadow .18s ease}.completion-result-range:hover::-webkit-slider-thumb{transform:scale(1.12);box-shadow:0 3px 10px rgba(255,119,71,.32)}.completion-result-range:focus-visible{outline:2px solid #ffb092;outline-offset:3px}
.completion-result-labels button{border:0;background:transparent;color:#7d8794;font:inherit;cursor:pointer;transition:color .18s ease,transform .18s ease}.completion-result-labels button:hover,.completion-result-labels button.active{color:#ff7747;font-weight:700}.completion-result-labels button.active{transform:translateY(-1px)}.completion-result-current.is-result-0{background:#fff7f3}.completion-result-current.is-result-1{background:#fff9ed}.completion-result-current.is-result-2{background:#fff3f1}.completion-result-current.is-result-0 strong{color:#e7623b}.completion-result-current.is-result-1 strong{color:#b87816}.completion-result-current.is-result-2 strong{color:#c85246}
.task-backfill-card{background:#fffaf7!important;border-color:#f0ddd5!important;box-shadow:0 12px 30px rgba(184,96,58,.10)!important}
.task-backfill-card .backfill-card-header,.task-backfill-card .backfill-section,.task-backfill-card .backfill-card-footer{background:transparent!important}
.task-backfill-card .backfill-checklist{background:rgba(255,255,255,.46)!important}
.task-backfill-card .completion-result-current{background:rgba(255,255,255,.58)}
.task-backfill-card{max-width:620px!important;margin:24px auto!important;padding:0!important;overflow:hidden;border:1px solid #f0ddd5!important;border-radius:16px!important;background:#fffaf7!important;box-shadow:0 14px 32px rgba(145,81,48,.12)!important;color:#313744}.task-backfill-card .backfill-card-header{padding:24px 26px 18px!important;background:transparent!important;border:0!important}.backfill-card-kicker{display:flex;align-items:center;gap:8px;margin-bottom:10px}.backfill-card-kicker span{color:#d85c32!important;font-size:11px!important;font-weight:750;letter-spacing:.04em}.backfill-card-kicker em{padding:3px 7px!important;border-radius:999px!important;background:#ffe9df!important;color:#b84b27!important;font-size:10px!important;font-style:normal}.backfill-card-header strong{color:#2e3542!important;font-size:18px!important;letter-spacing:-.02em}.backfill-card-header small{margin-top:5px;color:#737d8c!important;font-size:12px!important;line-height:1.55}.backfill-context{display:flex;flex-direction:column;gap:4px;margin:0 26px;padding:13px 15px;border:1px solid #f1dfd7;border-radius:10px;background:rgba(255,255,255,.52)}.backfill-context>span{color:#8f776d;font-size:10px;font-weight:700}.backfill-context strong{overflow:hidden;color:#3b414c;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.backfill-context small{color:#8a929e;font-size:10px}.task-backfill-card .backfill-section{padding:22px 26px!important;background:transparent!important;border:0!important}.backfill-deliverable{padding-bottom:16px!important}.backfill-decision{padding-top:16px!important;border-top:1px solid #f1e3dc!important}.backfill-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.backfill-section-heading>div{display:flex;flex-direction:column;gap:3px}.backfill-section-heading small{color:#8a929e;font-size:10px;line-height:1.4}.backfill-section-heading>strong{padding-top:2px;color:#a7664e;font-size:10px;font-weight:650;white-space:nowrap}.backfill-section-label{margin:0!important;color:#4e5663!important;font-size:12px!important;font-weight:720!important}.backfill-section-label b{margin-left:2px;color:#d85c32!important;font-size:10px!important}.task-backfill-artifact{gap:9px!important}.task-backfill-artifact-file{padding:11px 12px!important;border-color:#eadfd9!important;border-radius:10px!important;background:rgba(255,255,255,.76)!important}.task-backfill-artifact-edit{width:36px!important;height:36px!important;flex-basis:36px!important;border-color:#e8d9d1!important;border-radius:9px!important;background:rgba(255,255,255,.7)!important;color:#7b6970!important}.task-backfill-artifact-edit:hover{border-color:#e88b66!important;background:#fff1ea!important;color:#d85c32!important}.backfill-inline-input,.backfill-field textarea{border-color:#e5d9d2!important;border-radius:9px!important;background:rgba(255,255,255,.84)!important;color:#373e4a!important}.backfill-inline-input:focus,.backfill-field textarea:focus{border-color:#e88059!important;box-shadow:0 0 0 3px rgba(232,128,89,.14)!important}.completion-result-labels{position:relative;z-index:1;gap:8px;margin-bottom:-2px}.completion-result-labels button{min-height:30px;border-radius:7px!important;color:#7a838f!important;font-size:12px!important}.completion-result-labels button.active{color:#cc542e!important;background:#fff0e9!important;transform:none!important}.completion-result-range{position:relative;z-index:0;height:28px!important;margin:-1px 0 7px!important}.completion-result-range::-webkit-slider-runnable-track{height:3px!important;background:linear-gradient(to right,#ee734b 0 var(--completion-progress),#eadcd4 var(--completion-progress) 100%)!important}.completion-result-range::-webkit-slider-thumb{width:15px!important;height:15px!important;margin-top:-6px!important;border-color:#ee734b!important;background:#fffaf7!important;box-shadow:0 1px 5px rgba(188,84,47,.24)!important}.completion-result-current{gap:3px!important;margin-top:0!important;padding:12px 14px!important;border:1px solid transparent;border-radius:10px!important;background:rgba(255,255,255,.55)!important}.completion-result-current strong{font-size:13px!important}.completion-result-current span{font-size:11px!important;line-height:1.45}.completion-result-current.is-result-0{border-color:#f5d6c9!important;background:#fff3ed!important}.completion-result-current.is-result-1{border-color:#f0dfb7!important;background:#fff9ec!important}.completion-result-current.is-result-2{border-color:#f0d2cd!important;background:#fff3f1!important}.completion-result-fields{margin-top:14px!important;padding-top:14px!important;border-top-color:#f0e4df!important}.backfill-field{gap:6px!important;margin:0 0 13px!important}.backfill-field span{color:#596271!important;font-size:11px!important;font-weight:650}.backfill-extra{margin:0 26px;border-top:1px solid #f1e3dc}.backfill-extra summary{display:flex;align-items:center;justify-content:space-between;padding:16px 0;color:#606977;font-size:12px;font-weight:650;cursor:pointer;list-style:none}.backfill-extra summary::-webkit-details-marker{display:none}.backfill-extra summary::after{content:'⌄';margin-left:7px;color:#a47c6d;font-size:15px;line-height:1}.backfill-extra[open] summary::after{transform:rotate(180deg)}.backfill-extra summary span{margin-left:auto;color:#989fa9;font-size:10px;font-weight:400}.backfill-extra>div{padding:0 0 3px}.task-backfill-card .backfill-checklist{margin-top:6px;padding-top:18px!important;padding-bottom:19px!important;background:rgba(255,255,255,.38)!important;border-top:1px solid #f1e3dc!important}.backfill-checklist label{gap:9px!important;margin:9px 0 0!important;color:#5d6674!important;font-size:11px!important}.backfill-checklist input{accent-color:#e46d46!important}.backfill-checklist label::after{content:'待确认';margin-left:auto;color:#999fa8;font-size:10px;white-space:nowrap}.task-backfill-card .backfill-card-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 26px!important;background:rgba(248,236,229,.66)!important;border-top:1px solid #efded6!important}.backfill-card-footer>span{color:#858d98;font-size:10px}.backfill-card-footer>div{display:flex;gap:8px}.backfill-card-footer button{min-height:34px!important;padding:7px 12px!important;border-radius:8px!important;font-size:11px!important;font-weight:650;white-space:nowrap}.backfill-secondary{border-color:#e2d4cc!important;background:rgba(255,255,255,.72)!important;color:#66707d!important}.backfill-primary{border-color:#e06439!important;background:#e06439!important;color:#fff!important;box-shadow:0 5px 12px rgba(206,83,43,.2)!important}.backfill-card-footer button:hover{transform:translateY(-1px)}.backfill-card-footer button:active{transform:translateY(0) scale(.98)}.backfill-card-footer button:focus-visible,.completion-result-labels button:focus-visible,.backfill-extra summary:focus-visible{outline:2px solid #e88059;outline-offset:2px}@media (max-width:640px){.task-backfill-card{margin:18px 0!important;border-radius:14px!important}.task-backfill-card .backfill-card-header,.task-backfill-card .backfill-section{padding-left:18px!important;padding-right:18px!important}.backfill-context,.backfill-extra{margin-left:18px;margin-right:18px}.task-backfill-card .backfill-card-footer{align-items:flex-start;flex-direction:column;padding:14px 18px!important}.backfill-card-footer>div{width:100%}.backfill-card-footer button{flex:1}.backfill-context strong{white-space:normal}.completion-result-labels{gap:3px}.completion-result-labels button{font-size:11px!important}}
.task-backfill-card{background:#fff!important}.backfill-card-kicker{flex-direction:row!important}.backfill-card-kicker strong{color:#2e3542!important;font-size:19px!important;font-weight:720!important;letter-spacing:-.025em}.backfill-context{background:#fff!important}.task-backfill-card .backfill-checklist,.task-backfill-card .backfill-card-footer{background:#fff!important}.backfill-extra{border-top:0!important}.backfill-extra summary::marker{content:''}.backfill-extra summary{flex-direction:row!important}.backfill-checklist label{display:grid!important;grid-template-columns:16px minmax(0,1fr) auto;align-items:center!important}.backfill-checklist input{margin:0!important}.backfill-checklist label>span{min-width:0}.backfill-checklist label::after{align-self:center}
.task-backfill-card .backfill-card-header{padding-top:20px!important;padding-bottom:14px!important}.backfill-card-header small{margin-top:12px!important}.backfill-context{margin-bottom:0!important;padding-top:12px!important;padding-bottom:12px!important}.task-backfill-card .backfill-section{padding-top:16px!important;padding-bottom:16px!important}.backfill-deliverable{padding-bottom:12px!important}.backfill-decision{padding-top:12px!important}.backfill-extra summary{padding-top:12px!important;padding-bottom:12px!important}.task-backfill-card .backfill-checklist{padding-top:14px!important;padding-bottom:14px!important}
.task-backfill-card.is-pending_acceptance,.task-backfill-card.is-accepted,.task-backfill-card.is-project_backfilled{padding-bottom:14px!important}
.task-backfill-outcome-shell{padding:0 26px 18px}
.task-backfill-outcome-shell .task-backfill-outcome{margin:0}
.task-backfill-card.is-pending_acceptance{min-height:166px!important;padding-bottom:18px!important;box-sizing:border-box}
@media (max-width:640px){.task-backfill-outcome-shell{padding:0 18px 18px}}
.plan-submit-status.is-review{background:#fff0e9;color:#d85c32}
.completion-result-labels button.active{color:#111!important;background:transparent!important}.completion-result-range{height:44px!important;margin:6px 0 10px!important;padding:2px 9px;box-sizing:border-box;border:1px solid #e5e6e8;border-radius:999px;background:#f4f5f6!important}.completion-result-range::-webkit-slider-runnable-track{height:38px!important;border-radius:999px;background:linear-gradient(to right,#050505 0 var(--completion-progress),#f4f5f6 var(--completion-progress) 100%)!important}.completion-result-range::-webkit-slider-thumb{width:38px!important;height:38px!important;margin-top:0!important;border:3px solid #050505!important;border-radius:50%!important;background:#fff!important;box-shadow:0 1px 2px rgba(0,0,0,.16)!important}.completion-result-range::-moz-range-track{height:38px;border-radius:999px;background:#f4f5f6}.completion-result-range::-moz-range-progress{height:38px;border-radius:999px;background:#050505}.completion-result-range::-moz-range-thumb{width:32px;height:32px;border:3px solid #050505;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.16)}.completion-result-range:focus-visible{outline:2px solid #111;outline-offset:3px}
.completion-result-control{position:relative;height:44px;margin:6px 0 10px;padding:2px 9px;box-sizing:border-box;overflow:hidden;border:1px solid #e5e6e8;border-radius:999px;background:#f4f5f6}.completion-result-control::before{content:'';position:absolute;inset:2px auto 2px 9px;width:var(--completion-progress);border-radius:999px;background:#050505}.completion-result-control::after{content:'';position:absolute;z-index:1;top:3px;left:var(--completion-progress);width:38px;height:38px;box-sizing:border-box;border:3px solid #050505;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.16);transform:translateX(-50%)}.completion-result-control-label{position:absolute;z-index:1;top:50%;left:calc(var(--completion-progress) / 2);transform:translate(-50%,-50%);color:#fff;font-size:12px;font-weight:700;line-height:1;white-space:nowrap;pointer-events:none}.completion-result-control:focus-within{outline:2px solid #111;outline-offset:3px}.completion-result-control .completion-result-range{position:absolute;inset:0;z-index:2;width:100%;height:100%!important;margin:0!important;padding:0!important;border:0;background:transparent!important;opacity:0;cursor:pointer}.completion-result-control .completion-result-range::-webkit-slider-runnable-track,.completion-result-control .completion-result-range::-moz-range-track{background:transparent!important}.completion-result-control .completion-result-range::-webkit-slider-thumb,.completion-result-control .completion-result-range::-moz-range-thumb{opacity:0}
.completion-result{position:relative}.completion-result-labels{display:grid!important;grid-template-columns:repeat(3,1fr);gap:3px!important;margin:0!important;padding:3px;border:1px solid #e5e6e8;border-radius:11px;background:#f3f4f5}.completion-result-labels button{min-height:36px!important;border-radius:8px!important;color:#737983!important;font-size:12px!important;font-weight:600!important}.completion-result-labels button:hover{color:#111!important;background:#e9eaec!important}.completion-result-labels button.active{color:#fff!important;background:#111!important;box-shadow:0 2px 5px rgba(0,0,0,.12)!important}.completion-result-control{height:1px!important;margin:0!important;padding:0!important;overflow:visible!important;border:0!important;background:transparent!important;outline:0!important}.completion-result-control::before,.completion-result-control::after,.completion-result-control-label{display:none!important}.completion-result-control .completion-result-range{position:absolute;top:-42px;left:0;width:100%;height:40px!important;opacity:0;pointer-events:none}.completion-result-control:focus-within{outline:2px solid #111;outline-offset:3px}.completion-result-current{margin-top:14px!important;border-color:#e8e9eb!important;background:#fafafa!important}.completion-result-current.is-result-0,.completion-result-current.is-result-1,.completion-result-current.is-result-2{border-color:#e8e9eb!important;background:#fafafa!important}.completion-result-current.is-result-0 strong,.completion-result-current.is-result-1 strong,.completion-result-current.is-result-2 strong{color:#20242b!important}
.completion-result-labels button.active{background:#ff621f!important;box-shadow:0 2px 6px rgba(255,98,31,.22)!important}
.task-backfill-card .backfill-card-footer{justify-content:flex-end!important}.backfill-card-footer>div{display:flex!important;margin-left:auto}
.task-backfill-feedback,.task-backfill-outcome{display:flex;flex-direction:column;gap:6px;margin:0 26px 14px;padding:12px 14px;border:1px solid;border-radius:10px;font-size:12px;line-height:1.5}.task-backfill-feedback.is-error{border-color:#f1c9c4;background:#fff5f4;color:#b8473f}.task-backfill-feedback.is-loading{border-color:#cadcf7;background:#f5f9ff;color:#3a68a7}.task-backfill-outcome.is-pending_acceptance{border-color:#f1d2c5;background:#fff8f4;color:#92563e}.task-backfill-outcome.is-accepted,.task-backfill-outcome.is-project_backfilled{border-color:#cbe7d7;background:#f3fbf6;color:#28764b}.task-backfill-outcome strong{font-size:13px}.task-backfill-outcome button{align-self:flex-start;border:1px solid currentColor;border-radius:7px;padding:7px 10px;background:#fff;color:inherit;font:650 11px/1 PingFang SC,sans-serif;cursor:pointer}.plan-submit-status.is-review{background:#fff0e9;color:#d85c32}.plan-submit-status.is-changes{background:#fff0ef;color:#bd5349}.plan-submit-status.is-accepted,.plan-submit-status.is-completed{background:#eaf7ef;color:#2c965d}.plan-review-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;padding-top:9px;border-top:1px solid #e9edf1}.plan-review-actions>span{color:#8d96a5;font-size:10px}.plan-review-actions>div{display:flex;gap:6px}.plan-review-actions button{border:1px solid #e2c8c1;border-radius:6px;padding:5px 7px;background:#fff;color:#a65348;font-size:10px;cursor:pointer}.plan-review-actions button.is-approve{border-color:#bde0ca;background:#eff9f2;color:#28764b}
.bridge-message{position:relative}.project-message-delete{position:absolute;top:0;right:-32px;display:grid;place-items:center;width:24px;height:24px;padding:0;border:1px solid #e7eaee;border-radius:6px;background:#fff;color:#9aa1ad;font-size:16px;line-height:1;cursor:pointer;opacity:0;transform:translateX(-3px);transition:opacity .16s ease,transform .16s ease,color .16s ease,border-color .16s ease}.bridge-message:hover .project-message-delete,.project-message-delete:focus-visible{opacity:1;transform:translateX(0)}.project-message-delete:hover{border-color:#e19489;background:#fff5f3;color:#bd5549}.task-backfill-artifact-actions{display:flex;gap:6px}.task-backfill-artifact-remove{display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid #efcfca;border-radius:7px;background:#fff;color:#b7564b;font-size:17px;line-height:1;cursor:pointer}.task-backfill-artifact-remove:hover{border-color:#d9675c;background:#fff5f4}.task-backfill-artifact-file.is-empty{border-style:dashed;background:#fffaf8}
.bridge-state-view{display:flex;flex:1;min-height:0;box-sizing:border-box;align-items:center;justify-content:center;flex-direction:column;padding:44px 24px;color:#697485;text-align:center}.bridge-state-view strong{margin-top:14px;color:#303746;font-size:15px;font-weight:680}.bridge-state-view p{max-width:330px;margin:8px 0 0;color:#8993a1;font-size:12px;line-height:1.65}.bridge-state-mark{display:grid;place-items:center;width:46px;height:46px;border:1px solid #dfe5ed;border-radius:15px;background:#f8fafc;color:#64748b;font-size:23px;font-weight:700;box-shadow:0 6px 18px rgba(34,48,68,.05)}.bridge-state-view.is-error .bridge-state-mark{border-color:#f0cbc7;background:#fff6f5;color:#c15b52}.bridge-state-view.is-permission .bridge-state-mark{border-color:#f0dcae;background:#fffaf0;color:#aa7a28}.bridge-state-mark:has(i){display:flex;gap:4px;align-items:center;justify-content:center}.bridge-state-mark i{display:block;width:4px;height:4px;border-radius:50%;background:currentColor;animation:bridge-state-pulse 1s ease-in-out infinite}.bridge-state-mark i:nth-child(2){animation-delay:.14s}.bridge-state-mark i:nth-child(3){animation-delay:.28s}.bridge-state-skeleton{display:grid;width:min(100%,410px);gap:9px;margin-top:24px}.bridge-state-skeleton span{display:block;height:11px;border-radius:999px;background:linear-gradient(90deg,#eef2f6 25%,#f8fafc 38%,#eef2f6 63%);background-size:400% 100%;animation:bridge-state-shimmer 1.25s ease-in-out infinite}.bridge-state-skeleton span:nth-child(2){width:82%}.bridge-state-skeleton span:nth-child(3){width:63%}.bridge-state-actions{display:flex;gap:8px;margin-top:20px}.bridge-state-actions button{min-height:34px;border-radius:8px;padding:0 12px;font:650 12px/1 PingFang SC,sans-serif;cursor:pointer;transition:transform .16s ease,background .16s ease}.bridge-state-actions button:active{transform:scale(.98)}.bridge-state-primary{border:1px solid #ff621f;background:#ff621f;color:#fff}.bridge-state-secondary{border:1px solid #dfe4eb;background:#fff;color:#5b6675}.bridge-state-primary:focus-visible,.bridge-state-secondary:focus-visible{outline:2px solid #3157d5;outline-offset:2px}.dashboard-state-control{position:relative}.dashboard-state-menu{position:absolute;z-index:20;top:28px;right:0;display:flex;width:122px;flex-direction:column;overflow:hidden;border:1px solid #e5e9ef;border-radius:9px;background:#fff;box-shadow:0 10px 24px rgba(30,43,61,.14)}.dashboard-state-menu>span{padding:9px 10px 6px;color:#9aa3af;font-size:10px}.dashboard-state-menu button{border:0;padding:8px 10px;background:#fff;color:#596473;font:12px/1.2 PingFang SC,sans-serif;text-align:left;cursor:pointer}.dashboard-state-menu button:hover{background:#f5f7fa;color:#303746}.dashboard-state-menu button:last-child{margin-top:3px;border-top:1px solid #edf0f3;color:#708094}@keyframes bridge-state-pulse{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-3px);opacity:1}}@keyframes bridge-state-shimmer{to{background-position:-135% 0}}@media (prefers-reduced-motion:reduce){.bridge-state-mark i,.bridge-state-skeleton span{animation:none}}
.dashboard-head-actions{display:flex;align-items:center;gap:2px}.dashboard-expand{display:grid;place-items:center;width:28px;height:24px;margin-top:-3px;padding:0;border:0;border-radius:6px;background:transparent;color:#8d96a5;cursor:pointer}.dashboard-expand svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.8}.dashboard-expand:hover{background:#f2f4f7;color:#2f3547}.dashboard-attention p.is-safe{color:#3c8d66}.dashboard-workspace{position:absolute;z-index:10;inset:0;display:flex;flex-direction:column;overflow:hidden;background:#f6f7f9;color:#21252d}.dashboard-workspace::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 14% 0%,rgba(255,134,79,.14),transparent 24%),radial-gradient(circle at 88% 9%,rgba(47,104,207,.11),transparent 23%)}.dashboard-workspace__header,.dashboard-tabs,.dashboard-workspace__scroll{position:relative;z-index:1}.dashboard-workspace__header{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:72px;padding:0 30px;border-bottom:1px solid #e2e5ea;background:rgba(250,251,252,.82);backdrop-filter:blur(16px)}.dashboard-workspace__title{display:flex;align-items:center;gap:12px}.dashboard-workspace__title>div{display:flex;flex-direction:column;gap:4px}.dashboard-workspace__title span{color:#222831;font-size:16px;font-weight:720;letter-spacing:-.025em}.dashboard-workspace__title small{color:#7c8796;font-size:11px}.dashboard-workspace__back,.dashboard-workspace__close{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid #e0e4ea;border-radius:10px;background:#fff;color:#637083;cursor:pointer;transition:background .18s ease,border-color .18s ease,color .18s ease,transform .18s ease}.dashboard-workspace__back{font-size:27px;font-weight:300;line-height:1}.dashboard-workspace__tools{display:flex;align-items:center;gap:8px}.dashboard-workspace__tools>button:first-child{min-height:34px;padding:0 12px;border:1px solid #dfe4eb;border-radius:9px;background:#fff;color:#4d596a;font:650 12px/1 PingFang SC,sans-serif;cursor:pointer}.dashboard-workspace__close{font-size:21px}.dashboard-workspace__header button:hover{border-color:#b6c3d4;background:#f8fafc;color:#263243}.dashboard-workspace__header button:active{transform:scale(.96)}.dashboard-tabs{display:flex;align-items:center;gap:4px;padding:10px 30px 0;border-bottom:1px solid #e2e5ea;background:rgba(250,251,252,.68)}.dashboard-tabs button{position:relative;padding:0 12px 12px;border:0;background:transparent;color:#7c8795;font:650 12px/1 PingFang SC,sans-serif;cursor:pointer}.dashboard-tabs button::after{content:'';position:absolute;right:11px;bottom:-1px;left:11px;height:2px;border-radius:999px;background:transparent}.dashboard-tabs button:hover{color:#374255}.dashboard-tabs button.active{color:#252a33}.dashboard-tabs button.active::after{background:#2568d8}.dashboard-workspace__scroll{flex:1;min-height:0;overflow:auto;padding:24px 30px 34px;scroll-behavior:smooth}.dashboard-hero-grid{display:grid;grid-template-columns:minmax(290px,1.9fr) repeat(3,minmax(150px,1fr));gap:14px;max-width:1240px;margin:0 auto}.dashboard-closure-card{position:relative;min-height:242px;overflow:hidden;padding:23px 24px;border-radius:18px;background:radial-gradient(circle at 86% 85%,#254a86 0,rgba(37,74,134,.23) 22%,transparent 46%),linear-gradient(132deg,#11151c,#202834);color:#fff;box-shadow:0 16px 34px rgba(23,31,44,.22)}.dashboard-closure-card::after{content:'';position:absolute;right:-52px;bottom:-74px;width:230px;height:230px;border:1px solid rgba(107,165,255,.3);border-radius:50%;box-shadow:0 0 0 22px rgba(96,154,255,.05),0 0 0 45px rgba(96,154,255,.04)}.dashboard-card-eyebrow{position:relative;z-index:1;display:flex;align-items:center;gap:7px;color:#aeb8c9;font-size:11px;font-weight:650;letter-spacing:.035em}.dashboard-card-eyebrow span{padding:3px 6px;border:1px solid rgba(142,180,255,.32);border-radius:999px;color:#9cc2ff;font-size:9px;letter-spacing:0}.dashboard-closure-value{position:relative;z-index:1;display:flex;align-items:baseline;gap:7px;margin-top:11px}.dashboard-closure-value strong{font-size:53px;font-weight:650;letter-spacing:-.06em;line-height:.95}.dashboard-closure-value span{color:#aab4c4;font-size:17px;font-weight:600}.dashboard-closure-card>p{position:relative;z-index:1;margin:8px 0 0;color:#aeb8c9;font-size:11px}.dashboard-stage-track{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:26px}.dashboard-stage-track span{position:relative;display:flex;flex-direction:column;gap:5px;color:#aeb7c7;font-size:9px}.dashboard-stage-track i{display:block;width:100%;height:4px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden}.dashboard-stage-track i::after{content:'';display:block;width:max(5px,var(--stage-share));height:100%;border-radius:inherit;background:#5f9cf3;transition:width .42s cubic-bezier(.22,1,.36,1)}.dashboard-stage-track .is-pending_acceptance i::after{background:#f69b6a}.dashboard-stage-track .is-completed i::after{background:#60c889}.dashboard-stage-track b{font-size:13px;font-weight:650;color:#fff}.dashboard-stage-track small{white-space:nowrap}.dashboard-closure-note{position:relative;z-index:1;display:flex;align-items:center;gap:6px;margin-top:16px;color:#c9d1dc;font-size:10px}.dashboard-closure-note i{width:6px;height:6px;border-radius:50%;background:#f18a5b;box-shadow:0 0 0 4px rgba(241,138,91,.14)}.dashboard-metric-card{display:flex;min-height:242px;flex-direction:column;justify-content:space-between;padding:20px;border:1px solid #e0e4ea;border-radius:18px;background:rgba(255,255,255,.8);box-shadow:0 8px 20px rgba(45,57,76,.06);transition:transform .22s ease,box-shadow .22s ease}.dashboard-metric-card:hover{transform:translateY(-3px);box-shadow:0 15px 28px rgba(45,57,76,.1)}.dashboard-metric-card>span{color:#758091;font-size:11px;font-weight:650}.dashboard-metric-card>strong{margin-top:auto;color:#1e2530;font-size:44px;line-height:1;font-weight:680;letter-spacing:-.055em}.dashboard-metric-card>small{margin-top:7px;color:#8d96a5;font-size:10px;line-height:1.45}.dashboard-mini-line{display:flex;align-items:flex-end;gap:3px;height:22px;margin-top:13px}.dashboard-mini-line i{display:block;flex:1;height:5px;border-radius:99px;background:#e8ebf0;transition:height .2s ease,background .2s ease}.dashboard-mini-line i.active{height:18px;background:#3778dd}.dashboard-review-pulse{display:flex;align-items:center;gap:6px;margin-top:14px;color:#84756b;font-size:10px}.dashboard-review-pulse i{width:8px;height:8px;border-radius:50%;background:#f37e43;box-shadow:0 0 0 0 rgba(243,126,67,.42);animation:dashboard-pulse 1.8s ease-out infinite}.dashboard-metric-card.is-attention{background:linear-gradient(150deg,#fff8f4,#fff)}.dashboard-metric-card.is-attention button{align-self:flex-start;margin-top:14px;padding:0;border:0;background:transparent;color:#c85c31;font:650 11px/1 PingFang SC,sans-serif;cursor:pointer}.dashboard-section{max-width:1240px;margin:16px auto 0;border:1px solid #e0e4ea;border-radius:16px;background:rgba(255,255,255,.82);box-shadow:0 8px 20px rgba(45,57,76,.05)}.dashboard-section>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:17px 19px;border-bottom:1px solid #edf0f3}.dashboard-section>header>div{display:flex;flex-direction:column;gap:4px}.dashboard-section>header span{color:#303845;font-size:14px;font-weight:700}.dashboard-section>header small{color:#8d96a5;font-size:10px}.dashboard-section>header>button{border:0;background:transparent;color:#3778dd;font:650 11px/1 PingFang SC,sans-serif;cursor:pointer}.dashboard-kanban{display:grid;grid-template-columns:repeat(4,1fr);gap:0}.dashboard-kanban>article{min-height:190px;padding:14px;border-right:1px solid #edf0f3}.dashboard-kanban>article:last-child{border-right:0}.dashboard-kanban__head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.dashboard-kanban__head span{color:#616d7d;font-size:11px;font-weight:650}.dashboard-kanban__head b{display:grid;place-items:center;min-width:19px;height:19px;border-radius:999px;background:#f0f2f5;color:#7c8694;font-size:10px}.dashboard-kanban>article.is-in_progress .dashboard-kanban__head b{background:#edf4ff;color:#3778dd}.dashboard-kanban>article.is-pending_acceptance .dashboard-kanban__head b{background:#fff0e9;color:#d76537}.dashboard-kanban>article.is-completed .dashboard-kanban__head b{background:#eaf8f0;color:#369b64}.dashboard-task-chip{display:flex;width:100%;flex-direction:column;align-items:flex-start;gap:4px;margin-top:8px;padding:10px;border:1px solid #e6e9ee;border-radius:10px;background:#fff;color:#303846;text-align:left;cursor:pointer;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.dashboard-task-chip:hover{border-color:#bac9de;box-shadow:0 7px 14px rgba(45,57,76,.08);transform:translateY(-2px)}.dashboard-task-chip i{width:6px;height:6px;border-radius:50%;background:#aeb7c4}.dashboard-task-chip strong{max-width:100%;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.dashboard-task-chip small{color:#8e97a5;font-size:10px}.dashboard-task-chip em{margin-top:3px;padding:3px 5px;border-radius:5px;background:#f2f3f5;color:#7c8693;font-size:9px;font-style:normal}.dashboard-kanban>article>p{margin:28px 0;color:#a4acb7;text-align:center;font-size:10px}.dashboard-bottom-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;max-width:1240px;margin:0 auto}.dashboard-bottom-grid .dashboard-section{width:100%}.dashboard-timeline ol{position:relative;margin:0;padding:17px 20px 18px;list-style:none}.dashboard-timeline ol::before{content:'';position:absolute;top:28px;bottom:30px;left:81px;width:1px;background:#e8ebef}.dashboard-timeline li{position:relative;display:grid;grid-template-columns:54px 16px minmax(0,1fr);align-items:start;gap:10px;padding:7px 0}.dashboard-timeline time{padding-top:3px;color:#788495;font-size:10px;font-variant-numeric:tabular-nums}.dashboard-timeline li>i{position:relative;z-index:1;width:9px;height:9px;margin-top:4px;border:3px solid #f7f8fa;border-radius:50%;background:#aeb7c4;box-shadow:0 0 0 1px #d6dce5}.dashboard-timeline li>i.is-in_progress{background:#3778dd}.dashboard-timeline li>i.is-pending_acceptance,.dashboard-timeline li>i.is-changes_requested{background:#ed7c47}.dashboard-timeline li>i.is-completed{background:#43ad71}.dashboard-timeline li>button{display:flex;min-width:0;flex-direction:column;align-items:flex-start;gap:3px;padding:0;border:0;background:transparent;color:#354052;text-align:left;cursor:pointer}.dashboard-timeline li>button:hover b{color:#2568d8}.dashboard-timeline b{font-size:11px}.dashboard-timeline li small{color:#929ba7;font-size:10px}.dashboard-timeline li.is-empty{display:block;color:#99a2af;font-size:11px}.dashboard-activity__items{padding:10px 20px 14px}.dashboard-activity__items p{display:flex;align-items:flex-start;gap:9px;margin:0;padding:9px 0;border-bottom:1px solid #f0f2f4}.dashboard-activity__items p:last-child{border-bottom:0}.dashboard-activity__items i{width:8px;height:8px;flex:0 0 auto;margin-top:4px;border-radius:50%;background:#9aa5b4}.dashboard-activity__items i.is-in_progress{background:#3778dd}.dashboard-activity__items i.is-pending_acceptance,.dashboard-activity__items i.is-changes_requested{background:#ed7c47}.dashboard-activity__items i.is-completed{background:#43ad71}.dashboard-activity__items i.is-base{background:#806bd9}.dashboard-activity__items span{display:flex;min-width:0;flex-direction:column;gap:3px}.dashboard-activity__items b{color:#485364;font-size:11px}.dashboard-activity__items small{color:#929ba0;font-size:10px;line-height:1.45}.dashboard-task-workbench,.dashboard-delivery,.dashboard-timeline--full,.dashboard-activity--full{min-height:360px}.dashboard-filter{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px}.dashboard-filter button{padding:5px 7px;border:0;border-radius:6px;background:transparent;color:#7c8694;font:600 10px/1 PingFang SC,sans-serif;cursor:pointer}.dashboard-filter button:hover{background:#f2f5f9}.dashboard-filter button.active{background:#eaf2ff;color:#2967c6}.dashboard-task-table{padding:6px 19px 13px}.dashboard-task-table>button{display:grid;grid-template-columns:10px minmax(180px,1.6fr) minmax(115px,1fr) 88px 88px 12px;align-items:center;width:100%;gap:10px;padding:13px 4px;border:0;border-bottom:1px solid #edf0f3;background:transparent;color:#576273;text-align:left;cursor:pointer}.dashboard-task-table>button:hover{background:#f8fafc}.dashboard-task-table>button>span:nth-child(2){display:flex;min-width:0;flex-direction:column;gap:4px}.dashboard-task-table b{overflow:hidden;color:#303846;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.dashboard-task-table small{overflow:hidden;color:#929ba7;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.dashboard-task-table>button>span:nth-child(3),.dashboard-task-table>button>span:nth-child(4){color:#7c8795;font-size:10px}.dashboard-task-table em{justify-self:start;padding:4px 6px;border-radius:5px;background:#f1f2f4;color:#7e8895;font-size:9px;font-style:normal}.dashboard-task-table em.is-review{background:#fff0e9;color:#d76537}.dashboard-task-table em.is-changes{background:#fff0ef;color:#bd5349}.dashboard-task-table em.is-accepted,.dashboard-task-table em.is-completed{background:#eaf8f0;color:#369b64}.dashboard-task-table>button>i{color:#87919f;font-size:18px;font-style:normal}.dashboard-task-table>p{padding:38px 0;color:#9aa3ae;text-align:center;font-size:12px}.dashboard-task-table__state{width:8px;height:8px;border-radius:50%;background:#aeb7c4}.dashboard-task-table__state.is-in_progress{background:#3778dd}.dashboard-task-table__state.is-pending_acceptance,.dashboard-task-table__state.is-changes_requested{background:#ed7c47}.dashboard-task-table__state.is-completed{background:#43ad71}.dashboard-delivery-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0}.dashboard-delivery-grid article{min-height:270px;padding:16px;border-right:1px solid #edf0f3}.dashboard-delivery-grid article:last-child{border-right:0}.dashboard-delivery-grid article>div{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.dashboard-delivery-grid article>div span{color:#586476;font-size:11px;font-weight:650}.dashboard-delivery-grid article>div b{display:grid;place-items:center;min-width:20px;height:20px;border-radius:999px;background:#f0f2f5;color:#768191;font-size:10px}.dashboard-delivery-grid article>button{display:flex;width:100%;flex-direction:column;align-items:flex-start;gap:4px;margin-top:8px;padding:11px;border:1px solid #e6e9ee;border-radius:10px;background:#fff;color:#354052;text-align:left;cursor:pointer}.dashboard-delivery-grid article>button:hover{border-color:#b8c7da}.dashboard-delivery-grid strong{font-size:12px}.dashboard-delivery-grid small{color:#8e97a5;font-size:10px;line-height:1.45}.dashboard-delivery-grid em{margin-top:3px;color:#d76537;font-size:9px;font-style:normal}.dashboard-delivery-grid p{margin:28px 0;color:#a4acb7;text-align:center;font-size:10px}.dashboard-timeline--full ol{max-width:760px}.dashboard-activity--full .dashboard-activity__items{max-width:760px}.dashboard-workspace button:focus-visible{outline:2px solid #2568d8;outline-offset:2px}@keyframes dashboard-pulse{70%{box-shadow:0 0 0 8px rgba(243,126,67,0)}}.dashboard-workspace-enter-active,.dashboard-workspace-leave-active{transition:opacity .24s ease,transform .24s cubic-bezier(.22,1,.36,1)}.dashboard-workspace-enter-from,.dashboard-workspace-leave-to{opacity:0;transform:translateY(12px)}@media (max-width:1020px){.dashboard-hero-grid{grid-template-columns:minmax(280px,1.6fr) repeat(2,minmax(150px,1fr))}.dashboard-metric-card.is-attention{grid-column:span 2}.dashboard-workspace__scroll{padding:20px}.dashboard-workspace__header{padding:0 20px}.dashboard-tabs{padding-left:20px;padding-right:20px}}@media (max-width:720px){.dashboard-workspace__header{min-height:62px;padding:0 14px}.dashboard-workspace__title small,.dashboard-workspace__tools>button:first-child{display:none}.dashboard-workspace__title span{font-size:14px}.dashboard-tabs{gap:0;overflow:auto;padding:9px 14px 0}.dashboard-tabs button{flex:0 0 auto;padding:0 9px 11px;font-size:11px}.dashboard-workspace__scroll{padding:14px}.dashboard-hero-grid{grid-template-columns:1fr 1fr;gap:10px}.dashboard-closure-card{grid-column:span 2;min-height:220px}.dashboard-metric-card{min-height:176px;padding:16px}.dashboard-metric-card.is-attention{grid-column:auto}.dashboard-metric-card>strong{font-size:36px}.dashboard-section{margin-top:10px;border-radius:13px}.dashboard-section>header{padding:14px}.dashboard-kanban,.dashboard-delivery-grid{grid-template-columns:1fr 1fr}.dashboard-kanban>article,.dashboard-delivery-grid article{min-height:150px;border-bottom:1px solid #edf0f3}.dashboard-kanban>article:nth-child(2n),.dashboard-delivery-grid article:nth-child(2n){border-right:0}.dashboard-bottom-grid{grid-template-columns:1fr;gap:0}.dashboard-task-table{padding:5px 14px 10px;overflow:auto}.dashboard-task-table>button{min-width:620px}.dashboard-filter{justify-content:flex-start}.dashboard-timeline ol{padding-left:14px}.dashboard-timeline ol::before{left:75px}.dashboard-workspace__back{width:30px;height:30px}.dashboard-workspace__close{width:30px;height:30px}}@media (prefers-reduced-motion:reduce){.dashboard-workspace-enter-active,.dashboard-workspace-leave-active,.dashboard-metric-card,.dashboard-task-chip,.dashboard-review-pulse i{animation:none;transition:none}}
/* Full dashboard: use opaque surfaces only, so the data keeps visual priority. */
.dashboard-workspace {
  background: #ffffff;
}

.dashboard-workspace__scroll {
  background: #ffffff;
}

.team-plan-head__title {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 8px !important;
}

.team-plan-head__expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: auto;
  min-width: 28px;
  gap: 5px;
  padding: 0 4px 0 7px;
  margin: 0;
}

.team-plan-head__expand span {
  color: #8d96a5;
  font-size: 10px;
  font-weight: 650;
  white-space: nowrap;
}

.team-plan-head__actions {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 4px !important;
}

.dashboard-workspace::before,
.dashboard-closure-card::after {
  display: none;
}

.dashboard-workspace__header,
.dashboard-tabs {
  background: #ffffff;
}

.dashboard-workspace__tools > .dashboard-workspace__close {
  min-height: 0;
  padding: 0;
}

.dashboard-closure-card {
  background: #18202b;
  box-shadow: 0 14px 28px rgba(25, 33, 45, .16);
}

.dashboard-metric-card,
.dashboard-metric-card.is-attention,
.dashboard-section {
  background: #ffffff;
}

.dashboard-workspace .dashboard-progress span {
  background: #3677dc;
}

.dashboard-curve-section > header > b {
  color: #7a8594;
  font-size: 11px;
  font-weight: 650;
}

.dashboard-curve-layout {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
  padding: 18px 19px 20px;
}

.dashboard-curve-copy {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 182px;
  padding: 17px;
  border-radius: 12px;
  background: #eef4ff;
}

.dashboard-curve-copy > span {
  color: #647792;
  font-size: 10px;
  font-weight: 650;
}

.dashboard-curve-copy > strong {
  color: #213a61;
  font-size: 44px;
  font-weight: 680;
  letter-spacing: -.065em;
  line-height: 1;
}

.dashboard-curve-copy > strong i {
  margin-left: 2px;
  color: #5b7092;
  font-size: 16px;
  font-style: normal;
  letter-spacing: -.02em;
}

.dashboard-curve-copy > small {
  color: #718197;
  font-size: 10px;
  line-height: 1.55;
}

.dashboard-curve-chart {
  min-width: 0;
  min-height: 182px;
}

.dashboard-curve-chart svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.dashboard-curve-chart line {
  stroke: #edf0f4;
  stroke-width: 1;
}

.dashboard-curve-area {
  fill: #e7effc;
}

.dashboard-curve-line {
  fill: none;
  stroke: #3677dc;
  stroke-linecap: round;
  stroke-width: 3;
  stroke-dasharray: 900;
  stroke-dashoffset: 900;
  animation: dashboard-curve-draw .8s cubic-bezier(.22, 1, .36, 1) .12s forwards;
}

.dashboard-curve-chart circle {
  fill: #ffffff;
  stroke: #3677dc;
  stroke-width: 3;
  transform-origin: center;
  animation: dashboard-curve-point .28s cubic-bezier(.22, 1, .36, 1) both;
}

.dashboard-curve-chart g:nth-of-type(2) circle { animation-delay: .12s; }
.dashboard-curve-chart g:nth-of-type(3) circle { animation-delay: .22s; }
.dashboard-curve-chart g:nth-of-type(4) circle { animation-delay: .32s; }

.dashboard-curve-chart text {
  fill: #8b95a3;
  font-family: PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 10px;
  text-anchor: middle;
}

.dashboard-curve-chart .dashboard-curve-value {
  fill: #3d4a5d;
  font-size: 11px;
  font-weight: 700;
}

@keyframes dashboard-curve-draw {
  to { stroke-dashoffset: 0; }
}

@keyframes dashboard-curve-point {
  from { opacity: 0; transform: scale(.45); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 720px) {
  .dashboard-curve-layout {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 14px;
  }

  .dashboard-curve-copy {
    min-height: 0;
    gap: 10px;
  }

  .dashboard-curve-copy > strong {
    font-size: 36px;
  }

  .dashboard-curve-chart {
    min-height: 168px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-curve-line,
  .dashboard-curve-chart circle {
    animation: none;
    stroke-dashoffset: 0;
  }
}

/* The workspace shares the screen with both product sidebars, so use the
   effective content width rather than waiting for a phone-sized viewport. */
@media (max-width: 1500px) {
  .dashboard-workspace__scroll {
    padding: 20px;
  }

  .dashboard-hero-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-closure-card,
  .dashboard-metric-card.is-attention {
    grid-column: span 2;
  }

  .dashboard-kanban,
  .dashboard-delivery-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-kanban > article:nth-child(2n),
  .dashboard-delivery-grid article:nth-child(2n) {
    border-right: 0;
  }

  .dashboard-kanban > article,
  .dashboard-delivery-grid article {
    border-bottom: 1px solid #edf0f3;
  }

  .dashboard-bottom-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

/* Compact white overview cards: keep the data dense and scannable. */
.dashboard-hero-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dashboard-closure-card {
  min-height: 218px;
  padding: 20px 22px;
  border: 1px solid #e0e4ea;
  background: #ffffff;
  color: #202733;
  box-shadow: 0 8px 20px rgba(45, 57, 76, .07);
}

.dashboard-card-eyebrow {
  color: #596577;
}

.dashboard-card-eyebrow em {
  padding: 3px 6px;
  border-radius: 999px;
  background: #fff1e9;
  color: #e66a3d;
  font-size: 9px;
  font-style: normal;
  letter-spacing: 0;
}

.dashboard-card-eyebrow > .dashboard-card-icon,
.dashboard-card-eyebrow > span:nth-child(2) {
  padding: 0;
  border: 0;
  letter-spacing: 0;
}

.dashboard-card-eyebrow > .dashboard-card-icon {
  color: #ef6b3b;
  font-size: 16px;
}

.dashboard-card-eyebrow > span:nth-child(2) {
  color: #596577;
  font-size: 11px;
}

.dashboard-card-icon {
  display: inline-grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 750;
  line-height: 1;
}

.dashboard-card-icon.is-orange { background: #fff0e8; color: #ef6b3b; }
.dashboard-card-icon.is-blue { background: #eaf2ff; color: #3476dc; }
.dashboard-card-icon.is-cyan { background: #e9f8f8; color: #24a5a8; }

.dashboard-closure-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.dashboard-closure-value {
  margin-top: 15px;
}

.dashboard-closure-value strong { color: #202733; font-size: 48px; }
.dashboard-closure-value span { color: #8691a0; }
.dashboard-closure-card > p { color: #8691a0; }

.dashboard-ring {
  position: relative;
  width: 92px;
  height: 92px;
  flex: 0 0 auto;
}

.dashboard-ring svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }
.dashboard-ring circle { fill: none; stroke-width: 9; }
.dashboard-ring-track { stroke: #eef1f4; }
.dashboard-ring-value { stroke: #f17843; stroke-linecap: round; transition: stroke-dasharray .4s ease; }
.dashboard-ring > strong { position: absolute; inset: 0; display: flex; align-items: baseline; justify-content: center; color: #303a49; font-size: 20px; font-weight: 720; }
.dashboard-ring > strong small { margin-left: 1px; color: #8c96a3; font-size: 10px; }

.dashboard-stage-track { margin-top: 19px; }
.dashboard-stage-track i { background: #edf0f3; }
.dashboard-stage-track b { color: #303a49; }
.dashboard-stage-track span { color: #8d97a5; }
.dashboard-stage-track .is-pending_acceptance i::after { background: #ef9a70; }
.dashboard-stage-track .is-completed i::after { background: #55b97c; }
.dashboard-closure-note { margin-top: 12px; color: #778292; }

.dashboard-metric-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px;
  grid-template-rows: auto auto 1fr auto;
  align-items: center;
  min-height: 218px;
  padding: 18px;
  background: #ffffff;
}

.dashboard-metric-head { display: flex; align-items: center; gap: 8px; color: #5e6a7a; }
.dashboard-metric-head > span:last-child { font-size: 11px; font-weight: 650; }
.dashboard-metric-head { grid-column: 1; grid-row: 1; }
.dashboard-metric-card > strong { grid-column: 1; grid-row: 2; align-self: end; margin-top: 16px; color: #202733; font-size: 42px; }
.dashboard-metric-card > small { grid-column: 1; grid-row: 3; align-self: start; margin-top: 5px; }
.dashboard-mini-bars { grid-column: 2; grid-row: 2 / 5; display: flex; align-items: flex-end; justify-content: center; gap: 5px; width: 76px; height: 66px; padding: 0 4px 2px; border-bottom: 1px solid #edf0f3; }
.dashboard-mini-bars i { width: 7px; height: 22px; border-radius: 99px; background: #e7edf6; }
.dashboard-mini-bars i:nth-child(2) { height: 32px; }
.dashboard-mini-bars i:nth-child(3) { height: 25px; }
.dashboard-mini-bars i:nth-child(4) { height: 42px; }
.dashboard-mini-bars i:nth-child(5) { height: 35px; }
.dashboard-mini-bars i:nth-child(6) { height: 49px; }
.dashboard-mini-bars i.active { background: #4b86df; }
.dashboard-mini-donut { grid-column: 2; grid-row: 2 / 5; position: relative; display: grid; place-items: center; width: 66px; height: 66px; margin-left: auto; border: 8px solid #e5f5f4; border-top-color: #2ca7a7; border-right-color: #2ca7a7; border-radius: 50%; color: #2e8889; font-size: 18px; font-weight: 720; transform: rotate(-35deg); }
.dashboard-mini-donut span { transform: rotate(35deg); }
.dashboard-review-pulse { margin-top: 10px; }
.dashboard-attention-bars { grid-column: 2; grid-row: 2 / 5; display: flex; align-items: flex-end; justify-content: center; gap: 4px; width: 76px; height: 66px; padding: 0 4px 2px; border-bottom: 1px solid #f3e7e2; }
.dashboard-attention-bars i { width: 8px; height: 7px; border-radius: 99px; background: #f5dcd2; }
.dashboard-attention-bars i.active { height: 17px; background: #ef8a61; }
.dashboard-metric-card > button { grid-column: 1; grid-row: 4; align-self: end; margin-top: 10px; }

@media (max-width: 1500px) {
  .dashboard-hero-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-closure-card { grid-column: auto; }
  .dashboard-metric-card.is-attention { grid-column: auto; }
}

@media (max-width: 720px) {
  .dashboard-hero-grid { grid-template-columns: 1fr; }
  .dashboard-closure-card,
  .dashboard-metric-card.is-attention { grid-column: auto; }
}

/* Dashboard V3 — the overview separates global status from actionable work. */
.dashboard-workspace {
  --dashboard-orange: #f46b35;
  --dashboard-orange-soft: #fff0e9;
  --dashboard-ink: #252b35;
  --dashboard-muted: #8892a0;
  --dashboard-line: #e9edf1;
  --dashboard-surface: #ffffff;
}

.dashboard-workspace__header {
  min-height: 66px;
  padding: 0 28px;
}

.dashboard-workspace__title span { font-size: 17px; font-weight: 720; }
.dashboard-workspace__title small { color: #98a1ad; }
.dashboard-workspace__header { border-bottom: 0; }
.dashboard-tabs {
  position: relative;
  align-items: flex-end;
  gap: 2px;
  min-height: 46px;
  padding: 7px 0 0;
  border-bottom: 0;
  background: #ffffff;
}

.dashboard-tabs::before {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1px;
  background: #edf0f3;
}

.dashboard-tabs button {
  position: relative;
  z-index: 1;
  min-width: 82px;
  padding: 12px 15px 11px;
  border-radius: 12px 12px 0 0;
  color: #7e8998;
  transition: color .18s ease, background .18s ease, transform .18s ease;
}

.dashboard-tabs button::after {
  right: 50%;
  bottom: 0;
  left: 50%;
  width: 28px;
  height: 3px;
  transform: translateX(-50%) scaleX(0);
  transform-origin: center;
  background: var(--dashboard-orange);
  transition: transform .2s cubic-bezier(.22, 1, .36, 1);
}

.dashboard-tabs button:hover { color: #394454; background: rgba(255, 255, 255, .58); }

.dashboard-tabs button.active {
  z-index: 1;
  color: #252b35;
  background: #ffffff;
  box-shadow: 8px 0 18px -8px rgba(36, 45, 57, .24), 0 -1px 0 #eef0f3, 0 3px 12px rgba(36, 45, 57, .08);
}

.dashboard-tabs button.active::after { transform: translateX(-50%) scaleX(1); }
.dashboard-workspace__scroll { padding: 18px 24px 28px; }

.dashboard-v2-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 308px;
  align-items: start;
  gap: 16px;
  max-width: 1280px;
  margin: 0 auto;
}

.dashboard-v2-main { min-width: 0; }
.dashboard-v2-main .dashboard-section,
.dashboard-v2-main .dashboard-hero-grid,
.dashboard-v2-main .dashboard-bottom-grid { max-width: none; }

.dashboard-v2-main .dashboard-hero-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.dashboard-v2-main .dashboard-metric-card {
  min-height: 168px;
  padding: 16px;
  border-color: var(--dashboard-line);
  border-radius: 14px;
  box-shadow: none;
}

.dashboard-v2-main .dashboard-metric-card:hover {
  border-color: #f4cabc;
  box-shadow: 0 10px 20px rgba(56, 49, 45, .06);
  transform: translateY(-2px);
}

.dashboard-v2-main .dashboard-metric-card > strong { margin-top: 10px; font-size: 36px; }
.dashboard-v2-main .dashboard-card-icon.is-blue { background: #fff0e9; color: var(--dashboard-orange); }
.dashboard-v2-main .dashboard-card-icon.is-cyan { background: #fff7ef; color: #e38a3e; }
.dashboard-v2-main .dashboard-mini-bars i.active { background: var(--dashboard-orange); }
.dashboard-v2-main .dashboard-mini-donut { border-color: #fff0e9; border-top-color: var(--dashboard-orange); border-right-color: var(--dashboard-orange); color: var(--dashboard-orange); }
.dashboard-v2-main .dashboard-attention-bars i.active { background: var(--dashboard-orange); }
.dashboard-v2-main .dashboard-metric-card.is-attention button { color: #d85c2e; }

.dashboard-v2-main .dashboard-section {
  margin-top: 12px;
  border-color: var(--dashboard-line);
  border-radius: 14px;
  box-shadow: none;
}

.dashboard-v2-main .dashboard-section > header { padding: 15px 17px; }
.dashboard-v2-main .dashboard-section > header span { font-size: 13px; }
.dashboard-v2-main .dashboard-curve-layout { padding: 15px 17px 16px; gap: 16px; }
.dashboard-v2-main .dashboard-curve-copy { min-height: 172px; background: #fff7f2; }
.dashboard-v2-main .dashboard-curve-copy > strong { color: var(--dashboard-orange); }
.dashboard-v2-main .dashboard-curve-line { stroke: var(--dashboard-orange); }
.dashboard-v2-main .dashboard-curve-area { fill: #fff0e9; }
.dashboard-v2-main .dashboard-curve-chart circle { fill: #fff; stroke: var(--dashboard-orange); }
.dashboard-v2-main .dashboard-curve-chart .dashboard-curve-value { fill: #c8552a; }

.dashboard-v2-main .dashboard-kanban { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dashboard-v2-main .dashboard-kanban > article { min-height: 136px; padding: 13px; }
.dashboard-v2-main .dashboard-kanban > article:nth-child(2n) { border-right: 0; }
.dashboard-v2-main .dashboard-kanban > article:nth-child(-n + 2) { border-bottom: 1px solid var(--dashboard-line); }
.dashboard-v2-main .dashboard-task-chip:hover { border-color: #f0bda9; }
.dashboard-v2-main .dashboard-task-chip em.is-review { background: #fff0e9; color: #c95b30; }
.dashboard-v2-main .dashboard-bottom-grid { gap: 12px; }

.dashboard-insight-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.dashboard-insight-rail {
  overflow: hidden;
  border: 1px solid var(--dashboard-line);
  border-radius: 14px;
  background: var(--dashboard-surface);
  box-shadow: 0 8px 20px rgba(42, 48, 58, .04);
}

.dashboard-insight-rail > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 17px 17px 12px;
}

.dashboard-insight-rail header > div { display: flex; flex-direction: column; gap: 4px; }
.dashboard-insight-rail header span { color: var(--dashboard-ink); font-size: 13px; font-weight: 700; }
.dashboard-insight-rail header small { color: var(--dashboard-muted); font-size: 10px; }
.dashboard-insight-rail > header > b { display: grid; place-items: center; min-width: 23px; height: 23px; border-radius: 999px; background: var(--dashboard-orange-soft); color: #d75b2e; font-size: 10px; }

.dashboard-insight-item {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) 12px;
  align-items: center;
  width: calc(100% - 24px);
  gap: 9px;
  margin: 0 12px;
  padding: 12px 5px;
  border: 0;
  border-top: 1px solid #f0f2f4;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.dashboard-insight-item:hover strong { color: #d85c2e; }
.dashboard-insight-item > i { width: 7px; height: 7px; border-radius: 50%; background: #aeb7c4; }
.dashboard-insight-item > i.is-pending_acceptance,
.dashboard-insight-item > i.is-changes_requested { background: var(--dashboard-orange); }
.dashboard-insight-item > i.is-in_progress { background: #6d95d8; }
.dashboard-insight-item > i.is-completed { background: #55b97c; }
.dashboard-insight-item > span { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.dashboard-insight-item strong { overflow: hidden; color: #3a4350; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.dashboard-insight-item small { overflow: hidden; color: #98a1ad; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.dashboard-insight-item em { color: #a2abb6; font-size: 17px; font-style: normal; }
.dashboard-insight-empty { margin: 0; padding: 22px 17px; color: #9aa3ae; text-align: center; font-size: 11px; }
.dashboard-insight-action { width: calc(100% - 24px); margin: 12px; border: 1px solid #f0d4c9; border-radius: 9px; padding: 9px; background: #fffaf8; color: #d75b2e; font: 650 11px/1 PingFang SC, sans-serif; cursor: pointer; }

.dashboard-rail-timeline {
  overflow: hidden;
  border: 1px solid var(--dashboard-line);
  border-radius: 14px;
  background: var(--dashboard-surface);
  box-shadow: 0 8px 20px rgba(42, 48, 58, .04);
}
.dashboard-rail-timeline > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 17px 17px 8px; }
.dashboard-rail-timeline > header > div { display: flex; flex-direction: column; gap: 4px; }
.dashboard-rail-timeline > header span { color: var(--dashboard-ink); font-size: 13px; font-weight: 700; }
.dashboard-rail-timeline > header small { color: var(--dashboard-muted); font-size: 10px; }
.dashboard-rail-timeline ol { padding: 6px 17px 16px; }
.dashboard-rail-timeline ol::before { left: 77px; top: 18px; bottom: 24px; }
.dashboard-rail-timeline li { grid-template-columns: 50px 14px minmax(0, 1fr); gap: 8px; padding: 8px 0; }
.dashboard-rail-timeline time { font-size: 9px; }
.dashboard-rail-timeline li > i { width: 8px; height: 8px; margin-top: 4px; }
.dashboard-rail-timeline b { font-size: 10px; }
.dashboard-rail-timeline li small { font-size: 9px; }

.dashboard-rail-activity {
  overflow: hidden;
  border: 1px solid var(--dashboard-line);
  border-radius: 14px;
  background: var(--dashboard-surface);
  box-shadow: 0 8px 20px rgba(42, 48, 58, .04);
}

.dashboard-rail-activity > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 17px 17px 8px;
}

.dashboard-rail-activity > header > div { display: flex; flex-direction: column; gap: 4px; }
.dashboard-rail-activity > header span { color: var(--dashboard-ink); font-size: 13px; font-weight: 700; }
.dashboard-rail-activity > header small { color: var(--dashboard-muted); font-size: 10px; }
.dashboard-rail-activity .dashboard-activity__items { padding: 5px 17px 14px; }
.dashboard-rail-activity .dashboard-activity__items p { padding: 9px 0; }
.dashboard-rail-activity .dashboard-activity__items b { font-size: 10px; }
.dashboard-rail-activity .dashboard-activity__items small { font-size: 9px; }

.dashboard-task-workbench > header {
  align-items: flex-start;
  flex-direction: column;
  gap: 10px;
}

.dashboard-task-workbench .dashboard-filter {
  display: flex;
  width: 100%;
  flex-wrap: nowrap;
  overflow-x: auto;
  justify-content: flex-start;
  gap: 6px;
  scrollbar-width: none;
}

.dashboard-task-workbench .dashboard-filter::-webkit-scrollbar { display: none; }

.dashboard-task-workbench .dashboard-filter button {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: #f6f7f9;
}

.dashboard-task-workbench .dashboard-filter button:hover {
  border-color: #f0d3c5;
  background: #fff9f6;
}

/* Keep the summary ring and the three action cards on one visual baseline. */
.dashboard-ring > strong {
  align-items: center;
  line-height: 1;
}

.dashboard-ring > strong small {
  align-self: center;
  margin-top: 2px;
  line-height: 1;
}

.dashboard-v2-main .dashboard-metric-card {
  grid-template-rows: auto 1fr auto auto;
}

.dashboard-v2-main .dashboard-metric-card > strong {
  grid-column: 1;
  grid-row: 3;
  align-self: end;
  margin: 0;
}

.dashboard-v2-main .dashboard-metric-card > small {
  grid-column: 1;
  grid-row: 4;
  align-self: end;
  margin: 4px 0 0;
}

.dashboard-v2-main .dashboard-metric-card > button {
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
  align-self: start;
  margin: 0;
  white-space: nowrap;
}

@media (max-width: 1500px) {
  .dashboard-v2-layout { grid-template-columns: 1fr; }
  .dashboard-insight-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .dashboard-workspace__scroll { padding: 14px; }
  .dashboard-v2-main .dashboard-hero-grid { grid-template-columns: 1fr; }
  .dashboard-v2-main .dashboard-kanban { grid-template-columns: 1fr; }
  .dashboard-v2-main .dashboard-kanban > article { border-right: 0; border-bottom: 1px solid var(--dashboard-line); }
  .dashboard-insight-column { display: block; }
  .dashboard-rail-timeline { margin-top: 12px; }
}
/* Review-card refinements: the header description sits exactly 12px below
   the title, and the acceptance checklist is a collapsed disclosure by default. */
.task-backfill-card .backfill-card-kicker { margin-bottom: 0; }
.task-backfill-card .backfill-card-header small { display: block; margin-top: 6px !important; }
.task-backfill-card .backfill-card-header { padding-bottom: 8px !important; }
.task-backfill-card .backfill-deliverable { padding-top: 8px !important; }
.task-backfill-card .backfill-checklist { padding-top: 14px !important; padding-bottom: 14px !important; }
.task-backfill-card .backfill-checklist:not([open]) { margin-top: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
.task-backfill-card .backfill-checklist > summary { display: flex !important; align-items: center !important; height: 48px; min-height: 48px; box-sizing: border-box; margin: 0; padding: 0 !important; cursor: pointer; list-style: none; }
.task-backfill-card .backfill-checklist > summary > div { flex-direction: row; align-items: center; gap: 8px; }
.task-backfill-card .backfill-checklist > summary .backfill-section-label { margin-bottom: 0 !important; }
.task-backfill-card .backfill-checklist > summary small { white-space: nowrap; }
.task-backfill-card .backfill-checklist > summary::-webkit-details-marker { display: none; }
.task-backfill-card .backfill-checklist > summary::after { content: '⌄'; margin-left: 8px; color: #a47c6d; font-size: 15px; line-height: 1; transform: translateY(-1px); }
.task-backfill-card .backfill-checklist[open] > summary::after { transform: rotate(180deg); }
.task-backfill-card .backfill-checklist-items { padding-top: 4px; }
.task-backfill-artifact-file { position: relative; }
.task-backfill-artifact-file .task-backfill-artifact-remove { position: absolute; top: 50%; right: 10px; opacity: 0; transform: translateY(-50%); transition: opacity .15s ease; }
.task-backfill-artifact-file:hover .task-backfill-artifact-remove,
.task-backfill-artifact-file:focus-within .task-backfill-artifact-remove { opacity: 1; }
.task-backfill-artifact-file > div { padding-right: 26px; }
.task-backfill-artifact-picker { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; padding: 10px; border: 1px solid #eadfd9; border-radius: 9px; background: #fffaf7; }
.task-backfill-artifact-picker > span { color: #8a929e; font-size: 10px; }
.task-backfill-artifact-picker > button { display: flex; align-items: center; gap: 8px; padding: 7px; border: 1px solid #eee2dc; border-radius: 8px; background: #fff; color: #373e4a; text-align: left; cursor: pointer; }
.task-backfill-artifact-picker > button:hover { border-color: #e88059; background: #fff6f1; }
.task-backfill-artifact-picker > button > span:last-child { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.task-backfill-artifact-picker strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.task-backfill-artifact-picker small { color: #8a929e; font-size: 10px; }
</style>
