import { ElMessageBox } from 'element-plus'

/**
 * 事项（工作台）销毁的统一二次确认流程。
 *
 * 入口：侧边栏「删除事项」按钮 / 右键菜单
 *
 * 规则：
 *   - `lastTerminal === true`（该事项只剩 1 个终端面板）时，先弹一次更强的前置提示；
 *     用户通过后再走常规「会丢失该事项下所有终端会话」二次确认。
 *   - 其他场景只走常规二次确认（维持既有文案 / 按钮）。
 *
 * @param {Object} args
 * @param {string} args.workbenchName
 * @param {boolean} args.lastTerminal
 * @returns {Promise<boolean>} 用户是否确认继续销毁
 */
export async function confirmWorkbenchDeletion({ workbenchName, lastTerminal }) {
  if (lastTerminal) {
    try {
      await ElMessageBox.confirm(
        '删除最后一个终端将连带删除对应事项，是否继续？',
        '删除事项',
        {
          confirmButtonText: '继续',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
    } catch {
      return false
    }
  }

  try {
    await ElMessageBox.confirm(
      `删除“${workbenchName}”会丢失该事项下所有终端会话，但不会删除本地目录。\n\n是否继续？`,
      '删除事项',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch {
    return false
  }

  return true
}
