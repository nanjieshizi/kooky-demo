<template>
  <div class="odn">
    <div
      class="odn-row"
      :class="{ active: String(activeId) === String(dept.id) }"
      :style="{ paddingLeft: `${6 + depth * 10}px` }"
      @click="$emit('select', dept.id)"
    >
      <button
        v-if="dept.hasChildren"
        type="button"
        class="odn-caret"
        :class="{ open: isExpanded }"
        @click.stop="$emit('toggle', dept.id)"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <span v-else class="odn-caret odn-caret--empty" />
      <span class="odn-name">{{ dept.name }}</span>
    </div>

    <template v-if="isExpanded && dept.children?.length">
      <OrgDeptNode
        v-for="child in dept.children"
        :key="child.id"
        :dept="child"
        :depth="depth + 1"
        :active-id="activeId"
        :expanded-ids="expandedIds"
        @toggle="$emit('toggle', $event)"
        @select="$emit('select', $event)"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'OrgDeptNode' })

const props = defineProps({
  dept: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  activeId: { type: [String, Number], default: null },
  expandedIds: { type: Array, default: () => [] },
})

defineEmits(['toggle', 'select'])

const isExpanded = computed(() => props.expandedIds.includes(String(props.dept.id)))
</script>

<style lang="scss" scoped>
.odn-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding-right: 8px;
  border-radius: 8px;
  font-size: 13px;
  color: #2f3547;
  cursor: pointer;
  transition: background 0.2s ease;
}

.odn-row:hover {
  background: #f7f8fa;
}

.odn-row.active {
  font-weight: 600;
  background: #f4f3ff;
  color: #6a5df0;
}

.odn-caret {
  width: 13px;
  height: 13px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a8b0c0;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.odn-caret.open {
  transform: rotate(90deg);
}

.odn-caret--empty {
  cursor: default;
}

.odn-name {
  min-width: 0;
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
