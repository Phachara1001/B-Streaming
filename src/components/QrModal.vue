<script setup>
import { ref, watch, onMounted } from 'vue'
import QRCode from 'qrcode'
import {
  QrCode,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  X,
  Wifi,
  Radio
} from 'lucide-vue-next'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  roomId: {
    type: String,
    default: 'KTV-889'
  },
  remoteCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'open-simulator', 'open-remote-mode'])

const qrDataUrl = ref('')
const remoteUrl = ref('')
const copied = ref(false)

async function buildRemoteUrlAndQr() {
  let hostPart = window.location.host
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

  const protocol = window.location.protocol || 'http:'
  const url = `${protocol}//${hostPart}/?mode=remote&room=${encodeURIComponent(props.roomId)}`
  remoteUrl.value = url

  try {
    qrDataUrl.value = await QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: {
        dark: '#090A0F',
        light: '#FFFFFF'
      }
    })
  } catch (_) {}
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(remoteUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1800)
  } catch (_) {}
}

watch(
  () => props.show,
  (val) => {
    if (val) buildRemoteUrlAndQr()
  }
)

onMounted(() => {
  buildRemoteUrlAndQr()
})
</script>

<template>
  <transition name="modal-fade">
    <div v-if="show" class="studio-modal-backdrop" @click.self="emit('close')">
      <div class="studio-modal-card">
        <div class="modal-top-bar">
          <div class="modal-title-group">
            <div class="modal-icon-box">
              <QrCode :size="18" />
            </div>
            <div>
              <h3>Mobile Remote Control</h3>
              <p>สแกน QR Code เพื่อใช้สมาร์ตโฟนเลือกเพลงและควบคุมคิว</p>
            </div>
          </div>
          <button type="button" class="modal-close-btn" @click="emit('close')">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body-grid">
          <div class="qr-frame-box">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="Room QR Code" class="qr-image" />
            <div class="room-code-pill">
              <Radio :size="14" class="icon-accent" />
              <span>ROOM ID:</span>
              <strong class="mono-code">{{ roomId }}</strong>
            </div>
          </div>

          <div class="qr-instructions">
            <div class="net-status-badge">
              <Wifi :size="14" />
              <span>เชื่อมต่ออุปกรณ์รีโมตแล้ว: {{ remoteCount }} เครื่อง</span>
            </div>

            <ol class="step-list">
              <li>เชื่อมต่อมือถือในวง Wi-Fi เดียวกันกับเครื่องหลัก</li>
              <li>สแกน QR Code หรือเปิดลิงก์ด้านล่างบนเบราว์เซอร์มือถือ</li>
              <li>ค้นหาเพลงจาก YouTube เพิ่มคิว ลากสลับคิว หรือกดข้ามเพลงได้แบบ Real-time</li>
            </ol>

            <div class="url-copy-box">
              <input type="text" readonly :value="remoteUrl" class="url-readonly-input" />
              <button type="button" class="btn-copy-url" @click="copyUrl">
                <Check v-if="copied" :size="14" />
                <Copy v-else :size="14" />
                <span>{{ copied ? 'คัดลอกแล้ว' : 'คัดลอก' }}</span>
              </button>
            </div>

            <div class="modal-quick-launch">
              <button
                type="button"
                class="btn-launch-sim"
                @click="
                  emit('close');
                  emit('open-simulator')
                "
              >
                <Smartphone :size="15" />
                <span>เปิดรีโมตมือถือจำลองบนจอนี้</span>
              </button>

              <a
                :href="`/?mode=remote&room=${roomId}`"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-launch-tab"
              >
                <ExternalLink :size="15" />
                <span>เปิดแท็บรีโมตแยก</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

