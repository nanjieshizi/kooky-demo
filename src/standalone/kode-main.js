/**
 * Kode Standalone · 独立单文件 HTML demo 的挂载入口
 *
 * 目标：只挂 KodeView，不挂 Kooky 主壳；浏览器双击 .html 即开。
 * 用法：npm run build:kode-html → 出 dist-standalone/kode-standalone.html
 */

import { createApp } from 'vue'
import KodeView from '@/modules/kode/KodeView.vue'

// 标记一下当前是 standalone 模式（KodeView 内部 window.__kookyMock 桥接会自动 no-op）
if (typeof window !== 'undefined') {
  window.__KODE_STANDALONE__ = true
}

createApp(KodeView).mount('#app')
