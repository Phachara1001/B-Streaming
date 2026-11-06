<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Palette, RotateCcw, Check, X } from 'lucide-vue-next'
import {
  THEME_PRESETS,
  SITE_STYLES,
  themeState,
  selectPreset,
  selectStyle,
  setCustomColor,
  resetTheme
} from '../services/themeService'

const open = ref(false)
const rootRef = ref(null)

const CUSTOM_FIELDS = [
  { key: 'primary', label: 'สีหลัก (ปุ่ม/เน้น)' },
  { key: 'header', label: 'สีแถบหัว' },
  { key: 'secondary', label: 'สีรอง' },
  { key: 'qr', label: 'สีกล่อง QR' },
  { key: 'bg', label: 'สีพื้นหลัง' },
  { key: 'ink', label: 'สีตัวอักษร/ขอบ' }
]

function onDocClick(e) {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div class="theme-switcher" ref="rootRef">
    <button type="button" class="theme-trigger" :class="{ open }" @click="open = !open" title="ปรับแต่งธีมเว็บไซต์">
      <Palette :size="15" />
      <span>ธีม</span>
      <span class="theme-trigger-dots">
        <i :style="{ background: themeState.colors.primary }"></i>
        <i :style="{ background: themeState.colors.header }"></i>
        <i :style="{ background: themeState.colors.secondary }"></i>
      </span>
    </button>

    <transition name="theme-pop">
      <div class="theme-panel" v-if="open">
        <div class="theme-panel-head">
          <div class="theme-panel-title">
            <Palette :size="16" />
            <span>ปรับแต่งธีม</span>
          </div>
          <button type="button" class="theme-icon-btn" @click="open = false" title="ปิด">
            <X :size="15" />
          </button>
        </div>

        <div class="theme-section-label">สไตล์เว็บไซต์</div>
        <div class="theme-style-grid">
          <button v-for="s in SITE_STYLES" :key="s.id" type="button" class="theme-style-card"
            :class="[s.id, { active: themeState.style === s.id }]" @click="selectStyle(s.id)">
            <span class="ts-preview">
              <span class="ts-bar"></span>
              <span class="ts-body">
                <i></i><i></i>
              </span>
            </span>
            <span class="ts-name">
              <Check :size="12" v-if="themeState.style === s.id" />
              {{ s.name }}
            </span>
            <span class="ts-desc">{{ s.desc }}</span>
          </button>
        </div>

        <div class="theme-colors-zone" :class="{ disabled: themeState.style === 'classic' }">
        <div class="theme-section-label">ชุดสีสำเร็จรูป</div>
        <div class="theme-preset-grid">
          <button v-for="p in THEME_PRESETS" :key="p.id" type="button" class="theme-preset"
            :class="{ active: themeState.preset === p.id }" @click="selectPreset(p.id)">
            <span class="theme-preset-preview" :style="{ background: p.colors.bg, borderColor: p.colors.ink }">
              <span class="tp-bar" :style="{ background: p.colors.header, borderColor: p.colors.ink }"></span>
              <span class="tp-row">
                <i :style="{ background: p.colors.primary }"></i>
                <i :style="{ background: p.colors.secondary }"></i>
                <i :style="{ background: p.colors.qr }"></i>
              </span>
            </span>
            <span class="theme-preset-name">
              <Check :size="11" v-if="themeState.preset === p.id" />
              {{ p.name }}
            </span>
          </button>
        </div>

        <div class="theme-section-label">
          กำหนดสีเอง
          <span class="theme-custom-tag" v-if="themeState.preset === 'custom'">CUSTOM</span>
        </div>
        <div class="theme-custom-list">
          <label v-for="f in CUSTOM_FIELDS" :key="f.key" class="theme-color-row">
            <span>{{ f.label }}</span>
            <span class="theme-color-input">
              <code>{{ themeState.colors[f.key] }}</code>
              <input type="color" :value="themeState.colors[f.key]"
                @input="setCustomColor(f.key, $event.target.value)" />
            </span>
          </label>
        </div>
        </div>
        <p class="theme-classic-note" v-if="themeState.style === 'classic'">
          สไตล์ Classic Dark ใช้ชุดสีของตัวเอง ปรับสีได้ในสไตล์ Light Pop
        </p>

        <button type="button" class="theme-reset" @click="resetTheme">
          <RotateCcw :size="13" />
          <span>รีเซ็ตเป็นค่าเริ่มต้น</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.theme-switcher {
  position: relative;
}

.theme-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: var(--card, #fff);
  color: var(--ink);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--ink);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.theme-trigger:hover {
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0 var(--ink);
}

.theme-trigger.open {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--ink);
}

.theme-trigger-dots {
  display: inline-flex;
}

.theme-trigger-dots i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
  margin-left: -3px;
}

.theme-trigger-dots i:first-child {
  margin-left: 0;
}

.theme-panel {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: 330px;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  padding: 16px;
  z-index: 200;
  background: var(--card, #fff);
  color: var(--ink);
  border: 3px solid var(--ink);
  border-radius: 24px;
  box-shadow: 8px 8px 0 var(--pop-pink);
  text-align: left;
}

.theme-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.theme-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 800;
}

.theme-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid var(--ink);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}

.theme-icon-btn:hover {
  background: var(--pop-yellow);
}

.theme-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--ink);
  opacity: 0.7;
}

.theme-custom-tag {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ink);
  color: var(--pop-yellow);
  font-size: 9px;
  letter-spacing: 0.12em;
  opacity: 1;
}

.theme-style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.theme-style-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  text-align: left;
  background: transparent;
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: 16px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.theme-style-card:hover {
  transform: translateY(-2px);
}

.theme-style-card.active {
  box-shadow: 4px 4px 0 var(--pop-pink);
  background: color-mix(in srgb, var(--pop-yellow) 30%, transparent);
}

.ts-preview {
  display: flex;
  flex-direction: column;
  height: 52px;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid var(--ink);
}

.ts-bar {
  height: 14px;
}

.ts-body {
  flex: 1;
  display: flex;
  gap: 5px;
  padding: 5px;
}

.ts-body i {
  flex: 1;
  border-radius: 5px;
}

.theme-style-card.pop .ts-preview { background: #fff6e9; }
.theme-style-card.pop .ts-bar { background: #ffd23f; border-bottom: 2px solid #1a0f2e; }
.theme-style-card.pop .ts-body i:first-child { background: #ff4d8d; }
.theme-style-card.pop .ts-body i:last-child { background: #3d5bff; }

.theme-style-card.classic .ts-preview { background: #08090d; }
.theme-style-card.classic .ts-bar { background: #0e1017; border-bottom: 1px solid #2a2f40; }
.theme-style-card.classic .ts-body i:first-child { background: #6366f1; }
.theme-style-card.classic .ts-body i:last-child { background: #191d2a; border: 1px solid #2a2f40; }

.ts-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 800;
}

.ts-desc {
  font-size: 10px;
  line-height: 1.3;
  opacity: 0.65;
}

.theme-colors-zone.disabled {
  opacity: 0.35;
  pointer-events: none;
  filter: grayscale(1);
}

.theme-classic-note {
  margin-top: 10px;
  font-size: 11px;
  opacity: 0.7;
}

.theme-preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.theme-preset {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ink);
}

.theme-preset-preview {
  display: flex;
  flex-direction: column;
  height: 58px;
  border: 2px solid;
  border-radius: 14px;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.theme-preset:hover .theme-preset-preview {
  transform: translateY(-2px);
}

.theme-preset.active .theme-preset-preview {
  box-shadow: 0 0 0 3px var(--card, #fff), 0 0 0 5px var(--ink);
}

.tp-bar {
  height: 16px;
  border-bottom: 2px solid;
}

.tp-row {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.tp-row i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.theme-preset-name {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
}

.theme-custom-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.theme-color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.theme-color-row:hover {
  background: color-mix(in srgb, var(--pop-yellow) 35%, transparent);
}

.theme-color-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-color-input code {
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.65;
  text-transform: uppercase;
}

.theme-color-input input[type='color'] {
  width: 30px;
  height: 24px;
  padding: 0;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: none;
  cursor: pointer;
}

.theme-reset {
  width: 100%;
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: var(--ink);
  color: var(--cream);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.theme-reset:hover {
  background: var(--pop-pink);
  color: #fff;
}

.theme-pop-enter-active,
.theme-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: top right;
}

.theme-pop-enter-from,
.theme-pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.94);
}
</style>

