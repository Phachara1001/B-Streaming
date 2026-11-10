<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import BrandLogo from './BrandLogo.vue'
import ThemeSwitcher from './ThemeSwitcher.vue'
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  History,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  QrCode,
  Smartphone,
  Radio,
  Music,
  Mic2,
  Sparkles,
  Award,
  Flame,
  Sliders,
  Tv,
  ChevronRight,
  Disc,
  CheckCircle2,
  Headphones,
  ListMusic,
  GripVertical,
  ArrowUpToLine,
  Trash2,
  User,
  Wifi
} from 'lucide-vue-next'

const props = defineProps({
  currentSong: {
    type: Object,
    default: null
  },
  nextSong: {
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
  roomName: {
    type: String,
    default: ''
  },
  roomId: {
    type: String,
    default: 'BS8899'
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
  },
  osdNotification: {
    type: Object,
    default: null
  },
  activeEffect: {
    type: Object,
    default: null
  },
  restartTrigger: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'toggle-play',
  'skip-song',
  'restart-song',
  'update-volume',
  'toggle-mute',
  'update-pitch',
  'update-room-music-mode',
  'reset-room-id',
  'open-history',
  'toggle-remote-drawer',
  'switch-to-remote-page',
  'song-ended',
  'time-update',
  'open-add-tab',
  'play-immediately',
  'move-to-top',
  'remove-from-queue',
  'reorder-queue',
  'trigger-effect'
])

const fsDraggedIndex = ref(null)

// Art-directed scattered positions for Cartoon Clapping Hands (U-shaped cheering arc around stage edges)
const CARTOON_CLAPPERS = [
  { id: 1, left: '4%', bottom: '6%', size: '112px', tilt: '-14deg', delay: '0s', speed: '0.26s' },
  { id: 2, left: '13%', bottom: '26%', size: '86px', tilt: '-8deg', delay: '0.09s', speed: '0.24s' },
  { id: 3, left: '24%', bottom: '5%', size: '98px', tilt: '-5deg', delay: '0.16s', speed: '0.28s' },
  { id: 4, left: '45%', bottom: '2%', size: '106px', tilt: '0deg', delay: '0.04s', speed: '0.25s' },
  { id: 5, left: '66%', bottom: '5%', size: '98px', tilt: '5deg', delay: '0.13s', speed: '0.27s' },
  { id: 6, left: '78%', bottom: '26%', size: '86px', tilt: '8deg', delay: '0.21s', speed: '0.24s' },
  { id: 7, left: '87%', bottom: '6%', size: '112px', tilt: '14deg', delay: '0.07s', speed: '0.26s' }
]

function onFsDragStart(event, index) {
  fsDraggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
}

function onFsDrop(event, targetIndex) {
  event.preventDefault()
  const fromIndex =
    fsDraggedIndex.value !== null
      ? fsDraggedIndex.value
      : Number(event.dataTransfer.getData('text/plain'))
  fsDraggedIndex.value = null
  if (!Number.isNaN(fromIndex) && fromIndex !== targetIndex) {
    emit('reorder-queue', { fromIndex, toIndex: targetIndex })
  }
}

const stageContainerRef = ref(null)
const isFullscreen = ref(false)
const stageMode = ref('youtube') // 'youtube' | 'lyric-studio'
const ytReady = ref(false)
const ytError = ref(false)
const currentTime = ref(0)
const duration = ref(240)

let ytPlayer = null
let progressTimer = null

function parseDurationString(str) {
  if (!str) return 220
  const parts = str.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 220
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const activeLyricIndex = computed(() => {
  const lyrics = props.currentSong?.lyrics
  if (!lyrics || !lyrics.length) return 0
  const loopTime = currentTime.value % 48
  let idx = 0
  for (let i = 0; i < lyrics.length; i++) {
    if (loopTime >= lyrics[i].time) {
      idx = i
    }
  }
  return idx
})

const progressPercent = computed(() => {
  if (!duration.value || duration.value <= 0) return 0
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})

function loadYouTubeApi() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT)
      return
    }
    const existing = document.getElementById('yt-iframe-api-script')
    if (!existing) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api-script'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
    const prevCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback()
      resolve(window.YT)
    }
    setTimeout(() => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT)
      } else {
        resolve(null)
      }
    }, 4500)
  })
}

async function initPlayer() {
  const YT = await loadYouTubeApi()
  if (!YT) {
    ytError.value = true
    stageMode.value = 'lyric-studio'
    return
  }

  const playerConfig = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: props.isPlaying ? 1 : 0,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      playsinline: 1
    },
    events: {
      onReady: () => {
        ytReady.value = true
        ytError.value = false
        syncVolumeToPlayer()
        if (props.currentSong?.videoId) {
          duration.value = parseDurationString(props.currentSong.duration)
          ytPlayer.loadVideoById(props.currentSong.videoId)
          if (!props.isPlaying) {
            ytPlayer.pauseVideo()
          }
        }
      },
      onStateChange: (event) => {
        if (event.data === 0) {
          emit('song-ended')
        } else if (event.data === 1) {
          const ytDur = ytPlayer.getDuration?.()
          if (ytDur && ytDur > 0) {
            duration.value = ytDur
          }
        }
      },
      onError: () => {
        ytError.value = true
        stageMode.value = 'lyric-studio'
      }
    }
  }

  if (props.currentSong?.videoId) {
    playerConfig.videoId = props.currentSong.videoId
  }

  ytPlayer = new YT.Player('yt-karaoke-player', playerConfig)
}

function syncVolumeToPlayer() {
  if (!ytPlayer || !ytReady.value) return
  try {
    if (props.isMuted) {
      ytPlayer.mute?.()
    } else {
      ytPlayer.unMute?.()
      ytPlayer.setVolume?.(props.volume)
    }
  } catch (_) { }
}

watch(
  () => props.currentSong,
  (newSong) => {
    currentTime.value = 0
    ytError.value = false
    if (!newSong) return
    duration.value = parseDurationString(newSong.duration)
    if (ytPlayer && ytReady.value && newSong.videoId) {
      try {
        ytPlayer.loadVideoById(newSong.videoId)
        if (!props.isPlaying) {
          ytPlayer.pauseVideo()
        }
      } catch (_) { }
    }
  }
)

watch(
  () => props.isPlaying,
  (playing) => {
    if (!ytPlayer || !ytReady.value || ytError.value || stageMode.value === 'lyric-studio') return
    try {
      const state = ytPlayer.getPlayerState?.()
      if (playing && state !== 1) {
        ytPlayer.playVideo?.()
      } else if (!playing && state === 1) {
        ytPlayer.pauseVideo?.()
      }
    } catch (_) { }
  }
)

watch(
  () => [props.volume, props.isMuted],
  () => {
    syncVolumeToPlayer()
  }
)

watch(
  () => props.restartTrigger,
  () => {
    currentTime.value = 0
    if (ytPlayer && ytReady.value) {
      try {
        ytPlayer.seekTo?.(0, true)
        if (props.isPlaying) ytPlayer.playVideo?.()
      } catch (_) { }
    }
  }
)

function handleSeek(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const targetSec = ratio * duration.value
  currentTime.value = targetSec
  if (ytPlayer && ytReady.value && stageMode.value === 'youtube' && !ytError.value) {
    try {
      ytPlayer.seekTo?.(targetSec, true)
    } catch (_) { }
  }
}

async function toggleFullscreen() {
  if (!stageContainerRef.value) return
  try {
    if (!document.fullscreenElement) {
      await stageContainerRef.value.requestFullscreen()
      isFullscreen.value = true
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch (_) { }
}

function handleFullscreenChange() {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

onMounted(() => {
  if (props.currentSong) {
    duration.value = parseDurationString(props.currentSong.duration)
  }
  initPlayer()
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  progressTimer = setInterval(() => {
    if (!props.currentSong) return
    if (
      ytPlayer &&
      ytReady.value &&
      stageMode.value === 'youtube' &&
      !ytError.value &&
      props.isPlaying
    ) {
      try {
        const t = ytPlayer.getCurrentTime?.()
        const d = ytPlayer.getDuration?.()
        if (typeof t === 'number' && t >= 0) {
          currentTime.value = t
        } else {
          currentTime.value += 1
        }
        if (typeof d === 'number' && d > 0) {
          duration.value = d
        }
      } catch (_) {
        currentTime.value += 1
      }
    } else if (props.isPlaying) {
      currentTime.value += 1
      if (currentTime.value >= duration.value) {
        emit('song-ended')
      }
    }
    emit('time-update', {
      currentTime: currentTime.value,
      duration: duration.value
    })
  }, 1000)
})

onBeforeUnmount(() => {
  if (progressTimer) clearInterval(progressTimer)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (ytPlayer && ytPlayer.destroy) {
    try {
      ytPlayer.destroy()
    } catch (_) { }
  }
})
</script>

<template>
  <section ref="stageContainerRef" class="stage-column">
    <!-- Top Studio Header Bar -->
    <header class="stage-topbar">
      <div class="brand-cluster">
        <div class="brand-logo-mark">
          <BrandLogo :size="52" />
        </div>
        <div class="brand-titles">
          <div class="brand-name-row">
            <span class="brand-title"><span class="brand-b">B</span><span class="brand-dash">-</span>Streaming</span>
            <span class="brand-pro-badge">LIVE</span>
          </div>
          <span class="brand-subtitle">{{ roomName || 'Stream. Sing. Share.' }}</span>
        </div>
      </div>

      <!-- Center Live Ticker -->
      <div class="stage-ticker">
        <div class="ticker-status" :class="{ active: isPlaying }">
          <span class="status-dot"></span>
          <span>{{ isPlaying ? 'ON AIR' : 'STANDBY' }}</span>
        </div>
        <div class="ticker-content" v-if="currentSong">
          <Music :size="14" class="ticker-icon" />
          <span class="ticker-song">{{ currentSong.title }}</span>
          <span class="ticker-divider">—</span>
          <span class="ticker-artist">{{ currentSong.artist }}</span>
        </div>
        <div class="ticker-content muted" v-else>
          <span>ยังไม่มีเพลงที่กำลังเล่น กรุณาเลือกเพลงจากรายการคิวด้านขวา</span>
        </div>
        <div class="ticker-next" v-if="nextSong">
          <span class="next-label">NEXT</span>
          <ChevronRight :size="13" />
          <span class="next-title">{{ nextSong.title }}</span>
        </div>
      </div>

      <!-- Right Studio & Remote Actions -->
      <div class="stage-actions">
        <!-- Host Room Mode Switcher: Karaoke vs Normal Music -->
        <div class="room-mode-pill" title="เลือกโหมดห้องสำหรับค้นหาเพลง (คาราโอเกะ หรือ เพลงปกติ)">
          <button type="button" class="room-mode-btn" :class="{ active: roomMusicMode === 'karaoke' }"
            @click="emit('update-room-music-mode', 'karaoke')">
            <Mic2 :size="14" />
            <span>โหมดคาราโอเกะ</span>
          </button>
          <button type="button" class="room-mode-btn" :class="{ active: roomMusicMode === 'music' }"
            @click="emit('update-room-music-mode', 'music')">
            <Headphones :size="14" />
            <span>โหมดเพลงปกติ</span>
          </button>
        </div>

        <div class="mode-switch-pill">
          <button type="button" class="mode-btn" :class="{ active: stageMode === 'youtube' }"
            @click="stageMode = 'youtube'" title="โหมดวิดีโอ YouTube">
            <Tv :size="14" />
            <span>YouTube</span>
          </button>
          <button type="button" class="mode-btn" :class="{ active: stageMode === 'lyric-studio' }"
            @click="stageMode = 'lyric-studio'" title="โหมดเนื้อเพลงสตูดิโอไฮไลต์">
            <Disc :size="14" />
            <span>Lyrics</span>
          </button>
        </div>

        <ThemeSwitcher />

        <button type="button" class="remote-sim-btn history-btn" @click="emit('open-history')"
          title="ดูประวัติเพลงของห้องนี้">
          <History :size="15" />
          <span>ประวัติ</span>
        </button>

        <button type="button" class="remote-sim-btn" @click="emit('toggle-remote-drawer')"
          title="เปิดรีโมตมือถือจำลองบนหน้าจอ">
          <Smartphone :size="15" />
          <span>Mobile Remote</span>
          <span class="remote-live-count" v-if="remoteCount > 0">{{ remoteCount }}</span>
        </button>

        <button type="button" class="room-static-badge clickable" @click="emit('reset-room-id')"
          title="ออกจากห้อง กลับไปหน้ารายการห้อง">
          <QrCode :size="14" />
          <span class="mono-code">{{ roomId }}</span>
          <RotateCcw :size="12" />
        </button>
      </div>
    </header>

    <!-- Main 16:9 Karaoke Viewport -->
    <div class="stage-viewport">
      <!-- YouTube IFrame Layer -->
      <div class="yt-stage-wrapper" v-show="currentSong && stageMode === 'youtube' && !ytError">
        <div id="yt-karaoke-player" class="yt-iframe-target"></div>
      </div>

      <!-- Studio Lyric Visualizer Stage -->
      <div class="lyric-studio-stage" v-if="currentSong && (stageMode === 'lyric-studio' || ytError)">
        <div class="lyric-backdrop" :style="{ backgroundImage: `url(${currentSong.thumbnail})` }"></div>
        <div class="lyric-backdrop-overlay"></div>

        <div class="lyric-stage-inner">
          <div class="lyric-meta-pill">
            <Disc :size="15" :class="{ 'spin-slow': isPlaying }" />
            <span>STUDIO KARAOKE TELEPROMPTER</span>
            <span v-if="ytError" class="embed-fallback-tag">
              Auto-Switched (Video Owner Restricted Embed)
            </span>
          </div>

          <h1 class="lyric-song-heading">{{ currentSong.title }}</h1>
          <p class="lyric-artist-sub">{{ currentSong.artist }}</p>

          <div class="studio-eq-bars" :class="{ playing: isPlaying }">
            <span v-for="n in 24" :key="n" class="eq-bar" :style="{ '--bar-idx': n }"></span>
          </div>

          <div class="teleprompter-box" v-if="currentSong.lyrics && currentSong.lyrics.length">
            <div v-for="(line, idx) in currentSong.lyrics" :key="idx" class="teleprompter-line" :class="{
              current: idx === activeLyricIndex,
              past: idx < activeLyricIndex,
              upcoming: idx > activeLyricIndex
            }">
              <span>{{ line.text }}</span>
            </div>
          </div>
          <div class="teleprompter-box generic" v-else>
            <div class="teleprompter-line current">
              <span>{{ currentSong.title }} — {{ currentSong.artist }}</span>
            </div>
            <div class="teleprompter-line upcoming">
              <span>Instrumental Karaoke Backing Track Playing</span>
            </div>
          </div>

          <div class="lyric-switch-back" v-if="ytError">
            <a :href="`https://www.youtube.com/watch?v=${currentSong.videoId}`" target="_blank"
              rel="noopener noreferrer" class="yt-direct-link">
              <Tv :size="14" />
              <span>เปิดวิดีโอต้นฉบับบน YouTube</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Empty Queue Idle State -->
      <div class="stage-idle-state" v-if="!currentSong">
        <div class="idle-glow"></div>
        <div class="idle-card">
          <div class="idle-icon-ring">
            <Mic2 :size="36" />
          </div>
          <h2>พร้อมเริ่ม</h2>
          <p>
            เลือกเพลงจากแถบจัดการคิวด้านขวา หรือสแกน QR Code
            บนหน้าจอเพื่อใช้มือถือเป็นรีโมตค้นหาและส่งเพลงขึ้นจอได้ทันที
          </p>
          <div class="idle-actions">
            <button type="button" class="btn-primary-studio" @click="emit('open-add-tab')">
              <Music :size="16" />
              <span>เลือกเพลงเข้าคิว</span>
            </button>
          </div>
        </div>
      </div>

      <!-- On-Screen Display (OSD) Remote Action Toast -->
      <transition name="osd-pop">
        <div class="stage-osd-toast" v-if="osdNotification" :key="osdNotification.id">
          <div class="osd-icon-wrap">
            <CheckCircle2 v-if="osdNotification.type === 'queue'" :size="18" />
            <Sparkles v-else-if="osdNotification.type === 'effect'" :size="18" />
            <Smartphone v-else :size="18" />
          </div>
          <div class="osd-text-group">
            <span class="osd-sender">{{ osdNotification.sender }}</span>
            <span class="osd-message">{{ osdNotification.message }}</span>
          </div>
        </div>
      </transition>

      <!-- FULL-SCREEN EXTRAVAGANT CONCERT STAGE FX ARENA -->
      <transition name="effect-burst">
        <div
          v-if="activeEffect"
          :key="activeEffect.id"
          class="stage-fx-arena"
          :class="`fx-mode-${activeEffect.effectType}`"
        >
          <!-- 1. APPLAUSE FX: CARTOON CLAPPING HANDS CROWD, COMIC IMPACT BURSTS & 3D CONFETTI -->
          <template v-if="activeEffect.effectType === 'applause'">
            <div class="fx-applause-aura"></div>
            <div class="fx-shockwave-ring ring-1"></div>
            <div class="fx-shockwave-ring ring-2"></div>
            <div class="fx-shockwave-ring ring-3"></div>

            <div class="fx-confetti-layer">
              <span
                v-for="n in 32"
                :key="`conf-${n}`"
                class="fx-confetti-piece"
                :style="{
                  left: `${(n * 3.1) - 1}%`,
                  animationDelay: `${(n % 8) * 0.14}s`,
                  '--drift': `${((n % 5) - 2) * 45}px`
                }"
              ></span>
            </div>

            <!-- ART-DIRECTED SCATTERED CARTOON CLAPPING HANDS AROUND STAGE EDGES -->
            <div class="fx-cartoon-clappers-layer">
              <div
                v-for="item in CARTOON_CLAPPERS"
                :key="`clapper-${item.id}`"
                class="fx-cartoon-clapper"
                :style="{
                  left: item.left,
                  bottom: item.bottom,
                  width: item.size,
                  height: item.size,
                  '--tilt': item.tilt,
                  '--clap-delay': item.delay,
                  '--clap-speed': item.speed
                }"
              >
                <svg
                  viewBox="0 0 220 200"
                  class="cartoon-clap-svg"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient :id="`handLeftGrad-${item.id}`" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#FFE082" />
                      <stop offset="100%" stop-color="#FFA000" />
                    </linearGradient>
                    <linearGradient :id="`handRightGrad-${item.id}`" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#FFF59D" />
                      <stop offset="100%" stop-color="#FFC107" />
                    </linearGradient>
                  </defs>

                  <!-- Comic Clap Impact Starburst & Sound Waves (Flashes at top-center when hands hit!) -->
                  <g class="clap-impact-burst">
                    <path
                      d="M 65,28 Q 110,4 155,28"
                      fill="none"
                      stroke="#22D3EE"
                      stroke-width="4.5"
                      stroke-linecap="round"
                    />
                    <path
                      d="M 50,16 Q 110,-12 170,16"
                      fill="none"
                      stroke="#F472B6"
                      stroke-width="3.5"
                      stroke-linecap="round"
                    />
                    <polygon
                      points="110,18 122,44 150,28 134,56 164,64 136,80 150,104 122,94 110,120 98,94 70,104 84,80 56,64 86,56 70,28 98,44"
                      fill="#FFF176"
                      stroke="#F59E0B"
                      stroke-width="4"
                      stroke-linejoin="round"
                    />
                  </g>

                  <!-- LEFT CARTOON HAND (Angled on the left side, swings in to clap) -->
                  <g class="cartoon-hand-left">
                    <g transform="translate(-16, 8) rotate(-18 80 130)">
                      <rect
                        x="34"
                        y="142"
                        width="44"
                        height="22"
                        rx="8"
                        fill="#6366F1"
                        stroke="#1E1B4B"
                        stroke-width="5"
                      />
                      <path
                        d="M42,144 C30,124 28,98 32,76 C34,64 44,62 47,74 L50,92
                           C49,68 52,48 60,46 C68,44 72,60 70,84
                           C72,60 78,44 86,46 C94,48 94,66 89,88
                           C92,68 99,54 106,58 C112,62 109,82 101,102
                           L110,90 C118,80 128,86 122,100 C114,120 98,136 80,146 Z"
                        :fill="`url(#handLeftGrad-${item.id})`"
                        stroke="#1E1B4B"
                        stroke-width="5"
                        stroke-linejoin="round"
                        stroke-linecap="round"
                      />
                      <path
                        d="M58,110 Q76,104 88,118"
                        fill="none"
                        stroke="#B45309"
                        stroke-width="3.5"
                        stroke-linecap="round"
                      />
                    </g>
                  </g>

                  <!-- RIGHT CARTOON HAND (Angled on the right side, swings in to clap) -->
                  <g class="cartoon-hand-right">
                    <g transform="translate(16, 8) rotate(18 140 130)">
                      <rect
                        x="142"
                        y="142"
                        width="44"
                        height="22"
                        rx="8"
                        fill="#06B6D4"
                        stroke="#1E1B4B"
                        stroke-width="5"
                      />
                      <path
                        d="M178,144 C190,124 192,98 188,76 C186,64 176,62 173,74 L170,92
                           C171,68 168,48 160,46 C152,44 148,60 150,84
                           C148,60 142,44 134,46 C126,48 126,66 131,88
                           C128,68 121,54 114,58 C108,62 111,82 119,102
                           L110,90 C102,80 92,86 98,100 C106,120 122,136 140,146 Z"
                        :fill="`url(#handRightGrad-${item.id})`"
                        stroke="#1E1B4B"
                        stroke-width="5"
                        stroke-linejoin="round"
                        stroke-linecap="round"
                      />
                      <path
                        d="M162,110 Q144,104 132,118"
                        fill="none"
                        stroke="#B45309"
                        stroke-width="3.5"
                        stroke-linecap="round"
                      />
                    </g>
                  </g>
                </svg>
                <span class="comic-clap-tag">CLAP!</span>
              </div>
            </div>
          </template>

          <!-- 2. SPOTLIGHT FX: 6 VOLUMETRIC SWEEPING CONCERT BEAMS, 8 LASERS & FLOOR HALO -->
          <template v-else-if="activeEffect.effectType === 'spotlight'">
            <div class="fx-spotlight-rig">
              <div class="fx-spotlight-beam beam-1"></div>
              <div class="fx-spotlight-beam beam-2"></div>
              <div class="fx-spotlight-beam beam-3"></div>
              <div class="fx-spotlight-beam beam-4"></div>
              <div class="fx-spotlight-beam beam-5"></div>
              <div class="fx-spotlight-beam beam-6"></div>
            </div>

            <div class="fx-laser-grid">
              <span
                v-for="n in 8"
                :key="`laser-${n}`"
                class="fx-laser-beam"
                :style="{
                  left: `${n * 11}%`,
                  animationDelay: `${n * 0.12}s`
                }"
              ></span>
            </div>

            <div class="fx-stage-floor-halo"></div>

            <div class="fx-starburst-field">
              <div
                v-for="n in 12"
                :key="`star-${n}`"
                class="fx-starburst-node"
                :style="{
                  top: `${14 + ((n * 19) % 66)}%`,
                  left: `${8 + ((n * 23) % 84)}%`,
                  animationDelay: `${n * 0.11}s`
                }"
              >
                <Sparkles :size="28" />
              </div>
            </div>
          </template>

          <!-- 3. HYPE / FIRE FX: ROARING PYRO FLAME PILLARS, FIRE WALL, 40 RISING EMBERS & HEAT PULSE -->
          <template v-else>
            <div class="fx-inferno-vignette"></div>

            <div class="fx-fire-wall-bottom">
              <div class="fx-fire-glow-base"></div>
              <div
                v-for="n in 10"
                :key="`pyro-${n}`"
                class="fx-pyro-pillar"
                :style="{
                  height: `${52 + ((n % 3) * 14)}%`,
                  animationDelay: `${(n % 4) * 0.08}s`
                }"
              >
                <div class="pyro-core"></div>
                <div class="pyro-outer"></div>
              </div>
            </div>

            <div class="fx-ember-storm">
              <span
                v-for="n in 36"
                :key="`ember-${n}`"
                class="fx-ember-spark"
                :style="{
                  left: `${(n * 2.7) - 1}%`,
                  width: `${6 + (n % 4) * 2}px`,
                  height: `${6 + (n % 4) * 2}px`,
                  animationDelay: `${(n % 9) * 0.14}s`,
                  '--ember-drift': `${((n % 5) - 2) * 40}px`
                }"
              ></span>
            </div>

            <div class="fx-floating-flames">
              <div
                v-for="n in 8"
                :key="`flame-icon-${n}`"
                class="fx-flame-surge"
                :style="{
                  left: `${(n * 11.5) - 2}%`,
                  animationDelay: `${n * 0.16}s`
                }"
              >
                <Flame :size="38" />
              </div>
            </div>
          </template>

          <!-- CENTER-TOP DRAMATIC NEON BANNER -->
          <div class="stage-effect-banner" :class="`banner-${activeEffect.effectType}`">
            <div class="effect-icon-circle">
              <Award v-if="activeEffect.effectType === 'applause'" :size="30" />
              <Sparkles v-else-if="activeEffect.effectType === 'spotlight'" :size="30" />
              <Flame v-else :size="30" />
            </div>
            <div class="effect-copy">
              <span class="effect-title">{{ activeEffect.label }}</span>
              <span class="effect-sub">TRIGGERED BY {{ activeEffect.sender }}</span>
            </div>
          </div>
        </div>
      </transition>

      <!-- FULLSCREEN RIGHT PANEL (SIDE-BY-SIDE COLUMN, DOES NOT COVER VIDEO) -->
      <aside class="fs-right-queue-dock" v-if="isFullscreen">
        <!-- Large QR Code Box at Top of Right Panel -->
        <div class="fs-qr-card" v-if="qrDataUrl">
          <div class="fs-qr-img-box">
            <img :src="qrDataUrl" alt="Room QR Code" class="fs-qr-img" />
          </div>
          <div class="fs-qr-meta">
            <div class="fs-qr-badge">
              <QrCode :size="13" />
              <span>MOBILE REMOTE</span>
            </div>
            <div class="fs-qr-room mono-code">{{ roomId }}</div>
            <p class="fs-qr-hint">สแกนเพื่อค้นหาและเพิ่มคิวเพลง</p>
            <div class="fs-qr-online">
              <Wifi :size="12" />
              <span>เชื่อมต่อแล้ว {{ remoteCount }} เครื่อง</span>
            </div>
          </div>
        </div>

        <!-- Live Queue List in Fullscreen Right Panel -->
        <div class="fs-queue-section">
          <div class="fs-queue-header">
            <div class="fs-queue-title">
              <ListMusic :size="16" class="icon-accent" />
              <span>UP NEXT</span>
              <span class="fs-count-chip">{{ queue.length }}</span>
            </div>
            <span class="fs-drag-hint" v-if="queue.length > 1">ลากสลับคิวได้</span>
          </div>

          <!-- Currently Playing Card inside Fullscreen Queue -->
          <div class="fs-now-playing" v-if="currentSong">
            <div class="fs-np-art" :style="{ backgroundImage: `url(${currentSong.thumbnail})` }"></div>
            <div class="fs-np-body">
              <span class="fs-np-tag">
                <span class="fs-np-eq"><i></i><i></i><i></i><i></i></span>
                NOW PLAYING
              </span>
              <div class="fs-np-title">{{ currentSong.title }}</div>
              <div class="fs-np-sub">
                {{ currentSong.artist }}
                <span class="fs-np-by">โดย {{ currentSong.requestedBy || 'Host' }}</span>
              </div>
            </div>
          </div>

          <div class="fs-queue-list" v-if="queue.length > 0">
            <div
              v-for="(item, index) in queue"
              :key="item.queueId || `${item.id}-${index}`"
              class="fs-queue-item"
              :class="{ 'is-next': index === 0 }"
              draggable="true"
              @dragstart="onFsDragStart($event, index)"
              @dragover.prevent
              @drop="onFsDrop($event, index)"
            >
              <div class="fs-q-grip">
                <GripVertical :size="14" />
                <span class="fs-q-num">{{ index + 1 }}</span>
              </div>
              <div class="fs-q-thumb-wrap" @click="emit('play-immediately', index)" title="คลิกเพื่อเล่นเพลงนี้ทันที">
                <img :src="item.thumbnail" :alt="item.title" class="fs-q-thumb" />
                <span class="fs-q-next-tag" v-if="index === 0">NEXT</span>
              </div>
              <div class="fs-q-info">
                <div class="fs-q-song" :title="item.title">{{ item.title }}</div>
                <div class="fs-q-meta">
                  <span class="fs-q-artist">{{ item.artist }}</span>
                  <span class="fs-q-user">
                    <User :size="10" />
                    {{ item.requestedBy || 'Host' }}
                  </span>
                </div>
              </div>
              <div class="fs-q-actions">
                <button
                  v-if="index > 0"
                  type="button"
                  class="fs-q-btn"
                  @click="emit('move-to-top', index)"
                  title="ดันขึ้นคิวแรก"
                >
                  <ArrowUpToLine :size="13" />
                </button>
                <button
                  type="button"
                  class="fs-q-btn danger"
                  @click="emit('remove-from-queue', index)"
                  title="ลบออกจากคิว"
                >
                  <Trash2 :size="13" />
                </button>
              </div>
            </div>
          </div>

          <div class="fs-queue-empty" v-else>
            <ListMusic :size="24" />
            <p>ยังไม่มีเพลงในคิวถัดไป</p>
            <span>สแกน QR Code ด้านบนเพื่อส่งเพลงเข้าคิว</span>
          </div>
        </div>
      </aside>
    </div>

    <!-- Bottom Studio Transport Deck -->
    <footer class="stage-transport-deck">
      <div class="deck-track-info">
        <template v-if="currentSong">
          <img :src="currentSong.thumbnail" :alt="currentSong.title" class="deck-thumb" />
          <div class="deck-meta">
            <div class="deck-title" :title="currentSong.title">{{ currentSong.title }}</div>
            <div class="deck-sub">
              <span>{{ currentSong.artist }}</span>
              <span class="meta-dot">•</span>
              <span class="requester-tag">โดย {{ currentSong.requestedBy || 'Host' }}</span>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="deck-thumb placeholder">
            <Music :size="18" />
          </div>
          <div class="deck-meta">
            <div class="deck-title">Waiting for Queue</div>
            <div class="deck-sub">Select a song to start playback</div>
          </div>
        </template>
      </div>

      <div class="deck-center-controls">
        <div class="transport-buttons">
          <button type="button" class="ctrl-icon-btn" :disabled="!currentSong" @click="emit('restart-song')"
            title="เริ่มเพลงนี้ใหม่ (Restart)">
            <RotateCcw :size="17" />
          </button>

          <button type="button" class="ctrl-play-btn" :disabled="!currentSong" @click="emit('toggle-play')"
            :title="isPlaying ? 'หยุดชั่วคราว (Pause)' : 'เล่นต่อ (Play)'">
            <Pause v-if="isPlaying" :size="20" />
            <Play v-else :size="20" />
          </button>

          <button type="button" class="ctrl-icon-btn" :disabled="!currentSong && !nextSong" @click="emit('skip-song')"
            title="ข้ามไปเพลงถัดไป (Skip Next)">
            <SkipForward :size="18" />
          </button>
        </div>

        <div class="timeline-row">
          <span class="time-mono">{{ formatTime(currentTime) }}</span>
          <div class="timeline-bar-track" @click="handleSeek">
            <div class="timeline-bar-fill" :style="{ width: `${progressPercent}%` }"></div>
            <div class="timeline-thumb" :style="{ left: `${progressPercent}%` }"></div>
          </div>
          <span class="time-mono">{{ formatTime(duration) }}</span>
        </div>
      </div>

      <div class="deck-right-console">
        <!-- Quick Stage FX Trigger Pad on Host Console -->
        <div class="deck-fx-triggers">
          <button
            type="button"
            class="deck-fx-btn gold"
            @click="
              emit('trigger-effect', {
                effectType: 'applause',
                label: 'GOLDEN OVATION // เสียงปรบมือรัว!'
              })
            "
            title="ยิงเอฟเฟกต์เสียงปรบมือ & พลุทองคำ"
          >
            <Award :size="15" />
          </button>
          <button
            type="button"
            class="deck-fx-btn cyan"
            @click="
              emit('trigger-effect', {
                effectType: 'spotlight',
                label: 'ARENA SPOTLIGHT // นักร้องเสียงทอง!'
              })
            "
            title="ยิงเอฟเฟกต์ไฟสปอตไลต์คอนเสิร์ต & เลเซอร์"
          >
            <Sparkles :size="15" />
          </button>
          <button
            type="button"
            class="deck-fx-btn fire"
            @click="
              emit('trigger-effect', {
                effectType: 'hype',
                label: 'STAGE INFERNO // เวทีลุกเป็นไฟ!'
              })
            "
            title="ยิงเอฟเฟกต์ไฟพ่นหน้าเวที"
          >
            <Flame :size="15" />
          </button>
        </div>

        <div class="pitch-control-box" title="ปรับคีย์เพลง (Key Transpose)">
          <Sliders :size="14" class="console-icon" />
          <span class="pitch-label">KEY</span>
          <button type="button" class="pitch-step-btn" @click="emit('update-pitch', Math.max(-6, pitchSemitones - 1))">
            -
          </button>
          <span class="pitch-val-mono" @click="emit('update-pitch', 0)" title="คลิกเพื่อรีเซ็ตคีย์ปกติ">
            {{ pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones }}
          </span>
          <button type="button" class="pitch-step-btn" @click="emit('update-pitch', Math.min(6, pitchSemitones + 1))">
            +
          </button>
        </div>

        <div class="volume-control-box">
          <button type="button" class="ctrl-icon-btn sm" @click="emit('toggle-mute')"
            :title="isMuted ? 'เปิดเสียง' : 'ปิดเสียง'">
            <VolumeX v-if="isMuted || volume === 0" :size="17" class="text-danger" />
            <Volume2 v-else :size="17" />
          </button>
          <input type="range" min="0" max="100" :value="isMuted ? 0 : volume"
            @input="emit('update-volume', Number($event.target.value))" class="volume-slider" />
          <span class="vol-mono">{{ isMuted ? 'MUTE' : `${volume}%` }}</span>
        </div>

        <button type="button" class="ctrl-icon-btn sm" @click="toggleFullscreen"
          :title="isFullscreen ? 'ออกจากเต็มจอ' : 'ขยายเต็มจอ'">
          <Minimize2 v-if="isFullscreen" :size="17" />
          <Maximize2 v-else :size="17" />
        </button>
      </div>
    </footer>
  </section>
</template>
