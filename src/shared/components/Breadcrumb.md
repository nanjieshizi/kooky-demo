# Breadcrumb 面包屑组件使用文档

## 组件简介

面包屑导航组件，支持多级导航、自动折叠、响应式截断和跨页面历史传递。

## 基础用法

### 简单两级面包屑

```vue
<template>
  <div class="page">
    <Breadcrumb
      :items="[
        { label: 'Skill 市场', to: '/market/skill' },
        { label: '测试助理 v2.1.0 详情' }
      ]"
    />
  </div>
</template>

<script setup>
import Breadcrumb from '@/shared/components/Breadcrumb/Breadcrumb.vue'
</script>
```

### 多级面包屑

```vue
<Breadcrumb
  :items="[
    { label: '首页', to: '/' },
    { label: 'Skill 市场', to: '/market/skill' },
    { label: '分类', to: '/market/skill/category' },
    { label: '测试助理 v2.1.0 详情' }
  ]"
/>
```

## Props

| 参数 | 说明 | 类型 | 必填 | 默认值 |
|------|------|------|------|--------|
| items | 面包屑路径数组 | Array | 是 | - |

### items 数组项结构

| 字段 | 说明 | 类型 | 必填 |
|------|------|------|------|
| label | 显示文本 | String | 是 |
| to | 跳转路径（最后一项不需要） | String | 否 |

## 核心特性

### 1. 自动折叠（超过4级）

当面包屑超过4级时，自动折叠中间层级，保留第一级 + 最后三级：

```
第一级 / ... / 倒数第三级 / 倒数第二级 / 当前页
```

**示例**：6级面包屑会显示为：
```
首页 / ... / 第四级 / 第五级 / 当前页
```

hover "..." 显示 tooltip，展示所有折叠的层级（横向排列，用 "/" 分隔），tooltip 内的项可点击跳转。

### 2. 响应式截断

- 面包屑路径最大宽度 1080px
- 空间不足时，优先截断父级项（最小约4个字，56px）
- 父级都截到最小后，再截断当前页
- 被截断的项 hover 显示 tooltip，展示完整文本

### 3. 极窄宽度渐进折叠

所有项都截到最小仍溢出时，依次折叠：
1. 倒数第三级
2. 倒数第二级
3. 第一级

最小宽度 424px。

## 详情页之间的跳转

### 场景说明

从一个详情页跳转到另一个详情页时，需要保留面包屑历史，实现路径追踪。

**效果**：
- 直接访问数字人详情：`数字人市场 / 数字人详情`
- 从 Skill 详情跳转：`Skill 市场 / 测试助理 v2.1.0 详情 / 数字人详情`

### 实现步骤

#### 1. 源详情页（发起跳转）

```vue
<template>
  <div class="skill-detail">
    <Breadcrumb :items="breadcrumbItems" />
    <div class="detail-body">
      <button @click="goToAvatarDetail">跳转到数字人详情</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Breadcrumb from '@/shared/components/Breadcrumb/Breadcrumb.vue'

const route = useRoute()
const router = useRouter()
const skillId = computed(() => route.params.id)

// 读取历史面包屑（如果有）
const breadcrumbItems = computed(() => {
  const history = router.options.history.state.breadcrumbHistory || []
  return [
    ...history,
    { label: 'Skill 市场', to: '/market/skill' },
    { label: `测试助理 v2.1.0 详情` }
  ]
})

// 跳转到数字人详情，传递面包屑历史
function goToAvatarDetail() {
  router.push({
    name: 'AvatarDetail',
    params: { id: 'demo-avatar-123' },
    state: {
      breadcrumbHistory: [
        { label: 'Skill 市场', to: '/market/skill' },
        { label: '测试助理 v2.1.0 详情', to: `/market/skill/${skillId.value}` }
      ]
    }
  })
}
</script>
```

**关键点**：
- `breadcrumbItems` 读取历史并拼接当前页
- 跳转时通过 `state.breadcrumbHistory` 传递历史
- 历史中的每一项都要包含 `to` 属性，确保可点击返回

#### 2. 目标详情页（接收历史）

```vue
<template>
  <div class="avatar-detail">
    <Breadcrumb :items="breadcrumbItems" />
    <div class="detail-body">
      <h2>数字人详情</h2>
      <p>数字人 ID: {{ avatarId }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Breadcrumb from '@/shared/components/Breadcrumb/Breadcrumb.vue'

const route = useRoute()
const router = useRouter()
const avatarId = computed(() => route.params.id)

// 读取历史面包屑（如果有）
const breadcrumbItems = computed(() => {
  const history = router.options.history.state.breadcrumbHistory || []

  // 如果没有历史，显示正常的两级面包屑
  if (history.length === 0) {
    return [
      { label: '数字人市场', to: '/market/avatar' },
      { label: `数字人 ${avatarId.value} 详情` }
    ]
  }

  // 有历史时，直接拼接历史 + 当前详情页（不加中间层级）
  return [
    ...history,
    { label: `数字人 ${avatarId.value} 详情` }
  ]
})
</script>
```

**关键点**：
- 通过 `router.options.history.state.breadcrumbHistory` 读取历史
- 无历史：显示正常两级（列表页 + 详情页）
- 有历史：拼接历史 + 当前详情页（不重复添加列表页）

### 跨多个详情页

如果需要跨多个详情页（A → B → C），每次跳转都传递累积的历史：

```javascript
// 从 B 跳转到 C
function goToC() {
  const currentHistory = router.options.history.state.breadcrumbHistory || []
  router.push({
    name: 'CDetail',
    params: { id: 'c-id' },
    state: {
      breadcrumbHistory: [
        ...currentHistory,
        { label: 'B 详情', to: `/b/${bId.value}` }
      ]
    }
  })
}
```

## 交互说明

### 返回按钮
- 点击返回上一级页面
- 如果有上一级的 `to` 属性，跳转到指定路径
- 否则执行 `router.back()`

### 面包屑项
- **有 `to` 属性**：可点击跳转，hover 变蓝色 (#436FF6)
- **无 `to` 属性**：置灰 (#C0C4CC)，不可点击
- **当前页（最后一项）**：深色 (#2F3547) 加粗，不可点击

### 折叠指示器 "..."
- hover 变蓝色 (#436FF6)
- 点击显示 tooltip（深色背景）
- tooltip 内横向显示折叠的层级，用 "/" 分隔
- tooltip 内的项可点击跳转

### 文本截断
- 被截断的项 hover 显示完整文本的 tooltip
- tooltip 延迟 300ms 显示

## 样式规范

| 元素 | 样式 |
|------|------|
| 容器高度 | 46px |
| 容器边框 | 底部 1px 实线 #DFE2EA |
| 容器内边距 | 左右 20px |
| 返回按钮图标 | 10px × 10px |
| 返回按钮文字 | 14px，颜色 #606572 |
| 分隔线 | 1px × 14px，颜色 #DFE2EA，左右间距 12px |
| 面包屑文字 | 14px，非当前页 #91949E，当前页 #2F3547（加粗） |
| 分隔符图标 | 16px × 16px SVG，左右间距 8px |
| hover 颜色 | #436FF6 |
| 禁用颜色 | #C0C4CC |
| 折叠 tooltip 背景 | #303133（深色） |
| 折叠 tooltip 文字 | rgba(255, 255, 255, 0.85) |

## 注意事项

1. **自动处理**：组件会自动处理折叠和截断，无需手动控制
2. **历史传递**：跨详情页跳转时，确保传递的历史项都包含 `to` 属性
3. **当前页标识**：最后一项（当前页）不需要 `to` 属性
4. **历史持久性**：面包屑历史通过路由 state 传递，刷新页面后会丢失（这是预期行为）
5. **import 路径**：`import Breadcrumb from '@/shared/components/Breadcrumb/Breadcrumb.vue'`
6. **最大层级**：建议不超过6级，超过4级会自动折叠
7. **文字长度**：当前页名称建议不超过30个字符，过长会被截断

## 完整示例

参考项目中的详情页实现：
- `src/modules/market/skill/components/SkillDetailView.vue`
- `src/modules/market/avatar/components/AvatarDetailView.vue`
