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
export const IS_DEMO = IS_DEV || import.meta.env.VITE_DEMO === 'true'
