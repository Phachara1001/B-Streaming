import { supabase, isSupabaseConfigured } from './supabaseClient.js'

/**
 * Room + history data layer.
 * Uses Supabase when configured, otherwise falls back to localStorage
 * (single browser only) so the app still runs without a database.
 */

const LS_ROOMS = 'bs.localRooms.v1'
const LS_HISTORY = 'bs.localHistory.v1'
const LS_OWNED = 'bs.ownedRooms.v1'

const roomIdCache = new Map() // code -> uuid

function readJson(key, fallback) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null')
    return raw ?? fallback
  } catch (_) {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (_) {}
}

export const usingDatabase = isSupabaseConfigured

// ----- ownership (this browser created the room => it is the host screen) -----
export function getOwnedCodes() {
  return readJson(LS_OWNED, []).map((c) => normalizeRoomCode(c) || c)
}

export function markOwned(code) {
  const clean = normalizeRoomCode(code) || code
  const list = getOwnedCodes().filter((c) => c !== clean)
  list.unshift(clean)
  writeJson(LS_OWNED, list.slice(0, 100))
}

export function isOwned(code) {
  const clean = normalizeRoomCode(code) || code
  return getOwnedCodes().includes(clean)
}

function unmarkOwned(code) {
  writeJson(
    LS_OWNED,
    getOwnedCodes().filter((c) => c !== code)
  )
}

// ----- helpers -----
export function randomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
  return `BS${code}`
}

export function normalizeRoomCode(raw) {
  const cleaned = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('KTV') && cleaned.length >= 7) return `BS${cleaned.slice(3, 7)}`
  if (cleaned.startsWith('BS')) return cleaned.slice(0, 6)
  if (cleaned.length <= 4) return `BS${cleaned}`
  return `BS${cleaned.slice(0, 4)}`
}

function normalizeRoom(row) {
  const fixedCode = normalizeRoomCode(row.code) || row.code
  return {
    id: row.id,
    code: fixedCode,
    name: row.name,
    musicMode: row.music_mode || row.musicMode || 'karaoke',
    isActive: row.is_active !== false,
    createdAt: row.created_at || row.createdAt,
    lastActiveAt: row.last_active_at || row.lastActiveAt || row.created_at
  }
}

// ----- rooms -----
export async function createRoom(name, musicMode = 'karaoke', preferredCode = '') {
  const cleanName = String(name || '').trim().slice(0, 60)
  if (!cleanName) throw new Error('กรุณากรอกชื่อห้อง')

  const initialCode = normalizeRoomCode(preferredCode)
  const validPreferred = /^BS[A-Z0-9]{4}$/.test(initialCode) ? initialCode : ''

  if (!supabase) {
    const rooms = readJson(LS_ROOMS, [])
    let code = validPreferred || randomCode()
    while (rooms.some((r) => r.code === code)) code = randomCode()
    const now = new Date().toISOString()
    const room = {
      id: `local-${code}`,
      code,
      name: cleanName,
      music_mode: musicMode,
      is_active: true,
      created_at: now,
      last_active_at: now
    }
    rooms.unshift(room)
    writeJson(LS_ROOMS, rooms)
    markOwned(code)
    return normalizeRoom(room)
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = attempt === 0 && validPreferred ? validPreferred : randomCode()
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, name: cleanName, music_mode: musicMode })
      .select()
      .single()
    if (!error && data) {
      roomIdCache.set(data.code, data.id)
      markOwned(data.code)
      return normalizeRoom(data)
    }
    if (error && error.code !== '23505') throw new Error(error.message)
  }
  throw new Error('สร้างรหัสห้องไม่สำเร็จ ลองใหม่อีกครั้ง')
}

export async function joinRoomByCode(rawCode) {
  const code = normalizeRoomCode(rawCode)
  if (!/^BS[A-Z0-9]{4}$/.test(code)) {
    throw new Error('กรุณากรอกรหัสห้องในรูปแบบ BSxxxx (เช่น BS4829)')
  }
  const existing = await getRoom(code)
  if (existing) return existing
  const now = new Date().toISOString()
  return {
    id: `join-${code}`,
    code,
    name: `ห้อง ${code}`,
    musicMode: 'karaoke',
    isActive: true,
    createdAt: now,
    lastActiveAt: now
  }
}

export async function listRooms() {
  if (!supabase) {
    return readJson(LS_ROOMS, []).map(normalizeRoom)
  }
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, name, music_mode, is_active, created_at, last_active_at')
    .eq('is_active', true)
    .order('last_active_at', { ascending: false })
    .limit(60)
  if (error) throw new Error(error.message)
  data.forEach((r) => roomIdCache.set(r.code, r.id))
  return data.map(normalizeRoom)
}

export async function getRoom(code) {
  if (!code) return null
  if (!supabase) {
    const row = readJson(LS_ROOMS, []).find((r) => r.code === code)
    return row ? normalizeRoom(row) : null
  }
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, name, music_mode, is_active, created_at, last_active_at')
    .eq('code', code)
    .maybeSingle()
  if (error || !data) return null
  roomIdCache.set(data.code, data.id)
  return normalizeRoom(data)
}

export async function deleteRoom(code) {
  unmarkOwned(code)
  if (!supabase) {
    writeJson(
      LS_ROOMS,
      readJson(LS_ROOMS, []).filter((r) => r.code !== code)
    )
    writeJson(
      LS_HISTORY,
      readJson(LS_HISTORY, []).filter((h) => h.room_code !== code)
    )
    return
  }
  await supabase.from('rooms').delete().eq('code', code)
  roomIdCache.delete(code)
}

export function subscribeRooms(onChange) {
  if (!supabase) {
    const handler = (e) => {
      if (e.key === LS_ROOMS) onChange()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }
  const channel = supabase
    .channel(`rooms-list-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => onChange())
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

// ----- room state snapshot (queue + playback) -----
let saveTimer = null
let pendingSave = null

export function saveRoomState(code, state, musicMode) {
  pendingSave = { code, state, musicMode }
  if (saveTimer) return
  saveTimer = setTimeout(async () => {
    saveTimer = null
    const job = pendingSave
    pendingSave = null
    if (!job) return
    const now = new Date().toISOString()
    if (!supabase) {
      const rooms = readJson(LS_ROOMS, [])
      const room = rooms.find((r) => r.code === job.code)
      if (room) {
        room.state = job.state
        room.last_active_at = now
        if (job.musicMode) room.music_mode = job.musicMode
        writeJson(LS_ROOMS, rooms)
      }
      return
    }
    const patch = { state: job.state, last_active_at: now }
    if (job.musicMode) patch.music_mode = job.musicMode
    await supabase.from('rooms').update(patch).eq('code', job.code)
  }, 500)
}

export async function loadRoomState(code) {
  if (!supabase) {
    const room = readJson(LS_ROOMS, []).find((r) => r.code === code)
    return room && room.state && Object.keys(room.state).length ? room.state : null
  }
  const { data } = await supabase.from('rooms').select('state').eq('code', code).maybeSingle()
  return data && data.state && Object.keys(data.state).length ? data.state : null
}

// ----- history -----
async function resolveRoomId(code) {
  if (roomIdCache.has(code)) return roomIdCache.get(code)
  const room = await getRoom(code)
  return room ? room.id : null
}

export async function logHistory(code, song, event) {
  if (!song || !song.videoId) return
  const row = {
    video_id: song.videoId,
    url: `https://www.youtube.com/watch?v=${song.videoId}`,
    title: song.title || song.videoId,
    artist: song.artist || null,
    thumbnail: song.thumbnail || `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`,
    duration: song.duration || null,
    requested_by: song.requestedBy || 'Host',
    event
  }

  if (!supabase) {
    const list = readJson(LS_HISTORY, [])
    list.unshift({
      ...row,
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      room_code: code,
      created_at: new Date().toISOString()
    })
    writeJson(LS_HISTORY, list.slice(0, 500))
    return
  }

  const roomId = await resolveRoomId(code)
  if (!roomId) return
  await supabase.from('song_history').insert({ ...row, room_id: roomId })
}

export async function listHistory(code, limit = 200) {
  if (!supabase) {
    return readJson(LS_HISTORY, [])
      .filter((h) => h.room_code === code)
      .slice(0, limit)
  }
  const roomId = await resolveRoomId(code)
  if (!roomId) return []
  const { data, error } = await supabase
    .from('song_history')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data
}

export async function clearHistory(code) {
  if (!supabase) {
    writeJson(
      LS_HISTORY,
      readJson(LS_HISTORY, []).filter((h) => h.room_code !== code)
    )
    return
  }
  const roomId = await resolveRoomId(code)
  if (roomId) await supabase.from('song_history').delete().eq('room_id', roomId)
}

export function subscribeHistory(code, onChange) {
  if (!supabase) return () => {}
  let channel = null
  resolveRoomId(code).then((roomId) => {
    if (!roomId) return
    channel = supabase
      .channel(`history-${roomId}-${Math.random().toString(36).slice(2, 6)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'song_history', filter: `room_id=eq.${roomId}` },
        () => onChange()
      )
      .subscribe()
  })
  return () => {
    if (channel) supabase.removeChannel(channel)
  }
}

