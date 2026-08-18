<template>
  <div class="factory-kb-pane">
    <div class="kb-toolbar">
      <span class="kb-count">{{ items.length }} 个文件</span>
      <div class="kb-actions">
        <button type="button" class="action-btn ghost" @click="showAddModal = true">
          + 添加
        </button>
      </div>
    </div>

    <div class="kb-list scrollbar-thin">
      <div
        v-for="item in items"
        :key="item.id"
        class="kb-item"
      >
        <span class="kb-icon">{{ item.type === 'url' ? '🔗' : '📄' }}</span>
        <div class="kb-info">
          <div class="kb-name">
            {{ item.name }}
            <span v-if="item.isNew" class="kb-new">NEW</span>
          </div>
          <div class="kb-meta">{{ item.meta }} · {{ item.time }}</div>
        </div>
        <button
          type="button"
          class="kb-remove"
          @click="removeItem(item.id)"
        >
          删除
        </button>
      </div>
      <div v-if="items.length === 0" class="kb-empty">
        暂无知识库内容，点击「添加」上传文件或 URL
      </div>
    </div>

    <!-- 添加弹窗 -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
          <div class="modal-box">
            <div class="modal-head">
              <span class="modal-title">添加到知识库</span>
              <button type="button" class="modal-close" @click="showAddModal = false">&times;</button>
            </div>
            <div class="modal-body">
              <div class="add-tabs">
                <button type="button" class="add-tab" :class="{ active: addTab === 'file' }" @click="addTab = 'file'">上传文件</button>
                <button type="button" class="add-tab" :class="{ active: addTab === 'url' }" @click="addTab = 'url'">添加 URL</button>
              </div>

              <template v-if="addTab === 'file'">
                <div class="upload-area">
                  <div class="upload-icon">📁</div>
                  <div class="upload-hint">点击或拖拽文件到这里上传</div>
                  <div class="upload-types">支持 PDF、DOCX、TXT、MD，最大 20MB</div>
                </div>
              </template>

              <template v-else>
                <div class="url-input-wrap">
                  <label class="url-label">网页 URL</label>
                  <input
                    v-model="addUrl"
                    class="url-input"
                    type="url"
                    placeholder="https://example.com/docs"
                  />
                  <label class="url-label">名称（可选）</label>
                  <input v-model="addUrlName" class="url-input" type="text" placeholder="文档标题" />
                </div>
              </template>
            </div>
            <div class="modal-footer">
              <button type="button" class="action-btn ghost" @click="showAddModal = false">取消</button>
              <button type="button" class="action-btn primary" @click="doAdd">确认添加</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { KB_ITEMS } from '../../moreMock'

defineOptions({ name: 'FactoryKnowledgePane' })

const items = ref([...KB_ITEMS])
const showAddModal = ref(false)
const addTab = ref('file')
const addUrl = ref('')
const addUrlName = ref('')

function removeItem(id) {
  items.value = items.value.filter(i => i.id !== id)
  ElMessage.success('已移除')
}

function doAdd() {
  if (addTab.value === 'url') {
    if (!addUrl.value.trim()) { ElMessage.warning('请输入 URL'); return }
    items.value.unshift({
      id: `k${Date.now()}`,
      type: 'url',
      name: addUrlName.value.trim() || addUrl.value,
      meta: new URL(addUrl.value).hostname,
      time: '刚刚',
      isNew: true,
    })
  } else {
    items.value.unshift({
      id: `k${Date.now()}`,
      type: 'file',
      name: '示例文件.pdf',
      meta: '2.0 MB',
      time: '刚刚',
      isNew: true,
    })
  }
  addUrl.value = ''
  addUrlName.value = ''
  showAddModal.value = false
  ElMessage.success('已添加到知识库')
}
</script>

<style lang="scss" scoped>
.factory-kb-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #F4F5F5;
}
.kb-toolbar {
  height: 40px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.kb-count { font-size: 12px; color: #666; }

.kb-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kb-item {
  background: #fff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: box-shadow 0.15s;
  &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
}
.kb-icon { font-size: 20px; flex-shrink: 0; }
.kb-info { flex: 1; min-width: 0; }
.kb-name {
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}
.kb-new {
  font-size: 10px;
  font-weight: 600;
  color: #6366f1;
  background: rgba(99,102,241,0.1);
  padding: 1px 5px;
  border-radius: 4px;
}
.kb-meta { font-size: 11px; color: #999; margin-top: 2px; }
.kb-remove {
  font-size: 12px;
  color: #ef4444;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s;
  .kb-item:hover & { opacity: 1; }
}
.kb-empty {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 40px 0;
}

/* 公共按钮 */
.action-btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  &.ghost {
    background: #fff;
    border: 1px solid rgba(0,0,0,0.12);
    color: #1a1a1a;
    &:hover { border-color: #6366f1; color: #6366f1; }
  }
  &.primary {
    background: #6366f1;
    color: #fff;
    &:hover { background: #4f46e5; }
  }
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.10);
  width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-head {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.modal-title { font-size: 15px; font-weight: 600; }
.modal-close {
  width: 28px; height: 28px; border: none; background: transparent;
  font-size: 20px; cursor: pointer; color: #999; border-radius: 6px;
  &:hover { background: #f7f7f8; color: #1a1a1a; }
}
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(0,0,0,0.08);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.add-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}
.add-tab {
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  background: transparent;
  color: #666;
  transition: all 0.15s;
  &.active { background: rgba(99,102,241,0.08); color: #6366f1; font-weight: 500; }
  &:hover:not(.active) { background: #f7f7f8; }
}

.upload-area {
  border: 1.5px dashed rgba(0,0,0,0.15);
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s;
  &:hover { border-color: #6366f1; }
}
.upload-icon { font-size: 32px; margin-bottom: 8px; }
.upload-hint { font-size: 14px; color: #1a1a1a; margin-bottom: 4px; }
.upload-types { font-size: 12px; color: #999; }

.url-input-wrap { display: flex; flex-direction: column; gap: 8px; }
.url-label { font-size: 12px; font-weight: 500; color: #666; }
.url-input {
  height: 36px;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  &:focus { border-color: #6366f1; }
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
