import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import os from 'os'

function getLocalExternalIp() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

function karaokeStudioServerPlugin() {
  const rooms = new Map()

  function getOrCreateRoom(roomId) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        roomId,
        version: 1,
        updatedAt: Date.now(),
        state: null,
        commands: [],
        connectedClients: new Map()
      })
    }
    return rooms.get(roomId)
  }

  return {
    name: 'karaoke-studio-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

        if (url.pathname === '/api/network') {
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ip: getLocalExternalIp(),
              host: req.headers.host || 'localhost:5173'
            })
          )
          return
        }

        if (url.pathname === '/api/yt-search') {
          const query = (url.searchParams.get('q') || '').trim()
          const mode = url.searchParams.get('mode') || 'karaoke'
          res.setHeader('Content-Type', 'application/json')
          if (!query) {
            res.end(JSON.stringify({ results: [] }))
            return
          }
          try {
            let searchQuery = query
            if (mode === 'karaoke') {
              const hasKaraokeWord =
                query.toLowerCase().includes('karaoke') || query.includes('คาราโอเกะ')
              if (!hasKaraokeWord) {
                searchQuery = `${query} karaoke คาราโอเกะ`
              }
            }
            const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`
            const response = await fetch(ytUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7'
              }
            })
            const html = await response.text()
            const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)
            if (!match) {
              res.end(JSON.stringify({ results: [] }))
              return
            }
            const data = JSON.parse(match[1])
            const contents =
              data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
                ?.contents?.[0]?.itemSectionRenderer?.contents || []

            const results = []
            for (const item of contents) {
              const v = item.videoRenderer
              if (!v || !v.videoId) continue
              const title = v.title?.runs?.map((r) => r.text).join('') || 'Unknown Title'
              const artist =
                v.ownerText?.runs?.[0]?.text ||
                v.longBylineText?.runs?.[0]?.text ||
                (mode === 'karaoke' ? 'YouTube Karaoke' : 'YouTube Music')
              const duration = v.lengthText?.simpleText || '03:45'
              if (!v.lengthText) continue // skip live streams
              results.push({
                id: `yt-${v.videoId}`,
                videoId: v.videoId,
                title,
                artist,
                duration,
                songMode: mode,
                category: mode === 'karaoke' ? 'YouTube Karaoke' : 'YouTube Music',
                thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
              })
              if (results.length >= 14) break
            }
            res.end(JSON.stringify({ results, mode }))
          } catch (err) {
            res.end(JSON.stringify({ results: [], error: String(err.message || err) }))
          }
          return
        }

        if (url.pathname === '/api/room') {
          const roomId = (url.searchParams.get('room') || 'KTV-889').toUpperCase()
          const clientId = url.searchParams.get('clientId') || 'anon'
          const role = url.searchParams.get('role') || 'remote'
          const room = getOrCreateRoom(roomId)

          room.connectedClients.set(clientId, {
            role,
            lastSeen: Date.now()
          })
          // Prune stale clients older than 12s
          const now = Date.now()
          for (const [cid, info] of room.connectedClients.entries()) {
            if (now - info.lastSeen > 12000) {
              room.connectedClients.delete(cid)
            }
          }

          if (req.method === 'GET') {
            const sinceCmdId = Number(url.searchParams.get('sinceCmd') || 0)
            const remoteCount = Array.from(room.connectedClients.values()).filter(
              (c) => c.role === 'remote'
            ).length

            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                roomId: room.roomId,
                version: room.version,
                state: room.state,
                remoteCount,
                commands: room.commands.filter((c) => c.cmdId > sinceCmdId),
                latestCmdId:
                  room.commands.length > 0 ? room.commands[room.commands.length - 1].cmdId : 0
              })
            )
            return
          }

          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}')
                if (payload.type === 'SYNC_STATE' && payload.state) {
                  room.state = payload.state
                  room.version += 1
                  room.updatedAt = Date.now()
                } else if (payload.type === 'COMMAND' && payload.command) {
                  const cmdId = Date.now() + Math.floor(Math.random() * 1000)
                  room.commands.push({
                    cmdId,
                    ...payload.command,
                    createdAt: Date.now()
                  })
                  if (room.commands.length > 50) {
                    room.commands = room.commands.slice(-50)
                  }
                  room.version += 1
                  room.updatedAt = Date.now()
                }
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true, version: room.version }))
              } catch (e) {
                res.statusCode = 400
                res.end(JSON.stringify({ ok: false }))
              }
            })
            return
          }
        }

        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), karaokeStudioServerPlugin()],
  server: {
    host: true,
    port: 5173
  }
})

