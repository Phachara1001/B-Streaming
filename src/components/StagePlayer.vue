<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
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
  'toggle-remote-drawer',
  'switch-to-remote-page',
  'song-ended',
  'time-update',
  'open-add-tab',
  'play-immediately',
  'move-to-top',
  'remove-from-queue',
  'reorder-queue'
])

const fsDraggedIndex = ref(null)

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
          <Radio :size="18" class="icon-accent" />
        </div>
        <div class="brand-titles">
          <div class="brand-name-row">
            <span class="brand-title">AURA KTV</span>
            <span class="brand-pro-badge">STUDIO 4:1</span>
          </div>
          <span class="brand-subtitle">Professional YouTube Karaoke System</span>
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

        <button type="button" class="remote-sim-btn" @click="emit('toggle-remote-drawer')"
          title="เปิดรีโมตมือถือจำลองบนหน้าจอ">
          <Smartphone :size="15" />
          <span>Mobile Remote</span>
          <span class="remote-live-count" v-if="remoteCount > 0">{{ remoteCount }}</span>
        </button>

        <button type="button" class="room-static-badge clickable" @click="emit('reset-room-id')"
          title="รหัสห้องจะสุ่มใหม่ทุกครั้งที่รีเฟรช หรือคลิกที่นี่เพื่อสุ่มรหัสห้องใหม่ทันที">
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

      <!-- Studio Visual Trigger Overlay -->
      <transition name="effect-burst">
        <div class="stage-effect-banner" v-if="activeEffect" :key="activeEffect.id">
          <div class="effect-icon-circle">
            <Award v-if="activeEffect.effectType === 'applause'" :size="28" />
            <Sparkles v-else-if="activeEffect.effectType === 'spotlight'" :size="28" />
            <Flame v-else :size="28" />
          </div>
          <div class="effect-copy">
            <span class="effect-title">{{ activeEffect.label }}</span>
            <span class="effect-sub">ส่งจาก {{ activeEffect.sender }}</span>
          </div>
        </div>
      </transition>

      <!-- Up Next Floating Corner Preview (Bottom Left) -->
      <div class="stage-upnext-Hud" v-if="currentSong && nextSong && !isFullscreen">
        <div class="hud-label">
          <span>UP NEXT IN QUEUE</span>
        </div>
        <div class="hud-song">
          <span class="hud-title">{{ nextSong.title }}</span>
          <span class="hud-artist">{{ nextSong.artist }}</span>
        </div>
      </div>

      <!-- Always-Visible Corner QR Code HUD on Stage (Normal View) -->
      <div class="stage-qr-hud" v-if="qrDataUrl && !isFullscreen">
        <img :src="qrDataUrl" alt="Scan Remote QR" class="stage-qr-img" />
        <div class="stage-qr-text">
          <span class="stage-qr-label">SCAN REMOTE</span>
          <strong class="stage-qr-room">{{ roomId }}</strong>
          <span class="stage-qr-sub">สแกนเพิ่มคิวเพลง</span>
        </div>
      </div>

      <!-- FULLSCREEN RIGHT PANEL: LARGE QR CODE + LIVE QUEUE LIST -->
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
              <ListMusic :size="15" class="icon-accent" />
              <span>คิวเพลงถัดไป ({{ queue.length }})</span>
            </div>
            <span class="fs-drag-hint" v-if="queue.length > 1">ลากสลับคิวได้</span>
          </div>

          <!-- Currently Playing Mini Banner inside Fullscreen Queue -->
          <div class="fs-now-playing" v-if="currentSong">
            <span class="fs-np-tag">กำลังเล่น</span>
            <div class="fs-np-title">{{ currentSong.title }}</div>
            <div class="fs-np-sub">
              {{ currentSong.artist }} • โดย {{ currentSong.requestedBy || 'Host' }}
            </div>
          </div>

          <div class="fs-queue-list" v-if="queue.length > 0">
            <div
              v-for="(item, index) in queue"
              :key="item.queueId || `${item.id}-${index}`"
              class="fs-queue-item"
              draggable="true"
              @dragstart="onFsDragStart($event, index)"
              @dragover.prevent
              @drop="onFsDrop($event, index)"
            >
              <div class="fs-q-grip">
                <GripVertical :size="14" />
                <span class="fs-q-num">{{ String(index + 1).padStart(2, '0') }}</span>
              </div>
              <img
                :src="item.thumbnail"
                :alt="item.title"
                class="fs-q-thumb"
                @click="emit('play-immediately', index)"
                title="คลิกเพื่อเล่นเพลงนี้ทันที"
              />
              <div class="fs-q-info">
                <div class="fs-q-song" :title="item.title">{{ item.title }}</div>
                <div class="fs-q-meta">
                  <span>{{ item.artist }}</span>
                  <span>•</span>
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
