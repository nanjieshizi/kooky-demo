import { defineStore } from 'pinia'
import { teamFileService, getCloudFileTree } from '@/modules/file/service'

/**
 * 将后端 TeamFileInfo 转换为 store 节点格式
 * @param {object} r  TeamFileInfo
 * @param {string} spaceId
 */
function toNode(r, spaceId) {
  const name = r.displayName || r.fileName || r.name || ''
  // suffix 优先用后端字段，其次从文件名提取
  let suffix = r.suffix || ''
  if (!suffix && !r.isDir) {
    const i = name.lastIndexOf('.')
    if (i > 0) suffix = name.slice(i + 1).toLowerCase()
  }
  return {
    id: r.id,
    name,
    type: r.isDir ? 'folder' : (suffix || 'file'),
    spaceId,
    parentId: r.parentId ?? null,
    order: r.order ?? 0,
    isOpen: false,
    size: r.size,
    mimeType: r.mimeType,
  }
}

export const useFileStore = defineStore('file', {
  state: () => ({
    fileNodes: [
      {
        id: 'folder1',
        name: '财务报表',
        type: 'folder',
        spaceId: 'personal',
        isOpen: true,
        children: [
          { id: 'f1', name: '2026年Q1财报.pdf', type: 'pdf', spaceId: 'personal' },
          { id: 'f3', name: '2025年度总结.pdf', type: 'pdf', spaceId: 'personal' },
        ],
      },
      {
        id: 'folder2',
        name: '规章制度',
        type: 'folder',
        spaceId: 'personal',
        isOpen: false,
        children: [
          { id: 'f2', name: '员工手册.markdown', type: 'markdown', spaceId: 'personal' },
        ],
      },
    ],
    // 空间容量信息：{ [spaceId]: QuotaInfo }
    quotaInfo: {},
    // 云端文件树（统一接口）
    cloudTree: {
      // nodeId → CloudFileNodeVO[]（子节点列表缓存）
      nodeCache: {},
      // 已展开的 nodeId Set（序列化为数组存储，响应式用普通对象模拟）
      expandedNodeIds: [],
      // 加载中的 nodeId Set
      loadingNodeIds: [],
    },
  }),
  getters: {
    nodesBySpace: (state) => (spaceId) => {
      return state.fileNodes.filter((n) => n.spaceId === spaceId)
    },
  },
  actions: {
    toggleFolder(id) {
      const node = this.fileNodes.find((n) => n.id === id)
      if (node && node.type === 'folder') {
        node.isOpen = !node.isOpen
      }
    },
    forwardToSpace(fileItem, targetSpaceId) {
      const newId = `f${Date.now()}`
      this.fileNodes.push({
        ...fileItem,
        id: newId,
        spaceId: targetSpaceId,
      })
    },

    // ─── 已废弃的团队文件库 actions（使用云端文件树代替）───────────────────────────

    /**
     * 将上传成功的文件入库到团队文件库，并刷新云端文件树
     * @param {string} spaceId
     * @param {File} file
     * @param {string|null} parentId
     * @param {Function} onProgress
     */
    async addFileToTeamSpace(spaceId, file, parentId = null, onProgress) {
      const result = await teamFileService.uploadFile(spaceId, file, parentId, onProgress)
      // 上传成功后使云端文件树缓存失效（下次访问时会自动重新加载）
      this.invalidateCloudNode('category_person')
      this.invalidateCloudNode('category_opt')
      this.invalidateCloudNode('category_team')
      // 上传成功后刷新容量信息
      await this.refreshQuota(spaceId)
      return result
    },

    /**
     * 刷新当前激活的云端文件树分类
     * @param {string} personBizId
     * @param {Array} teams
     * @param {string} activeCategoryKey - 当前激活的分类 ('person' | 'solo-team' | 'collaboration')
     */
    async refreshActiveCloudTree(personBizId, teams, activeCategoryKey = null) {
      // 根据激活的分类确定要刷新的节点
      let nodesToRefresh = []
      if (activeCategoryKey) {
        // 只刷新当前激活的分类
        const nodeId = activeCategoryKey === 'person' ? 'category_person'
          : activeCategoryKey === 'solo-team' ? 'category_opt'
          : activeCategoryKey === 'collaboration' ? 'category_team'
          : null
        if (nodeId) {
          nodesToRefresh = [nodeId]
        }
      } else {
        // 刷新所有已加载的分类
        nodesToRefresh = ['category_person', 'category_opt', 'category_team'].filter(
          nodeId => this.cloudTree.nodeCache[nodeId]
        )
      }

      // 如果没有要刷新的节点，至少刷新 person 分类（默认）
      if (nodesToRefresh.length === 0) {
        nodesToRefresh = ['category_person']
      }

      for (const nodeId of nodesToRefresh) {
        // 使缓存失效并重新加载
        this.invalidateCloudNode(nodeId)
        try {
          await this.loadCloudTreeNode(nodeId, personBizId, teams)
        } catch (e) {
          console.error(`[fileStore] 刷新云端文件树失败: ${nodeId}`, e)
        }
      }
    },

    /**
     * 从 URL 保存文件到团队文件库根目录
     * 注意：此方法仍然使用 team-files 接口上传，但会刷新 cloudTree
     */
    async saveFileFromUrl(spaceId, httpUrl, fileName) {
      if (!httpUrl) throw new Error('无法解析文件地址')
      const result = await teamFileService.saveFromUrl(spaceId, httpUrl, fileName, null, null)
      // 刷新云端文件树缓存（根据 spaceId 判断刷新哪个分类）
      // 这里简化处理：刷新所有分类的根节点
      this.invalidateCloudNode('category_person')
      this.invalidateCloudNode('category_opt')
      this.invalidateCloudNode('category_team')
      // 保存成功后刷新容量信息
      await this.refreshQuota(spaceId)
      return result
    },

    /**
     * 清空团队文件缓存（房间退出时调用）
     */
    clearTeamFiles(spaceId) {
      // 已废弃：不再使用 teamFileNodes
      // 清空对应的云端文件树缓存
      this.invalidateCloudNode('category_person')
      this.invalidateCloudNode('category_opt')
      this.invalidateCloudNode('category_team')
    },

    /**
     * 刷新空间容量信息
     */
    async refreshQuota(spaceId) {
      try {
        const quota = await teamFileService.getQuota(spaceId)
        this.quotaInfo[spaceId] = quota
        return quota
      } catch (e) {
        console.error('[fileStore] refreshQuota 失败:', e)
        throw e
      }
    },

    // ─── 云端文件树 actions ───────────────────────────────────────────────

    /**
     * 懒加载某节点的子节点列表
     * @param {string} nodeId
     * @param {string} personBizId  我的分身 roomId
     * @param {Array<{bizId: string, name: string}>} teams  协作团队列表
     */
    async loadCloudTreeNode(nodeId, personBizId, teams) {
      if (this.cloudTree.nodeCache[nodeId]) return
      if (this.cloudTree.loadingNodeIds.includes(nodeId)) return
      this.cloudTree.loadingNodeIds.push(nodeId)
      try {
        const children = await getCloudFileTree(nodeId, personBizId, teams)
        this.cloudTree.nodeCache[nodeId] = children
      } catch (e) {
        console.error('[fileStore] loadCloudTreeNode 失败:', nodeId, e)
        throw e
      } finally {
        this.cloudTree.loadingNodeIds = this.cloudTree.loadingNodeIds.filter(id => id !== nodeId)
      }
    },

    /**
     * 展开节点（懒加载子节点）
     */
    async expandCloudNode(nodeId, personBizId, teams) {
      if (!this.cloudTree.expandedNodeIds.includes(nodeId)) {
        this.cloudTree.expandedNodeIds.push(nodeId)
      }
      await this.loadCloudTreeNode(nodeId, personBizId, teams)
    },

    /**
     * 收起节点
     */
    collapseCloudNode(nodeId) {
      this.cloudTree.expandedNodeIds = this.cloudTree.expandedNodeIds.filter(id => id !== nodeId)
    },

    /**
     * 切换节点展开/收起
     */
    async toggleCloudNode(nodeId, personBizId, teams) {
      if (this.cloudTree.expandedNodeIds.includes(nodeId)) {
        this.collapseCloudNode(nodeId)
      } else {
        await this.expandCloudNode(nodeId, personBizId, teams)
      }
    },

    /**
     * 清空云端文件树缓存并重新加载根节点
     */
    async reloadCloudTree(personBizId, teams) {
      this.cloudTree.nodeCache = {}
      this.cloudTree.expandedNodeIds = []
      this.cloudTree.loadingNodeIds = []
      await this.loadCloudTreeNode('root', personBizId, teams)
    },

    /**
     * 使某节点缓存失效（文件操作后刷新）
     */
    invalidateCloudNode(nodeId) {
      delete this.cloudTree.nodeCache[nodeId]
    },

    /**
     * 移动云端文件/文件夹到目标目录
     * @param {object} dragNode  被拖拽的节点
     * @param {object} targetNode  目标文件夹节点（dir 或 team_root）
     * @param {string} dragParentNodeId  拖拽源的父节点 nodeId（用于刷新缓存）
     * @param {string} personBizId
     * @param {Array} teams
     */
    async moveCloudFile(dragNode, targetNode, dragParentNodeId, personBizId, teams) {
      const targetParentId = targetNode.nodeType === 'team_root' ? null : targetNode.fileId
      await teamFileService.moveFile(dragNode.businessId, dragNode.fileId, targetParentId, dragNode.businessType)
      // 刷新拖拽源父节点
      if (dragParentNodeId) {
        this.invalidateCloudNode(dragParentNodeId)
        await this.loadCloudTreeNode(dragParentNodeId, personBizId, teams)
      }
      // 刷新目标节点（展开目标文件夹显示新内容）
      this.invalidateCloudNode(targetNode.nodeId)
      await this.loadCloudTreeNode(targetNode.nodeId, personBizId, teams)
    },
  },
})
