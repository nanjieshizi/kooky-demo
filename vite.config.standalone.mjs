/**
 * Vite 配置 · Kode Standalone 单文件 HTML 构建
 *
 * 与主项目 vite.config.mjs 完全独立,只为 build:kode-html 服务。
 * 产物：dist-standalone/kode-standalone.html（所有 JS/CSS/图片 inline）
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  resolve: {
    alias: [
      // 把两个重型 shared 组件替换成 standalone stub（避免拉 markdown/katex/mermaid 等大依赖）
      // 顺序：精确匹配在前,通用 @ 在后
      {
        find: '@/shared/components/AssistantMessageActions.vue',
        replacement: resolve(__dirname, 'src/standalone/stubs/AssistantMessageActions.vue'),
      },
      {
        find: '@/shared/components/MessageAssistantAttachmentCards.vue',
        replacement: resolve(__dirname, 'src/standalone/stubs/MessageAssistantAttachmentCards.vue'),
      },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000, // 强制所有 asset 内联（图标等）
    rollupOptions: {
      input: resolve(__dirname, 'kode-standalone.html'),
      output: {
        inlineDynamicImports: true, // 单文件必备：所有动态 import 合成一个 bundle
      },
    },
  },
})
