<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import QRCode from 'qrcode'
import {
  Plus, Search, Mic2, Headphones, Trash2, Monitor, Smartphone, X, Loader2, Database,
  HardDrive, RefreshCw, Clock, Crown, Home, History, Settings, ChevronRight, Star,
  ArrowLeft, Sparkles, QrCode, LogIn, Copy, Check
} from 'lucide-vue-next'
import BrandLogo from './BrandLogo.vue'
import StageScenery from './StageScenery.vue'
import ThemeSwitcher from './ThemeSwitcher.vue'
import HistoryModal from './HistoryModal.vue'
import {
  createRoom, listRooms, deleteRoom, subscribeRooms, isOwned, usingDatabase,
  randomCode, normalizeRoomCode, joinRoomByCode
} from '../services/roomService.js'

const emit = defineEmits(['enter', 'back'])

const view = ref('rooms') // rooms | history | settings
const rooms = ref([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const now = ref(Date.now())

const joinCodeInput = ref('')
const joiningByCode = ref(false)
const joinError = ref('')

const showCreate = ref(false)
const newName = ref('')
const newMode = ref('karaoke')
const previewCode = ref(randomCode())
const creating = ref(false)
const createError = ref('')
const nameInput = ref(null)

const qrModalRoom = ref(null)
const qrModalDataUrl = ref('')
const qrModalRemoteUrl = ref('')
const copiedCode = ref(false)

const historyRoom = ref(null)
const notice = ref('')

let unsubscribe = null
let tick = null
let reloadTimer = null
let noticeTimer = null

const allRooms = computed(() =>
  rooms.value
    .map((r) => ({ ...r, owned: isOwned(r.code) }))
    .sort((a, b) => Number(b.owned) - Number(a.owned))
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return allRooms.value
  return allRooms.value.filter(
    (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
  )
})

function seedOf(code) {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0
  return (h % 997) + 1
}

function toneOf(code) {
  return ['violet', 'pink', 'blue'][seedOf(code) % 3]
}

function timeAgo(iso) {
  const diff = Math.max(0, now.value - new Date(iso).getTime())
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'เมื่อสักครู่'
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

async function load(silent = false) {
  if (!silent) loading.value = true
  loadError.value = ''
  try {
    rooms.value = await listRooms()
  } catch (e) {
    loadError.value = e.message || 'โหลดรายการห้องไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}

function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => load(true), 250)
}

async function openCreate() {
  newName.value = ''
  newMode.value = 'karaoke'
  previewCode.value = randomCode()
  createError.value = ''
  showCreate.value = true
  await nextTick()
  if (nameInput.value) nameInput.value.focus()
}

function rerollPreviewCode() {
  previewCode.value = randomCode()
}

async function submitCreate() {
  if (creating.value) return
  if (!newName.value.trim()) {
    createError.value = 'กรุณากรอกชื่อห้อง'
    return
  }
  creating.value = true
  createError.value = ''
  try {
    const room = await createRoom(newName.value, newMode.value, previewCode.value)
    showCreate.value = false
    emit('enter', { room, mode: 'host' })
  } catch (e) {
    createError.value = e.message || 'สร้างห้องไม่สำเร็จ'
  } finally {
    creating.value = false
  }
}

async function handleJoinByCode(targetMode = 'remote') {
  if (joiningByCode.value) return
  const raw = joinCodeInput.value.trim()
  if (!raw) {
    joinError.value = 'กรุณากรอกรหัสห้อง เช่น BS4829'
    return
  }
  joiningByCode.value = true
  joinError.value = ''
  try {
    const room = await joinRoomByCode(raw)
    joinCodeInput.value = ''
    emit('enter', { room, mode: targetMode })
  } catch (e) {
    joinError.value = e.message || 'ไม่พบรหัสห้องนี้'
  } finally {
    joiningByCode.value = false
  }
}

async function openRoomQrModal(room) {
  qrModalRoom.value = room
  copiedCode.value = false
  const protocol = window.location.protocol || 'http:'
  const hostPart = window.location.host
  const url = `${protocol}//${hostPart}/?mode=remote&room=${encodeURIComponent(room.code)}`
  qrModalRemoteUrl.value = url
  try {
    qrModalDataUrl.value = await QRCode.toDataURL(url, {
      width: 280,
      margin: 1,
      color: { dark: '#1a0f2e', light: '#ffffff' }
    })
  } catch (_) {
    qrModalDataUrl.value = ''
  }
}

async function copyRoomCodeText(code) {
  try {
    await navigator.clipboard.writeText(code)
    copiedCode.value = true
    setTimeout(() => {
      copiedCode.value = false
    }, 1800)
  } catch (_) {}
}

async function onDelete(room) {
  if (!window.confirm(`ลบห้อง "${room.name}" และประวัติเพลงทั้งหมด?`)) return
  await deleteRoom(room.code)
  await load(true)
}

function onRequeueFromHistory() {
  notice.value = 'เข้าห้องก่อน แล้วค่อยเพิ่มเพลงเข้าคิวจากประวัติ'
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 3000)
}

onMounted(() => {
  load()
  unsubscribe = subscribeRooms(scheduleReload)
  tick = setInterval(() => {
    now.value = Date.now()
  }, 30000)
})

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe()
  if (tick) clearInterval(tick)
  if (reloadTimer) clearTimeout(reloadTimer)
  if (noticeTimer) clearTimeout(noticeTimer)
})
</script>

<template>
  <main class="rl">
    <div class="rl-bg" aria-hidden="true"></div>

    <!-- Top bar -->
    <header class="rl-top">
      <div class="rl-brand">
        <span class="rl-logo"><BrandLogo :size="40" class="logo-purple" /></span>
        <div class="rl-brand-text">
          <strong>B-Streaming</strong>
          <span>Stream. Sing. Share.</span>
        </div>
        <span class="rl-live"><i></i>LIVE</span>
      </div>

      <div class="rl-ticker">
        <span class="tk-status"><i></i>STANDBY</span>
        <span class="tk-text">ยังไม่มีเพลงที่กำลังเล่น กรุณาเลือกห้องหรือสร้างห้องใหม่</span>
      </div>

      <div class="rl-top-actions">
        <ThemeSwitcher />
        <button type="button" class="rl-new" @click="openCreate">
          <Plus :size="16" />
          <span>สร้างห้องใหม่</span>
        </button>
      </div>
    </header>

    <div class="rl-body">
      <!-- Sidebar -->
      <nav class="rl-side">
        <button type="button" class="side-btn" :class="{ active: view === 'rooms' }" @click="view = 'rooms'">
          <Home :size="22" />
          <span>หน้าหลัก</span>
        </button>
        <button type="button" class="side-btn" :class="{ active: view === 'history' }" @click="view = 'history'">
          <History :size="22" />
          <span>ประวัติการเล่น</span>
        </button>
        <button type="button" class="side-btn" :class="{ active: view === 'settings' }" @click="view = 'settings'">
          <Settings :size="22" />
          <span>ตั้งค่า</span>
        </button>
        <button type="button" class="side-btn back" @click="emit('back')">
          <ArrowLeft :size="22" />
          <span>หน้าปก</span>
        </button>
      </nav>

      <!-- Content -->
      <section class="rl-panel">
        <p class="rl-error" v-if="loadError">{{ loadError }}</p>
        <p class="rl-notice" v-if="notice">{{ notice }}</p>

        <!-- ROOMS -->
        <template v-if="view === 'rooms'">
          <!-- Quick Join by Room Code (BSxxxx) -->
          <div class="join-code-banner">
            <div class="jc-left">
              <span class="jc-icon"><QrCode :size="20" /></span>
              <div class="jc-text">
                <strong>เข้าร่วมห้องด้วยรหัส (BSxxxx) หรือสแกน QR Code</strong>
                <span>กรอกรหัสห้อง 6 หลัก เช่น BS4829 เพื่อเข้าใช้งานรีโมตหรือเปิดจอหลักได้ทันทีโดยไม่ต้องล็อกอิน</span>
              </div>
            </div>
            <form class="jc-form" @submit.prevent="handleJoinByCode('remote')">
              <input
                v-model="joinCodeInput"
                type="text"
                maxlength="8"
                class="jc-input"
                placeholder="รหัสห้อง เช่น BS4829"
                autocomplete="off"
              />
              <button type="submit" class="jc-btn remote" :disabled="joiningByCode">
                <Smartphone :size="15" />
                <span>เข้ารีโมต</span>
              </button>
              <button type="button" class="jc-btn host" :disabled="joiningByCode" @click="handleJoinByCode('host')">
                <Monitor :size="15" />
                <span>เปิดจอหลัก</span>
              </button>
            </form>
          </div>
          <p class="rl-error" v-if="joinError">{{ joinError }}</p>

          <div class="rl-head">
            <h1><Star :size="22" class="star" /> รายการห้องคาราโอเกะ</h1>
            <div class="rl-tools">
              <label class="rl-search">
                <Search :size="15" />
                <input v-model="search" type="text" placeholder="ค้นหาชื่อห้อง หรือรหัส BSxxxx" />
              </label>
              <button type="button" class="rl-icon-btn" @click="load()" title="รีเฟรช">
                <RefreshCw :size="16" :class="{ spin: loading }" />
              </button>
            </div>
          </div>

          <div class="rl-state" v-if="loading && !rooms.length">
            <Loader2 :size="28" class="spin" />
            <span>กำลังโหลดรายการห้อง...</span>
          </div>

          <div class="rl-grid" v-else>
            <article v-for="room in filtered" :key="room.code" class="rc" :class="{ owned: room.owned }">
              <div class="rc-thumb">
                <StageScenery :seed="seedOf(room.code)" :tone="toneOf(room.code)" :beams="3" />
                <span class="rc-mode">
                  <Mic2 :size="12" v-if="room.musicMode === 'karaoke'" />
                  <Headphones :size="12" v-else />
                  {{ room.musicMode === 'karaoke' ? 'คาราโอเกะ' : 'เพลงปกติ' }}
                </span>
                <span class="rc-own" v-if="room.owned"><Crown :size="12" /> ห้องของคุณ</span>
              </div>
              <div class="rc-info">
                <h3 :title="room.name">{{ room.name }}</h3>
                <div class="rc-line">
                  <span class="rc-code">{{ room.code }}</span>
                  <span class="rc-time"><Clock :size="12" /> {{ timeAgo(room.lastActiveAt) }}</span>
                </div>
                <div class="rc-actions">
                  <button v-if="room.owned" type="button" class="rc-btn main" @click="emit('enter', { room, mode: 'host' })">
                    <Monitor :size="15" />
                    <span>เปิดจอหลัก</span>
                    <ChevronRight :size="15" class="chev" />
                  </button>
                  <button type="button" class="rc-btn" :class="{ main: !room.owned }"
                    @click="emit('enter', { room, mode: 'remote' })">
                    <Smartphone :size="15" v-if="room.owned" />
                    <span>{{ room.owned ? 'รีโมต' : 'เข้าห้อง' }}</span>
                    <ChevronRight :size="15" class="chev" v-if="!room.owned" />
                  </button>
                  <button type="button" class="rc-btn icon" @click="openRoomQrModal(room)" title="แสดง QR Code และรหัสห้อง">
                    <QrCode :size="15" />
                  </button>
                  <button v-if="room.owned" type="button" class="rc-btn icon danger" @click="onDelete(room)" title="ลบห้อง">
                    <Trash2 :size="15" />
                  </button>
                </div>
              </div>
            </article>

            <button type="button" class="rc-new" @click="openCreate">
              <span class="plus"><Plus :size="30" /></span>
              <strong>สร้างห้องใหม่</strong>
              <span>เริ่มต้นความสนุกของคุณ</span>
            </button>
          </div>
        </template>

        <!-- HISTORY -->
        <template v-else-if="view === 'history'">
          <div class="rl-head">
            <h1><History :size="22" class="star" /> ประวัติการเล่น</h1>
          </div>
          <p class="rl-hint">เลือกห้องเพื่อดูประวัติเพลงที่เข้าคิว เล่น และข้าม</p>
          <div class="hist-rooms" v-if="allRooms.length">
            <button v-for="room in allRooms" :key="room.code" type="button" class="hr-row" @click="historyRoom = room">
              <span class="hr-icon"><History :size="18" /></span>
              <span class="hr-text">
                <strong>{{ room.name }}</strong>
                <small>{{ room.code }} · ใช้งานล่าสุด {{ timeAgo(room.lastActiveAt) }}</small>
              </span>
              <ChevronRight :size="18" />
            </button>
          </div>
          <div class="rl-empty" v-else>
            <Sparkles :size="30" />
            <strong>ยังไม่มีห้อง</strong>
            <span>สร้างห้องก่อน แล้วประวัติจะแสดงที่นี่</span>
          </div>
        </template>

        <!-- SETTINGS -->
        <template v-else>
          <div class="rl-head">
            <h1><Settings :size="22" class="star" /> ตั้งค่า</h1>
          </div>
          <div class="set-grid">
            <div class="set-card">
              <h3>สถานะระบบ</h3>
              <div class="set-status" :class="usingDatabase ? 'on' : 'off'">
                <component :is="usingDatabase ? Database : HardDrive" :size="18" />
                <span>{{ usingDatabase ? 'เชื่อมต่อฐานข้อมูล Realtime (Supabase)' : 'โหมดออฟไลน์ (เก็บในเบราว์เซอร์)' }}</span>
              </div>
              <p>
                {{ usingDatabase
                  ? 'ห้อง คิวเพลง และประวัติถูกเก็บในฐานข้อมูล ทุกเครื่องเห็นตรงกันแบบ Realtime'
                  : 'ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY เพื่อใช้หลายเครื่องพร้อมกัน' }}
              </p>
            </div>
            <div class="set-card">
              <h3>ธีมและขนาดตัวหนังสือ</h3>
              <p>ปรับสีและสไตล์ของเว็บไซต์ได้ที่ปุ่ม "ธีม" ด้านบน</p>
              <ThemeSwitcher />
            </div>
          </div>
        </template>
      </section>
    </div>

    <!-- Create room modal -->
    <transition name="rl-fade">
      <div class="rl-backdrop" v-if="showCreate" @click.self="showCreate = false">
        <form class="rl-modal" @submit.prevent="submitCreate">
          <button type="button" class="m-close" @click="showCreate = false" title="ปิด"><X :size="17" /></button>

          <div class="m-hero">
            <span class="m-spark s1"></span><span class="m-spark s2"></span>
            <span class="m-mic"><Mic2 :size="38" /></span>
          </div>
          <h2>สร้างห้องใหม่</h2>

          <div class="m-code-preview">
            <span class="mcp-label">รหัสห้องของคุณ:</span>
            <strong class="mcp-code">{{ previewCode }}</strong>
            <button type="button" class="mcp-reroll" @click="rerollPreviewCode" title="สุ่มรหัสใหม่">
              <RefreshCw :size="13" />
            </button>
          </div>

          <div class="m-field">
            <input ref="nameInput" v-model="newName" type="text" maxlength="60" autocomplete="off"
              placeholder="ชื่อห้องของคุณ..." />
          </div>

          <div class="m-modes">
            <button type="button" :class="{ active: newMode === 'karaoke' }" @click="newMode = 'karaoke'">
              <Mic2 :size="15" /> คาราโอเกะ
            </button>
            <button type="button" :class="{ active: newMode === 'music' }" @click="newMode = 'music'">
              <Headphones :size="15" /> เพลงปกติ
            </button>
          </div>

          <p class="m-error" v-if="createError">{{ createError }}</p>

          <div class="m-actions">
            <button type="button" class="m-cancel" @click="showCreate = false">ยกเลิก</button>
            <button type="submit" class="m-submit" :disabled="creating">
              <Loader2 :size="16" class="spin" v-if="creating" />
              <span>{{ creating ? 'กำลังสร้าง...' : 'สร้างห้อง' }}</span>
            </button>
          </div>
        </form>
      </div>
    </transition>

    <!-- QR & Room Code Join Modal -->
    <transition name="rl-fade">
      <div class="rl-backdrop" v-if="qrModalRoom" @click.self="qrModalRoom = null">
        <div class="rl-modal qr-join-modal">
          <button type="button" class="m-close" @click="qrModalRoom = null" title="ปิด"><X :size="17" /></button>

          <h2>{{ qrModalRoom.name }}</h2>
          <p class="qjm-sub">สแกน QR Code หรือใช้รหัสห้องด้านล่างเพื่อเข้าร่วม</p>

          <div class="qjm-qr-box" v-if="qrModalDataUrl">
            <img :src="qrModalDataUrl" :alt="`QR ${qrModalRoom.code}`" />
          </div>

          <div class="qjm-code-row">
            <span class="qjm-code">{{ qrModalRoom.code }}</span>
            <button type="button" class="qjm-copy" @click="copyRoomCodeText(qrModalRoom.code)">
              <Check :size="15" v-if="copiedCode" />
              <Copy :size="15" v-else />
              <span>{{ copiedCode ? 'คัดลอกแล้ว' : 'คัดลอกรหัส' }}</span>
            </button>
          </div>

          <div class="m-actions">
            <button
              type="button"
              class="m-cancel"
              @click="emit('enter', { room: qrModalRoom, mode: 'host' }); qrModalRoom = null"
            >
              <Monitor :size="15" /> เปิดจอหลัก
            </button>
            <button
              type="button"
              class="m-submit"
              @click="emit('enter', { room: qrModalRoom, mode: 'remote' }); qrModalRoom = null"
            >
              <Smartphone :size="15" /> เข้ารีโมต
            </button>
          </div>
        </div>
      </div>
    </transition>

    <HistoryModal
      v-if="historyRoom"
      :open="Boolean(historyRoom)"
      :room-code="historyRoom.code"
      :room-name="historyRoom.name"
      @close="historyRoom = null"
      @requeue="onRequeueFromHistory"
    />
  </main>
</template>

<style scoped>
.rl {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  color: #2b1b5a;
  font-family: var(--font-sans);
  text-align: left;
  overflow: hidden;
}

.rl-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(60% 50% at 0% 0%, rgba(255, 255, 255, 0.9), transparent 70%),
    radial-gradient(50% 50% at 100% 100%, rgba(255, 150, 235, 0.45), transparent 70%),
    linear-gradient(160deg, #e9defd 0%, #cdb8fb 55%, #b99cf7 100%);
}

.rl-bg::after {
  content: '';
  position: absolute;
  left: -10%;
  right: -10%;
  bottom: -2px;
  height: 22%;
  background:
    radial-gradient(60% 100% at 25% 100%, rgba(138, 77, 255, 0.35), transparent 70%),
    radial-gradient(60% 100% at 80% 100%, rgba(255, 79, 208, 0.25), transparent 70%);
}

/* top bar */
.rl-top {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 22px;
  background: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid rgba(138, 77, 255, 0.18);
  backdrop-filter: blur(16px);
  box-shadow: 0 6px 24px rgba(106, 53, 230, 0.12);
}

.rl-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.rl-logo {
  display: inline-flex;
}

.logo-purple {
  --pop-pink: #ff3fb4;
  --pop-orange: #8a4dff;
  --pop-yellow: #ffe27a;
  --ink: #2a1573;
}

.rl-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.rl-brand-text strong {
  font-size: 17px;
  font-weight: 800;
  color: #2a1573;
}

.rl-brand-text span {
  font-size: 11px;
  font-weight: 600;
  color: #6a35e6;
}

.rl-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #e6fbef;
  color: #12a853;
  border: 1px solid #22d56b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.rl-live i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22d56b;
  animation: blink 1.2s ease-in-out infinite;
}

@keyframes blink { 50% { opacity: 0.3; } }

.rl-ticker {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid rgba(138, 77, 255, 0.25);
}

.tk-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #8a7bb8;
  flex-shrink: 0;
}

.tk-status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b9aadb;
}

.tk-text {
  font-size: 12px;
  color: #6b5a9c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rl-top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.rl-new {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 18px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #7b45f0, #a24dff);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(123, 69, 240, 0.4);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.rl-new:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(123, 69, 240, 0.5); }

/* body */
.rl-body {
  position: relative;
  z-index: 5;
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 18px;
  padding: 18px 22px 22px;
}

.rl-side {
  width: 96px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 10px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(14px);
  box-shadow: 0 10px 30px rgba(106, 53, 230, 0.14);
  align-self: flex-start;
}

.side-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px;
  border: none;
  border-radius: 18px;
  background: transparent;
  color: #5a4a8f;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.side-btn:hover { background: rgba(138, 77, 255, 0.12); color: #6a35e6; }

.side-btn.active {
  background: linear-gradient(160deg, #7b45f0, #a24dff);
  color: #fff;
  box-shadow: 0 10px 22px rgba(123, 69, 240, 0.45);
}

.side-btn.back { margin-top: 6px; border-top: 1px dashed rgba(138, 77, 255, 0.3); border-radius: 0 0 18px 18px; }

.rl-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 24px 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  box-shadow: 0 16px 44px rgba(106, 53, 230, 0.16);
  scrollbar-width: thin;
  scrollbar-color: rgba(123, 69, 240, 0.4) transparent;
}

.rl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.rl-head h1 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 800;
  color: #2a1573;
}

.rl-head .star { color: #ffb020; fill: #ffcf4a; }

.rl-tools { display: flex; gap: 8px; }

.rl-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  width: 260px;
  max-width: 100%;
  padding: 0 14px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(138, 77, 255, 0.28);
  color: #8a7bb8;
}

.rl-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #2b1b5a;
  font-size: 13px;
  user-select: text;
}

.rl-icon-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(138, 77, 255, 0.28);
  border-radius: 12px;
  background: #fff;
  color: #6a35e6;
  cursor: pointer;
}

.rl-warn,
.rl-error,
.rl-notice {
  margin-bottom: 14px;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.5;
}

.rl-warn { background: #fff4d6; color: #8a5a00; border: 1px solid #ffd36b; }
.rl-error { background: #ffe3ea; color: #b4123b; }
.rl-notice { background: #e8defd; color: #4a23b8; }
.rl-hint { margin: -6px 0 16px; font-size: 13px; color: #6b5a9c; }

.rl-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 0;
  color: #6a35e6;
  font-weight: 700;
}

/* rooms grid */
.rl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(236px, 1fr));
  gap: 18px;
}

.rc {
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  background: #fff;
  border: 1px solid rgba(138, 77, 255, 0.14);
  box-shadow: 0 10px 28px rgba(106, 53, 230, 0.16);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.rc:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 38px rgba(106, 53, 230, 0.28);
}

.rc.owned { border-color: rgba(255, 63, 180, 0.55); }

.rc-thumb {
  position: relative;
  height: 118px;
  background: linear-gradient(160deg, #2a1573, #6a35e6 60%, #a24dff);
  overflow: hidden;
}

.rc-mode,
.rc-own {
  position: absolute;
  z-index: 3;
  top: 9px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  backdrop-filter: blur(6px);
}

.rc-mode { left: 9px; background: rgba(255, 255, 255, 0.85); color: #4a23b8; }
.rc-own { right: 9px; background: linear-gradient(90deg, #ff6ad9, #ff2fae); color: #fff; }

.rc-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px 14px 14px;
}

.rc-info h3 {
  font-size: 16px;
  font-weight: 800;
  color: #2a1573;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rc-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}

.rc-code {
  padding: 2px 9px;
  border-radius: 8px;
  background: #efe8ff;
  color: #5a2fd0;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.06em;
}

.rc-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #8a7bb8;
  font-weight: 600;
}

.rc-actions { display: flex; gap: 7px; margin-top: 2px; }

.rc-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(138, 77, 255, 0.35);
  border-radius: 11px;
  background: #fff;
  color: #5a2fd0;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rc-btn.main {
  border: none;
  background: linear-gradient(135deg, #7b45f0, #a24dff);
  color: #fff;
  box-shadow: 0 6px 14px rgba(123, 69, 240, 0.35);
}

.rc-btn .chev { margin-left: auto; }
.rc-btn:hover { transform: translateY(-1px); filter: brightness(1.05); }
.rc-btn.icon { flex: 0 0 36px; padding: 0; }
.rc-btn.danger { color: #d91a4a; border-color: rgba(217, 26, 74, 0.35); }
.rc-btn.danger:hover { background: #ffe3ea; }

.rc-new {
  min-height: 250px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 2px dashed rgba(138, 77, 255, 0.5);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.5);
  color: #5a2fd0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.rc-new:hover { background: rgba(255, 255, 255, 0.9); transform: translateY(-4px); }

.rc-new .plus {
  width: 62px;
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #8a4dff, #c04dff);
  color: #fff;
  box-shadow: 0 10px 22px rgba(138, 77, 255, 0.45);
  margin-bottom: 6px;
}

.rc-new strong { font-size: 16px; font-weight: 800; }
.rc-new span:last-child { font-size: 11.5px; color: #8a7bb8; }

/* history list */
.hist-rooms { display: flex; flex-direction: column; gap: 10px; }

.hr-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 1px solid rgba(138, 77, 255, 0.18);
  border-radius: 18px;
  background: #fff;
  color: #5a2fd0;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(106, 53, 230, 0.1);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.hr-row:hover { transform: translateX(4px); box-shadow: 0 10px 22px rgba(106, 53, 230, 0.2); }

.hr-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: linear-gradient(135deg, #7b45f0, #a24dff);
  color: #fff;
}

.hr-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.hr-text strong { font-size: 15px; color: #2a1573; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hr-text small { font-size: 11px; color: #8a7bb8; font-weight: 600; }

.rl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 50px 20px;
  border: 2px dashed rgba(138, 77, 255, 0.4);
  border-radius: 24px;
  color: #6a35e6;
  text-align: center;
}

/* settings */
.set-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }

.set-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 18px;
  border-radius: 22px;
  background: #fff;
  border: 1px solid rgba(138, 77, 255, 0.16);
  box-shadow: 0 8px 22px rgba(106, 53, 230, 0.12);
}

.set-card h3 { font-size: 16px; font-weight: 800; color: #2a1573; }
.set-card p { font-size: 12.5px; line-height: 1.55; color: #6b5a9c; }

.set-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 12.5px;
  font-weight: 700;
}

.set-status.on { background: #e6fbef; color: #12a853; }
.set-status.off { background: #fff4d6; color: #8a5a00; }

/* modal */
.rl-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(42, 21, 115, 0.45);
  backdrop-filter: blur(8px);
}

.rl-modal {
  position: relative;
  width: min(400px, 100%);
  padding: 26px 26px 22px;
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 30px 80px rgba(42, 21, 115, 0.5);
  text-align: center;
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes pop {
  from { opacity: 0; transform: scale(0.9) translateY(14px); }
  to { opacity: 1; transform: none; }
}

.m-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: #f1ebff;
  color: #6a35e6;
  cursor: pointer;
}

.m-hero {
  position: relative;
  width: 84px;
  height: 84px;
  margin: 0 auto 8px;
}

.m-mic {
  position: relative;
  z-index: 2;
  width: 84px;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(160deg, #ff6ad9, #a24dff);
  color: #fff;
  box-shadow: 0 0 0 8px rgba(255, 106, 217, 0.18), 0 14px 30px rgba(162, 77, 255, 0.55);
}

.m-spark {
  position: absolute;
  z-index: 3;
  width: 14px;
  height: 14px;
  background: #ffcf4a;
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
  animation: twinkle 1.6s ease-in-out infinite;
}

.m-spark.s1 { top: 2px; right: -8px; }
.m-spark.s2 { bottom: 6px; left: -10px; animation-delay: -0.8s; width: 10px; height: 10px; }

@keyframes twinkle {
  50% { transform: scale(1.5) rotate(20deg); opacity: 0.6; }
}

.rl-modal h2 { font-size: 20px; font-weight: 800; color: #2a1573; margin: 4px 0 16px; }

.m-field input {
  width: 100%;
  height: 46px;
  padding: 0 16px;
  border: 1px solid rgba(138, 77, 255, 0.3);
  border-radius: 14px;
  background: #f7f3ff;
  color: #2b1b5a;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  user-select: text;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.m-field input:focus { border-color: #8a4dff; box-shadow: 0 0 0 4px rgba(138, 77, 255, 0.18); background: #fff; }

.m-modes { display: flex; gap: 8px; margin-top: 12px; }

.m-modes button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  border: 1px solid rgba(138, 77, 255, 0.3);
  border-radius: 12px;
  background: #fff;
  color: #5a2fd0;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}

.m-modes button.active {
  border-color: transparent;
  background: linear-gradient(135deg, #7b45f0, #a24dff);
  color: #fff;
}

.m-error {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  background: #ffe3ea;
  color: #b4123b;
  font-size: 12.5px;
  font-weight: 600;
}

.m-actions { display: flex; gap: 10px; margin-top: 20px; }

.m-cancel,
.m-submit {
  height: 46px;
  border-radius: 999px;
  font-size: 14.5px;
  font-weight: 800;
  cursor: pointer;
}

.m-cancel {
  flex: 1;
  border: 1px solid rgba(138, 77, 255, 0.4);
  background: #fff;
  color: #5a2fd0;
}

.m-submit {
  flex: 1.2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  background: linear-gradient(180deg, #ff6ad9, #e11d9c);
  color: #fff;
  box-shadow: 0 10px 22px rgba(225, 29, 156, 0.45);
  transition: transform 0.15s ease;
}

.m-submit:hover:not(:disabled) { transform: translateY(-2px); }
.m-submit:disabled { opacity: 0.7; cursor: wait; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.rl-fade-enter-active,
.rl-fade-leave-active { transition: opacity 0.2s ease; }
.rl-fade-enter-from,
.rl-fade-leave-to { opacity: 0; }

/* Quick Join by Room Code Banner */
.join-code-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 14px 18px;
  margin-bottom: 18px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(243, 234, 255, 0.9));
  border: 1px solid rgba(138, 77, 255, 0.28);
  box-shadow: 0 10px 26px rgba(106, 53, 230, 0.14);
}

.jc-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 240px;
  flex: 1;
}

.jc-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(135deg, #7b45f0, #ff3fb4);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 6px 16px rgba(138, 77, 255, 0.35);
}

.jc-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.jc-text strong {
  font-size: 14.5px;
  font-weight: 800;
  color: #2a1573;
}

.jc-text span {
  font-size: 12px;
  color: #6b5a9c;
}

.jc-form {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.jc-input {
  width: 170px;
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(138, 77, 255, 0.4);
  background: #fff;
  color: #2a1573;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  outline: none;
  user-select: text;
}

.jc-input::placeholder {
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  color: #9b8cc2;
}

.jc-input:focus {
  border-color: #7b45f0;
  box-shadow: 0 0 0 3px rgba(123, 69, 240, 0.18);
}

.jc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.jc-btn.remote {
  border: none;
  background: linear-gradient(135deg, #ff6ad9, #e11d9c);
  color: #fff;
  box-shadow: 0 6px 14px rgba(225, 29, 156, 0.35);
}

.jc-btn.host {
  border: 1.5px solid rgba(123, 69, 240, 0.45);
  background: #fff;
  color: #5a2fd0;
}

.jc-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

/* Create Room Code Preview */
.m-code-preview {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  margin-bottom: 14px;
  border-radius: 999px;
  background: #f1ebff;
  border: 1px solid rgba(138, 77, 255, 0.3);
}

.mcp-label {
  font-size: 12px;
  font-weight: 700;
  color: #6b5a9c;
}

.mcp-code {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #5a2fd0;
}

.mcp-reroll {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: #fff;
  color: #6a35e6;
  cursor: pointer;
}

.mcp-reroll:hover {
  background: #7b45f0;
  color: #fff;
}

/* QR Join Modal */
.qjm-sub {
  font-size: 12.5px;
  color: #6b5a9c;
  margin: -10px 0 14px;
}

.qjm-qr-box {
  width: 200px;
  height: 200px;
  margin: 0 auto 14px;
  padding: 10px;
  border-radius: 20px;
  background: #fff;
  border: 2px solid rgba(138, 77, 255, 0.25);
  box-shadow: 0 12px 28px rgba(106, 53, 230, 0.16);
}

.qjm-qr-box img {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 10px;
}

.qjm-code-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px 6px 16px;
  border-radius: 999px;
  background: #f3ecff;
  border: 1px solid rgba(138, 77, 255, 0.3);
}

.qjm-code {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #2a1573;
}

.qjm-copy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  background: #7b45f0;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.m-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

@media (max-width: 860px) {
  .rl-ticker { display: none; }
  .rl-top { padding: 10px 14px; }
  .rl-brand-text span { display: none; }
  .rl-body { flex-direction: column; padding: 12px; gap: 12px; }
  .rl-side { width: 100%; flex-direction: row; align-self: stretch; padding: 6px; border-radius: 20px; }
  .side-btn { flex: 1; flex-direction: row; justify-content: center; padding: 10px 4px; font-size: 11px; gap: 5px; }
  .side-btn.back { border-top: none; margin-top: 0; }
  .side-btn svg { width: 18px; height: 18px; }
  .rl-panel { padding: 16px 14px 22px; border-radius: 22px; }
}

@media (max-width: 520px) {
  .rl-new span { display: none; }
  .rl-new { padding: 0 12px; }
  .rl-search { width: 100%; }
  .rl-tools { width: 100%; }
}
</style>
