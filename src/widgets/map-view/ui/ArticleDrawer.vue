<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { fetchOg } from '../../../shared/lib/map/ogFetch'

const props = defineProps<{ url: string | null }>()
const emit = defineEmits<{ close: [] }>()

const BLOCKED_DOMAINS = new Set([
  't.me', 'telegram.me', 'telegram.org',
  'twitter.com', 'x.com',
  'facebook.com', 'fb.com',
  'instagram.com',
  'tiktok.com',
  'vk.com', 'vk.ru',
])

const iframeBlocked = ref(false)
const iframeKey = ref(0)

const domain = computed(() => {
  if (!props.url) return ''
  try { return new URL(props.url).hostname.replace(/^www\./, '') }
  catch { return '' }
})

const isKnownBlocked = computed(() =>
  BLOCKED_DOMAINS.has(domain.value) || [...BLOCKED_DOMAINS].some(d => domain.value.endsWith('.' + d))
)

// Telegram post: t.me/channelname/12345
const telegramPostPath = computed(() => {
  if (!props.url) return ''
  try {
    const u = new URL(props.url)
    if (!['t.me', 'telegram.me'].includes(u.hostname.replace(/^www\./, ''))) return ''
    const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean)
    if (parts.length >= 2 && /^\d+$/.test(parts[1])) return `${parts[0]}/${parts[1]}`
  } catch { /* empty */ }
  return ''
})

const isTelegramPost = computed(() => !!telegramPostPath.value)

// OG card for non-Telegram blocked sites
const ogData = ref<{ title: string | null; description: string | null; image: string | null } | null>(null)
const ogLoading = ref(false)

watch(() => props.url, async (url) => {
  iframeBlocked.value = false
  iframeKey.value++
  ogData.value = null
  if (!url || !isKnownBlocked.value || isTelegramPost.value) return
  ogLoading.value = true
  try { ogData.value = await fetchOg(url) }
  finally { ogLoading.value = false }
}, { immediate: true })

// Telegram widget injection — attributes must live on the script tag itself
const tgContainer = ref<HTMLElement | null>(null)
watchEffect(() => {
  const el = tgContainer.value
  const path = telegramPostPath.value
  if (!el || !path) return
  el.innerHTML = ''
  const script = document.createElement('script')
  script.src = `https://telegram.org/js/telegram-widget.js?22&_cb=${Date.now()}`
  script.async = true
  script.setAttribute('data-telegram-post', path)
  script.setAttribute('data-width', '100%')
  script.setAttribute('data-dark', '1')
  el.appendChild(script)
})

function onIframeLoad(e: Event) {
  const iframe = e.target as HTMLIFrameElement
  try {
    const doc = iframe.contentDocument
    if (doc && doc.body && doc.body.innerHTML === '') iframeBlocked.value = true
  } catch {
    iframeBlocked.value = true
  }
}
</script>

<template>
  <Transition name="drawer">
    <div v-if="url" class="article-drawer">
      <div class="drawer-header">
        <span class="drawer-domain">{{ domain }}</span>
        <div class="drawer-actions">
          <a :href="url" target="_blank" rel="noopener noreferrer" class="drawer-open">↗ Open in tab</a>
          <button class="drawer-close" @click="emit('close')">✕</button>
        </div>
      </div>

      <!-- Telegram native widget -->
      <div v-if="isTelegramPost" ref="tgContainer" class="tg-container" />

      <!-- OG preview card for other non-embeddable sites -->
      <div v-else-if="isKnownBlocked" class="drawer-og">
        <div v-if="ogLoading" class="og-loading">
          <span class="og-spinner" />
        </div>
        <template v-else>
          <img v-if="ogData?.image" :src="ogData.image" class="og-image" alt="" referrerpolicy="no-referrer" />
          <div class="og-body">
            <p v-if="ogData?.title" class="og-title">{{ ogData.title }}</p>
            <p v-if="ogData?.description" class="og-desc">{{ ogData.description }}</p>
            <a :href="url" target="_blank" rel="noopener noreferrer" class="og-open">Open in new tab ↗</a>
          </div>
        </template>
      </div>

      <!-- Runtime-blocked iframe fallback -->
      <div v-else-if="iframeBlocked" class="drawer-og">
        <div class="og-body">
          <p class="og-title">This site doesn't allow embedding.</p>
          <a :href="url" target="_blank" rel="noopener noreferrer" class="og-open">Open in new tab ↗</a>
        </div>
      </div>

      <!-- Normal iframe -->
      <iframe
        v-else
        :key="iframeKey"
        :src="url"
        class="drawer-frame"
        referrerpolicy="no-referrer"
        @load="onIframeLoad"
      />
    </div>
  </Transition>
</template>

<style scoped>
.article-drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 480px;
  height: 100dvh;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: var(--aero-glass);
  backdrop-filter: blur(32px) saturate(160%);
  border-left: var(--aero-border);
  box-shadow: -8px 0 40px rgba(0, 0, 0, 0.5);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: var(--aero-border);
  flex-shrink: 0;
  gap: 10px;
  min-height: 46px;
}

.drawer-domain {
  font-family: var(--aero-font);
  font-size: 11px;
  color: var(--aero-text-dim);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.drawer-open {
  font-family: var(--aero-font);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--aero-accent);
  text-decoration: none;
  padding: 3px 10px;
  border: 1px solid rgba(77, 215, 250, 0.3);
  border-radius: var(--aero-radius-pill);
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.drawer-open:hover {
  background: rgba(77, 215, 250, 0.1);
  border-color: rgba(77, 215, 250, 0.5);
}

.drawer-close {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transition: color 0.12s, background 0.12s;
  padding: 0;
  flex-shrink: 0;
}
.drawer-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.drawer-frame {
  flex: 1;
  width: 100%;
  border: none;
  background: #1a1a1a;
}

/* Telegram widget container */
.tg-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* OG preview card (blocked non-Telegram sites) */
.drawer-og {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.og-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.og-spinner {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(var(--aero-accent-rgb), 0.2);
  border-top-color: var(--aero-accent);
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.og-image {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  flex-shrink: 0;
}

.og-body {
  padding: 24px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.og-title {
  font-family: var(--aero-font);
  font-size: 15px;
  font-weight: 700;
  color: var(--aero-text);
  line-height: 1.4;
  margin: 0;
}

.og-desc {
  font-family: var(--aero-font);
  font-size: 12px;
  color: var(--aero-text-dim);
  line-height: 1.6;
  margin: 0;
}

.og-open {
  align-self: flex-start;
  margin-top: auto;
  font-family: var(--aero-font);
  font-size: 12px;
  font-weight: 700;
  color: var(--aero-accent);
  text-decoration: none;
  padding: 8px 20px;
  border: 1px solid rgba(77, 215, 250, 0.35);
  border-radius: var(--aero-radius-pill);
  transition: background 0.12s;
}
.og-open:hover {
  background: rgba(77, 215, 250, 0.1);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
