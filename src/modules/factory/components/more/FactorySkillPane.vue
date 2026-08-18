<template>
  <div class="factory-skill-pane">
    <!-- 列表视图 -->
    <template v-if="!activeSkill">
      <div class="skill-header">
        <div class="skill-header-left">
          <span class="skill-title">Skill 管理</span>
          <span class="skill-badge">{{ items.length }} 个</span>
        </div>
        <button type="button" class="btn-add" @click="showAddModal = true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          添加 Skill
        </button>
      </div>

      <div class="skill-list scrollbar-thin">
        <div v-for="group in groups" :key="group.label" class="skill-group">
          <div class="group-label">{{ group.label }}</div>
          <div class="group-items">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="skill-card"
              @click="activeSkill = item"
            >
              <div class="card-icon-box">
                <SkillIcon :name="item.icon" :size="16" />
              </div>
              <div class="card-body">
                <div class="card-name">{{ item.name }}</div>
                <div class="card-desc">{{ item.desc }}</div>
              </div>
              <div
                class="toggle-switch"
                :class="{ on: item.enabled }"
                @click.stop="toggleEnabled(item)"
              >
                <div class="toggle-thumb"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 详情视图 -->
    <template v-else>
      <div class="skill-detail scrollbar-thin">
        <button type="button" class="back-link" @click="activeSkill = null">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          返回 Skill 列表
        </button>

        <div class="detail-head">
          <div class="detail-icon-box">
            <SkillIcon :name="activeSkill.icon" :size="20" />
          </div>
          <div class="detail-info">
            <div class="detail-name">{{ activeSkill.name }}</div>
            <div class="detail-desc">{{ activeSkill.desc }}</div>
          </div>
          <div
            class="toggle-switch lg"
            :class="{ on: activeSkill.enabled }"
            @click="toggleEnabled(activeSkill)"
          >
            <div class="toggle-thumb"></div>
          </div>
        </div>

        <div class="detail-meta">
          <span class="meta-tag">{{ activeSkill.category }}</span>
          <span class="meta-version">v{{ activeSkill.version }}</span>
        </div>

        <div class="detail-section">
          <div class="section-title">参数配置</div>
          <div class="params-list">
            <div v-for="p in activeSkill.params" :key="p.key" class="param-row">
              <label class="param-label">{{ p.label }}</label>
              <input
                v-model="p.value"
                class="param-input"
                :type="p.type === 'number' ? 'number' : 'text'"
              />
            </div>
            <div v-if="activeSkill.params.length === 0" class="params-empty">暂无参数</div>
          </div>
          <button v-if="activeSkill.params.length > 0" type="button" class="btn-save" @click="saveParams">保存配置</button>
        </div>

        <div v-if="activeSkill.sample" class="detail-section">
          <div class="section-title">调用示例</div>
          <div class="sample-block">
            <div class="sample-label">Input</div>
            <div class="sample-code">{{ activeSkill.sample.input }}</div>
            <div class="sample-label border-t">Output</div>
            <div class="sample-code">{{ activeSkill.sample.output }}</div>
          </div>
        </div>

        <div class="detail-actions">
          <button type="button" class="btn-primary-sm" @click="testRun">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            测试运行
          </button>
          <button type="button" class="btn-danger-sm" @click="removeSkill(activeSkill.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            移除
          </button>
        </div>
      </div>
    </template>

    <!-- 添加 Skill 弹窗 -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
          <div class="modal-box" @click.stop>
            <div class="modal-head">
              <div class="modal-head-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="modal-head-icon"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.47 1.229 0 1.698l-2.589 2.59c-.27.27-.69.34-1.029.17"/><circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 1 0 10 10"/></svg>
                <div>
                  <div class="modal-title">添加 Skill</div>
                  <div class="modal-subtitle">为 Agent 扩展新的能力</div>
                </div>
              </div>
              <button type="button" class="modal-close" @click="showAddModal = false">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="tab-bar">
                <button type="button" class="tab-btn" :class="{ active: addTab === 'market' }" @click="addTab = 'market'">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                  市场
                </button>
                <button type="button" class="tab-btn" :class="{ active: addTab === 'custom' }" @click="addTab = 'custom'">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  自定义
                </button>
                <button type="button" class="tab-btn" :class="{ active: addTab === 'upload' }" @click="addTab = 'upload'">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                  上传包
                </button>
              </div>

              <!-- 市场 Tab -->
              <div v-if="addTab === 'market'" class="tab-content">
                <div class="search-wrap">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input v-model="marketSearch" type="text" class="search-input" placeholder="搜索 Skill..." />
                </div>
                <div class="market-grid scrollbar-thin">
                  <div v-for="sk in filteredMarketItems" :key="sk.id" class="market-card">
                    <div class="market-card-head">
                      <div class="market-card-icon">
                        <SkillIcon :name="sk.icon" :size="14" />
                      </div>
                      <span class="market-card-name">{{ sk.name }}</span>
                    </div>
                    <div class="market-card-desc">{{ sk.desc }}</div>
                    <div class="market-card-foot">
                      <span class="market-installs">{{ sk.installs }} 安装</span>
                      <button type="button" class="btn-install" @click="installMarketSkill(sk)">安装</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 自定义 Tab -->
              <div v-if="addTab === 'custom'" class="tab-content">
                <div class="form-field">
                  <label class="form-label">Skill 名称 <span class="required">*</span></label>
                  <input v-model="newSkillName" type="text" class="form-input" placeholder="如：天气查询、生成周报、客户画像分析" />
                </div>
                <div class="form-field">
                  <label class="form-label">功能描述 <span class="required">*</span></label>
                  <textarea v-model="newSkillDesc" rows="3" class="form-textarea" placeholder="描述这个 Skill 要做什么，Kooky 会根据描述自动生成实现逻辑"></textarea>
                </div>
                <div class="ai-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ai-hint-icon"><path d="M12 3l1.912 5.813h6.123l-4.974 3.614 1.912 5.813L12 14.626l-4.973 3.614 1.912-5.813L3.965 8.813h6.123z"/></svg>
                  <span>点击下方按钮后，Kooky 会在对话区帮你自动创建这个 Skill 的完整实现，包括参数定义、执行逻辑和错误处理。</span>
                </div>
                <div class="form-actions">
                  <button type="button" class="btn-primary-sm" @click="doCustomCreate">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813h6.123l-4.974 3.614 1.912 5.813L12 14.626l-4.973 3.614 1.912-5.813L3.965 8.813h6.123z"/></svg>
                    让 Kooky 帮我创建
                  </button>
                </div>
              </div>

              <!-- 上传包 Tab -->
              <div v-if="addTab === 'upload'" class="tab-content">
                <div class="upload-zone">
                  <div class="upload-icon-box">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  </div>
                  <div class="upload-title">点击上传或拖拽 Skill 包到此处</div>
                  <div class="upload-hint">支持 .zip · .tar.gz · .wasm · 单文件 ≤ 20MB</div>
                </div>
                <div class="upload-spec">
                  <div class="spec-title">Skill 包规范</div>
                  <div class="spec-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spec-check"><polyline points="20 6 9 17 4 12"/></svg>包含 manifest.json 描述文件（名称、版本、入口）</div>
                  <div class="spec-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spec-check"><polyline points="20 6 9 17 4 12"/></svg>入口文件导出标准 skill 接口（init / execute / destroy）</div>
                  <div class="spec-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spec-check"><polyline points="20 6 9 17 4 12"/></svg>不包含敏感信息（密钥、Token 等通过参数配置注入）</div>
                </div>
                <div class="form-actions">
                  <button type="button" class="btn-primary-sm" @click="doUpload">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/></svg>
                    上传并安装
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { SKILL_ITEMS, SKILL_MARKET_ITEMS } from '../../moreMock'
import SkillIcon from './SkillIcon.vue'

defineOptions({ name: 'FactorySkillPane' })

const items = ref(SKILL_ITEMS.map(s => ({ ...s, params: s.params.map(p => ({ ...p })) })))
const activeSkill = ref(null)
const showAddModal = ref(false)
const addTab = ref('market')
const newSkillName = ref('')
const newSkillDesc = ref('')
const marketSearch = ref('')

const groups = computed(() => [
  { label: '内置', items: items.value.filter(s => s.source === 'builtin') },
  { label: '市场安装', items: items.value.filter(s => s.source === 'market') },
  { label: '自定义', items: items.value.filter(s => s.source === 'custom') },
].filter(g => g.items.length > 0))

const filteredMarketItems = computed(() => {
  if (!marketSearch.value.trim()) return SKILL_MARKET_ITEMS
  const q = marketSearch.value.toLowerCase()
  return SKILL_MARKET_ITEMS.filter(s => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q))
})

function toggleEnabled(item) {
  item.enabled = !item.enabled
  ElMessage.success(item.enabled ? `${item.name} 已启用` : `${item.name} 已禁用`)
}

function removeSkill(id) {
  items.value = items.value.filter(s => s.id !== id)
  activeSkill.value = null
  ElMessage.success('已移除')
}

function saveParams() {
  ElMessage.success('参数已保存')
}

function testRun() {
  ElMessage.info('测试运行中…（模拟）')
}

function installMarketSkill(sk) {
  items.value.push({
    id: `sk-m-${Date.now()}`,
    name: sk.name,
    desc: sk.desc,
    iconEmoji: '',
    icon: sk.icon,
    source: 'market',
    enabled: true,
    category: '市场',
    version: '1.0.0',
    params: [],
    sample: { input: '{}', output: '{}' },
  })
  ElMessage.success(`${sk.name} 已安装`)
}

function doCustomCreate() {
  if (!newSkillName.value.trim()) { ElMessage.warning('请输入 Skill 名称'); return }
  ElMessage.success(`正在创建「${newSkillName.value}」…`)
  showAddModal.value = false
  newSkillName.value = ''
  newSkillDesc.value = ''
}

function doUpload() {
  ElMessage.info('上传功能开发中')
  showAddModal.value = false
}
</script>

<style lang="scss" scoped>
.factory-skill-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

/* ─── 列表视图 ─── */
.skill-header {
  height: 48px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.skill-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.skill-badge {
  font-size: 10px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: #6366f1;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: #4f46e5; }
}

.skill-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.skill-group {
  margin-bottom: 16px;
  &:last-child { margin-bottom: 0; }
}

.group-label {
  font-size: 10px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #6366f1;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08);

    .card-icon-box {
      background: rgba(99, 102, 241, 0.08);
      color: #6366f1;
    }
  }
}

.card-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #6b7280;
  transition: all 0.15s;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: 12px;
  font-weight: 500;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-desc {
  font-size: 10px;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

/* Toggle switch */
.toggle-switch {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: #d1d5db;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;

  &.on { background: #6366f1; }
  &.lg { width: 36px; height: 20px; border-radius: 10px; }

  .toggle-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
  }

  &.on .toggle-thumb { transform: translateX(14px); }
  &.lg .toggle-thumb { width: 16px; height: 16px; }
  &.lg.on .toggle-thumb { transform: translateX(16px); }
}

/* ─── 详情视图 ─── */
.skill-detail {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  margin-bottom: 16px;
  transition: color 0.15s;
  &:hover { color: #6366f1; }
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(99, 102, 241, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  flex-shrink: 0;
}

.detail-info { flex: 1; min-width: 0; }
.detail-name { font-size: 14px; font-weight: 600; color: #1a1a1a; }
.detail-desc { font-size: 11px; color: #9ca3af; margin-top: 2px; }

.detail-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  font-size: 10px;
  color: #9ca3af;
}

.meta-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: #f3f4f6;
}

.detail-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 10px;
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.param-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.param-label {
  font-size: 11px;
  color: #6b7280;
  width: 90px;
  flex-shrink: 0;
}

.param-input {
  flex: 1;
  height: 30px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  padding: 0 10px;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
  &:focus { border-color: #6366f1; }
}

.params-empty {
  font-size: 11px;
  color: #9ca3af;
  padding: 8px 0;
}

.btn-save {
  margin-top: 10px;
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  background: #6366f1;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: #4f46e5; }
}

.sample-block {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
  font-size: 11px;
}

.sample-label {
  padding: 6px 12px;
  background: #f9fafb;
  color: #9ca3af;
  font-weight: 500;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);

  &.border-t {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
}

.sample-code {
  padding: 8px 12px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.btn-primary-sm {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: #6366f1;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: #4f46e5; }
}

.btn-danger-sm {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #ef4444;
  background: transparent;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: rgba(239, 68, 68, 0.05); }
}

/* ─── 弹窗 ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-box {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-head {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-head-icon { color: #6366f1; }
.modal-title { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.modal-subtitle { font-size: 11px; color: #9ca3af; margin-top: 1px; }

.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  &:hover { background: #f3f4f6; color: #1a1a1a; }
}

.modal-body { padding: 16px 20px; overflow-y: auto; }

.tab-bar {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  background: #f3f4f6;
  margin-bottom: 16px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;

  &.active {
    background: #fff;
    color: #6366f1;
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  &:hover:not(.active) { color: #374151; }
}

.tab-content { min-height: 200px; }

/* 市场 Tab */
.search-wrap {
  position: relative;
  margin-bottom: 12px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.search-input {
  width: 100%;
  height: 34px;
  padding: 0 12px 0 32px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
  &:focus { border-color: #6366f1; }
}

.market-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.market-card {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #6366f1;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08);

    .market-card-icon {
      background: rgba(99, 102, 241, 0.08);
      color: #6366f1;
    }
  }
}

.market-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.market-card-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  transition: all 0.15s;
}

.market-card-name {
  font-size: 12px;
  font-weight: 500;
  color: #1a1a1a;
}

.market-card-desc {
  font-size: 10px;
  color: #9ca3af;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.market-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.market-installs { font-size: 10px; color: #9ca3af; }

.btn-install {
  padding: 2px 8px;
  border-radius: 4px;
  border: none;
  background: #6366f1;
  color: #fff;
  font-size: 10px;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.85; }
}

/* 自定义 Tab */
.form-field { margin-bottom: 12px; }

.form-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 6px;

  .required { color: #ef4444; }
}

.form-input {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
  &:focus { border-color: #6366f1; }
}

.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 12px;
  outline: none;
  resize: none;
  transition: border-color 0.15s;
  &:focus { border-color: #6366f1; }
}

.ai-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.15);
  margin-bottom: 12px;
  font-size: 11px;
  color: #6b7280;
  line-height: 1.5;
}

.ai-hint-icon { color: #6366f1; flex-shrink: 0; margin-top: 1px; }

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

/* 上传 Tab */
.upload-zone {
  border: 2px dashed rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 12px;

  &:hover {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.02);
  }
}

.upload-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: #f3f4f6;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  margin-bottom: 10px;
}

.upload-title { font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 4px; }
.upload-hint { font-size: 11px; color: #9ca3af; }

.upload-spec {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.spec-title {
  font-size: 12px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.spec-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
  line-height: 1.4;
  &:last-child { margin-bottom: 0; }
}

.spec-check { color: #22c55e; flex-shrink: 0; margin-top: 1px; }

/* Transition */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
