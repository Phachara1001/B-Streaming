<script setup>
import { ref, computed, watch } from 'vue'
import {
  Search,
  ListMusic,
  Sliders,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Volume1,
  Plus,
  ListStart,
  Check,
  Trash2,
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Award,
  Sparkles,
  Flame,
  User,
  Radio,
  X,
  Loader2,
  Link2,
  Music,
  Tv,
  Mic2,
  Headphones,
  ArrowRight,
  Edit3
} from 'lucide-vue-next'
import { parseYouTubeVideoId } from '../data/karaokeCatalog.js'

const props = defineProps({
  roomId: {
    type: String,
    default: 'KTV-889'
  },
  roomMusicMode: {
    type: String,
    default: 'karaoke'
  },
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
  volume: {
    type: Number,
    default: 80
  },
  isMuted: {
    type: Boolean,
    default: false
  },
  pitchSemitones: {
    type: Number,
    default: 0
  },
  isEmbeddedDrawer: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send-command', 'close-drawer', 'switch-to-host'])

// Mandatory Guest Name Onboarding State
const guestName = ref('')
const hasEnteredName = ref(false)
const nameInputError = ref(false)

const activeTab = ref('search') // 'search' | 'queue' | 'pad'
const searchQuery = ref('')
const isSearchingYouTube = ref(false)
const youtubeResults = ref([])
const addedFeedbackIds = ref(new Set())
const draggedIndex = ref(null)

let searchDebounce = null

const detectedVideoId = computed(() => parseYouTubeVideoId(searchQuery.value))

function performRemoteSearch() {
  if (searchDebounce) clearTimeout(searchDebounce)
  const q = searchQuery.value.trim()
  if (!q || q.length < 2 || detectedVideoId.value) {
    youtubeResults.value = []
    isSearchingYouTube.value = false
    return
  }
  isSearchingYouTube.value = true
  searchDebounce = setTimeout(async () => {
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
  performRemoteSearch()
})

watch(
  () => props.roomMusicMode,
  () => {
    if (searchQuery.value.trim().length >= 2) {
      performRemoteSearch()
    }
  }
)

function handleConfirmGuestName() {
  const trimmed = guestName.value.trim()
  if (!trimmed) {
    nameInputError.value = true
    return
  }
  nameInputError.value = false
  guestName.value = trimmed
  hasEnteredName.value = true
  dispatchCmd('JOIN_ROOM', { name: trimmed })
}

function handleEditName() {
  hasEnteredName.value = false
}

function dispatchCmd(action, payload = {}) {
  emit('send-command', {
    action,
    payload,
    sender: guestName.value.trim() || 'Guest'
  })
}

function handleRemoteAddSong(song, priority = false) {
  if (!hasEnteredName.value || !guestName.value.trim()) {
    hasEnteredName.value = false
    return
  }
  const key = song.id || song.videoId
  addedFeedbackIds.value.add(key)
  setTimeout(() => {
    addedFeedbackIds.value.delete(key)
  }, 1300)

  const songItem = {
    ...song,
    requestedBy: guestName.value.trim()
  }
  dispatchCmd(priority ? 'PLAY_NEXT' : 'ADD_QUEUE', { song: songItem })
}

function handleAddDirectLink(priority = false) {
  const vid = detectedVideoId.value
  if (!vid) return
  handleRemoteAddSong(
    {
      id: `yt-${vid}-${Date.now()}`,
      videoId: vid,
      title:
        props.roomMusicMode === 'karaoke'
          ? `YouTube Karaoke (${vid})`
          : `YouTube Music (${vid})`,
      artist: 'YouTube Video',
      duration: '04:00',
      thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`
    },
    priority
  )
  searchQuery.value = ''
}

function onDragStart(event, index) {
  draggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
}

function onDrop(event, targetIndex) {
  event.preventDefault()
  const fromIndex =
    draggedIndex.value !== null
      ? draggedIndex.value
      : Number(event.dataTransfer.getData('text/plain'))
  draggedIndex.value = null
  if (!Number.isNaN(fromIndex) && fromIndex !== targetIndex) {
    dispatchCmd('REORDER_QUEUE', { fromIndex, toIndex: targetIndex })
  }
}
</script>

<template>
  <div class="mobile-remote-shell" :class="{ 'is-drawer': isEmbeddedDrawer }">
    <!-- Top Remote Status Header -->
    <header class="remote-header">
      <div class="remote-top-row">
        <div class="remote-room-pill">
          <Radio :size="14" class="icon-live" />
          <span>ROOM:</span>
          <strong class="mono-text">{{ roomId }}</strong>
        </div>

        <div class="remote-header-right">
          <button
            v-if="hasEnteredName"
            type="button"
            class="guest-verified-pill"
            @click="handleEditName"
            title="คลิกเพื่อเปลี่ยนชื่อผู้ขอเพลง"
          >
            <User :size="12" />
            <span>{{ guestName }}</span>
            <Edit3 :size="11" class="edit-icon" />
          </button>

          <button
            v-if="isEmbeddedDrawer"
            type="button"
            class="remote-close-btn"
            @click="emit('close-drawer')"
            title="ปิดหน้ารีโมตจำลอง"
          >
            <X :size="16" />
          </button>
          <button
            v-else
            type="button"
            class="remote-switch-tv-btn"
            @click="emit('switch-to-host')"
            title="กลับไปหน้าจอหลัก 4:1"
          >
            <Tv :size="14" />
            <span>หน้าจอหลัก</span>
          </button>
        </div>
      </div>

      <!-- Mini Now Playing Banner (Visible after entering room) -->
      <div class="remote-now-playing" v-if="hasEnteredName && currentSong">
        <img :src="currentSong.thumbnail" :alt="currentSong.title" class="r-np-thumb" />
        <div class="r-np-info">
          <span class="r-np-badge">NOW PLAYING ON TV</span>
          <div class="r-np-title">{{ currentSong.title }}</div>
          <div class="r-np-artist">{{ currentSong.artist }}</div>
        </div>
        <div class="r-np-quick-btns">
          <button
            type="button"
            class="r-mini-ctrl"
            @click="dispatchCmd('TOGGLE_PLAY')"
          >
            <Pause v-if="isPlaying" :size="16" />
            <Play v-else :size="16" />
          </button>
          <button
            type="button"
            class="r-mini-ctrl"
            @click="dispatchCmd('SKIP')"
          >
            <SkipForward :size="16" />
          </button>
        </div>
      </div>
    </header>

    <!-- STEP 1: MANDATORY NAME ENTRY GATE BEFORE ACCESSING QUEUE -->
    <div v-if="!hasEnteredName" class="remote-name-gate">
      <div class="gate-card">
        <div class="gate-icon-circle">
          <Mic2 v-if="roomMusicMode === 'karaoke'" :size="28" />
          <Headphones v-else :size="28" />
        </div>

        <div class="gate-mode-tag">
          <span>
            {{
              roomMusicMode === 'karaoke'
                ? 'KARAOKE ROOM // โหมดคาราโอเกะ'
                : 'MUSIC LOUNGE // โหมดเพลงปกติ'
            }}
          </span>
        </div>

        <h2 class="gate-title">ยินดีต้อนรับสู่ห้อง {{ roomId }}</h2>
        <p class="gate-desc">
          กรุณากรอกชื่อเล่นหรือชื่อโต๊ะของคุณก่อนเข้าเลือกเพลง เพื่อให้หน้าจอหลักแสดงชื่อผู้ขอคิวเพลง
        </p>

        <form class="gate-form" @submit.prevent="handleConfirmGuestName">
          <div class="gate-input-wrap" :class="{ error: nameInputError }">
            <User :size="16" class="gate-user-icon" />
            <input
              v-model="guestName"
              type="text"
              class="gate-name-input"
              placeholder="กรอกชื่อของคุณ เช่น นนท์, โต๊ะ VIP..."
              maxlength="20"
              autofocus
              @input="nameInputError = false"
            />
          </div>
          <span v-if="nameInputError" class="gate-error-text">
            กรุณาระบุชื่อก่อนเข้าใช้งานระบบคิวเพลง
          </span>

          <button
            type="submit"
            class="gate-submit-btn"
            :disabled="!guestName.trim()"
          >
            <span>เข้าสู่ห้องและเลือกคิวเพลง</span>
            <ArrowRight :size="16" />
          </button>
        </form>
      </div>
    </div>

    <!-- STEP 2: MAIN REMOTE BODY (Accessible only after entering name) -->
    <template v-else>
      <main class="remote-body">
        <!-- TAB 1: SEARCH & ADD SONGS (LIVE YOUTUBE ONLY, NO MOCK SONGS) -->
        <div v-if="activeTab === 'search'" class="remote-tab-pane">
          <div class="r-room-mode-banner" :class="roomMusicMode">
            <Mic2 v-if="roomMusicMode === 'karaoke'" :size="14" />
            <Headphones v-else :size="14" />
            <span>
              โหมดห้องปัจจุบัน:
              <strong>
                {{
                  roomMusicMode === 'karaoke'
                    ? 'คาราโอเกะ (ตัดเสียงร้อง/ดนตรี)'
                    : 'เพลงปกติ (Official MV / Audio)'
                }}
              </strong>
            </span>
          </div>

          <div class="r-search-bar">
            <Search :size="15" class="r-search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="
                roomMusicMode === 'karaoke'
                  ? 'พิมพ์ชื่อเพลง/ศิลปิน เพื่อค้นหาคาราโอเกะ...'
                  : 'พิมพ์ชื่อเพลง/ศิลปิน เพื่อค้นหาเพลงปกติ...'
              "
              class="r-search-input"
            />
            <button v-if="searchQuery" type="button" class="r-clear-btn" @click="searchQuery = ''">
              <X :size="14" />
            </button>
          </div>

          <!-- Direct YouTube URL Card -->
          <div v-if="detectedVideoId" class="r-direct-url-box">
            <div class="r-direct-title">
              <Link2 :size="14" />
              <span>วิดีโอ YouTube ID: {{ detectedVideoId }}</span>
            </div>
            <div class="r-direct-btns">
              <button type="button" class="r-btn-primary" @click="handleAddDirectLink(false)">
                <Plus :size="14" />
                <span>ส่งเข้าคิว</span>
              </button>
              <button type="button" class="r-btn-accent" @click="handleAddDirectLink(true)">
                <ListStart :size="14" />
                <span>แทรกคิวแรก</span>
              </button>
            </div>
          </div>

          <!-- Live YouTube Results -->
          <template v-if="searchQuery.trim().length >= 2 && !detectedVideoId">
            <div class="r-section-header">
              <Sparkles :size="13" />
              <span>
                {{
                  roomMusicMode === 'karaoke'
                    ? 'ผลการค้นหา YouTube คาราโอเกะ'
                    : 'ผลการค้นหา YouTube เพลงปกติ'
                }}
              </span>
              <Loader2 v-if="isSearchingYouTube" :size="13" class="spin-icon" />
            </div>

            <div class="r-song-list">
              <div v-for="song in youtubeResults" :key="song.id" class="r-song-item">
                <img :src="song.thumbnail" :alt="song.title" class="r-song-thumb" />
                <div class="r-song-meta">
                  <div class="r-song-title">{{ song.title }}</div>
                  <div class="r-song-sub">{{ song.artist }} • {{ song.duration }}</div>
                </div>
                <div class="r-song-actions">
                  <button
                    type="button"
                    class="r-add-btn"
                    :class="{ done: addedFeedbackIds.has(song.id) }"
                    @click="handleRemoteAddSong(song, false)"
                  >
                    <Check v-if="addedFeedbackIds.has(song.id)" :size="14" />
                    <Plus v-else :size="14" />
                    <span>คิว</span>
                  </button>
                  <button
                    type="button"
                    class="r-priority-btn"
                    @click="handleRemoteAddSong(song, true)"
                    title="แทรกคิวแรก"
                  >
                    <ListStart :size="14" />
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="!isSearchingYouTube && youtubeResults.length === 0"
              class="r-empty-queue"
            >
              <Music :size="24" />
              <p>ไม่พบผลลัพธ์สำหรับ "{{ searchQuery }}"</p>
            </div>
          </template>

          <!-- Prompt to Search YouTube when Input is Empty -->
          <div v-else-if="!detectedVideoId" class="r-empty-queue">
            <Search :size="28" />
            <p>
              {{
                roomMusicMode === 'karaoke'
                  ? 'พิมพ์ชื่อเพลงหรือศิลปินในช่องด้านบนเพื่อค้นหาคาราโอเกะจาก YouTube'
                  : 'พิมพ์ชื่อเพลงหรือศิลปินในช่องด้านบนเพื่อค้นหาเพลงจาก YouTube'
              }}
            </p>
          </div>
        </div>

        <!-- TAB 2: LIVE QUEUE MANAGEMENT -->
        <div v-else-if="activeTab === 'queue'" class="remote-tab-pane">
          <div class="r-queue-header">
            <span>รายการคิวรอเล่น ({{ queue.length }} เพลง)</span>
            <span class="r-queue-sub" v-if="queue.length > 1">ลากหรือกดลูกศรเพื่อจัดลำดับ</span>
          </div>

          <div v-if="queue.length > 0" class="r-queue-list">
            <div
              v-for="(item, index) in queue"
              :key="item.queueId || `${item.id}-${index}`"
              class="r-queue-card"
              draggable="true"
              @dragstart="onDragStart($event, index)"
              @dragover.prevent
              @drop="onDrop($event, index)"
            >
              <div class="r-q-grip">
                <GripVertical :size="15" />
                <span class="mono-idx">{{ String(index + 1).padStart(2, '0') }}</span>
              </div>
              <img :src="item.thumbnail" :alt="item.title" class="r-q-thumb" />
              <div class="r-q-info">
                <div class="r-q-title">{{ item.title }}</div>
                <div class="r-q-sub">{{ item.artist }} • ขอโดย {{ item.requestedBy || 'Host' }}</div>
              </div>
              <div class="r-q-btns">
                <button
                  v-if="index > 0"
                  type="button"
                  class="r-q-icon-btn accent"
                  @click="dispatchCmd('MOVE_TO_TOP', { index })"
                  title="ดันขึ้นคิวแรก"
                >
                  <ArrowUpToLine :size="14" />
                </button>
                <button
                  v-if="index > 0"
                  type="button"
                  class="r-q-icon-btn"
                  @click="dispatchCmd('REORDER_QUEUE', { fromIndex: index, toIndex: index - 1 })"
                >
                  <ArrowUp :size="14" />
                </button>
                <button
                  v-if="index < queue.length - 1"
                  type="button"
                  class="r-q-icon-btn"
                  @click="dispatchCmd('REORDER_QUEUE', { fromIndex: index, toIndex: index + 1 })"
                >
                  <ArrowDown :size="14" />
                </button>
                <button
                  type="button"
                  class="r-q-icon-btn danger"
                  @click="dispatchCmd('REMOVE_QUEUE', { index })"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>

          <div v-else class="r-empty-queue">
            <ListMusic :size="28" />
            <p>ยังไม่มีเพลงในคิว</p>
            <button type="button" class="r-btn-primary" @click="activeTab = 'search'">
              <Plus :size="14" />
              <span>ค้นหาเพลงเพิ่มเข้าคิว</span>
            </button>
          </div>
        </div>

        <!-- TAB 3: STUDIO REMOTE CONTROL PAD -->
        <div v-else class="remote-tab-pane pad-pane">
          <div class="pad-card">
            <div class="pad-section-title">ควบคุมการเล่น (PLAYBACK CONTROL)</div>
            <div class="pad-transport-grid">
              <button type="button" class="pad-big-btn" @click="dispatchCmd('RESTART')">
                <RotateCcw :size="20" />
                <span>เริ่มเพลงใหม่</span>
              </button>

              <button
                type="button"
                class="pad-big-btn primary"
                @click="dispatchCmd('TOGGLE_PLAY')"
              >
                <Pause v-if="isPlaying" :size="24" />
                <Play v-else :size="24" />
                <span>{{ isPlaying ? 'หยุดชั่วคราว' : 'เล่นเพลง' }}</span>
              </button>

              <button type="button" class="pad-big-btn" @click="dispatchCmd('SKIP')">
                <SkipForward :size="20" />
                <span>ข้ามเพลง</span>
              </button>
            </div>
          </div>

          <div class="pad-card">
            <div class="pad-section-title">ระดับเสียง & คีย์เพลง (AUDIO & KEY PITCH)</div>

            <div class="pad-control-row">
              <button
                type="button"
                class="pad-step-btn"
                @click="dispatchCmd('SET_VOLUME', { volume: Math.max(0, volume - 10) })"
              >
                <Volume1 :size="18" />
                <span>ลดเสียง -10%</span>
              </button>

              <button
                type="button"
                class="pad-step-btn"
                :class="{ danger: isMuted }"
                @click="dispatchCmd('TOGGLE_MUTE')"
              >
                <VolumeX v-if="isMuted" :size="18" />
                <Volume2 v-else :size="18" />
                <span>{{ isMuted ? 'เปิดเสียง' : `เสียง ${volume}%` }}</span>
              </button>

              <button
                type="button"
                class="pad-step-btn"
                @click="dispatchCmd('SET_VOLUME', { volume: Math.min(100, volume + 10) })"
              >
                <Volume2 :size="18" />
                <span>เพิ่มเสียง +10%</span>
              </button>
            </div>

            <div class="pad-control-row mt-10">
              <button
                type="button"
                class="pad-step-btn"
                @click="dispatchCmd('SET_PITCH', { pitch: Math.max(-6, pitchSemitones - 1) })"
              >
                <span>ลดคีย์ (-1)</span>
              </button>
              <button
                type="button"
                class="pad-step-btn mono"
                @click="dispatchCmd('SET_PITCH', { pitch: 0 })"
              >
                <span>KEY: {{ pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones }}</span>
              </button>
              <button
                type="button"
                class="pad-step-btn"
                @click="dispatchCmd('SET_PITCH', { pitch: Math.min(6, pitchSemitones + 1) })"
              >
                <span>เพิ่มคีย์ (+1)</span>
              </button>
            </div>
          </div>

          <div class="pad-card">
            <div class="pad-section-title">ส่งเอฟเฟกต์ขึ้นจอหลัก (STAGE REACTIONS)</div>
            <div class="pad-reaction-grid">
              <button
                type="button"
                class="pad-react-btn"
                @click="
                  dispatchCmd('STAGE_EFFECT', {
                    effectType: 'applause',
                    label: 'STUDIO APPLAUSE // เสียงปรบมือรัว!'
                  })
                "
              >
                <Award :size="20" />
                <span>ปรบมือ</span>
              </button>

              <button
                type="button"
                class="pad-react-btn"
                @click="
                  dispatchCmd('STAGE_EFFECT', {
                    effectType: 'spotlight',
                    label: 'STAR SPOTLIGHT // นักร้องเสียงทอง!'
                  })
                "
              >
                <Sparkles :size="20" />
                <span>สปอตไลต์</span>
              </button>

              <button
                type="button"
                class="pad-react-btn"
                @click="
                  dispatchCmd('STAGE_EFFECT', {
                    effectType: 'hype',
                    label: 'STAGE ON FIRE // เวทีลุกเป็นไฟ!'
                  })
                "
              >
                <Flame :size="20" />
                <span>เวทีเดือด</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <!-- Bottom Mobile Navigation Bar -->
      <nav class="remote-bottom-nav">
        <button
          type="button"
          class="r-nav-item"
          :class="{ active: activeTab === 'search' }"
          @click="activeTab = 'search'"
        >
          <Search :size="18" />
          <span>เลือกเพลง</span>
        </button>

        <button
          type="button"
          class="r-nav-item"
          :class="{ active: activeTab === 'queue' }"
          @click="activeTab = 'queue'"
        >
          <div class="r-nav-icon-badge">
            <ListMusic :size="18" />
            <span v-if="queue.length > 0" class="r-badge">{{ queue.length }}</span>
          </div>
          <span>จัดคิวเพลง</span>
        </button>

        <button
          type="button"
          class="r-nav-item"
          :class="{ active: activeTab === 'pad' }"
          @click="activeTab = 'pad'"
        >
          <Sliders :size="18" />
          <span>รีโมตควบคุม</span>
        </button>
      </nav>
    </template>
  </div>
</template>
