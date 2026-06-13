import { createApp } from 'vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../shared/styles/aero.css'
import App from './App.vue'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {/* non-fatal */})
}

const app = createApp(App)
app.config.devtools = true
app.mount('#app')
