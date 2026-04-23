export type Channel = {
  id: number;
  name: string;
  country: string;
  category: string;
  language: string;
  logo_url: string | null;
  stream_url: string;
  quality_tag: string;
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

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  is_admin: boolean;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser & { created_at: string };
};
