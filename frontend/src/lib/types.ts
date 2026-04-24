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
};

export type ChannelListResponse = {
  total: number;
  page: number;
  page_size: number;
  items: Channel[];
};

export type LiveScore = {
  id: number;
  sport_type: "football" | "cricket";
  league: string;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  match_minute: string | null;
  status: "live" | "upcoming" | "finished";
  extra_data: string | null;
  created_at: string;
  updated_at: string;
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
  live_scores: number;
  active_channels: number;
  cache_ttl_seconds: number;
  scheduled_sync_minutes: number;
  last_sync_at: string | null;
};
