import { ref, computed } from 'vue'
import { loadShortcutBarState, saveShortcutBarCommands } from '@/modules/terminal/services/persistentUserDataService'

const MAX_COUNT = 20

export function useShortcutCommands() {
  const commands = ref([])

  async function load() {
    const state = await loadShortcutBarState()
    commands.value = Array.isArray(state?.commands) ? state.commands : []
  }

  async function save() {
    await saveShortcutBarCommands(commands.value)
  }

  function generateId() {
    return `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  }

  /** 添加命令（插入到最前面） */
  function addCommand({ label, command, mode, color }) {
    if (commands.value.length >= MAX_COUNT) return null
    const item = {
      id: generateId(),
      label,
      command,
      mode: mode || 'input',
      color: color || null,
      createdAt: Date.now(),
    }
    commands.value.unshift(item)
    void save()
    return item
  }

  /** 编辑命令 */
  function updateCommand(id, { label, command, mode, color }) {
    const idx = commands.value.findIndex(c => c.id === id)
    if (idx === -1) return
    commands.value[idx] = { ...commands.value[idx], label, command, mode, color, updatedAt: Date.now() }
    void save()
  }

  /** 删除命令 */
  function removeCommand(id) {
    const idx = commands.value.findIndex(c => c.id === id)
    if (idx === -1) return
    commands.value.splice(idx, 1)
    void save()
  }

  /** 重新排序 */
  function reorder(newList) {
    commands.value = [...newList]
    void save()
  }

  const isAtLimit = computed(() => commands.value.length >= MAX_COUNT)

  return {
    commands,
    isAtLimit,
    MAX_COUNT,
    load,
    addCommand,
    updateCommand,
    removeCommand,
    reorder,
  }
}
