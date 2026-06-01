import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://sports-tv-lovat.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: BASE, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE}/?module=bangladesh`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/?module=global_sports`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/?module=live_matches`, lastModified: now, changeFrequency: 'hourly', priority: 0.95 },
    { url: `${BASE}/?module=world_cup_2026`, lastModified: now, changeFrequency: 'hourly', priority: 0.95 },
    { url: `${BASE}/?module=india`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
    { url: `${BASE}/?module=fast_tv`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
  ]
}
