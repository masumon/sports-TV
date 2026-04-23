import type { Channel, ChannelListResponse, LiveScore, TokenResponse } from "@/lib/types";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}/api/v1${normalized}`;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers: optionHeaders, ...rest } = options;
  const res = await fetch(buildUrl(path), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(optionHeaders as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    let message = "API request failed";
    try {
      const errBody: unknown = await res.json();
      if (errBody && typeof errBody === "object" && "detail" in errBody) {
        const detail = (errBody as { detail: unknown }).detail;
        if (typeof detail === "string") message = detail;
        else if (Array.isArray(detail))
          message = detail.map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : "")).join(", ");
      }
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

type ChannelListParams = {
  page?: number;
  page_size?: number;
  search?: string;
  country?: string;
  category?: string;
};

type AdminChannelCreateBody = {
  name: string;
  country: string;
  category: string;
  language: string;
  logo_url: string | null;
  stream_url: string;
  quality_tag: string;
  is_active: boolean;
};

type AdminScoreCreateBody = {
  sport_type: "football" | "cricket";
  league: string;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  match_minute: string | null;
  status: "live" | "upcoming" | "finished";
  extra_data: string | null;
};

export const apiClient = {
  getChannels(params: ChannelListParams = {}) {
    const sp = new URLSearchParams();
    if (params.page != null) sp.set("page", String(params.page));
    if (params.page_size != null) sp.set("page_size", String(params.page_size));
    if (params.search) sp.set("search", params.search);
    if (params.country) sp.set("country", params.country);
    if (params.category) sp.set("category", params.category);
    const q = sp.toString();
    return apiRequest<ChannelListResponse>(`/sports-tv/channels${q ? `?${q}` : ""}`);
  },

  getLiveScores(sportType?: string, limit?: number) {
    const sp = new URLSearchParams();
    if (sportType) sp.set("sport_type", sportType);
    if (limit != null) sp.set("limit", String(limit));
    const q = sp.toString();
    return apiRequest<LiveScore[]>(`/live-scores${q ? `?${q}` : ""}`);
  },

  login(email: string, password: string) {
    return apiRequest<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  adminListChannels(token: string) {
    return apiRequest<Channel[]>("/admin/channels", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  adminListScores(token: string) {
    return apiRequest<LiveScore[]>("/admin/scores", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  adminCreateChannel(token: string, body: AdminChannelCreateBody) {
    return apiRequest<Channel>("/admin/channels", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  },

  adminCreateScore(token: string, body: AdminScoreCreateBody) {
    return apiRequest<LiveScore>("/admin/scores", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  },

  adminDeleteChannel(token: string, id: number) {
    return apiRequest<void>(`/admin/channels/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  adminDeleteScore(token: string, id: number) {
    return apiRequest<void>(`/admin/scores/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  adminSyncChannels(token: string) {
    return apiRequest<Record<string, number>>("/admin/channels/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
