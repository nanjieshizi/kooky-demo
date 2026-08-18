// 一人团队「群内文件」演示数据（活体 demo 占位）
//
// 设计口径见记忆 kooky-group-files-preview：
//   主会话点【文件】→ 预览区列出「全群所有文件」= 主会话上传/挂载 + 各子任务 agent 沙箱产出。
//   预览区是纯查看器，按来源（主会话 / 任务）分组。web server 用静态截图占位，不起真服务。
//
// 真实化路径：把 getGroupFilesForTeam 换成后端「群内文件聚合」接口（主会话附件 + 各 thread 沙箱产物）。
//
// 文件结构：
//   { id, name, fileType, source, sourceKind, status, content?, web?, placeholder? }
//   fileType: md | excel | image | web | code | pdf | txt
//   sourceKind: main（主会话）| task（子任务沙箱）
//   status: new（新） | modified（改） | delivered（交付） | ''（无）

const COMPETITOR_MD = `# 竞品调研

| 产品 | 采集方式 | 更新频率 |
| --- | --- | --- |
| A 站 | 列表页分页 | 每日 |
| B 站 | 开放 API | 实时 |

- A 站反爬较弱，可直接抓列表页
- B 站有开放 API，优先走 API，省去解析成本
`

const PRD_DRAFT_MD = `# 爬虫 PRD（草稿）

## 目标
为个人博客采集行业资讯，自动生成选题池。

## 目标网站
- 待补充

## 字段范围
- 标题 / 链接 / 发布时间 / 摘要

> 「采集策略」章节还在补…
`

const REQ_LIST_MD = `# 需求清单

1. 支持配置目标网站白名单
2. 按关键词过滤选题
3. 去重后写入选题池
4. 采集失败自动重试 3 次
`

const PRD_V1_MD = `# 爬虫 PRD v1

## 一、目标
为个人博客建立自动化的选题采集与去重能力，降低日常找选题的人工成本。

## 二、目标网站与字段
- 目标：行业资讯站 A / 开发者社区 B
- 字段：标题、链接、发布时间、摘要、来源站点

## 三、采集策略
- A 站：列表页分页抓取，间隔 ≥ 3s
- B 站：走开放 API，按关键词增量拉取
- 统一去重键：标题归一化 + 链接

## 四、非功能需求
- 失败自动重试 3 次，超限告警
- 采集日志可追溯

> 已评审通过，可交付。
`

const LANDING_HTML = `<!doctype html>
<html lang="zh">
<head><meta charset="utf-8"><title>我的个人博客</title>
<style>
  body { font-family: PingFang SC, system-ui, sans-serif; margin: 0; background: #fcfaf7; color: #2f3547; }
  header { padding: 48px 32px 32px; text-align: center; background: linear-gradient(180deg,#fff,#fcfaf7); }
  h1 { font-size: 30px; margin: 0 0 8px; }
  .sub { color: #8b95a5; }
  .posts { max-width: 640px; margin: 24px auto; padding: 0 24px; }
  .post { background: #fff; border: 1px solid #eceef3; border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; }
  .post h2 { font-size: 17px; margin: 0 0 6px; }
  .post p { margin: 0; color: #6d7384; font-size: 14px; }
  .tag { display:inline-block; font-size:12px; color:#2f6bdc; background:#e8f0fe; border-radius:8px; padding:2px 8px; margin-top:10px;}
</style></head>
<body>
  <header><h1>我的个人博客</h1><div class="sub">记录技术、产品与生活</div></header>
  <main class="posts">
    <article class="post"><h2>用爬虫搭一个选题池</h2><p>把行业资讯自动采集、去重，每天给自己推一批选题。</p><span class="tag">爬虫</span></article>
    <article class="post"><h2>一人团队的协作流</h2><p>主会话派活、子会话执行、产物回收，单人也能跑出团队节奏。</p><span class="tag">效率</span></article>
  </main>
</body>
</html>`

const COLOR_MD = `# 促销海报配色

- 主色：#E4572E（喜庆橙红）
- 辅色：#FFC914（点亮按钮 / 标签）
- 背景：#FCEEE3（暖米色）
`

// 主力展示团队：我的个人博客
const PERSONAL_BLOG = [
  // —— 主会话：我上传 / 挂载的输入 ——
  { id: 'gf-blog-competitor', name: '竞品调研.md', fileType: 'md', source: '主会话', sourceKind: 'main', status: '', content: COMPETITOR_MD },
  { id: 'gf-blog-persona', name: '用户画像.xlsx', fileType: 'excel', source: '主会话', sourceKind: 'main', status: '' },
  { id: 'gf-blog-site', name: '博客预览', fileType: 'web', source: '主会话', sourceKind: 'main', status: '', web: { url: 'localhost:4000', running: true }, placeholder: '我的个人博客 · 本地预览' },
  { id: 'gf-blog-html', name: 'index.html', fileType: 'html', source: '主会话', sourceKind: 'main', status: 'new', content: LANDING_HTML },

  // —— 子任务「爬虫 PRD」沙箱产出 ——
  { id: 'gf-prd-draft', name: 'prd-draft.md', fileType: 'md', source: '爬虫 PRD', sourceKind: 'task', status: 'modified', content: PRD_DRAFT_MD },
  { id: 'gf-prd-req', name: '需求清单.md', fileType: 'md', source: '爬虫 PRD', sourceKind: 'task', status: 'new', content: REQ_LIST_MD },
  { id: 'gf-prd-v1', name: '爬虫 PRD v1.md', fileType: 'md', source: '爬虫 PRD', sourceKind: 'task', status: 'delivered', content: PRD_V1_MD },

  // —— 子任务「促销海报」沙箱产出 ——
  { id: 'gf-poster-png', name: '促销海报.png', fileType: 'image', source: '促销海报', sourceKind: 'task', status: 'delivered', placeholder: '促销主视觉 · 1080×1920' },
  { id: 'gf-poster-color', name: '配色方案.md', fileType: 'md', source: '促销海报', sourceKind: 'task', status: '', content: COLOR_MD },
]

const BY_TEAM = {
  'demo-team-personal-blog': PERSONAL_BLOG,
}

// 其它团队的兜底演示集，保证任意团队点开都有内容
function buildFallback() {
  return [
    { id: 'gf-fallback-brief', name: '需求说明.md', fileType: 'md', source: '主会话', sourceKind: 'main', status: '', content: '# 需求说明\n\n在主会话里上传的资料会出现在这里，供群内成员取用。\n' },
    { id: 'gf-fallback-output', name: '工作产出.md', fileType: 'md', source: '执行中任务', sourceKind: 'task', status: 'new', content: '# 工作产出\n\n成员在沙箱里生成的文件会聚合到这里，点开即可预览。\n' },
  ]
}

export function getGroupFilesForTeam(teamKey) {
  const key = teamKey ? String(teamKey) : ''
  // 优先读 dev-mocks 注入的运行时数据（现场建群可扩展），否则回退到内置演示集
  const injected = typeof window !== 'undefined' && window.__optMock?.groupFiles
  if (injected && typeof injected.get === 'function' && injected.has(key)) return injected.get(key)
  if (BY_TEAM[key]) return BY_TEAM[key]
  return buildFallback()
}
