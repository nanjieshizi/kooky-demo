import { ref } from 'vue'

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
}

export function useSplitLayout() {
  const layoutRoot = ref(null)
  const activeLeafId = ref(null)
  const dragState = ref(null) // { leafId } 拖拽中的叶子

  // 初始化：单终端场景
  function init(panelId) {
    const leafId = genId('leaf')
    layoutRoot.value = { type: 'leaf', id: leafId, panelId }
    activeLeafId.value = leafId
    return leafId
  }

  // 在树中查找节点，返回 { node, parent } 或 null
  function findNode(root, id, parent = null) {
    if (!root) return null
    if (root.id === id) return { node: root, parent }
    if (root.type === 'split') {
      for (const child of root.children) {
        const r = findNode(child, id, root)
        if (r) return r
      }
    }
    return null
  }

  // 在 targetLeafId 旁插入新叶子
  // direction: 'top' | 'bottom' | 'left' | 'right'
  function addLeaf(targetLeafId, direction, newPanelId, options = {}) {
    const newLeafId = genId('leaf')
    const newLeaf = { type: 'leaf', id: newLeafId, panelId: newPanelId }
    const splitDir = (direction === 'left' || direction === 'right') ? 'horizontal' : 'vertical'
    const isAfter = direction === 'right' || direction === 'bottom'
    const focus = options?.focus !== false

    const result = findNode(layoutRoot.value, targetLeafId)
    if (!result) return null

    const { node: target, parent } = result
    const newSplit = {
      type: 'split',
      id: genId('split'),
      direction: splitDir,
      sizes: [50, 50],
      children: isAfter ? [target, newLeaf] : [newLeaf, target],
    }

    if (!parent) {
      layoutRoot.value = newSplit
    } else {
      const idx = parent.children.indexOf(target)
      parent.children.splice(idx, 1, newSplit)
    }

    if (focus) {
      activeLeafId.value = newLeafId
    }
    return newLeafId
  }

  // 删除叶子，自动合并只剩一个子节点的 split
  function removeLeaf(leafId) {
    if (layoutRoot.value?.id === leafId) {
      layoutRoot.value = null
      activeLeafId.value = null
      return
    }

    const result = findNode(layoutRoot.value, leafId)
    if (!result || !result.parent) return

    const { node, parent } = result
    parent.children.splice(parent.children.indexOf(node), 1)

    // 合并：父节点只剩一个子节点时，用子节点替换父节点
    if (parent.children.length === 1) {
      _collapseParent(parent)
    }

    if (activeLeafId.value === leafId) {
      activeLeafId.value = _findFirstLeaf(layoutRoot.value)?.id ?? null
    }
  }

  function _collapseParent(splitNode) {
    const onlyChild = splitNode.children[0]
    if (layoutRoot.value?.id === splitNode.id) {
      layoutRoot.value = onlyChild
      return
    }
    const result = findNode(layoutRoot.value, splitNode.id)
    if (result?.parent) {
      const idx = result.parent.children.indexOf(splitNode)
      result.parent.children.splice(idx, 1, onlyChild)
    }
  }

  function _findFirstLeaf(node) {
    if (!node) return null
    if (node.type === 'leaf') return node
    return _findFirstLeaf(node.children[0])
  }

  // 拖拽重组：从 fromLeafId 移到 toLeafId 的某侧
  function moveLeaf(fromLeafId, toLeafId, position) {
    if (fromLeafId === toLeafId) return
    const fromResult = findNode(layoutRoot.value, fromLeafId)
    if (!fromResult) return
    const { panelId } = fromResult.node
    removeLeaf(fromLeafId)
    // removeLeaf 后 toLeafId 仍在树中（只移除了 fromLeafId 对应的叶子）
    const newLeafId = addLeaf(toLeafId, position, panelId)
    if (newLeafId === null) {
      console.warn('[useSplitLayout] moveLeaf: toLeafId not found after removeLeaf', toLeafId)
    }
  }

  // 更新某 split 节点的子节点比例（用 splice 触发 Vue 响应式）
  function resizeNode(splitId, newSizes) {
    const result = findNode(layoutRoot.value, splitId)
    if (result?.node?.type === 'split') {
      result.node.sizes.splice(0, result.node.sizes.length, ...newSizes)
    }
  }

  // 拖拽状态管理
  function startDrag(leafId) {
    dragState.value = { leafId }
  }
  function endDrag() {
    dragState.value = null
  }

  function setActiveLeafId(id) {
    activeLeafId.value = id
  }

  return {
    layoutRoot,
    activeLeafId,
    dragState,
    init,
    addLeaf,
    removeLeaf,
    moveLeaf,
    resizeNode,
    startDrag,
    endDrag,
    setActiveLeafId,
    findNode,
  }
}
