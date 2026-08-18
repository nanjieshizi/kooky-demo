import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'virtual:uno.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import { useUserStore } from '@/modules/auth/store'
import { postClaudeCodeClientLoginStatus } from '@/modules/terminal/claudeKeyService'
import { createKcControlRendererService } from '@/modules/terminal/services/kcControlRendererService'
import { applyDevlocalMockUser } from '@/shared/utils/devlocalUser'
import '@/shared/styles/global.css'
import '@/shared/styles/markdown-body.css'
import '@/assets/styles/scrollbar.scss'
import '@/assets/iconfont/iconfont.js'
// 协作流程时间线（vendored from 生产 0612）新增的流程状态图标，作为第二张 sprite 追加加载
import '@/assets/iconfont/iconfont-flow.js'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import Loading from '@/shared/components/Loading/index.vue'

// 导入并初始化 Sentry
import { initSentry } from './sentry'

// [dev-mocks] 本地高保真原型：登录态/IM/electronAPI 全套兜底。仅 DEV 生效。
import { installEarly, installLate } from '@/dev-mocks'
installEarly()

const app = createApp(App)
const pinia = createPinia()

// 初始化 Sentry
initSentry(app)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.component('SvgIcon', SvgIcon)
app.component('Loading', Loading)
app.use(pinia)
installLate(pinia)

const userStore = useUserStore(pinia)
applyDevlocalMockUser(userStore)

watch(
  () => userStore.isLoggedIn,
  (loggedIn) => {
    if (!loggedIn) return
    postClaudeCodeClientLoginStatus('in', { includeOpenclawClientType: true })
    postClaudeCodeClientLoginStatus('in')
  },
  { immediate: true }
)

app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 初始化 KC Control 渲染进程服务，使主进程能通过 renderer bridge 与渲染进程通信
try {
  const kcControlRendererService = createKcControlRendererService({
    pinia,
    bridge: window.electronAPI?.kcControl ?? null,
  })
  kcControlRendererService.attachBridge()
  window.electronAPI?.kcControl?.notifyReady?.()
} catch (error) {
  console.error('[Kooky] kc renderer control service init failed:', error)
}

app.mount('#app')

// 打印配置路径到渲染进程控制台（与主进程一致：隔离配置在 ~/.kooky-data/claude-config）
if (window.electronAPI?.getPath) {
  window.electronAPI.getPath('userData').then((userDataPath) => {
    console.log('[Kooky] userData 路径:', userDataPath)
  })
  window.electronAPI.getPath('home').then((home) => {
    console.log('[Kooky] claude-config 隔离路径（Claude / Kooky CLI 共用）:', `${home}/.kooky-data/claude-config`)
  })
}
