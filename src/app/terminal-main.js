/**
 * 独立终端窗口的 Vue 入口
 * 最小化启动，只挂载 DetachedTerminal 组件
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import DetachedTerminal from '@/modules/terminal/components/DetachedTerminal.vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import '@/assets/iconfont/iconfont.js'

const app = createApp(DetachedTerminal)
const pinia = createPinia()

app.component('SvgIcon', SvgIcon)
app.use(pinia)
app.use(ElementPlus)
app.mount('#terminal-app')
