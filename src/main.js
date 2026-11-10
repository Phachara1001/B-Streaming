import { createApp } from 'vue'
import './style.css'
import Shell from './Shell.vue'
import { initTheme } from './services/themeService'

initTheme()

createApp(Shell).mount('#app')

