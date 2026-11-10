<script setup>
import { ref, onMounted } from 'vue'
import LandingPage from './components/LandingPage.vue'
import RoomListPage from './components/RoomListPage.vue'
import RoomApp from './App.vue'
import { getRoom, isOwned, normalizeRoomCode } from './services/roomService.js'

const SESSION_KEY = 'bs.session.v1'

const page = ref('landing') // 'landing' | 'rooms' | 'room'
const session = ref(null) // { code, name, mode }
const booting = ref(true)

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch (_) {
    return null
  }
}

function saveSession(value) {
  try {
    if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value))
    else localStorage.removeItem(SESSION_KEY)
  } catch (_) {}
}

function enterRoom({ room, mode }) {
  session.value = { code: room.code, name: room.name, mode }
  saveSession(session.value)
  page.value = 'room'
}

function leaveRoom() {
  session.value = null
  saveSession(null)
  // drop ?mode=remote&room=... from the URL after leaving
  if (window.location.search) {
    window.history.replaceState({}, '', window.location.pathname)
  }
  page.value = 'rooms'
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const rawQrRoom = params.get('room') || ''
  const qrRoom = rawQrRoom ? normalizeRoomCode(rawQrRoom) : ''

  if (qrRoom) {
    // Opened from QR code: go straight into the room as a remote (or host if this browser owns it)
    const room = await getRoom(qrRoom).catch(() => null)
    const mode = params.get('mode') === 'remote' ? 'remote' : isOwned(qrRoom) ? 'host' : 'remote'
    session.value = { code: qrRoom, name: room ? room.name : `ห้อง ${qrRoom}`, mode }
    saveSession(session.value)
    page.value = 'room'
  } else {
    const saved = readSession()
    if (saved && saved.code && String(saved.code).startsWith('BS')) {
      session.value = saved
      page.value = 'room'
    } else if (saved) {
      saveSession(null)
    }
  }
  booting.value = false
})
</script>

<template>
  <template v-if="!booting">
    <LandingPage v-if="page === 'landing'" @enter="page = 'rooms'" />
    <RoomListPage v-else-if="page === 'rooms'" @enter="enterRoom" @back="page = 'landing'" />
    <RoomApp
      v-else-if="page === 'room' && session"
      :key="session.code + ':' + session.mode"
      :room-code="session.code"
      :room-name="session.name"
      :mode="session.mode"
      @leave="leaveRoom"
    />
  </template>
</template>

