<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="context-menu-mask"
      @mousedown="$emit('update:visible', false)"
    />
    <div
      v-if="visible"
      ref="menuRef"
      class="shortcut-context-menu"
      :style="{ ...menuStyle, ...menuThemeStyle }"
    >
      <div class="menu-item" @click="handleEdit">编辑</div>
      <div class="menu-item" @click="handleSendToAll">输出到所有视图</div>
      <div class="menu-item delete" @click="handleDelete">删除</div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  position: { type: Object, default: () => ({ x: 0, y: 0 }) },
  item: { type: Object, default: null },
  theme: { type: Object, default: null },
})

const menuThemeStyle = computed(() => {
  const t = props.theme
  if (!t) return {}
  return {
    background: t.menuBg,
    borderColor: t.menuBorder,
    '--menu-item-text': t.menuItemText,
    '--menu-item-hover-bg': t.menuItemHoverBg,
  }
})

const emit = defineEmits(['update:visible', 'edit', 'send-to-all', 'delete'])
const menuRef = ref(null)
const menuHeight = ref(120)

watch(() => props.visible, async (v) => {
  if (v) {
    await nextTick()
    if (menuRef.value) {
      menuHeight.value = menuRef.value.offsetHeight
    }
  }
})

const menuStyle = computed(() => ({
  left: `${props.position.x}px`,
  top: `${props.position.y - menuHeight.value - 8}px`,
}))

function close() {
  emit('update:visible', false)
}

function handleEdit() {
  emit('edit', props.item)
  close()
}

function handleSendToAll() {
  emit('send-to-all', props.item)
  close()
}

function handleDelete() {
  emit('delete', props.item)
  close()
}
</script>

<style scoped>
.context-menu-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.shortcut-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  backdrop-filter: blur(12px);
  border: 1px solid;
  border-radius: 8px;
  padding: 6px 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.menu-item {
  padding: 8px 10px;
  margin: 0 6px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--menu-item-text, rgba(255, 255, 255, 0.85));
  cursor: pointer;
  transition: background 0.12s;
}

.menu-item:hover {
  background: var(--menu-item-hover-bg, rgba(255, 255, 255, 0.1));
}

.menu-item.delete {
  color: #f56c6c;
}
</style>
