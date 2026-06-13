import { createApp } from 'vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../shared/styles/aero.css'
import App from './App.vue'
import { inject } from '@vercel/analytics'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {/* non-fatal */})
}

inject()

const app = createApp(App)
app.config.devtools = true
app.mount('#app')
