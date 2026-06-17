/** Viewer catalog modules — 4 tabs: World Cup, Live Matches, Global Sports, All Channels. */
export type ViewerModule = "world_cup_2026" | "live_matches" | "global_sports" | "all_channels";

/** Config alias — same as ViewerModule (legacy bangladesh_and_bdix removed). */
export type PremiumDirectModule = ViewerModule;

/** Direct stream rows merged into the catalog (not fetched as M3U playlists). */
export type PremiumDirectSportEntry = {
  name: string;
  /** Ordered failover URLs; first is primary `stream_url` on `Channel`. */
  stream_urls: readonly string[];
  module: PremiumDirectModule;
  category?: string;
  country?: string;
  logo_url?: string | null;
  geo_hint?: boolean;
  /** Server-side header profile to inject via /proxy/stream?header_profile= (e.g. "tsports"). */
  header_profile?: string | null;
  /** @deprecated use `stream_urls` */
  stream_url?: string;
  alternate_urls?: readonly string[];
};

/** Admin stream probe (`POST /admin/probe`). */
export type StreamProbeStatus = "alive" | "geo_blocked" | "dead";

export type StreamProbeItem = {
  url: string;
  status: StreamProbeStatus;
  http_status: number | null;
  cached: boolean;
};

export type Channel = {
  id: number;
  name: string;
  country: string;
  category: string;
  language: string;
  logo_url: string | null;
  stream_url: string;
  alternate_urls: string[];
  quality_tag: string;
  module: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Optional server allowlisted preset for /proxy/stream (rare; most channels omit). */
  header_profile?: string | null;
  /** Hint for VPN / geo messaging (FanCode, some Indian networks). */
  geo_hint?: boolean;
  /** "manual" | "m3u_sync" | … — how the channel was added. */
  source?: string;
};

export type ChannelListResponse = {
  total: number;
  page: number;
  page_size: number;
  items: Channel[];
};

export type LiveFixture = {
  id: number;
  source: string;
  external_id: string;
  competition_key: string | null;
  league_name: string;
  home_team: string;
  away_team: string;
  sport: string;
  starts_at_utc: string;
  status: string;
  score_text?: string | null;
  thumb_url: string | null;
  data_attribution: string;
  suggested_channels: Channel[];
};

export type LiveFixtureListResponse = {
  items: LiveFixture[];
  updated_hint: string | null;
};

export type SubscriptionTier = "free" | "premium";

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  is_admin: boolean;
  subscription_tier: SubscriptionTier;
};

export type UserRead = AuthUser & { created_at: string };

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: UserRead;
};

export type AdminStats = {
  users: number;
  channels: number;
  active_channels: number;
  inactive_channels: number;
  cache_ttl_seconds: number;
  scheduled_sync_minutes: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_created?: number;
  last_sync_updated?: number;
  last_sweep_at: string | null;
  last_sweep_checked: number;
  last_sweep_deactivated: number;
  active_module_counts?: Record<string, number>;
};

export type AdminAnalyticsSummary = {
  hours: number;
  playback: { attempts: number; successes: number; failures: number; success_pct: number };
  top_failed: { channel_id: number; channel_name: string; fail_count: number; last_failure: string | null }[];
  most_watched: { channel_id: number; channel_name: string; views: number }[];
  search_no_results: { term: string; count: number }[];
  quick_exits: { channel_id: number; channel_name: string; exit_count: number }[];
  watch_duration: {
    avg_secs: number;
    top_channels: { channel_id: number; channel_name: string; avg_secs: number; total_secs: number }[];
  };
  buffer_stalls: {
    total: number;
    stall_rate_pct: number;
    top_channels: { channel_id: number; channel_name: string; stall_count: number }[];
  };
  error_types: { type: string; count: number }[];
  search_conversion: { searches: number; plays: number; conversion_pct: number };
  tab_engagement: { module: string; switches: number }[];
  failover_depth: { failover_pct: number; servers: { server_idx: number; count: number }[] };
  peak_hours: { hour: number; events: number }[];
  return_visitor?: { new: number; returning: number; return_rate_pct: number };
  channel_health?: { top: { channel_id: number; channel_name: string; score: number; success_rate: number }[]; worst: { channel_id: number; channel_name: string; score: number; success_rate: number }[] };
  playback_retry?: { avg_retries: number; top_channels: { channel_id: number; channel_name: string; avg_retries: number; count: number }[] };
};

export type HealthSweepResult = {
  checked: number;
  deactivated: number;
  duration_seconds: number | null;
};
