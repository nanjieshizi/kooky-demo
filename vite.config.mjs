import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDevlocal = mode === 'devlocal'
  const isVercel = env.VERCEL === '1' || env.VERCEL === 'true'
  const localGatewayUrl = isDevlocal
    ? String(env.VITE_LOCAL_GATEWAY_URL || 'http://localhost:8001').replace(/\/$/, '')
    : ''

  return {
  plugins: [UnoCSS(), vue()],
  // 本地演示保留现有路径；Vercel 从域名根路径提供应用。
  base: isVercel ? '/' : '/super-assistant/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    'import.meta.env.VITE_LOCAL_GATEWAY_URL': JSON.stringify(localGatewayUrl),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler', // 使用现代 Sass API
        silenceDeprecations: ['legacy-js-api'], // 静默弃用警告
      },
    },
  },
  optimizeDeps: {
    include: ['element-plus', 'element-plus/es/locale/lang/zh-cn', '@element-plus/icons-vue'],
    force: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true, // 生成 Source Map
    minify: 'terser',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          'xterm-vendor': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links', '@xterm/addon-serialize'],
        },
        sourcemapExcludeSources: false, // 包含源代码内容
      },
    },
  },
  server: {
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    host: '0.0.0.0',
    port: 5173,
    open: false,
    cors: true,
    proxy: {
      ...(isDevlocal
        ? {
            '/api': { target: 'http://localhost:8001', changeOrigin: true },
            '/kooky-api': { target: 'http://localhost:8001', changeOrigin: true },
          }
        : {}),
      '/open-apis': {
        target: 'https://open.xfchat.iflytek.com/open-apis/authen/v2/oauth/token',
        changOrigin: true,
      },
      '/openclaw-manager': {
        target: 'http://172.29.214.74:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openclaw-manager/, ''),
      }
    }
  },
  }
})
