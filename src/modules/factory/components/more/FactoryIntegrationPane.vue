<template>
  <div class="factory-integration-pane">
    <div class="integration-scroll scrollbar-thin">
    <!-- 内置集成 · 大模型 -->
    <section class="int-section">
      <div class="section-head">
        <h4 class="section-title">🧠 大模型集成</h4>
        <span class="section-hint">该智能体内置可用的模型</span>
      </div>
      <div class="model-list">
        <div
          v-for="m in integrations.models"
          :key="m.id"
          class="model-card"
          :class="{ enabled: m.enabled, default: m.isDefault }"
        >
          <div class="model-main">
            <div class="model-name">
              {{ m.name }}
              <span v-if="m.isDefault" class="default-badge">默认</span>
            </div>
            <div class="model-meta">
              <span class="model-vendor">{{ m.vendor }}</span>
              <span class="model-desc">{{ m.desc }}</span>
            </div>
          </div>
          <div class="model-ops">
            <button
              v-if="!m.isDefault && m.enabled"
              type="button"
              class="link-btn"
              @click="factoryStore.setDefaultModel(m.id)"
            >
              设为默认
            </button>
            <el-switch
              :model-value="m.enabled"
              :disabled="m.isDefault"
              @change="factoryStore.toggleModel(m.id)"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- 外部集成（仅查看配置状态，配置入口在 Kooky 设置） -->
    <section class="int-section">
      <div class="section-head section-head--stack">
        <div>
          <h4 class="section-title">🔗 外部集成</h4>
          <span class="section-hint">仅展示全局配置状态，修改请前往 Kooky → 设置 → 外部集成</span>
        </div>
        <button type="button" class="goto-settings-btn" @click="openExternalSettings">
          前往设置
        </button>
      </div>
      <div class="int-grid">
        <div
          v-for="it in integrations.external"
          :key="it.id"
          class="int-card int-card--external"
          :class="{ connected: isExternalConfigured(it) }"
        >
          <div class="int-card-top">
            <span class="int-icon">{{ it.icon }}</span>
            <span class="int-status" :class="{ on: isExternalConfigured(it) }">
              {{ isExternalConfigured(it) ? '已配置' : '未配置' }}
            </span>
          </div>
          <div class="int-name">{{ it.name }}</div>
          <div class="int-desc">{{ it.desc }}</div>

          <div v-if="isGlobalExternal(it)" class="int-readonly-config">
            <div class="readonly-row">
              <span class="readonly-label">{{ extStore.getFieldLabel(it.id) }}</span>
              <span class="readonly-value">{{ extStore.getMaskedConfig(it.id) }}</span>
            </div>
          </div>

          <div v-else-if="it.configFields?.length" class="int-fields">
            <span v-for="f in it.configFields" :key="f" class="field-chip">{{ f }}</span>
          </div>
        </div>
      </div>
    </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElSwitch } from 'element-plus'
import { useFactoryStore } from '../../store'
import { useExternalIntegrationsStore } from '@/modules/space/externalIntegrationsStore'
import { useUIStore } from '@/modules/space/uiStore'

defineOptions({ name: 'FactoryIntegrationPane' })

const factoryStore = useFactoryStore()
const extStore = useExternalIntegrationsStore()
const uiStore = useUIStore()
const integrations = computed(() => factoryStore.integrations)

const GLOBAL_EXTERNAL_IDS = new Set(['feishu', 'yunfan'])

function isGlobalExternal(it) {
  return GLOBAL_EXTERNAL_IDS.has(it.id) || GLOBAL_EXTERNAL_IDS.has(it.settingsKey)
}

function isExternalConfigured(it) {
  if (isGlobalExternal(it)) return extStore.isConfigured(it.id)
  return !!it.connected
}

function openExternalSettings() {
  uiStore.openKookySettings('external-integrations')
}
</script>

<style scoped lang="scss">
.factory-integration-pane {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f4f5f5;
}

.integration-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.int-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px 18px;
  border: 1px solid #eef0f3;
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;

  &--stack {
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
  margin: 0;
}

.section-hint {
  font-size: 12px;
  color: #9ca3af;
  display: block;
  margin-top: 4px;
}

.goto-settings-btn {
  flex-shrink: 0;
  height: 30px;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6366f1;
  font-size: 12px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    border-color: #c7d2fe;
    background: #f5f3ff;
  }
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  transition: all 0.15s;

  &.enabled { border-color: #dfe3ff; background: #fbfbff; }
  &.default { border-color: #c7d2fe; background: linear-gradient(180deg, #f5f3ff, #fff); }
}

.model-name {
  font-size: 13px;
  font-weight: 600;
  color: #2f3547;
  display: flex;
  align-items: center;
  gap: 6px;
}

.default-badge {
  font-size: 10px;
  color: #6366f1;
  background: #eef2ff;
  border-radius: 4px;
  padding: 1px 6px;
}

.model-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}

.model-vendor {
  font-size: 11px;
  color: #6b7280;
  background: #f2f3f5;
  border-radius: 4px;
  padding: 1px 6px;
}

.model-desc { font-size: 12px; color: #9ca3af; }

.model-ops {
  display: flex;
  align-items: center;
  gap: 10px;
}

.link-btn {
  border: none;
  background: transparent;
  color: #6366f1;
  font-size: 12px;
  cursor: pointer;
  &:hover { text-decoration: underline; }
}

.int-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.int-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fff;

  &.connected {
    border-color: #bbf7d0;
    background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%);
  }
}

.int-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.int-icon { font-size: 22px; }

.int-status {
  font-size: 11px;
  color: #9ca3af;
  &.on { color: #22c55e; }
}

.int-name { font-size: 13px; font-weight: 600; color: #2f3547; }
.int-desc { font-size: 12px; color: #9ca3af; line-height: 1.5; }

.int-readonly-config {
  margin-top: 8px;
  padding: 10px 12px;
  background: #f7f8fb;
  border-radius: 8px;
  border: 1px solid #eef0f3;
}

.readonly-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.readonly-label {
  font-size: 11px;
  color: #9ca3af;
}

.readonly-value {
  font-size: 12px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  color: #4b5563;
  word-break: break-all;
}

.int-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.field-chip {
  font-size: 10px;
  color: #6b7280;
  background: #f7f8fb;
  border: 1px solid #eef0f3;
  border-radius: 4px;
  padding: 1px 6px;
}
</style>
