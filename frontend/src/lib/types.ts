/** Viewer catalog modules (M3U + FanCode); replaces legacy DB module slugs for the home experience. */
export type ViewerModule =
  | "bangladesh"
  | "india"
  | "global_sports"
  | "fast_tv"
  | "live_matches";

/** Config-only alias for premium rows targeting the Bangladesh tab. */
export type PremiumDirectModule = ViewerModule | "bangladesh_and_bdix";

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
};

export type ChannelListResponse = {
  total: number;
  page: number;
  page_size: number;
  items: Channel[];
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
  cache_ttl_seconds: number;
  scheduled_sync_minutes: number;
  last_sync_at: string | null;
};
