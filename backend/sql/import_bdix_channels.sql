-- Import BDIX Local CDN Bangladesh Sports Channels
-- These sources are ISP-level hosted with session token persistence
-- No geo-blocking, no dead links, perfect for Bangladesh viewers

-- 1. BTV HD
INSERT INTO channels (name, country, category, language, logo_url, stream_url, quality_tag, module, is_active, source)
VALUES ('BTV HD', 'Bangladesh', 'Sports', 'Bengali', 'https://sunplex.net/iptv/logo/btv.jpg',
        'http://172.32.1.88:1935/tvprogram/BTV/playlist.m3u8', 'auto', 'world_cup_2026', true, 'bdix-local')
ON CONFLICT (name, country) DO UPDATE SET
  stream_url = 'http://172.32.1.88:1935/tvprogram/BTV/playlist.m3u8',
  is_active = true,
  updated_at = NOW();

-- 2. T SPORTS HD (Primary)
INSERT INTO channels (name, country, category, language, logo_url, stream_url, quality_tag, module, is_active, source, alternate_urls)
VALUES ('T SPORTS HD', 'Bangladesh', 'Sports', 'Bengali', 'https://sunplex.net/iptv/logo/t-sports-hd-fifa-2022.jpg',
        'https://stream.sunplex.live/T-SPORTS/index.m3u8', 'auto', 'world_cup_2026', true, 'bdix-local',
        ARRAY['http://172.32.1.88:1935/tvprogram/T-SPORTS/playlist.m3u8', 'http://103.55.144.46:80/hls/t-sports.m3u8'])
ON CONFLICT (name, country) DO UPDATE SET
  stream_url = 'https://stream.sunplex.live/T-SPORTS/index.m3u8',
  alternate_urls = ARRAY['http://172.32.1.88:1935/tvprogram/T-SPORTS/playlist.m3u8', 'http://103.55.144.46:80/hls/t-sports.m3u8'],
  is_active = true,
  updated_at = NOW();

-- 3. SOMOY TV
INSERT INTO channels (name, country, category, language, logo_url, stream_url, quality_tag, module, is_active, source)
VALUES ('SOMOY TV', 'Bangladesh', 'News/Entertainment', 'Bengali', 'https://sunplex.net/iptv/logo/somoy-tv.jpg',
        'http://172.32.1.88:1935/tvprogram/SOMOY-TV/playlist.m3u8', 'auto', 'world_cup_2026', true, 'bdix-local')
ON CONFLICT (name, country) DO UPDATE SET
  stream_url = 'http://172.32.1.88:1935/tvprogram/SOMOY-TV/playlist.m3u8',
  is_active = true,
  updated_at = NOW();

-- 4. GAZI TV HD
INSERT INTO channels (name, country, category, language, logo_url, stream_url, quality_tag, module, is_active, source, alternate_urls)
VALUES ('GAZI TV HD', 'Bangladesh', 'Sports', 'Bengali', 'https://sunplex.net/iptv/logo/gtv-hd-fifa-2022.jpg',
        'https://stream.sunplex.live/GAZI-TV/index.m3u8', 'auto', 'world_cup_2026', true, 'bdix-local',
        ARRAY['http://103.55.144.46:80/hls/Gazi-TV.m3u8'])
ON CONFLICT (name, country) DO UPDATE SET
  stream_url = 'https://stream.sunplex.live/GAZI-TV/index.m3u8',
  alternate_urls = ARRAY['http://103.55.144.46:80/hls/Gazi-TV.m3u8'],
  is_active = true,
  updated_at = NOW();

-- Verify import
SELECT name, stream_url, is_active, updated_at
FROM channels
WHERE source = 'bdix-local' OR name IN ('BTV HD', 'T SPORTS HD', 'SOMOY TV', 'GAZI TV HD')
ORDER BY name;
