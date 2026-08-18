import { computed } from 'vue'

export function useEmployeeDeerflowSkill(opts) {
  const { selectedSkills, inputText, isComposing, hasFiles } = opts

  const canSend = computed(() => (
    inputText.value.trim().length > 0 ||
    (hasFiles?.value ?? false) ||
    selectedSkills.value.length > 0
  ))

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
    if (selectedSkills.value.length === 0) return { text: rawTrimmed, skills: [] }
    const skills = selectedSkills.value.map(s => ({
      id: s.id,
      slug: s.slug,
      displayName: s.displayName,
      name: s.name,
      avatar: s.avatar,
      image: s.image,
    }))
    return { text: rawTrimmed, skills }
  }

  return {
    canSend,
    handleSkillTagKeydown,
    buildSendText,
  }
}
