import { createClient } from '@/lib/supabase-server'
import { getGoogleToken } from '@/lib/google-api'
import { NextResponse } from 'next/server'

const YT = 'https://www.googleapis.com/youtube/v3'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getGoogleToken(supabase, user.id)
  if (!token) return NextResponse.json({ error: 'Google not connected', connected: false }, { status: 400 })

  const auth = { headers: { Authorization: `Bearer ${token}` } }

  // 1. Get channel info
  const chanResp = await fetch(
    `${YT}/channels?part=snippet,statistics,contentDetails&mine=true`,
    auth
  )
  if (!chanResp.ok) {
    const e = await chanResp.json()
    return NextResponse.json({ error: e.error?.message ?? 'YouTube channel fetch failed' }, { status: chanResp.status })
  }
  const chanData = await chanResp.json()
  const channel = chanData.items?.[0]
  if (!channel) return NextResponse.json({ error: 'Geen YouTube-kanaal gevonden', connected: true }, { status: 404 })

  const uploadsPlaylistId: string = channel.contentDetails?.relatedPlaylists?.uploads
  const stats = channel.statistics ?? {}

  // 2. Get latest uploads from uploads playlist
  const playlistResp = await fetch(
    `${YT}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=12`,
    auth
  )
  if (!playlistResp.ok) {
    const e = await playlistResp.json()
    return NextResponse.json({ error: e.error?.message ?? 'YouTube playlist fetch failed' }, { status: playlistResp.status })
  }
  const playlistData = await playlistResp.json()
  const playlistItems: {
    snippet: { title: string; thumbnails: { medium?: { url: string } }; publishedAt: string; resourceId: { videoId: string } }
    contentDetails: { videoId: string; videoPublishedAt: string }
  }[] = playlistData.items ?? []

  const videoIds = playlistItems.map(i => i.contentDetails?.videoId ?? i.snippet?.resourceId?.videoId).filter(Boolean)

  // 3. Get video stats + status
  const videosResp = await fetch(
    `${YT}/videos?part=statistics,status,snippet&id=${videoIds.join(',')}`,
    auth
  )
  const videosData = await videosResp.json()

  const videoMap: Record<string, {
    statistics: { viewCount: string; likeCount: string; commentCount: string }
    status: { privacyStatus: string; publishAt?: string }
    snippet: { title: string; publishedAt: string; thumbnails: { medium?: { url: string }; high?: { url: string } } }
  }> = {}
  for (const v of (videosData.items ?? [])) {
    videoMap[v.id] = v
  }

  const videos = videoIds.map(id => {
    const v = videoMap[id]
    if (!v) return null
    return {
      id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      thumbnail: v.snippet.thumbnails?.medium?.url ?? v.snippet.thumbnails?.high?.url ?? '',
      views: parseInt(v.statistics?.viewCount ?? '0'),
      likes: parseInt(v.statistics?.likeCount ?? '0'),
      comments: parseInt(v.statistics?.commentCount ?? '0'),
      privacy: v.status.privacyStatus,
      scheduledAt: v.status.publishAt ?? null,
    }
  }).filter(Boolean)

  const published  = videos.filter(v => v!.privacy === 'public')
  const scheduled  = videos.filter(v => v!.privacy === 'private' && v!.scheduledAt)
  const drafts     = videos.filter(v => v!.privacy === 'private' && !v!.scheduledAt)

  return NextResponse.json({
    connected: true,
    channel: {
      id: channel.id,
      name: channel.snippet.title,
      description: channel.snippet.description?.slice(0, 200) ?? '',
      thumbnail: channel.snippet.thumbnails?.medium?.url ?? '',
      subscribers: parseInt(stats.subscriberCount ?? '0'),
      totalViews: parseInt(stats.viewCount ?? '0'),
      videoCount: parseInt(stats.videoCount ?? '0'),
    },
    published: published.slice(0, 8),
    scheduled,
    drafts: drafts.slice(0, 5),
  })
}
