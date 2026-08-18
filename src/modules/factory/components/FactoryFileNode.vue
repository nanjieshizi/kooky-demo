<template>
  <div class="tree-node">
    <div
      class="tree-node-row"
      :class="{ selected: node.id === selectedId }"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      @click="handleClick"
    >
      <span class="tree-arrow" :class="{ invisible: !isFolder }">
        <img v-if="isFolder" :src="node.isOpen ? expandIcon : collapseIcon" width="14" height="14" alt="" />
      </span>

      <img :src="iconSrc" class="tree-icon-img" :alt="node.name" />

      <span class="tree-name" :title="node.name">{{ node.name }}</span>
    </div>

    <template v-if="isFolder && node.isOpen">
      <FactoryFileNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :selected-id="selectedId"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import folderIcon from '@/assets/home/folderTree.svg'
import mdIcon from '@/assets/home/md.svg'
import codeIcon from '@/assets/home/code.svg'
import textIcon from '@/assets/home/text.svg'
import richTextIcon from '@/assets/home/richText.svg'
import pictureIcon from '@/assets/home/picture.svg'
import expandIcon from '@/assets/home/expand.svg'
import collapseIcon from '@/assets/home/collapse.svg'

defineOptions({ name: 'FactoryFileNode' })

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  selectedId: { type: String, default: null },
})
const emit = defineEmits(['select', 'toggle'])

const isFolder = computed(() => props.node.type === 'folder')

const iconSrc = computed(() => {
  if (isFolder.value) return folderIcon
  const map = {
    python: codeIcon,
    markdown: mdIcon,
    yaml: textIcon,
    json: textIcon,
    text: textIcon,
    richText: richTextIcon,
    picture: pictureIcon,
  }
  return map[props.node.type] || textIcon
})

function handleClick() {
  if (isFolder.value) emit('toggle', props.node.id)
  else emit('select', props.node.id)
}
</script>

<style scoped>
.tree-node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  cursor: pointer;
  border-radius: 6px;
  margin: 0 12px;
  transition: background 0.1s;
  padding-left: 20px;
  padding-right: 8px;
  overflow: hidden;
  min-width: 0;
  user-select: none;
}

.tree-node-row:hover {
  background: #F5F6F9;
}

.tree-node-row.selected {
  background: #FFF1EA;
}

.tree-node-row.selected:hover {
  background: #F5F6F9;
}

.tree-arrow {
  width: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tree-arrow.invisible {
  visibility: hidden;
}

.tree-icon-img {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tree-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #2F3547;
}
</style>
