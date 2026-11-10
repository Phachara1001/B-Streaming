<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import QRCode from 'qrcode'
import StagePlayer from './components/StagePlayer.vue'
import QueueSidebar from './components/QueueSidebar.vue'
import MobileRemoteView from './components/MobileRemoteView.vue'
import HistoryModal from './components/HistoryModal.vue'
import { createRoomSync } from './services/syncService.js'
import { loadRoomState, logHistory, getRoom } from './services/roomService.js'

const props = defineProps({
  roomCode: { type: String, required: true },
  roomName: { type: String, default: '' },
  mode: { type: String, default: 'host' } // 'host' | 'remote'
})
const emit = defineEmits(['leave'])

const viewMode = ref(props.mode === 'remote' ? 'remote' : 'host') // 'host' | 'remote'
const roomId = ref(props.roomCode)
const showHistory = ref(false)
const historyVersion = ref(0)
const remoteCount = ref(0)

// Host Room Mode: 'karaoke' (คาราโอเกะ) | 'music' (เพลงปกติ / ฟังเพลง)
const roomMusicMode = ref('karaoke')
const syncStatus = ref('connecting')

// Always-visible QR Code Data
const qrDataUrl = ref('')
const remoteUrl = ref('')

async function generateRoomQrCode() {
  let hostPart = window.location.host
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

  if (isLocalhost) {
    try {
      const res = await fetch('/api/network')
      if (res.ok) {
        const info = await res.json()
        const port = window.location.port || '5173'
        if (info.ip && info.ip !== 'localhost') {
          hostPart = `${info.ip}:${port}`
        }
      }
    } catch (_) {}
  }

  const protocol = window.location.protocol || 'http:'
  const url = `${protocol}//${hostPart}/?mode=remote&room=${encodeURIComponent(roomId.value)}`
  remoteUrl.value = url

  try {
    qrDataUrl.value = await QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: {
        dark: '#08090D',
        light: '#FFFFFF'
      }
    })
  } catch (_) {}
}

// Karaoke Playback & Queue State (Starts completely empty with no mock songs)
const currentSong = ref(null)
const queue = ref([])

const isPlaying = ref(false)
const volume = ref(80)
const isMuted = ref(false)
const pitchSemitones = ref(0)
const autoAdvance = ref(true)
const sidebarTab = ref('queue') // 'queue' | 'add'
const restartTrigger = ref(0)

// Floating Mobile Remote Simulator Drawer
const showRemoteDrawer = ref(false)

// On-screen notifications & effects
const osdNotification = ref(null)
const activeEffect = ref(null)
let osdTimer = null
let effectTimer = null

const nextSong = computed(() => (queue.value.length > 0 ? queue.value[0] : null))

function triggerOsd(message, sender = 'System', type = 'info') {
  if (osdTimer) clearTimeout(osdTimer)
  osdNotification.value = {
    id: Date.now() + Math.random(),
    message,
    sender,
    type
  }
  osdTimer = setTimeout(() => {
    osdNotification.value = null
  }, 3200)
}

function triggerStageEffect(effectType, label, sender = 'Mobile Remote') {
  if (effectTimer) clearTimeout(effectTimer)
  activeEffect.value = {
    id: Date.now() + Math.random(),
    effectType,
    label,
    sender
  }
  effectTimer = setTimeout(() => {
    activeEffect.value = null
  }, 5000)
}

function leaveRoom() {
  emit('leave')
}

function setRoomMusicMode(mode, sender = 'Host') {
  if (mode !== 'karaoke' && mode !== 'music') return
  roomMusicMode.value = mode
  const modeLabel = mode === 'karaoke' ? 'โหมดคาราโอเกะ (Karaoke)' : 'โหมดเพลงปกติ (Original MV)'
  triggerOsd(`สลับโหมดห้องเป็น: ${modeLabel}`, sender, 'info')
  broadcastHostState()
}

let restoringState = false

function recordHistory(song, event) {
  if (viewMode.value !== 'host' || !song) return
  logHistory(roomId.value, song, event)
    .catch(() => {})
    .finally(() => {
      historyVersion.value += 1
    })
}

function makeQueueEntry(song, requester) {
  return {
    ...song,
    queueId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    requestedBy: requester || song.requestedBy || 'Host'
  }
}

// Queue & Transport Actions
function addToQueue(song, sender = 'Host') {
  const entry = makeQueueEntry(song, sender)
  recordHistory(entry, 'queued')
  if (!currentSong.value) {
    currentSong.value = entry
    isPlaying.value = true
  } else {
    queue.value.push(entry)
  }
  triggerOsd(`เพิ่มเพลง "${song.title}" เข้าสู่คิว (#${queue.value.length})`, sender, 'queue')
  broadcastHostState()
}

function playNext(song, sender = 'Host') {
  const entry = makeQueueEntry(song, sender)
  recordHistory(entry, 'queued')
  if (!currentSong.value) {
    currentSong.value = entry
    isPlaying.value = true
  } else {
    queue.value.unshift(entry)
  }
  triggerOsd(`แทรกคิวถัดไป "${song.title}"`, sender, 'queue')
  broadcastHostState()
}

function playImmediately(index) {
  if (index < 0 || index >= queue.value.length) return
  const [selected] = queue.value.splice(index, 1)
  currentSong.value = selected
  isPlaying.value = true
  triggerOsd(`เริ่มเล่น "${selected.title}"`, selected.requestedBy || 'Host', 'info')
  broadcastHostState()
}

function removeFromQueue(index, sender = 'Host') {
  if (index < 0 || index >= queue.value.length) return
  const [removed] = queue.value.splice(index, 1)
  if (removed) {
    triggerOsd(`ลบ "${removed.title}" ออกจากคิว`, sender, 'info')
  }
  broadcastHostState()
}

function moveToTop(index, sender = 'Host') {
  if (index <= 0 || index >= queue.value.length) return
  const [item] = queue.value.splice(index, 1)
  queue.value.unshift(item)
  triggerOsd(`ดัน "${item.title}" ขึ้นเป็นคิวแรก`, sender, 'queue')
  broadcastHostState()
}

function reorderQueue({ fromIndex, toIndex }, sender = 'Host') {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= queue.value.length ||
    toIndex >= queue.value.length ||
    fromIndex === toIndex
  ) {
    return
  }
  const updated = [...queue.value]
  const [moved] = updated.splice(fromIndex, 1)
  updated.splice(toIndex, 0, moved)
  queue.value = updated
  triggerOsd(`สลับลำดับคิว "${moved.title}" ไปลำดับที่ ${toIndex + 1}`, sender, 'queue')
  broadcastHostState()
}

function shuffleQueue() {
  if (queue.value.length <= 1) return
  const copy = [...queue.value]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  queue.value = copy
  triggerOsd('สุ่มลำดับคิวเพลงเรียบร้อยแล้ว', 'Host', 'queue')
  broadcastHostState()
}

function clearQueue() {
  queue.value = []
  triggerOsd('ล้างรายการคิวเพลงทั้งหมดแล้ว', 'Host', 'info')
  broadcastHostState()
}

function skipSong(sender = 'Host') {
  if (currentSong.value && sender !== 'Auto-Queue') recordHistory(currentSong.value, 'skipped')
  if (queue.value.length > 0) {
    const next = queue.value.shift()
    currentSong.value = next
    isPlaying.value = true
    triggerOsd(`ข้ามไปยังเพลง "${next.title}"`, sender, 'info')
  } else {
    currentSong.value = null
    isPlaying.value = false
    triggerOsd('จบรายการคิวเพลงทั้งหมดแล้ว', sender, 'info')
  }
  broadcastHostState()
}

function handleSongEnded() {
  if (autoAdvance.value && queue.value.length > 0) {
    skipSong('Auto-Queue')
  } else {
    isPlaying.value = false
    broadcastHostState()
  }
}

function togglePlay(sender = 'Host') {
  if (!currentSong.value && queue.value.length > 0) {
    skipSong(sender)
    return
  }
  isPlaying.value = !isPlaying.value
  triggerOsd(isPlaying.value ? 'กำลังเล่นเพลงต่อ' : 'หยุดเล่นชั่วคราว', sender, 'info')
  broadcastHostState()
}

function restartSong(sender = 'Host') {
  restartTrigger.value += 1
  isPlaying.value = true
  triggerOsd('เริ่มเล่นเพลงนี้ใหม่อีกครั้ง', sender, 'info')
  broadcastHostState()
}

function updateVolume(val, sender = 'Host') {
  volume.value = Math.min(100, Math.max(0, Number(val)))
  if (volume.value > 0 && isMuted.value) {
    isMuted.value = false
  }
  broadcastHostState()
}

function toggleMute(sender = 'Host') {
  isMuted.value = !isMuted.value
  triggerOsd(isMuted.value ? 'ปิดเสียงชั่วคราว (Muted)' : `เปิดเสียง (${volume.value}%)`, sender, 'info')
  broadcastHostState()
}

function updatePitch(semitones, sender = 'Host') {
  pitchSemitones.value = semitones
  triggerOsd(
    `ปรับคีย์เพลง: ${semitones === 0 ? 'Original (0)' : semitones > 0 ? `+${semitones}` : semitones}`,
    sender,
    'info'
  )
  broadcastHostState()
}

// Room Sync Setup
let roomSync = null

function getStateSnapshot() {
  return {
    currentSong: currentSong.value,
    queue: queue.value,
    isPlaying: isPlaying.value,
    volume: volume.value,
    isMuted: isMuted.value,
    pitchSemitones: pitchSemitones.value,
    autoAdvance: autoAdvance.value,
    roomMusicMode: roomMusicMode.value
  }
}

function broadcastHostState() {
  if (viewMode.value === 'host' && roomSync) {
    roomSync.pushStateToServer(getStateSnapshot())
  }
}

function executeRemoteCommand(cmd) {
  if (!cmd || !cmd.action) return
  const { action, payload = {}, sender = 'Mobile Remote' } = cmd

  switch (action) {
    case 'JOIN_ROOM':
      triggerOsd(`คุณ "${sender}" เข้าร่วมห้องรีโมตแล้ว`, sender, 'info')
      broadcastHostState()
      break
    case 'ADD_QUEUE':
      if (payload.song) addToQueue(payload.song, sender)
      break
    case 'PLAY_NEXT':
      if (payload.song) playNext(payload.song, sender)
      break
    case 'REMOVE_QUEUE':
      if (typeof payload.index === 'number') removeFromQueue(payload.index, sender)
      break
    case 'MOVE_TO_TOP':
      if (typeof payload.index === 'number') moveToTop(payload.index, sender)
      break
    case 'REORDER_QUEUE':
      reorderQueue(payload, sender)
      break
    case 'TOGGLE_PLAY':
      togglePlay(sender)
      break
    case 'SKIP':
      skipSong(sender)
      break
    case 'RESTART':
      restartSong(sender)
      break
    case 'SET_VOLUME':
      if (typeof payload.volume === 'number') updateVolume(payload.volume, sender)
      break
    case 'TOGGLE_MUTE':
      toggleMute(sender)
      break
    case 'SET_PITCH':
      if (typeof payload.pitch === 'number') updatePitch(payload.pitch, sender)
      break
    case 'STAGE_EFFECT':
      triggerStageEffect(payload.effectType || 'applause', payload.label || 'STUDIO EFFECT', sender)
      break
  }
}

function handleRemoteCommandDispatch({ action, payload, sender }) {
  if (viewMode.value === 'host') {
    executeRemoteCommand({ action, payload, sender })
  } else if (roomSync) {
    roomSync.sendCommand(action, payload, sender)
  }
}

function applyRemoteState(remoteState) {
  if (!remoteState) return
  currentSong.value = remoteState.currentSong
  queue.value = Array.isArray(remoteState.queue) ? remoteState.queue : []
  isPlaying.value = Boolean(remoteState.isPlaying)
  volume.value = typeof remoteState.volume === 'number' ? remoteState.volume : 80
  isMuted.value = Boolean(remoteState.isMuted)
  pitchSemitones.value = remoteState.pitchSemitones || 0
  if (remoteState.roomMusicMode) {
    roomMusicMode.value = remoteState.roomMusicMode
  }
}

watch(
  () => currentSong.value && currentSong.value.queueId,
  (id) => {
    if (id && !restoringState) recordHistory(currentSong.value, 'played')
  }
)

onMounted(async () => {
  generateRoomQrCode()

  if (viewMode.value === 'host') {
    try {
      const room = await getRoom(roomId.value)
      if (room && room.musicMode) roomMusicMode.value = room.musicMode
      const saved = await loadRoomState(roomId.value)
      if (saved) {
        restoringState = true
        applyRemoteState(saved)
        isPlaying.value = false
        await nextTick()
        restoringState = false
      }
    } catch (_) {
      restoringState = false
    }
  }

  roomSync = createRoomSync({
    roomId: roomId.value,
    role: viewMode.value,
    getInitialState: getStateSnapshot,
    onStateSync: (remoteState) => {
      if (viewMode.value === 'remote') {
        applyRemoteState(remoteState)
      }
    },
    onCommand: (cmd) => {
      if (viewMode.value === 'host') {
        executeRemoteCommand(cmd)
      }
    },
    onRemoteCount: (count) => {
      remoteCount.value = count
    },
    onStatus: (s) => {
      syncStatus.value = s
    }
  })

  roomSync.start()
  if (viewMode.value === 'host') {
    broadcastHostState()
  }
})

onBeforeUnmount(() => {
  if (roomSync) roomSync.stop()
})

watch(viewMode, (newMode) => {
  if (roomSync) roomSync.stop()
  roomSync = createRoomSync({
    roomId: roomId.value,
    role: newMode,
    getInitialState: getStateSnapshot,
    onStateSync: (remoteState) => {
      if (newMode === 'remote') {
        applyRemoteState(remoteState)
      }
    },
    onCommand: (cmd) => {
      if (newMode === 'host') executeRemoteCommand(cmd)
    },
    onRemoteCount: (count) => {
      remoteCount.value = count
    },
    onStatus: (s) => {
      syncStatus.value = s
    }
  })
  roomSync.start()
  if (newMode === 'host') broadcastHostState()
})
</script>

<template>
  <!-- MODE A: FULL MOBILE REMOTE CONTROL VIEW -->
  <div v-if="viewMode === 'remote'" class="remote-fullscreen-wrapper">
    <div v-if="syncStatus !== 'connected'" class="sync-banner">{{ syncStatus === 'host-offline' ? 'จอหลักของห้องนี้ยังไม่ออนไลน์ เพลงที่กดจะถูกส่งเมื่อจอหลักกลับมา' : 'กำลังเชื่อมต่อกับจอหลัก... คำสั่งที่กดจะถูกส่งอัตโนมัติเมื่อเชื่อมต่อได้' }}</div>
    <MobileRemoteView
      :room-id="roomId"
      :room-music-mode="roomMusicMode"
      :current-song="currentSong"
      :queue="queue"
      :is-playing="isPlaying"
      :volume="volume"
      :is-muted="isMuted"
      :pitch-semitones="pitchSemitones"
      :is-embedded-drawer="false"
      @send-command="handleRemoteCommandDispatch"
      @switch-to-host="leaveRoom"
    />
  </div>

  <!-- MODE B: PROFESSIONAL 4:1 SPLIT-SCREEN STUDIO HOST VIEW -->
  <div v-else class="studio-4-to-1-layout">
    <!-- 4 PARTS (80% Width): MAIN KARAOKE STAGE & PLAYER -->
    <StagePlayer
      :current-song="currentSong"
      :next-song="nextSong"
      :queue="queue"
      :is-playing="isPlaying"
      :volume="volume"
      :is-muted="isMuted"
      :pitch-semitones="pitchSemitones"
      :room-id="roomId"
      :room-name="roomName"
      :room-music-mode="roomMusicMode"
      :remote-count="remoteCount + (showRemoteDrawer ? 1 : 0)"
      :qr-data-url="qrDataUrl"
      :remote-url="remoteUrl"
      :osd-notification="osdNotification"
      :active-effect="activeEffect"
      :restart-trigger="restartTrigger"
      @toggle-play="togglePlay('Host')"
      @skip-song="skipSong('Host')"
      @restart-song="restartSong('Host')"
      @update-volume="updateVolume($event, 'Host')"
      @toggle-mute="toggleMute('Host')"
      @update-pitch="updatePitch($event, 'Host')"
      @update-room-music-mode="setRoomMusicMode($event, 'Host')"
      @reset-room-id="leaveRoom"
      @toggle-remote-drawer="showRemoteDrawer = !showRemoteDrawer"
      @open-history="showHistory = true"
      @switch-to-remote-page="viewMode = 'remote'"
      @song-ended="handleSongEnded"
      @open-add-tab="sidebarTab = 'add'"
      @play-immediately="playImmediately"
      @move-to-top="moveToTop($event, 'Host')"
      @remove-from-queue="removeFromQueue($event, 'Host')"
      @reorder-queue="reorderQueue($event, 'Host')"
      @trigger-effect="triggerStageEffect($event.effectType, $event.label, 'Host')"
    />

    <!-- 1 PART (20% Width): QUEUE RUNNER, ADD SONG, DRAG-AND-DROP & PERMANENT QR CODE -->
    <QueueSidebar
      v-model:active-tab="sidebarTab"
      v-model:auto-advance="autoAdvance"
      :current-song="currentSong"
      :queue="queue"
      :is-playing="isPlaying"
      :room-id="roomId"
      :room-music-mode="roomMusicMode"
      :remote-count="remoteCount + (showRemoteDrawer ? 1 : 0)"
      :qr-data-url="qrDataUrl"
      :remote-url="remoteUrl"
      @update-room-music-mode="setRoomMusicMode($event, 'Host')"
      @add-to-queue="addToQueue($event, 'Host')"
      @play-next="playNext($event, 'Host')"
      @play-immediately="playImmediately"
      @remove-from-queue="removeFromQueue($event, 'Host')"
      @move-to-top="moveToTop($event, 'Host')"
      @reorder-queue="reorderQueue($event, 'Host')"
      @shuffle-queue="shuffleQueue"
      @clear-queue="clearQueue"
      @skip-song="skipSong('Host')"
      @toggle-remote-drawer="showRemoteDrawer = !showRemoteDrawer"
    />

    <HistoryModal
      :open="showHistory"
      :room-code="roomId"
      :room-name="roomName"
      :version="historyVersion"
      @close="showHistory = false"
      @requeue="addToQueue($event, 'Host')"
    />

    <!-- FLOATING INTERACTIVE MOBILE REMOTE SIMULATOR DRAWER -->
    <transition name="remote-drawer-slide">
      <div v-if="showRemoteDrawer" class="floating-remote-simulator">
        <div class="phone-bezel-header">
          <span class="phone-speaker-notch"></span>
          <span class="phone-bezel-label">MOBILE REMOTE SIMULATOR</span>
        </div>
        <MobileRemoteView
          :room-id="roomId"
          :room-music-mode="roomMusicMode"
          :current-song="currentSong"
          :queue="queue"
          :is-playing="isPlaying"
          :volume="volume"
          :is-muted="isMuted"
          :pitch-semitones="pitchSemitones"
          :is-embedded-drawer="true"
          @send-command="handleRemoteCommandDispatch"
          @close-drawer="showRemoteDrawer = false"
        />
      </div>
    </transition>
  </div>
</template>
