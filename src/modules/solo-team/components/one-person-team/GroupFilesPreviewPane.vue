<template>
  <section class="preview-pane">
    <header v-if="!embedded" class="pv-head">
      <h2 class="pv-title">预览</h2>
      <button type="button" class="pv-icon-btn" aria-label="收起" @click="preview.close()">
        <SvgIcon name="icon-guanbi1" :size="16" color="#91949e" />
      </button>
    </header>

    <!-- 标签栏 -->
    <div class="pv-tabbar">
      <div class="pv-tabs">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="pv-tab"
          :class="{ active: tab.id === activeId }"
          @click="preview.setActive(tab.id)"
        >
          <span class="pv-tab-icon">
            <GlobeIcon v-if="tab.kind === 'browser'" :size="14" />
            <img v-else :src="iconFor(tab)" alt="" />
          </span>
          <span class="pv-tab-name">{{ tabTitle(tab) }}</span>
          <span class="pv-tab-close" role="button" aria-label="关闭" @click.stop="closeTab(tab.id)">
            <SvgIcon name="icon-guanbi1" :size="11" color="#91949e" />
          </span>
        </div>
      </div>

      <button ref="addBtnRef" type="button" class="pv-tab-add" aria-label="新建标签页" @click="toggleAddMenu">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="addMenuOpen" class="pv-add-backdrop" @click="addMenuOpen = false">
        <div class="pv-add-menu" :style="addMenuStyle" @click.stop>
          <button type="button" class="pv-add-item" @click="addBrowser">
            <GlobeIcon :size="15" /><span>浏览器</span>
          </button>
          <button type="button" class="pv-add-item" @click="pickLocalFile">
            <SvgIcon name="icon-wenjian" :size="15" color="#6d7384" /><span>文件</span>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 内容区 -->
    <div class="pv-content">
      <div v-if="!activeTab" class="pv-empty">从群内文件选择文件，或点 + 新建标签页</div>

      <!-- 浏览器 tab -->
      <template v-else-if="activeTab.kind === 'browser'">
        <div class="br-toolbar">
          <button type="button" class="br-nav" aria-label="后退" disabled><ArrowIcon dir="left" /></button>
          <button type="button" class="br-nav" aria-label="前进" disabled><ArrowIcon dir="right" /></button>
          <button type="button" class="br-nav" aria-label="刷新" @click="reloadBrowser"><SvgIcon name="icon-shuaxin" :size="14" color="#6d7384" /></button>
          <input
            v-model="activeTab.urlDraft"
            class="br-url"
            placeholder="输入 URL"
            @keydown.enter="navigate"
          />
          <button type="button" class="br-nav" aria-label="新窗口打开" @click="openExternal"><ArrowIcon dir="up-right" /></button>
        </div>

        <div class="br-body">
          <!-- 空态：开始浏览 -->
          <div v-if="activeTab.mode === 'empty'" class="br-blank">
            <GlobeIcon :size="64" class="br-blank-globe" />
            <div class="br-blank-title">开始浏览</div>
            <div class="br-blank-hint">输入 URL 以打开页面</div>
          </div>

          <!-- agent 起的前端工程 / web server：截图占位 -->
          <div v-else-if="activeTab.mode === 'web'" class="br-web">
            <div class="br-web-bar">
              <span class="br-web-status running">web server 运行中</span>
              <span class="br-web-url">{{ activeTab.url }}</span>
            </div>
            <div class="br-web-shot">
              <div class="br-shot-title">{{ activeTab.placeholder || activeTab.title }}</div>
              <div class="br-shot-line" style="width: 78%"></div>
              <div class="br-shot-line" style="width: 56%"></div>
              <div class="br-shot-cards"><div class="br-shot-card"></div><div class="br-shot-card"></div></div>
              <div class="br-shot-hint">↑ 渲染中的 {{ activeTab.url }} 页面（截图占位）</div>
            </div>
          </div>

          <!-- 群聊生成的 HTML：iframe 渲染 -->
          <iframe v-else-if="activeTab.mode === 'html'" class="br-frame" :srcdoc="activeTab.html"></iframe>

          <!-- 手动输入 URL：iframe 加载 -->
          <iframe v-else-if="activeTab.mode === 'url'" :key="activeTab.url" class="br-frame" :src="activeTab.url"></iframe>
        </div>
      </template>

      <!-- 文件 tab -->
      <template v-else>
        <!-- 文件工具条：md 源码/预览切换 + 下载/转存 -->
        <div class="fv-toolbar">
          <div v-if="canToggle(activeTab) && !editMode" class="fv-toggle">
            <button class="fvt-btn" :class="{ active: !srcMode }" title="预览" @click="srcMode = false">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8S3.8 3.8 8 3.8 14.5 8 14.5 8 12.2 12.2 8 12.2 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="1.9"/></svg>
            </button>
            <button class="fvt-btn" :class="{ active: srcMode }" title="源文件" @click="srcMode = true">
              <span class="fvt-code">&lt;/&gt;</span>
            </button>
          </div>
          <span class="fv-fname">{{ activeTab.name }}<span class="fv-ftype"> · {{ (activeTab.fileType || '').toUpperCase() }}</span></span>
          <span class="fv-acts">
            <template v-if="editMode">
              <button class="fv-act fv-act--save" title="保存" @click="saveEdit">保存</button>
              <button class="fv-act fv-act--text" title="取消" @click="cancelEdit">取消</button>
            </template>
            <template v-else>
              <button v-if="canEdit(activeTab)" class="fv-act fv-act--text" title="编辑" @click="enterEdit">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M11.3 2.3 13.7 4.7 5.4 13 2.5 13.5 3 10.6z"/></svg>
                编辑
              </button>
              <button class="fv-act" title="下载到本地" @click="downloadTab(activeTab)">
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v7M5 6.5 8 9.5l3-3M3 13h10"/></svg>
              </button>
              <button class="fv-act" title="转存到文件库" @click="saveTab(activeTab)">
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5v2.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5M5 9.5H2m3 0 1 1.5h4l1-1.5m0 0h3M8 2v5.5M6 5.5 8 7.5l2-2"/></svg>
              </button>
            </template>
          </span>
        </div>

        <div class="fv-body">
          <textarea
            v-if="editMode && canEdit(activeTab)"
            v-model="draft"
            class="fv-editor"
            spellcheck="false"
          ></textarea>
          <div v-else-if="activeTab.fileType === 'image'" class="fv-image">
            <img v-if="activeTab.localUrl" :src="activeTab.localUrl" :alt="activeTab.name" class="fv-image-real" />
            <template v-else>
              <img :src="iconFor(activeTab)" alt="" class="fv-icon" />
              <div class="fv-title">{{ activeTab.name }}</div>
              <div class="fv-hint">{{ activeTab.placeholder || '图片预览（截图占位）' }}</div>
            </template>
          </div>
          <template v-else-if="activeTab.fileType === 'md'">
            <pre v-if="srcMode" class="fv-code">{{ activeTab.content || '' }}</pre>
            <div v-else class="fv-doc"><MarkdownContent :content="activeTab.content || ''" /></div>
          </template>
          <pre v-else-if="activeTab.fileType === 'code' || activeTab.fileType === 'txt'" class="fv-code">{{ activeTab.content || '' }}</pre>
          <div v-else class="fv-unsupported">
            <img :src="iconFor(activeTab)" alt="" class="fv-icon" />
            <div class="fv-title">{{ activeTab.name }}</div>
            <div class="fv-hint">该类型暂不支持内联预览，可下载后查看。</div>
          </div>
        </div>
      </template>
    </div>

    <input ref="fileInputRef" type="file" class="pv-file-input" @change="onFilePicked" />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import MarkdownContent from '@/shared/components/MarkdownContent.vue'
import { getChatFileIconSrc, getChatFileTypeFromName } from '@/shared/utils/chatFileIcons'
import { usePreviewStore } from '@/modules/space/previewStore'
import { useFileLibraryStore } from '@/modules/file/store/fileLibraryStore'
import GlobeIcon from './preview/GlobeIcon.vue'
import ArrowIcon from './preview/ArrowIcon.vue'

defineOptions({ name: 'GroupFilesPreviewPane' })

// embedded：嵌入会话侧区 preview 槽时隐藏自带头部（由外层槽提供头）
defineProps({ embedded: { type: Boolean, default: false } })

// 全局共享预览区：标签状态在 previewStore，整个 kooky 共用这一个预览区
const preview = usePreviewStore()
const libStore = useFileLibraryStore()
const tabs = computed(() => preview.tabs)
const activeId = computed(() => preview.activeId)
const activeTab = computed(() => preview.activeTab)

// —— md 源文件/预览切换 —— 切换标签时重置回预览态
const srcMode = ref(false)
const editMode = ref(false)
const draft = ref('')
watch(activeId, () => { srcMode.value = false; editMode.value = false })
function canToggle(tab) {
  return tab && tab.fileType === 'md'
}
// 可编辑的文本类型（md / code / txt）
function canEdit(tab) {
  return tab && ['md', 'code', 'txt'].includes(tab.fileType)
}
function enterEdit() {
  draft.value = activeTab.value?.content || ''
  srcMode.value = false
  editMode.value = true
}
function saveEdit() {
  preview.updateTabContent(activeId.value, draft.value)
  editMode.value = false
  ElMessage.success('已保存')
}
function cancelEdit() {
  editMode.value = false
}

// —— 下载到本地 / 转存到文件库 ——
function downloadTab(tab) {
  if (!tab) return
  const text = tab.content || ''
  if (text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = tab.name || 'file'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    ElMessage?.success?.(`已下载「${tab.name}」`)
  } else {
    ElMessage?.info?.(`已下载「${tab.name}」（演示）`)
  }
}
function saveTab(tab) {
  if (!tab) return
  const ok = libStore.addFile({
    name: tab.name,
    type: tab.fileType,
    previewType: tab.fileType,
    content: tab.content || '',
    size: tab.size,
  })
  ElMessage?.[ok ? 'success' : 'info']?.(ok ? `已转存「${tab.name}」到文件库` : `「${tab.name}」已在文件库中`)
}

const addMenuOpen = ref(false)
const addMenuStyle = ref({})
const addBtnRef = ref(null)
const fileInputRef = ref(null)
let fileSeq = 0

function toggleAddMenu() {
  if (addMenuOpen.value) { addMenuOpen.value = false; return }
  const r = addBtnRef.value?.getBoundingClientRect()
  if (r) addMenuStyle.value = { top: `${Math.round(r.bottom + 4)}px`, left: `${Math.round(Math.min(r.left, window.innerWidth - 140))}px` }
  addMenuOpen.value = true
}

function iconFor(tab) {
  return getChatFileIconSrc(getChatFileTypeFromName(tab?.name))
}

function tabTitle(tab) {
  if (tab.kind === 'file') return tab.name
  if (tab.mode === 'web' || tab.mode === 'html') return tab.title
  if (tab.mode === 'url') return hostOf(tab.url) || '网页'
  return '新选项卡'
}

function hostOf(url) {
  try { return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).host } catch { return url }
}

function addBrowser() {
  preview.openBrowserBlank()
  addMenuOpen.value = false
}

function pickLocalFile() {
  addMenuOpen.value = false
  fileInputRef.value?.click()
}

function onFilePicked(e) {
  const f = e.target.files?.[0]
  if (!f) return
  const ext = (f.name.split('.').pop() || '').toLowerCase()
  if (ext === 'html' || ext === 'htm') {
    const r = new FileReader()
    r.onload = () => preview.openBrowser({ mode: 'html', title: f.name, html: String(r.result || '') })
    r.readAsText(f)
  } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) {
    preview.openFileTab({ id: `local-${f.name}-${fileSeq++}`, name: f.name, fileType: 'image', localUrl: URL.createObjectURL(f) })
  } else if (['md', 'markdown'].includes(ext)) {
    const r = new FileReader()
    r.onload = () => preview.openFileTab({ id: `local-${f.name}-${fileSeq++}`, name: f.name, fileType: 'md', content: String(r.result || '') })
    r.readAsText(f)
  } else if (['txt', 'json', 'js', 'ts', 'css', 'py', 'csv', 'log', 'yml', 'yaml', 'sh', 'java', 'go', 'rs', 'vue'].includes(ext)) {
    const r = new FileReader()
    r.onload = () => preview.openFileTab({ id: `local-${f.name}-${fileSeq++}`, name: f.name, fileType: 'code', content: String(r.result || '') })
    r.readAsText(f)
  } else {
    preview.openFileTab({ id: `local-${f.name}-${fileSeq++}`, name: f.name, fileType: 'other' })
  }
  e.target.value = ''
}

function navigate() {
  const t = activeTab.value
  if (!t || t.kind !== 'browser') return
  const url = String(t.urlDraft || '').trim()
  if (url) preview.navigate(t.id, url)
}

function reloadBrowser() {
  const t = activeTab.value
  if (t?.mode === 'url') { const u = t.url; t.url = ''; requestAnimationFrame(() => { t.url = u }) }
}

function openExternal() {
  const t = activeTab.value
  if (t?.url) window.open(t.url, '_blank', 'noopener')
}

function closeTab(id) {
  preview.closeTab(id)
}
</script>

<style scoped>
.preview-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #eceef3;
}

.pv-head {
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid #f0f1f5;
}

.pv-title {
  margin: 0;
  font-family: PingFang SC, sans-serif;
  font-size: 14px;
  font-weight: normal;
  color: #2f3547;
}

.pv-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.pv-icon-btn:hover {
  background: rgba(47, 53, 71, 0.06);
}

.pv-tabbar {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  border-bottom: 1px solid #f0f1f5;
}

.pv-tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  overflow-x: auto;
}

.pv-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  max-width: 180px;
  border-right: 1px solid #f0f1f5;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: background 0.15s;
}

.pv-tab:hover {
  background: #fafbfc;
}

.pv-tab.active {
  border-bottom-color: #436ff6;
}

.pv-tab-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.pv-tab-icon img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.pv-tab-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #2f3547;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pv-tab-close {
  display: flex;
  align-items: center;
  border-radius: 4px;
  padding: 1px;
  flex-shrink: 0;
}

.pv-tab-close:hover {
  background: rgba(47, 53, 71, 0.08);
}

.pv-tab-add {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  border: none;
  border-left: 1px solid #f0f1f5;
  background: transparent;
  cursor: pointer;
  color: #5f6470;
}

.pv-tab-add:hover {
  background: #f2f3f6;
  color: #2f3547;
}

.pv-add-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
}

.pv-add-menu {
  position: fixed;
  z-index: 2001;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(31, 35, 41, 0.14);
  padding: 4px;
  min-width: 128px;
}

.pv-add-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #2f3547;
  text-align: left;
}

.pv-add-item:hover {
  background: rgba(47, 53, 71, 0.05);
}

.pv-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pv-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #b6b9c2;
}

/* 浏览器 */
.br-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid #f0f1f5;
}

.br-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: #6d7384;
}

.br-nav:hover:not(:disabled) {
  background: rgba(47, 53, 71, 0.06);
}

.br-nav:disabled {
  opacity: 0.4;
  cursor: default;
}

.br-url {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 12px;
  border: 1px solid #e8ebf0;
  border-radius: 8px;
  font-size: 13px;
  color: #2f3547;
  outline: none;
  background: #f7f8fa;
}

.br-url:focus {
  border-color: #436ff6;
  background: #fff;
}

.br-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.br-frame {
  flex: 1;
  width: 100%;
  border: none;
  min-height: 0;
}

.br-blank {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #b6b9c2;
}

.br-blank-globe {
  color: #c4c8d2;
  margin-bottom: 6px;
}

.br-blank-title {
  font-size: 15px;
  font-weight: 500;
  color: #6d7384;
}

.br-blank-hint {
  font-size: 13px;
  color: #b6b9c2;
}

.br-web {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px;
}

.br-web-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  margin-bottom: 12px;
  background: #f7f8fa;
  border-radius: 8px;
}

.br-web-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #1a9d63;
}

.br-web-status.running::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2bb673;
}

.br-web-url {
  font-size: 12px;
  color: #2f3547;
}

.br-web-shot {
  border: 1px solid #eceef3;
  border-radius: 10px;
  padding: 20px 18px;
  background: #fafbfc;
}

.br-shot-title {
  font-size: 15px;
  font-weight: 500;
  color: #2f3547;
  margin-bottom: 10px;
}

.br-shot-line {
  height: 8px;
  border-radius: 4px;
  background: #e9ebf0;
  margin-bottom: 8px;
}

.br-shot-cards {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.br-shot-card {
  flex: 1;
  height: 58px;
  border-radius: 8px;
  background: #e9ebf0;
}

.br-shot-hint {
  margin-top: 14px;
  font-size: 11px;
  color: #b6b9c2;
  text-align: center;
}

/* 文件 */
.fv-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid #eef0f4;
}
.fv-toggle {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  background: #f2f3f5;
  border-radius: 8px;
}
.fvt-btn {
  min-width: 30px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #6d7384;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.fvt-btn.active {
  background: #fff;
  color: #1f2329;
  box-shadow: 0 1px 2px rgba(31, 35, 41, 0.12);
}
.fvt-code {
  font-family: var(--font-mono, 'SFMono-Regular', Consolas, monospace);
  font-size: 11px;
  font-weight: 600;
}
.fv-fname {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fv-ftype {
  color: #b6b9c2;
  font-weight: 400;
}
.fv-acts {
  flex-shrink: 0;
  display: inline-flex;
  gap: 2px;
}
.fv-act {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  font-size: 14px;
  color: #6d7384;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.fv-act:hover {
  background: #f2f3f5;
}
.fv-act--text {
  width: auto;
  gap: 4px;
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 500;
}
.fv-act--save {
  width: auto;
  padding: 0 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: #fff;
  background: #ff621f;
}
.fv-act--save:hover {
  background: #ff5214;
}
.fv-editor {
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  resize: none;
  border: none;
  outline: none;
  padding: 16px 20px;
  font-family: var(--font-mono, ui-monospace, "SF Mono", Menlo, monospace);
  font-size: 13px;
  line-height: 1.7;
  color: #2f3547;
  background: #fff;
}
.fv-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.fv-doc {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px;
  font-size: 14px;
  color: #2f3547;
}

.fv-code {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 16px 18px;
  font-family: var(--font-mono, 'SFMono-Regular', Consolas, monospace);
  font-size: 12px;
  line-height: 1.7;
  color: #2f3547;
  white-space: pre-wrap;
  word-break: break-word;
}

.fv-image {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  overflow: auto;
  padding: 16px;
}

.fv-image-real {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.fv-unsupported {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.fv-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.fv-title {
  font-size: 15px;
  font-weight: 500;
  color: #2f3547;
}

.fv-hint {
  font-size: 12px;
  color: #b6b9c2;
}

.pv-file-input {
  display: none;
}
</style>
