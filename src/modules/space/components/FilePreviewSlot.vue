<template>
  <div class="fps">
    <!-- 预览态：多标签预览 + 返回 -->
    <template v-if="isPreview">
      <header class="fps-head">
        <button class="fps-back" aria-label="返回文件列表" @click="backToList">
          <span class="back-arrow">‹</span> 文件
        </button>
        <button class="fps-close" aria-label="收起" @click="sidePanel.close()">✕</button>
      </header>
      <div class="fps-preview">
        <GroupFilesPreviewPane embedded />
      </div>
    </template>

    <!-- 列表态：分类文件卡（产物 / 用户上传）-->
    <template v-else>
      <header class="fps-head">
        <h3 class="fps-title">文件</h3>
        <button class="fps-close" aria-label="收起" @click="sidePanel.close()">✕</button>
      </header>
      <div class="fps-scroll">
        <div class="fps-tip">
          <span class="tip-dot">!</span>
          <span class="tip-text">沙箱产物会定期自动清理，重要文件请及时转存到「文件」</span>
        </div>

        <section v-for="sec in sections" :key="sec.key" class="fps-sec">
          <div class="sec-label">{{ sec.label }} <span class="sec-count">{{ sec.files.length }}</span></div>
          <div
            v-for="f in sec.files"
            :key="f.id"
            class="file-card"
            role="button"
            tabindex="0"
            @click="open(f)"
            @keydown.enter.prevent="open(f)"
          >
            <span class="fc-icon" :class="'t-' + f.fileType">{{ iconOf(f) }}</span>
            <span class="fc-main">
              <span class="fc-name">{{ f.name }}</span>
              <span class="fc-meta">{{ metaOf(f) }}</span>
            </span>
            <span class="fc-actions">
              <button class="fc-act" title="转存到文件库" @click.stop="saveRow(f)">
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5v2.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5M5 9.5H2m3 0 1 1.5h4l1-1.5m0 0h3M8 2v5.5M6 5.5 8 7.5l2-2"/></svg>
              </button>
              <button class="fc-act" title="下载到本地" :disabled="!f.content" @click.stop="downloadRow(f)">
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v7M5 6.5 8 9.5l3-3M3 13h10"/></svg>
              </button>
            </span>
            <span class="fc-arrow">›</span>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { usePreviewStore } from '@/modules/space/previewStore'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { useFileLibraryStore } from '@/modules/file/store/fileLibraryStore'
import { PREVIEW_FILES_DEMO } from '@/modules/space/demo/previewFilesDemo'
import GroupFilesPreviewPane from '@/modules/solo-team/components/one-person-team/GroupFilesPreviewPane.vue'

const preview = usePreviewStore()
const sidePanel = useSidePanelStore()
const libStore = useFileLibraryStore()
const files = PREVIEW_FILES_DEMO


const sections = computed(() =>
  [
    { key: 'artifact', label: '产物', files: files.filter((f) => f.category === 'artifact') },
    { key: 'upload', label: '用户上传', files: files.filter((f) => f.category === 'upload') },
  ].filter((s) => s.files.length),
)

const ICON = { md: '📄', code: '📜', txt: '📃', image: '🖼', web: '🌐', html: '🌐', other: '📎' }
function iconOf(f) {
  return ICON[f.fileType] || '📎'
}
const TYPE_LABEL = { md: 'Markdown', code: '代码', txt: '文本', image: '图片', web: 'Web 页面', html: 'HTML' }
function metaOf(f) {
  const t = TYPE_LABEL[f.fileType] || '文件'
  return f.lines ? `${t} · ${f.lines} 行` : t
}

// 预览态 = previewStore 里有标签（外部如分身会话点文件也能进预览）
const isPreview = computed(() => preview.tabs.length > 0)

function open(f) {
  preview.openFile(f)
}
function backToList() {
  preview.close()
}

// —— 列表页：转存到「文件」库 / 下载到本地 ——
function saveRow(f) {
  const ok = libStore.addFile({
    name: f.name,
    type: f.fileType,
    previewType: f.fileType,
    content: f.content || '',
  })
  ElMessage?.[ok ? 'success' : 'info']?.(
    ok ? `已转存「${f.name}」到文件库` : `「${f.name}」已在文件库中`,
  )
}
function downloadRow(f) {
  const text = f.content || ''
  if (!text) {
    ElMessage?.info?.(`「${f.name}」暂无可下载内容`)
    return
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = f.name || 'file'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  ElMessage?.success?.(`已下载「${f.name}」`)
}

// 列表=窄、预览=宽（平滑过渡由侧区统一处理）
watch(isPreview, (v) => sidePanel.setWide(v), { immediate: true })
// 离开文件槽清空预览标签，避免全局老宿主残留
onBeforeUnmount(() => preview.close())
</script>

<style scoped>
.fps {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.fps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  flex-shrink: 0;
}
.fps-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--kk-ink-800, #1f2329);
}
.fps-back {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--kk-ink-700, #333);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 6px;
}
.fps-back:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.04));
}
.back-arrow {
  font-size: 20px;
  line-height: 1;
}
.fps-close {
  border: none;
  background: transparent;
  color: var(--kk-ink-400, #9aa0aa);
  cursor: pointer;
  font-size: 13px;
  padding: 4px;
  border-radius: 6px;
}
.fps-close:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.04));
}

.fps-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 16px;
}
.fps-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 4px 2px 12px;
  padding: 9px 11px;
  border: 1px solid var(--accent-soft, rgba(255, 98, 31, 0.16));
  background: rgba(255, 98, 31, 0.05);
  border-radius: 10px;
}
.tip-dot {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--kk-orange-400, #ff621f);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
}
.tip-text {
  flex: 1;
  font-size: 12px;
  line-height: 1.5;
  color: var(--kk-orange-500, #d9531e);
}

.fps-sec {
  margin-bottom: 14px;
}
.sec-label {
  font-size: 12px;
  color: var(--kk-ink-500, #6b7280);
  padding: 6px 4px;
}
.sec-count {
  color: var(--kk-ink-300, #c4c8ce);
}

.file-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  border: 1px solid var(--kk-border-soft, #e5e6eb);
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.file-card:hover {
  border-color: var(--kk-orange-400, #ff621f);
  background: var(--kk-orange-50, rgba(255, 98, 31, 0.04));
}
.fc-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
  background: var(--kk-fill-muted, #f2f3f5);
}
.fc-icon.t-md {
  background: rgba(51, 112, 255, 0.1);
}
.fc-icon.t-code {
  background: rgba(132, 120, 250, 0.12);
}
.fc-icon.t-web,
.fc-icon.t-html {
  background: rgba(7, 193, 96, 0.1);
}
.fc-icon.t-image {
  background: rgba(255, 98, 31, 0.1);
}
.fc-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.fc-name {
  font-size: 13px;
  color: var(--kk-ink-800, #1f2329);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fc-meta {
  font-size: 11px;
  color: var(--kk-ink-400, #9aa0aa);
}
.fc-actions {
  display: none;
  flex-shrink: 0;
  gap: 2px;
}
.file-card:hover .fc-actions,
.file-card:focus-within .fc-actions {
  display: inline-flex;
}
.file-card:hover .fc-arrow,
.file-card:focus-within .fc-arrow {
  display: none;
}
.fc-act {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  color: var(--kk-ink-500, #6b7280);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.fc-act:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.06));
  color: var(--kk-ink-800, #1f2329);
}
.fc-act:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.fc-arrow {
  color: var(--kk-ink-300, #c4c8ce);
  font-size: 16px;
  flex-shrink: 0;
}

.fps-preview {
  flex: 1;
  min-height: 0;
  display: flex;
}
.fps-preview > * {
  flex: 1;
  min-width: 0;
}
</style>
