<template>
  <section class="gf-list-panel" aria-label="群内文件">
    <header class="gfl-head">
      <span class="gfl-title">群内文件</span>
      <button type="button" class="gfl-close" aria-label="关闭" @click="emit('close')">
        <SvgIcon name="icon-guanbi1" :size="16" />
      </button>
    </header>

    <div class="gfl-body">
      <div v-if="!files.length" class="gfl-empty">群内还没有文件</div>
      <template v-else>
        <section v-for="group in groups" :key="group.label" class="gfl-group">
          <div class="gfl-group-head">
            <SvgIcon :name="group.kind === 'main' ? 'icon-duihua' : 'icon-renwu'" :size="14" color="#91949e" />
            <span class="gfl-group-label">{{ group.label }}</span>
            <span class="gfl-group-count">{{ group.files.length }}</span>
          </div>
          <button
            v-for="file in group.files"
            :key="file.id"
            type="button"
            class="gfl-file"
            :class="{ active: openIds.includes(file.id) }"
            @click="emit('open-file', file)"
          >
            <span class="gfl-file-icon">
              <span v-if="file.fileType === 'web'" class="gfl-web-dot" :class="{ running: file.web && file.web.running }" />
              <img v-else :src="iconFor(file)" alt="" />
            </span>
            <span class="gfl-file-name" :title="file.name">{{ file.name }}</span>
            <span v-if="file.status" class="gfl-badge" :class="`gfl-badge--${file.status}`">{{ statusLabel(file.status) }}</span>
          </button>
        </section>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { getChatFileIconSrc, getChatFileTypeFromName } from '@/shared/utils/chatFileIcons'

defineOptions({ name: 'GroupFilesListPanel' })

const props = defineProps({
  files: { type: Array, default: () => [] },
  openIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['open-file', 'close'])

// 按来源分组，保留首次出现顺序
const groups = computed(() => {
  const order = []
  const byLabel = new Map()
  props.files.forEach((file) => {
    if (!byLabel.has(file.source)) {
      byLabel.set(file.source, { label: file.source, kind: file.sourceKind, files: [] })
      order.push(file.source)
    }
    byLabel.get(file.source).files.push(file)
  })
  return order.map((label) => byLabel.get(label))
})

function iconFor(file) {
  return getChatFileIconSrc(getChatFileTypeFromName(file?.name))
}

function statusLabel(status) {
  return { new: '新', modified: '改', delivered: '交付' }[status] || ''
}
</script>

<style scoped>
.gf-list-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

.gfl-head {
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid #f0f1f5;
}

.gfl-title {
  font-family: PingFang SC, sans-serif;
  font-size: 14px;
  color: #2f3547;
}

.gfl-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: #91949e;
  transition: background 0.15s;
}

.gfl-close:hover {
  background: rgba(47, 53, 71, 0.06);
}

.gfl-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0 12px;
}

.gfl-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: #b6b9c2;
}

.gfl-group + .gfl-group {
  margin-top: 8px;
  border-top: 1px solid #f5f6f8;
  padding-top: 8px;
}

.gfl-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
}

.gfl-group-label {
  font-size: 12px;
  color: #91949e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gfl-group-count {
  margin-left: auto;
  font-size: 11px;
  color: #b6b9c2;
}

.gfl-file {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.gfl-file:hover {
  background: rgba(47, 53, 71, 0.04);
}

.gfl-file.active {
  background: rgba(67, 111, 246, 0.08);
}

.gfl-file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.gfl-file-icon img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.gfl-web-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #c4c8d2;
}

.gfl-web-dot.running {
  background: #2bb673;
}

.gfl-file-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #2f3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gfl-badge {
  flex-shrink: 0;
  font-size: 10px;
  line-height: 1;
  padding: 2px 7px;
  border-radius: 8px;
}

.gfl-badge--new {
  background: #e6f7ef;
  color: #1a9d63;
}

.gfl-badge--modified {
  background: #fdf1dd;
  color: #b5790b;
}

.gfl-badge--delivered {
  background: #e8f0fe;
  color: #2f6bdc;
}
</style>
