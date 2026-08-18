<template>
  <div class="factory-session-header">
    <div ref="switcherRef" class="session-switcher">
      <button
        type="button"
        class="session-trigger"
        @click="showMenu = !showMenu"
      >
        <span class="session-prefix">会话：</span>
        <span class="session-title">{{ factoryStore.currentThread?.title || '新对话' }}</span>
        <span class="session-arrow" :class="{ open: showMenu }"></span>
      </button>
      <div v-if="showMenu" class="session-menu">
        <button
          type="button"
          class="session-create"
          @click="handleCreate"
        >
          <span class="session-create-icon">+</span>
          <span>新增会话</span>
        </button>
        <div
          v-for="thread in factoryStore.currentProjectThreads"
          :key="thread.id"
          class="session-row"
          :class="{ active: factoryStore.currentThreadId === thread.id }"
          role="button"
          tabindex="0"
          @click="handleSelect(thread)"
          @keydown.enter.prevent="handleSelect(thread)"
        >
          <span class="session-thread-icon">💬</span>
          <span class="session-item-title">{{ thread.title || '新对话' }}</span>
          <span class="session-row-actions">
            <span
              v-if="factoryStore.currentThreadId === thread.id"
              class="session-check"
            >✓</span>
            <button
              v-if="factoryStore.currentProjectThreads.length > 1"
              type="button"
              class="session-remove"
              @click.stop="handleRemove(thread)"
            >
              删除
            </button>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactorySessionHeader' })

const factoryStore = useFactoryStore()
const showMenu = ref(false)
const switcherRef = ref(null)

function handleSelect(thread) {
  factoryStore.selectThread(thread.id)
  showMenu.value = false
}

function handleCreate() {
  factoryStore.createThread('新对话')
  showMenu.value = false
}

function handleRemove(thread) {
  if (factoryStore.currentProjectThreads.length <= 1) return
  factoryStore.deleteThread(thread.id)
}

function handleClickOutside(e) {
  if (switcherRef.value && !switcherRef.value.contains(e.target)) {
    showMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style lang="scss" scoped>
.factory-session-header {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  flex-shrink: 0;
}

.session-switcher {
  position: relative;
}

.session-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: #2f3547;
  font-size: 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;

  &:hover {
    background: rgba(47, 53, 71, 0.04);
  }
}

.session-prefix {
  color: #2f3547;
}

.session-title {
  font-weight: 500;
  color: #2f3547;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-arrow {
  width: 8px;
  height: 8px;
  border-right: 1.5px solid #8d93a6;
  border-bottom: 1.5px solid #8d93a6;
  transform: rotate(45deg) translate(-2px, -2px);
  transition: transform 0.2s;
  margin-left: 2px;

  &.open {
    transform: rotate(-135deg) translate(0, 0);
  }
}

.session-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 240px;
  max-width: 320px;
  max-height: 360px;
  overflow-y: auto;
  padding: 6px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(47, 53, 71, 0.16);
  z-index: 100;
  animation: menu-fade 0.15s ease;
}

@keyframes menu-fade {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.session-create {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: #2f3547;
  font-size: 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
  margin-bottom: 4px;

  &:hover {
    background: #f5f6f9;
  }
}

.session-create-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  color: #8d93a6;
}

.session-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 14px;
  color: #2f3547;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f5f6f9;

    .session-remove {
      opacity: 1;
    }

    .session-check {
      opacity: 0;
    }
  }

  &.active {
    .session-item-title {
      font-weight: 600;
    }
  }
}

.session-thread-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.session-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-row-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  width: 36px;
  height: 20px;
  justify-content: flex-end;
}

.session-check {
  color: #4e6ef2;
  font-size: 14px;
  font-weight: 600;
  transition: opacity 0.15s;
}

.session-remove {
  position: absolute;
  right: 0;
  font-size: 12px;
  color: #ff4d4f;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s;

  &:hover {
    background: rgba(255, 77, 79, 0.08);
  }
}
</style>
