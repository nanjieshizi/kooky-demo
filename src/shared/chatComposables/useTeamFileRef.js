import { ref, watch, onMounted, onUnmounted, onActivated } from 'vue'

/**
 * 团队文件引用监听逻辑
 * @param {Object} options
 * @param {Ref} options.uploadAreaRef - 上传区域 ref
 * @param {Ref} options.conversationId - 会话 ID (用于监听切换)
 * @param {Function} options.shouldHandle - 判断是否应该处理文件引用的函数
 */
export function useTeamFileRef(options) {
  const { uploadAreaRef, conversationId, shouldHandle } = options

  const justAddedTeamFileRef = ref(false)
  let clearFilesDebounceTimer = null

  function onTeamFileRef(e) {
    if (shouldHandle && !shouldHandle()) return

    uploadAreaRef.value?.addTeamFileRef(e.detail)

    justAddedTeamFileRef.value = true
    clearTimeout(clearFilesDebounceTimer)
    clearFilesDebounceTimer = setTimeout(() => {
      justAddedTeamFileRef.value = false
    }, 200)
  }

  onMounted(() => {
    window.addEventListener('team-file-ref', onTeamFileRef)
  })

  onUnmounted(() => {
    window.removeEventListener('team-file-ref', onTeamFileRef)
    clearTimeout(clearFilesDebounceTimer)
  })

  if (conversationId) {
    watch(conversationId, () => {
      if (!justAddedTeamFileRef.value) {
        uploadAreaRef.value?.clearFiles()
      }
    })
  }

  onActivated(() => {
    if (!justAddedTeamFileRef.value) {
      uploadAreaRef.value?.clearFiles()
    }
  })

  return {
    justAddedTeamFileRef,
  }
}
