import { reactive, watch } from 'vue'
import popCss from '../theme-bstreaming.css?inline'

const STORAGE_KEY = 'bstreaming.theme.v1'

export const THEME_PRESETS = [
  {
    id: 'pop',
    name: 'Pop',
    colors: { primary: '#ff4d8d', accent: '#ff8a3d', header: '#ffd23f', secondary: '#3d5bff', qr: '#1fd8a0', soft: '#b8a2ff', bg: '#fff6e9', ink: '#1a0f2e' }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: { primary: '#0ea5e9', accent: '#22d3ee', header: '#7dd3fc', secondary: '#2563eb', qr: '#5eead4', soft: '#c4b5fd', bg: '#eef8ff', ink: '#0b1f3a' }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: { primary: '#ff5e3a', accent: '#ffb02e', header: '#ffcf5c', secondary: '#c026d3', qr: '#ffd6a5', soft: '#fda4af', bg: '#fff1e6', ink: '#3b0d1a' }
  },
  {
    id: 'mint',
    name: 'Mint',
    colors: { primary: '#10b981', accent: '#84cc16', header: '#bef264', secondary: '#0d9488', qr: '#a7f3d0', soft: '#99f6e4', bg: '#f0fdf4', ink: '#052e1b' }
  },
  {
    id: 'grape',
    name: 'Grape',
    colors: { primary: '#8b5cf6', accent: '#d946ef', header: '#e9d5ff', secondary: '#6366f1', qr: '#f0abfc', soft: '#c4b5fd', bg: '#faf5ff', ink: '#2e1065' }
  },
  {
    id: 'mono',
    name: 'Mono',
    colors: { primary: '#111827', accent: '#4b5563', header: '#e5e7eb', secondary: '#374151', qr: '#d1d5db', soft: '#e5e7eb', bg: '#f9fafb', ink: '#111827' }
  }
]

const CSS_VAR_MAP = {
  primary: '--pop-pink',
  accent: '--pop-orange',
  header: '--pop-yellow',
  secondary: '--pop-blue',
  qr: '--pop-mint',
  soft: '--pop-lilac',
  bg: '--cream',
  ink: '--ink'
}

export const SITE_STYLES = [
  { id: 'pop', name: 'Light Pop', desc: 'สดใส การ์ดสีสัน (เวอร์ชันใหม่)' },
  { id: 'classic', name: 'Classic Dark', desc: 'มืด เรียบหรู (เวอร์ชันเดิม)' }
]

const CLASSIC_FIXES = `.brand-logo-mark{width:auto;height:auto;border:none;background:none;padding:0;border-radius:0}.brand-title{background:none;color:var(--text-primary)}.brand-dash{opacity:.5}`

const defaults = () => ({
  style: 'pop',
  preset: 'pop',
  colors: { ...THEME_PRESETS[0].colors }
})

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (raw && raw.colors) {
      return { style: raw.style === 'classic' ? 'classic' : 'pop', preset: raw.preset || 'custom', colors: { ...THEME_PRESETS[0].colors, ...raw.colors } }
    }
  } catch (_) { /* ignore */ }
  return defaults()
}

export const themeState = reactive(load())

function applyStyleSheet() {
  let el = document.getElementById('bs-style-sheet')
  if (!el) {
    el = document.createElement('style')
    el.id = 'bs-style-sheet'
    document.head.appendChild(el)
  }
  const css = themeState.style === 'classic' ? CLASSIC_FIXES : popCss
  if (el.textContent !== css) el.textContent = css
}

export function selectStyle(id) {
  themeState.style = id === 'classic' ? 'classic' : 'pop'
}

export function applyTheme() {
  const root = document.documentElement
  root.dataset.style = themeState.style
  applyStyleSheet()
  root.dataset.theme = themeState.preset
  Object.entries(CSS_VAR_MAP).forEach(([key, cssVar]) => {
    root.style.setProperty(cssVar, themeState.colors[key])
  })
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', themeState.colors.header)
}

export function selectPreset(id) {
  const preset = THEME_PRESETS.find((p) => p.id === id)
  if (!preset) return
  themeState.preset = id
  themeState.colors = { ...preset.colors }
}

export function setCustomColor(key, value) {
  themeState.preset = 'custom'
  themeState.colors = { ...themeState.colors, [key]: value }
}

export function resetTheme() {
  selectPreset('pop')
}

let started = false
export function initTheme() {
  if (started) return
  started = true
  applyTheme()
  watch(
    themeState,
    () => {
      applyTheme()
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ style: themeState.style, preset: themeState.preset, colors: themeState.colors })
        )
      } catch (_) { /* ignore */ }
    },
    { deep: true }
  )
}

