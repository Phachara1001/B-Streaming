export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const query = (req.query?.q || '').trim()
  const mode = req.query?.mode || 'karaoke' // 'karaoke' | 'music'

  if (!query) {
    return res.status(200).json({ results: [] })
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
      return res.status(200).json({ results: [] })
    }

    const data = JSON.parse(match[1])
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents?.[0]?.itemSectionRenderer?.contents || []

    const results = []
    for (const item of contents) {
      const v = item.videoRenderer
      if (!v || !v.videoId) continue
      if (!v.lengthText) continue // skip live streams

      const title = v.title?.runs?.map((r) => r.text).join('') || 'Unknown Title'
      const artist =
        v.ownerText?.runs?.[0]?.text ||
        v.longBylineText?.runs?.[0]?.text ||
        (mode === 'karaoke' ? 'YouTube Karaoke' : 'YouTube Music')
      const duration = v.lengthText?.simpleText || '03:45'

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
      if (results.length >= 15) break
    }

    return res.status(200).json({ results, mode })
  } catch (err) {
    return res.status(200).json({
      results: [],
      error: String(err?.message || err)
    })
  }
}

