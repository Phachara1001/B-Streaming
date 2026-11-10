<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { History, X, Trash2, ListPlus, ExternalLink, Music, Play, SkipForward, ListMusic } from 'lucide-vue-next'
import { listHistory, clearHistory, subscribeHistory } from '../services/roomService.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  roomCode: { type: String, required: true },
  roomName: { type: String, default: '' },
  version: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'requeue'])

const items = ref([])
const loading = ref(false)
const error = ref('')
const filter = ref('all') // all | played | queued | skipped
let unsubscribe = null
let reloadTimer = null

const FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'played', label: 'เล่นแล้ว' },
  { id: 'queued', label: 'เข้าคิว' },
  { id: 'skipped', label: 'ข้าม' }
]

const EVENT_LABEL = { queued: 'เข้าคิว', played: 'เล่นแล้ว', skipped: 'ข้าม' }

const filtered = computed(() =>
  filter.value === 'all' ? items.value : items.value.filter((i) => i.event === filter.value)
)

const counts = computed(() => ({
  all: items.value.length,
  played: items.value.filter((i) => i.event === 'played').length,
  queued: items.value.filter((i) => i.event === 'queued').length,
  skipped: items.value.filter((i) => i.event === 'skipped').length
}))

function formatTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `วันนี้ ${time}`
  return `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${time}`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await listHistory(props.roomCode)
  } catch (e) {
    error.value = e.message || 'โหลดประวัติไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(load, 300)
}

function requeue(item) {
  emit('requeue', {
    id: `hist-${item.video_id}-${Date.now()}`,
    videoId: item.video_id,
    title: item.title,
    artist: item.artist || 'YouTube',
    thumbnail: item.thumbnail,
    duration: item.duration || '04:00',
    requestedBy: item.requested_by || 'Host'
  })
}

async function onClear() {
  if (!window.confirm('ล้างประวัติทั้งหมดของห้องนี้?')) return
  await clearHistory(props.roomCode)
  await load()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      load()
      unsubscribe = subscribeHistory(props.roomCode, scheduleReload)
    } else if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  },
  { immediate: true }
)

watch(
  () => props.version,
  () => {
    if (props.open) scheduleReload()
  }
)

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe()
  if (reloadTimer) clearTimeout(reloadTimer)
})
</script>

<template>
  <transition name="hist-fade">
    <div class="hist-backdrop" v-if="open" @click.self="emit('close')">
      <div class="hist-card" role="dialog" aria-label="ประวัติเพลง">
        <header class="hist-head">
          <div class="hist-title">
            <span class="hist-icon"><History :size="20" /></span>
            <div>
              <h3>ประวัติเพลง</h3>
              <p>{{ roomName || roomCode }} <code>{{ roomCode }}</code></p>
            </div>
          </div>
          <div class="hist-head-actions">
            <button type="button" class="hist-ghost" @click="onClear" v-if="items.length" title="ล้างประวัติ">
              <Trash2 :size="15" />
              <span>ล้าง</span>
            </button>
            <button type="button" class="hist-close" @click="emit('close')" title="ปิด">
              <X :size="18" />
            </button>
          </div>
        </header>

        <div class="hist-filters">
          <button v-for="f in FILTERS" :key="f.id" type="button" class="hist-filter"
            :class="{ active: filter === f.id }" @click="filter = f.id">
            {{ f.label }}
            <span class="hist-count">{{ counts[f.id] }}</span>
          </button>
        </div>

        <div class="hist-body">
          <p class="hist-error" v-if="error">{{ error }}</p>
          <div class="hist-empty" v-else-if="!loading && !filtered.length">
            <ListMusic :size="30" />
            <strong>ยังไม่มีประวัติ</strong>
            <span>เมื่อมีการเพิ่มหรือเล่นเพลง รายการจะแสดงที่นี่</span>
          </div>

          <ul class="hist-list" v-else>
            <li v-for="item in filtered" :key="item.id" class="hist-item">
              <img :src="item.thumbnail" :alt="item.title" class="hist-thumb" loading="lazy" />
              <div class="hist-info">
                <div class="hist-song" :title="item.title">{{ item.title }}</div>
                <div class="hist-meta">
                  <span class="hist-chip" :class="item.event">
                    <Play :size="10" v-if="item.event === 'played'" />
                    <SkipForward :size="10" v-else-if="item.event === 'skipped'" />
                    <Music :size="10" v-else />
                    {{ EVENT_LABEL[item.event] || item.event }}
                  </span>
                  <span class="hist-by">โดย {{ item.requested_by || 'Host' }}</span>
                  <span class="hist-time">{{ formatTime(item.created_at) }}</span>
                </div>
              </div>
              <div class="hist-actions">
                <a :href="item.url" target="_blank" rel="noopener noreferrer" class="hist-icon-btn" title="เปิดลิงก์ YouTube">
                  <ExternalLink :size="15" />
                </a>
                <button type="button" class="hist-icon-btn primary" @click="requeue(item)" title="เพิ่มเข้าคิวอีกครั้ง">
                  <ListPlus :size="16" />
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.hist-backdrop {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(26, 15, 46, 0.6);
  backdrop-filter: blur(8px);
}

.hist-card {
  width: min(680px, 100%);
  height: min(640px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--card, #fff);
  color: var(--ink, #1a0f2e);
  border: 3px solid var(--ink, #1a0f2e);
  border-radius: 28px;
  box-shadow: 10px 10px 0 var(--pop-pink, #ff4d8d);
  overflow: hidden;
  text-align: left;
}

.hist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  background: var(--pop-yellow, #ffd23f);
  border-bottom: 3px solid var(--ink, #1a0f2e);
  flex-shrink: 0;
}

.hist-title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.hist-icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--ink, #1a0f2e);
  color: var(--pop-yellow, #ffd23f);
  flex-shrink: 0;
}

.hist-title h3 {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.1;
}

.hist-title p {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hist-title code {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ink, #1a0f2e);
  color: var(--pop-yellow, #ffd23f);
  font-family: var(--font-mono);
  font-size: 10px;
}

.hist-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hist-ghost,
.hist-close {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 2px solid var(--ink, #1a0f2e);
  border-radius: 999px;
  background: var(--card, #fff);
  color: var(--ink, #1a0f2e);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.hist-close {
  width: 36px;
  padding: 0;
  justify-content: center;
}

.hist-ghost:hover,
.hist-close:hover {
  background: var(--pop-pink, #ff4d8d);
  color: #fff;
}

.hist-filters {
  display: flex;
  gap: 8px;
  padding: 14px 20px 10px;
  flex-shrink: 0;
  overflow-x: auto;
}

.hist-filter {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border: 2px solid var(--ink, #1a0f2e);
  border-radius: 999px;
  background: transparent;
  color: var(--ink, #1a0f2e);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.hist-filter.active {
  background: var(--ink, #1a0f2e);
  color: #fff;
}

.hist-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--pop-pink, #ff4d8d);
  color: #fff;
  font-size: 10px;
  line-height: 18px;
  text-align: center;
}

.hist-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 20px 20px;
  scrollbar-width: thin;
}

.hist-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 2px solid var(--ink, #1a0f2e);
  border-radius: 18px;
  background: var(--card, #fff);
  box-shadow: 3px 3px 0 var(--ink, #1a0f2e);
}

.hist-thumb {
  width: 92px;
  height: 56px;
  object-fit: cover;
  border-radius: 12px;
  border: 2px solid var(--ink, #1a0f2e);
  flex-shrink: 0;
}

.hist-info {
  flex: 1;
  min-width: 0;
}

.hist-song {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hist-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
  font-size: 11px;
  opacity: 0.85;
}

.hist-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 999px;
  font-weight: 800;
  background: var(--pop-lilac, #b8a2ff);
  color: var(--ink, #1a0f2e);
}

.hist-chip.played {
  background: var(--pop-mint, #1fd8a0);
}

.hist-chip.skipped {
  background: var(--pop-yellow, #ffd23f);
}

.hist-by {
  font-weight: 700;
}

.hist-time {
  opacity: 0.65;
}

.hist-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.hist-icon-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--ink, #1a0f2e);
  border-radius: 50%;
  background: var(--card, #fff);
  color: var(--ink, #1a0f2e);
  cursor: pointer;
  text-decoration: none;
  transition: transform 0.15s ease;
}

.hist-icon-btn.primary {
  background: var(--pop-pink, #ff4d8d);
  color: #fff;
}

.hist-icon-btn:hover {
  transform: scale(1.1);
}

.hist-empty {
  height: 100%;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  border: 2px dashed var(--ink, #1a0f2e);
  border-radius: 22px;
  opacity: 0.75;
}

.hist-error {
  padding: 12px;
  border-radius: 14px;
  background: #ffe3ea;
  color: #b4123b;
  font-weight: 600;
  font-size: 13px;
}

.hist-fade-enter-active,
.hist-fade-leave-active {
  transition: opacity 0.2s ease;
}

.hist-fade-enter-from,
.hist-fade-leave-to {
  opacity: 0;
}
</style>

