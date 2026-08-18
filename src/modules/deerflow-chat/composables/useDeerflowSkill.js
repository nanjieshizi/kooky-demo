/**
 * DeerFlow 输入框技能选择逻辑
 * 从 chat 模块迁移
 */
import { computed } from 'vue'

/**
 * @param {{
 *   selectedSkills: import('vue').Ref<Array<object>>,
 *   inputText: import('vue').Ref<string>,
 *   isComposing: import('vue').Ref<boolean>,
 *   hasFiles: import('vue').Ref<boolean>,
 * }} opts
 */
export function useDeerflowSkill(opts) {
  const { selectedSkills, inputText, isComposing, hasFiles } = opts

  const canSend = computed(() => {
    return (
      inputText.value.trim().length > 0 ||
      (hasFiles?.value ?? false) ||
      selectedSkills.value.length > 0
    )
  })

  function handleSkillTagKeydown(e) {
    if (
      selectedSkills.value.length === 0 ||
      e.isComposing ||
      isComposing.value ||
      (e.key !== 'Backspace' && e.key !== 'Delete') ||
      inputText.value.trim().length > 0
    ) {
      return false
    }
    e.preventDefault()
    selectedSkills.value.pop()
    return true
  }

  function buildSendText(rawTrimmed) {
    if (selectedSkills.value.length === 0) {
      return { text: rawTrimmed, skills: [] }
    }

    const skills = selectedSkills.value.map(s => ({
      id: s.id,
      slug: s.slug,
      displayName: s.displayName,
      name: s.name,
      avatar: s.avatar,
      image: s.image,
    }))
    const text = `${rawTrimmed}`
    return { text, skills }
  }

  return {
    canSend,
    handleSkillTagKeydown,
    buildSendText,
  }
}
