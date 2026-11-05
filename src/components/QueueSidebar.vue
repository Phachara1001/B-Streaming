<script setup>
import { ref, computed, watch } from 'vue'
import {
  ListMusic,
  PlusCircle,
  GripVertical,
  Play,
  SkipForward,
  Trash2,
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  Shuffle,
  Search,
  Plus,
  ListStart,
  Link2,
  Loader2,
  Check,
  Music,
  User,
  Clock,
  Sparkles,
  X,
  QrCode,
  Copy,
  Smartphone,
  Wifi,
  Mic2,
  Headphones
} from 'lucide-vue-next'
import { parseYouTubeVideoId } from '../data/karaokeCatalog.js'

const props = defineProps({
  currentSong: {
    type: Object,
    default: null
  },
  queue: {
    type: Array,
    default: () => []
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  autoAdvance: {
    type: Boolean,
    default: true
  },
  activeTab: {
    type: String,
    default: 'queue'
  },
  roomId: {
    type: String,
    default: 'KTV-889'
  },
  roomMusicMode: {
    type: String,
    default: 'karaoke'
  },
  remoteCount: {
    type: Number,
    default: 0
  },
  qrDataUrl: {
    type: String,
    default: ''
  },
  remoteUrl: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'update:activeTab',
  'update:autoAdvance',
  'update-room-music-mode',
  'add-to-queue',
  'play-next',
  'play-immediately',
  'remove-from-queue',
  'move-to-top',
  'reorder-queue',
  'shuffle-queue',
  'clear-queue',
  'skip-song',
  'toggle-remote-drawer'
])

// Drag and Drop State
const draggedIndex = ref(null)
const dragOverIndex = ref(null)

// Search & Add State
const searchQuery = ref('')
const isSearchingYouTube = ref(false)
const youtubeResults = ref([])
const recentlyAddedIds = ref(new Set())
const customLinkTitle = ref('')
const copiedUrl = ref(false)

let searchDebounceTimer = null

const detectedVideoId = computed(() => parseYouTubeVideoId(searchQuery.value))

function triggerYouTubeSearch() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  const q = searchQuery.value.trim()
  if (!q || q.length < 2 || detectedVideoId.value) {
    youtubeResults.value = []
    isSearchingYouTube.value = false
    return
  }
  isSearchingYouTube.value = true
  searchDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(
        `/api/yt-search?q=${encodeURIComponent(q)}&mode=${encodeURIComponent(props.roomMusicMode)}`
      )
      const data = await res.json()
      youtubeResults.value = Array.isArray(data.results) ? data.results : []
    } catch (_) {
      youtubeResults.value = []
    } finally {
      isSearchingYouTube.value = false
    }
  }, 450)
}

watch(searchQuery, () => {
  triggerYouTubeSearch()
})

watch(
  () => props.roomMusicMode,
  () => {
    if (searchQuery.value.trim().length >= 2) {
      triggerYouTubeSearch()
    }
  }
)

function markAddedFeedback(id) {
  recentlyAddedIds.value.add(id)
  setTimeout(() => {
    recentlyAddedIds.value.delete(id)
  }, 1400)
}

function handleAddSong(song, priority = false) {
  markAddedFeedback(song.id || song.videoId)
  if (priority) {
    emit('play-next', { ...song, requestedBy: 'Host' })
  } else {
    emit('add-to-queue', { ...song, requestedBy: 'Host' })
  }
}

function handleAddDirectUrl(priority = false) {
  const vid = detectedVideoId.value
  if (!vid) return
  const customSong = {
    id: `custom-${vid}-${Date.now()}`,
    videoId: vid,
    title: customLinkTitle.value.trim() || `YouTube (${vid})`,
    artist: 'Direct YouTube Link',
    duration: '04:00',
    category: 'YouTube Link',
    thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
    requestedBy: 'Host'
  }
  handleAddSong(customSong, priority)
  searchQuery.value = ''
  customLinkTitle.value = ''
}

async function copyRemoteLink() {
  if (!props.remoteUrl) return
  try {
    await navigator.clipboard.writeText(props.remoteUrl)
    copiedUrl.value = true
    setTimeout(() => {
      copiedUrl.value = false
    }, 1600)
  } catch (_) { }
}

// Drag & Drop Handlers
function onDragStart(event, index) {
  draggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
}

function onDragOver(event, index) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  if (dragOverIndex.value !== index) {
    dragOverIndex.value = index
  }
}

function onDragLeave(index) {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null
  }
}

function onDrop(event, targetIndex) {
  event.preventDefault()
  const fromIndex =
    draggedIndex.value !== null
      ? draggedIndex.value
      : Number(event.dataTransfer.getData('text/plain'))

  draggedIndex.value = null
  dragOverIndex.value = null

  if (
    typeof fromIndex === 'number' &&
    !Number.isNaN(fromIndex) &&
    fromIndex !== targetIndex &&
    fromIndex >= 0 &&
    targetIndex >= 0
  ) {
    emit('reorder-queue', { fromIndex, toIndex: targetIndex })
  }
}

function onDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
}

function moveStep(fromIndex, delta) {
  const toIndex = fromIndex + delta
  if (toIndex < 0 || toIndex >= props.queue.length) return
  emit('reorder-queue', { fromIndex, toIndex })
}
</script>

<template>
  <aside class="queue-sidebar-column">
    <!-- Top Sidebar Header: Queue Runner Status -->
    <div class="sidebar-top-header">
      <div class="runner-title-row">
        <div class="runner-badge">
          <ListMusic :size="16" class="icon-accent" />
          <span>QUEUE SYSTEM</span>
        </div>

        <label class="auto-run-switch" title="เล่นเพลงถัดไปในคิวอัตโนมัติ">
          <input type="checkbox" :checked="autoAdvance" @change="emit('update:autoAdvance', $event.target.checked)" />
          <span class="switch-track">
            <span class="switch-dot"></span>
          </span>
          <span class="switch-label">AUTO-RUN</span>
        </label>
      </div>

      <!-- Segmented Navigation Tabs (Queue Management vs Add Song) -->
      <div class="sidebar-segmented-tabs">
        <button type="button" class="seg-tab-btn" :class="{ active: activeTab === 'queue' }"
          @click="emit('update:activeTab', 'queue')">
          <ListMusic :size="15" />
          <span>จัดการคิวเพลง</span>
          <span class="queue-count-pill">{{ queue.length }}</span>
        </button>

        <button type="button" class="seg-tab-btn" :class="{ active: activeTab === 'add' }"
          @click="emit('update:activeTab', 'add')">
          <PlusCircle :size="15" />
          <span>ค้นหา/เพิ่มเพลง</span>
        </button>
      </div>
    </div>

    <!-- TAB 1: QUEUE RUNNER & DRAG-AND-DROP MANAGEMENT -->
    <div v-if="activeTab === 'queue'" class="sidebar-tab-body">
      <!-- Active Now Playing Card -->
      <div class="now-playing-card" v-if="currentSong">
        <div class="np-header-bar">
          <div class="np-live-indicator">
            <span class="mini-eq" :class="{ paused: !isPlaying }">
              <i></i><i></i><i></i>
            </span>
            <span>กำลังเล่น (NOW PLAYING)</span>
          </div>
          <button type="button" class="np-skip-btn" @click="emit('skip-song')" title="ข้ามไปเพลงถัดไปทันที">
            <span>ข้ามคิว</span>
            <SkipForward :size="13" />
          </button>
        </div>

        <div class="np-body">
          <img :src="currentSong.thumbnail" :alt="currentSong.title" class="np-thumb" />
          <div class="np-info">
            <div class="np-title" :title="currentSong.title">{{ currentSong.title }}</div>
            <div class="np-artist">{{ currentSong.artist }}</div>
            <div class="np-meta-row">
              <span class="np-requester">
                <User :size="11" />
                <span>{{ currentSong.requestedBy || 'Host' }}</span>
              </span>
              <span class="np-duration">
                <Clock :size="11" />
                <span>{{ currentSong.duration || '04:00' }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Queue Toolbar -->
      <div class="queue-list-toolbar" v-if="queue.length > 0">
        <div class="toolbar-left">
          <span class="toolbar-heading">คิวถัดไป ({{ queue.length }})</span>
          <span class="drag-hint-text" v-if="queue.length > 1">ลากเพื่อจัดลำดับได้</span>
        </div>
        <div class="toolbar-actions">
          <button type="button" class="toolbar-mini-btn" v-if="queue.length > 1" @click="emit('shuffle-queue')"
            title="สุ่มลำดับคิวเพลง (Shuffle)">
            <Shuffle :size="13" />
          </button>
          <button type="button" class="toolbar-mini-btn danger" @click="emit('clear-queue')" title="ล้างคิวทั้งหมด">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>

      <!-- Draggable Queue List -->
      <div class="queue-scroll-list" v-if="queue.length > 0">
        <TransitionGroup name="queue-reorder" tag="div" class="queue-items-container">
          <div v-for="(item, index) in queue" :key="item.queueId || `${item.id}-${index}`" class="queue-item-card"
            :class="{
              'is-dragging': draggedIndex === index,
              'is-drag-over': dragOverIndex === index && draggedIndex !== index,
              'is-first-next': index === 0
            }" draggable="true" @dragstart="onDragStart($event, index)" @dragover="onDragOver($event, index)"
            @dragleave="onDragLeave(index)" @drop="onDrop($event, index)" @dragend="onDragEnd">
            <div class="queue-grip-zone" title="ลากเพื่อสลับตำแหน่งคิว">
              <GripVertical :size="15" class="grip-svg" />
              <span class="queue-index-mono">{{ String(index + 1).padStart(2, '0') }}</span>
            </div>

            <div class="queue-thumb-wrap" @click="emit('play-immediately', index)" title="เล่นเพลงนี้ทันที">
              <img :src="item.thumbnail" :alt="item.title" class="queue-thumb" />
              <div class="queue-thumb-play">
                <Play :size="13" />
              </div>
            </div>

            <div class="queue-item-details">
              <div class="queue-item-title" :title="item.title">{{ item.title }}</div>
              <div class="queue-item-sub">
                <span class="q-artist">{{ item.artist }}</span>
                <span class="q-dot">•</span>
                <span class="q-user">{{ item.requestedBy || 'Host' }}</span>
              </div>
            </div>

            <div class="queue-item-actions">
              <button v-if="index > 0" type="button" class="q-act-btn priority" @click="emit('move-to-top', index)"
                title="ดันขึ้นคิวแรกสุด (Play Next)">
                <ArrowUpToLine :size="13" />
              </button>
              <button v-if="index > 0" type="button" class="q-act-btn" @click="moveStep(index, -1)"
                title="เลื่อนขึ้น 1 ลำดับ">
                <ArrowUp :size="13" />
              </button>
              <button v-if="index < queue.length - 1" type="button" class="q-act-btn" @click="moveStep(index, 1)"
                title="เลื่อนลง 1 ลำดับ">
                <ArrowDown :size="13" />
              </button>
              <button type="button" class="q-act-btn delete" @click="emit('remove-from-queue', index)"
                title="ลบออกจากคิว">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </TransitionGroup>
      </div>

      <!-- Empty Queue Placeholder -->
      <div class="queue-empty-box" v-else>
        <div class="empty-icon-circle">
          <ListMusic :size="24" />
        </div>
        <p class="empty-title">ยังไม่มีคิวเพลง</p>
        <p class="empty-desc">
          กดปุ่มค้นหาด้านล่างเพื่อเพิ่มเพลงจาก YouTube หรือสแกน QR Code จากมือถือเพื่อส่งเพลงเข้าคิว
        </p>
        <button type="button" class="btn-add-from-empty" @click="emit('update:activeTab', 'add')">
          <Search :size="14" />
          <span>ค้นหาเพลงเพิ่มเข้าคิว</span>
        </button>
      </div>
    </div>

    <!-- TAB 2: SEARCH & ADD SONG TO QUEUE (LIVE YOUTUBE ONLY, NO MOCK SONGS) -->
    <div v-else class="sidebar-tab-body">
      <div class="search-box-area">
        <div class="sidebar-mode-selector">
          <button type="button" class="s-mode-btn" :class="{ active: roomMusicMode === 'karaoke' }"
            @click="emit('update-room-music-mode', 'karaoke')">
            <Mic2 :size="13" />
            <span>โหมดคาราโอเกะ</span>
          </button>
          <button type="button" class="s-mode-btn" :class="{ active: roomMusicMode === 'music' }"
            @click="emit('update-room-music-mode', 'music')">
            <Headphones :size="13" />
            <span>โหมดเพลงปกติ (MV)</span>
          </button>
        </div>

        <div class="search-input-wrap">
          <Search :size="15" class="search-icon" />
          <input v-model="searchQuery" type="text" class="search-input" :placeholder="roomMusicMode === 'karaoke'
              ? 'พิมพ์ชื่อเพลง/ศิลปิน เพื่อค้นหาคาราโอเกะ...'
              : 'พิมพ์ชื่อเพลง/ศิลปิน เพื่อค้นหาเพลงปกติ...'
            " />
          <button v-if="searchQuery" type="button" class="clear-search-btn" @click="searchQuery = ''">
            <X :size="14" />
          </button>
        </div>

        <div class="direct-url-card" v-if="detectedVideoId">
          <div class="direct-url-header">
            <Link2 :size="14" class="icon-accent" />
            <span>ตรวจพบลิงก์วิดีโอ YouTube ({{ detectedVideoId }})</span>
          </div>
          <input v-model="customLinkTitle" type="text" class="custom-title-input"
            placeholder="ตั้งชื่อเพลงในคิว (ไม่บังคับ)..." />
          <div class="direct-url-actions">
            <button type="button" class="btn-add-song primary" @click="handleAddDirectUrl(false)">
              <Plus :size="14" />
              <span>เพิ่มต่อท้ายคิว</span>
            </button>
            <button type="button" class="btn-add-song secondary" @click="handleAddDirectUrl(true)">
              <ListStart :size="14" />
              <span>แทรกคิวแรก</span>
            </button>
          </div>
        </div>
      </div>

      <div class="catalog-scroll-list">
        <template v-if="searchQuery.trim().length >= 2 && !detectedVideoId">
          <div class="section-divider-label">
            <Sparkles :size="12" />
            <span>
              {{
                roomMusicMode === 'karaoke'
                  ? 'ผลการค้นหา YouTube คาราโอเกะ'
                  : 'ผลการค้นหา YouTube เพลงปกติ / MV'
              }}
            </span>
            <Loader2 v-if="isSearchingYouTube" :size="13" class="spin-icon" />
          </div>

          <div v-for="song in youtubeResults" :key="song.id" class="catalog-song-card">
            <img :src="song.thumbnail" :alt="song.title" class="cat-thumb" />
            <div class="cat-info">
              <div class="cat-title" :title="song.title">{{ song.title }}</div>
              <div class="cat-sub">{{ song.artist }} • {{ song.duration }}</div>
            </div>
            <div class="cat-actions">
              <button type="button" class="cat-btn add" :class="{ added: recentlyAddedIds.has(song.id) }"
                @click="handleAddSong(song, false)" title="เพิ่มเข้าคิว (Add to Queue)">
                <Check v-if="recentlyAddedIds.has(song.id)" :size="14" />
                <Plus v-else :size="14" />
              </button>
              <button type="button" class="cat-btn next" @click="handleAddSong(song, true)"
                title="แทรกเป็นคิวแรก (Play Next)">
                <ListStart :size="14" />
              </button>
            </div>
          </div>

          <div v-if="!isSearchingYouTube && youtubeResults.length === 0" class="queue-empty-box">
            <Music :size="22" />
            <p class="empty-title">ไม่พบผลลัพธ์สำหรับ "{{ searchQuery }}"</p>
            <p class="empty-desc">ลองค้นหาด้วยชื่อเพลงหรือชื่อศิลปินอื่น</p>
          </div>
        </template>

        <div v-else-if="!detectedVideoId" class="queue-empty-box">
          <div class="empty-icon-circle">
            <Search :size="22" />
          </div>
          <p class="empty-title">
            {{
              roomMusicMode === 'karaoke'
                ? 'ค้นหาเพลงคาราโอเกะจาก YouTube'
                : 'ค้นหาเพลงปกติ / MV จาก YouTube'
            }}
          </p>
          <p class="empty-desc">
            พิมพ์ชื่อเพลง ชื่อศิลปิน หรือวางลิงก์ YouTube ในช่องด้านบนเพื่อเพิ่มเข้าคิว
          </p>
        </div>
      </div>
    </div>

    <!-- PERMANENT ALWAYS-VISIBLE QR CODE DOCK -->
    <div class="sidebar-qr-dock">
      <div class="qr-dock-img-wrap" v-if="qrDataUrl">
        <img :src="qrDataUrl" alt="Mobile Remote QR Code" class="qr-dock-img" />
      </div>
      <div class="qr-dock-info">
        <div class="qr-dock-top">
          <span class="qr-dock-badge">
            <QrCode :size="12" />
            <span>MOBILE REMOTE</span>
          </span>
          <span class="qr-dock-room mono-code">{{ roomId }}</span>
        </div>
        <p class="qr-dock-desc">สแกนเพื่อเลือกเพลง/จัดคิวผ่านมือถือ</p>
        <div class="qr-dock-status">
          <Wifi :size="11" />
          <span>เชื่อมต่อแล้ว {{ remoteCount }} เครื่อง</span>
        </div>
        <div class="qr-dock-actions">
          <button type="button" class="qr-mini-btn primary" @click="emit('toggle-remote-drawer')"
            title="เปิดหน้าจอจำลองรีโมตมือถือ">
            <Smartphone :size="12" />
            <span>จำลองรีโมต</span>
          </button>
          <button type="button" class="qr-mini-btn" @click="copyRemoteLink" title="คัดลอกลิงก์รีโมต">
            <Check v-if="copiedUrl" :size="12" />
            <Copy v-else :size="12" />
            <span>{{ copiedUrl ? 'คัดลอกแล้ว' : 'ลิงก์' }}</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
