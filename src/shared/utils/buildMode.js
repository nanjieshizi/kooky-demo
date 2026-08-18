/**
 * 构建模式判断
 *
 * - IS_DEV  : vite dev server 时为 true（vite 注入 import.meta.env.DEV）
 * - IS_DEMO : dev 时 true；或打包时通过环境变量 VITE_DEMO=true 强开
 *             用途：给 UED / 老板看 demo 时，让 mock 数据在生产构建里也生效
 *
 * 使用方式：
 *   import { IS_DEMO } from '@/shared/utils/buildMode'
 *   const ENABLED = IS_DEMO
 *
 * 打 demo 包：
 *   npm run build:demo:mac
 */

export const IS_DEV = import.meta.env.DEV
// 当前仓库是纯前端演示版，任何部署环境都直接使用 mock 数据与演示交互，
// 不再进入原产品的登录、IM 和后端初始化流程。
export const IS_DEMO = true
