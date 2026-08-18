import { createApp } from 'vue'
import BubbleApp from '@/modules/bubble/BubbleApp.vue'
import '@/modules/bubble/bubble-styles.css'

const app = createApp(BubbleApp)
app.mount('#bubble-app')
