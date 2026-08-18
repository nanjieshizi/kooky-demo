<template>
  <Transition name="todo-slide">
    <div v-if="todos && todos.length > 0" class="todo-list-wrapper">
      <div class="todo-list-header" @click="collapsed = !collapsed">
        <div class="todo-list-title">
          <svg class="todo-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3.854 2.146a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-.5-.5a.5.5 0 1 1 .708-.708L2 3.293l1.146-1.147a.5.5 0 0 1 .708 0zm0 4a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-.5-.5a.5.5 0 1 1 .708-.708L2 7.293l1.146-1.147a.5.5 0 0 1 .708 0zm0 4a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-.5-.5a.5.5 0 0 1 .708-.708l.146.147 1.146-1.147a.5.5 0 0 1 .708 0z"/>
          </svg>
          <span>To-dos</span>
        </div>
        <svg
          class="todo-chevron"
          :class="{ 'is-collapsed': collapsed }"
          width="12" height="12" viewBox="0 0 24 24" fill="none"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="todo-list-body" :class="{ 'is-collapsed': collapsed }">
        <div class="todo-items">
          <div
            v-for="(todo, i) in todos"
            :key="i"
            class="todo-item"
          >
            <span class="todo-indicator" :class="todoIndicatorClass(todo.status)">
              <svg v-if="todo.status === 'completed'" width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="todo-content" :class="todoContentClass(todo.status)">{{ todo.content }}</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  todos: { type: Array, default: () => [] },
})

const collapsed = ref(false)

function todoIndicatorClass(status) {
  if (status === 'completed') return 'is-completed'
  if (status === 'in_progress') return 'is-in-progress'
  return ''
}

function todoContentClass(status) {
  if (status === 'completed') return 'is-completed'
  if (status === 'in_progress') return 'is-in-progress'
  return ''
}
</script>

<style scoped>
.todo-list-wrapper {
  border: 1px solid #e5e7eb;
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  background: #f9fafb;
  overflow: hidden;
  margin: 0px 24px -1px 24px;
}

.todo-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
  background: #f3f4f6;
  min-height: 36px;
}

.todo-list-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.todo-icon {
  color: #6b7280;
  flex-shrink: 0;
}

.todo-chevron {
  color: #9ca3af;
  transition: transform 0.2s ease;
  transform: rotate(180deg);
}

.todo-chevron.is-collapsed {
  transform: rotate(0deg);
}

.todo-list-body {
  max-height: 120px;
  overflow-y: auto;
  transition: max-height 0.25s ease, padding 0.25s ease;
  padding: 6px 12px 8px;
}

.todo-list-body.is-collapsed {
  max-height: 0;
  padding: 0 12px;
}

.todo-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 4px;
}

.todo-indicator {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid #d1d5db;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.todo-indicator.is-in-progress {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.15);
}

.todo-indicator.is-completed {
  border-color: #22c55e;
  background: #22c55e;
  color: #fff;
}

.todo-content {
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
}

.todo-content.is-in-progress {
  color: #6366f1;
}

.todo-content.is-completed {
  color: #9ca3af;
  text-decoration: line-through;
}

.todo-slide-enter-active,
.todo-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.todo-slide-enter-from,
.todo-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
