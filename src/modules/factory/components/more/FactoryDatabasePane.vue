<template>
  <div class="factory-db-pane">
    <!-- 列表视图 -->
    <template v-if="!activeTableName">
      <div class="db-toolbar">
        <div class="toolbar-left">
          <span class="toolbar-title">数据表</span>
          <span class="toolbar-meta">{{ tables.length }} 张表 · {{ totalRows.toLocaleString() }} 条记录</span>
        </div>
      </div>

      <div class="db-scroll scrollbar-thin">
        <div class="db-list">
          <div
            v-for="table in tables"
            :key="table.name"
            class="db-card"
            @click="factoryStore.selectDbTable(table.name)"
          >
            <div class="db-card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18M3 9h18M3 15h18"/>
              </svg>
            </div>
            <div class="db-card-body">
              <div class="db-card-name-row">
                <span class="db-table-name">{{ table.name }}</span>
                <span class="db-table-desc">{{ table.desc }}</span>
              </div>
              <div class="db-card-meta">
                <span class="meta-item">{{ table.rows.toLocaleString() }} 行</span>
                <span class="meta-item">{{ table.size }}</span>
                <span class="meta-item">更新于 {{ table.updated }}</span>
              </div>
            </div>
            <svg class="db-card-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </div>
    </template>

    <!-- 表详情视图 -->
    <template v-else-if="activeTable">
      <div class="db-detail-bar">
        <div class="detail-bar-left">
          <button type="button" class="back-btn" title="返回" @click="factoryStore.selectDbTable('')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <span class="detail-table-name">{{ activeTable.name }}</span>
          <span class="detail-table-desc">{{ activeTable.desc }}</span>
        </div>
        <div class="detail-bar-right">
          <button type="button" class="add-row-btn" @click="openAdd">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新增记录
          </button>
        </div>
      </div>

      <div class="db-detail-body scrollbar-thin">
        <!-- 字段结构 -->
        <div class="detail-section">
          <div class="section-title">字段结构</div>
          <div class="detail-card">
            <table class="schema-table">
              <thead>
                <tr><th>字段名</th><th>类型</th><th>说明</th><th class="col-pk">主键</th></tr>
              </thead>
              <tbody>
                <tr v-for="col in activeTable.columns" :key="col.name">
                  <td class="cell-name">{{ col.name }}</td>
                  <td><span class="type-badge">{{ col.type }}</span></td>
                  <td class="cell-desc">{{ col.desc }}</td>
                  <td class="col-pk">{{ col.pk ? '🔑' : '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 数据（增删改查）-->
        <div class="detail-section">
          <div class="section-header">
            <span class="section-title">数据记录</span>
            <span class="section-hint">共 {{ activeTable.sampleRows.length }} 条</span>
          </div>
          <div class="detail-card data-card">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th v-for="col in activeTable.columns" :key="col.name">{{ col.name }}</th>
                    <th class="ops-col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in activeTable.sampleRows" :key="row.id">
                    <td v-for="col in activeTable.columns" :key="col.name">{{ row[col.name] ?? '—' }}</td>
                    <td class="ops-col">
                      <button class="row-op" title="编辑" @click="openEdit(row)">编辑</button>
                      <button class="row-op row-op--danger" title="删除" @click="removeRow(row)">删除</button>
                    </td>
                  </tr>
                  <tr v-if="!activeTable.sampleRows.length">
                    <td :colspan="activeTable.columns.length + 1" class="empty-row">暂无数据，点击右上角「新增记录」</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 新增 / 编辑 弹窗 -->
    <el-dialog
      :model-value="showRowDialog"
      :title="editingId ? '编辑记录' : '新增记录'"
      width="440px"
      align-center
      append-to-body
      @close="closeDialog"
    >
      <div class="row-form">
        <div v-for="col in editableColumns" :key="col.name" class="row-field">
          <label class="row-field-label">{{ col.name }}<span class="field-type">{{ col.type }}</span></label>
          <input v-model="rowForm[col.name]" class="row-field-input" :placeholder="col.desc" />
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="closeDialog">取消</button>
          <button class="btn-confirm" @click="saveRow">保存</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElDialog, ElMessage, ElMessageBox } from 'element-plus'
import { useFactoryStore } from '../../store'

defineOptions({ name: 'FactoryDatabasePane' })

const factoryStore = useFactoryStore()
const tables = computed(() => factoryStore.dbTables)
const activeTableName = computed(() => factoryStore.selectedDbTableName)
const activeTable = computed(() => factoryStore.selectedDbTable)
const totalRows = computed(() => tables.value.reduce((s, t) => s + (t.rows || 0), 0))

// 进入数据库默认回到列表视图
factoryStore.selectDbTable('')

const editableColumns = computed(() => (activeTable.value?.columns || []).filter(c => !c.pk))

const showRowDialog = ref(false)
const editingId = ref(null)
const rowForm = reactive({})

function openAdd() {
  editingId.value = null
  Object.keys(rowForm).forEach(k => delete rowForm[k])
  editableColumns.value.forEach(c => { rowForm[c.name] = '' })
  showRowDialog.value = true
}

function openEdit(row) {
  editingId.value = row.id
  Object.keys(rowForm).forEach(k => delete rowForm[k])
  editableColumns.value.forEach(c => { rowForm[c.name] = row[c.name] ?? '' })
  showRowDialog.value = true
}

function closeDialog() {
  showRowDialog.value = false
}

function saveRow() {
  const payload = { ...rowForm }
  if (editingId.value) {
    factoryStore.updateDbRow(activeTableName.value, editingId.value, payload)
    ElMessage.success('已更新记录')
  } else {
    factoryStore.insertDbRow(activeTableName.value, payload)
    ElMessage.success('已新增记录')
  }
  showRowDialog.value = false
}

async function removeRow(row) {
  try {
    await ElMessageBox.confirm(`确认删除记录 #${row.id}？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    factoryStore.deleteDbRow(activeTableName.value, row.id)
    ElMessage.success('已删除')
  } catch { /* 取消 */ }
}
</script>

<style lang="scss" scoped>
.factory-db-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #F4F5F5;
}

.db-toolbar {
  height: 44px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.toolbar-left { display: flex; align-items: center; gap: 10px; }
.toolbar-title { font-size: 13px; font-weight: 600; color: #1a1a1a; }
.toolbar-meta { font-size: 11px; color: #9ca3af; }

.db-scroll { flex: 1; overflow-y: auto; padding: 16px 20px; }

.db-list { display: flex; flex-direction: column; gap: 8px; }

.db-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: rgba(99, 102, 241, 0.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    .db-card-arrow { opacity: 1; }
  }
}

.db-card-icon {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; border-radius: 8px;
  background: rgba(99, 102, 241, 0.1); color: #6366f1;
}

.db-card-body { flex: 1; min-width: 0; }
.db-card-name-row { display: flex; align-items: baseline; gap: 8px; }
.db-table-name { font-size: 13px; font-weight: 500; color: #1a1a1a; font-family: 'SF Mono', Menlo, Consolas, monospace; }
.db-table-desc { font-size: 11px; color: #9ca3af; }
.db-card-meta { display: flex; align-items: center; gap: 14px; margin-top: 4px; font-size: 11px; color: #9ca3af; }
.db-card-arrow { flex-shrink: 0; color: #9ca3af; opacity: 0; transition: opacity 0.15s; }

.db-detail-bar {
  height: 44px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.detail-bar-left { display: flex; align-items: center; gap: 8px; min-width: 0; }

.back-btn {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: 6px;
  color: #6b7280; cursor: pointer; transition: all 0.15s;
  &:hover { background: rgba(0, 0, 0, 0.05); color: #1a1a1a; }
}

.detail-table-name { font-size: 13px; font-weight: 600; color: #1a1a1a; font-family: 'SF Mono', Menlo, Consolas, monospace; }
.detail-table-desc { font-size: 11px; color: #9ca3af; }

.add-row-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 12px;
  border: none;
  background: #6366f1;
  color: #fff;
  font-size: 12px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: #4f46e5; }
}

.db-detail-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
.detail-section { margin-bottom: 18px; &:last-child { margin-bottom: 0; } }

.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.section-title { font-size: 11px; font-weight: 500; color: #6b7280; margin-bottom: 8px; }
.section-header .section-title { margin-bottom: 0; }
.section-hint { font-size: 10px; color: #9ca3af; }

.detail-card { background: #fff; border: 1px solid rgba(0, 0, 0, 0.06); border-radius: 12px; overflow: hidden; }

.schema-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
  thead tr { background: #f9fafb; color: #6b7280; }
  th { text-align: left; padding: 8px 12px; font-weight: 500; font-size: 11px; }
  td { padding: 8px 12px; border-top: 1px solid rgba(0, 0, 0, 0.04); color: #374151; }
  .col-pk { width: 56px; text-align: center; }
}

.cell-name { font-family: 'SF Mono', Menlo, Consolas, monospace; font-weight: 500; color: #1a1a1a; }
.type-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 10px; background: #f3f4f6; color: #6b7280; }
.cell-desc { color: #6b7280; }

.data-card { padding: 0; }
.data-table-wrap { overflow-x: auto; }

.data-table {
  width: 100%; border-collapse: collapse; font-size: 11px;
  thead tr { background: #f9fafb; color: #6b7280; }
  th { text-align: left; padding: 8px 12px; font-weight: 500; white-space: nowrap; }
  td {
    padding: 6px 12px; border-top: 1px solid rgba(0, 0, 0, 0.04);
    font-family: 'SF Mono', Menlo, Consolas, monospace; color: #374151;
    white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis;
  }
  tbody tr:hover { background: #f9fafb; }
}

.ops-col { width: 110px; text-align: right; }
.empty-row { text-align: center; color: #9ca3af; padding: 18px; font-family: inherit; }

.row-op {
  border: none;
  background: transparent;
  color: #6366f1;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  font-family: inherit;
  &:hover { text-decoration: underline; }
  &--danger { color: #ef4444; }
}

/* 弹窗表单 */
.row-form { display: flex; flex-direction: column; gap: 12px; }
.row-field { display: flex; flex-direction: column; gap: 4px; }
.row-field-label {
  font-size: 12px; color: #2f3547; font-weight: 500;
  display: flex; align-items: center; gap: 6px;
}
.field-type { font-size: 10px; color: #9ca3af; font-weight: normal; }
.row-field-input {
  height: 32px; padding: 0 10px;
  border: 1px solid #e5e7eb; border-radius: 7px;
  font-size: 13px; outline: none; transition: border-color 0.15s;
  &:focus { border-color: #a5b4fc; }
}

.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }
.btn-cancel, .btn-confirm { padding: 6px 16px; border-radius: 7px; font-size: 13px; border: none; cursor: pointer; }
.btn-cancel { background: #f2f3f5; color: #2f3547; }
.btn-confirm { background: #1c1a21; color: #fff; }
</style>
