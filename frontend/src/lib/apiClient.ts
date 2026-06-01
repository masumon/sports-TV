import type {
  AdminStats,
  Channel,
  ChannelListResponse,
  LiveFixtureListResponse,
  StreamProbeItem,
  TokenResponse,
  UserRead,
} from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

/** Default `/api` matches Vercel rewrites → Render (same-origin, no CORS). Override for local direct backend. */
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api").replace(/\/$/, "");
/**
 * Avoids .../api/api/... when the base URL already ends with "/api":
 *  - relative proxy path: /api  → API_V1 = /v1   → full path = /api/v1/...
 *  - absolute URL:  https://host/api → API_V1 = /v1   → full path = https://host/api/v1/...
 *  - absolute URL:  https://host     → API_V1 = /api/v1 → full path = https://host/api/v1/...
 */
const endsWithApi = API_BASE_URL.endsWith("/api");
const API_V1 = endsWithApi ? "/v1" : "/api/v1";

/** Resolves a path like `/sports-tv/channels` or `/proxy/stream` to the same origin the rest of the app uses. */
export function buildApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${API_V1}${normalized}`;
}

/** @deprecated Use `buildApiUrl` — same implementation. */
export const buildApiV1Url = buildApiUrl;

type ApiRequestOptions = RequestInit & {
  /** When set, 401 will clear the persisted auth session. */
  authToken?: string | null;
  /** Request timeout in milliseconds. Defaults to no timeout. */
  timeoutMs?: number;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { headers: optionHeaders, authToken, timeoutMs, ...rest } = options;
  const merged: Record<string, string> = {
    "Content-Type": "application/json",
    ...(optionHeaders as Record<string, string> | undefined),
  };
  if (authToken) merged["Authorization"] = `Bearer ${authToken}`;

  let signal = rest.signal ?? undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0 && !signal) {
    const controller = new AbortController();
    signal = controller.signal;
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  let res: Response;
  try {
    res = await fetch(buildApiUrl(path), { ...rest, headers: merged, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out — backend may be waking up, try again shortly");
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  if (res.status === 401) {
    const authz = merged["Authorization"] || merged["authorization"];
    if (authz && authz.toLowerCase().startsWith("bearer ") && typeof window !== "undefined") {
      useAuthStore.getState().clearSession();
    }
    let message = "Session expired or unauthorized";
    try {
      const errBody: unknown = await res.json();
      if (errBody && typeof errBody === "object" && "detail" in errBody) {
        const detail = (errBody as { detail: unknown }).detail;
        if (typeof detail === "string") message = detail;
      }
    } catch {
      /* */
    }
    throw new Error(message);
  }

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
      /* */
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
  language?: string;
  module?: string;
};

export type ChannelFilters = {
  countries: string[];
  categories: string[];
  languages: string[];
  modules: string[];
};

type AdminChannelCreateBody = {
  name: string;
  country: string;
  category: string;
  language: string;
  logo_url: string | null;
  stream_url: string;
  quality_tag: string;
  module: string;
  is_active: boolean;
  alternate_urls?: string[];
};

export async function fetchAllChannels(
  filters: Omit<ChannelListParams, "page" | "page_size"> = {}
): Promise<Channel[]> {
  const pageSize = 500;
  const first: ChannelListResponse = await apiClient.getChannels({ ...filters, page: 1, page_size: pageSize });
  const { total, items: firstItems } = first;
  if (firstItems.length === 0 || firstItems.length >= total) {
    return firstItems;
  }
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) {
    return firstItems;
  }
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      apiClient.getChannels({ ...filters, page: i + 2, page_size: pageSize })
    )
  );
  return firstItems.concat(...rest.map((r) => r.items));
}

export const apiClient = {
  getChannels(params: ChannelListParams = {}) {
    const sp = new URLSearchParams();
    if (params.page != null) sp.set("page", String(params.page));
    if (params.page_size != null) sp.set("page_size", String(params.page_size));
    if (params.search) sp.set("search", params.search);
    if (params.country) sp.set("country", params.country);
    if (params.category) sp.set("category", params.category);
    if (params.language) sp.set("language", params.language);
    if (params.module) sp.set("module", params.module);
    const q = sp.toString();
    return apiRequest<ChannelListResponse>(`/sports-tv/channels${q ? `?${q}` : ""}`);
  },

  getChannelFilters() {
    return apiRequest<ChannelFilters>("/sports-tv/filters");
  },

  getLiveFixtures(params: { hours_back?: number; days_ahead?: number } = {}) {
    const sp = new URLSearchParams();
    if (params.hours_back != null) sp.set("hours_back", String(params.hours_back));
    if (params.days_ahead != null) sp.set("days_ahead", String(params.days_ahead));
    const q = sp.toString();
    return apiRequest<LiveFixtureListResponse>(`/sports-tv/fixtures${q ? `?${q}` : ""}`);
  },

  /** Flush server-side Redis list caches (public POST). */
  invalidateListCaches() {
    return apiRequest<{ detail: string; message: string }>("/sports-tv/invalidate-cache", {
      method: "POST",
    });
  },

  register(fullName: string, email: string, password: string) {
    return apiRequest<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name: fullName, email, password }),
    });
  },

  login(email: string, password: string) {
    return apiRequest<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  getMe(token: string) {
    return apiRequest<UserRead>("/auth/me", { method: "GET", authToken: token });
  },

  adminStats(token: string) {
    return apiRequest<AdminStats>("/admin/stats", { method: "GET", authToken: token });
  },

  adminListChannels(token: string) {
    return apiRequest<Channel[]>("/admin/channels", { method: "GET", authToken: token });
  },

  adminCreateChannel(token: string, body: AdminChannelCreateBody) {
    return apiRequest<Channel>("/admin/channels", {
      method: "POST",
      authToken: token,
      body: JSON.stringify(body),
    });
  },

  adminUpdateChannel(token: string, id: number, body: Partial<AdminChannelCreateBody & { alternate_urls?: string[] }>) {
    return apiRequest<Channel>(`/admin/channels/${id}`, {
      method: "PUT",
      authToken: token,
      body: JSON.stringify(body),
    });
  },

  adminDeleteChannel(token: string, id: number) {
    return apiRequest<void>(`/admin/channels/${id}`, { method: "DELETE", authToken: token });
  },

  adminSyncChannels(token: string) {
    return apiRequest<Record<string, number>>("/admin/channels/sync", {
      method: "POST",
      authToken: token,
      timeoutMs: 5 * 60 * 1000, // 5 minutes — M3U sync can be slow on free tier
    });
  },

  adminSyncFixtures(token: string) {
    return apiRequest<Record<string, number>>("/admin/fixtures/sync", {
      method: "POST",
      authToken: token,
      timeoutMs: 2 * 60 * 1000, // 2 minutes
    });
  },

  adminProbeStreams(token: string, urls: string[]) {
    return apiRequest<{ results: StreamProbeItem[] }>("/admin/proxy/probe", {
      method: "POST",
      authToken: token,
      body: JSON.stringify({ urls }),
    });
  },

  adminHealthSweep(token: string) {
    return apiRequest<{ checked: number; deactivated: number; duration_seconds: number | null }>(
      "/admin/channels/health-sweep",
      {
        method: "POST",
        authToken: token,
        timeoutMs: 10 * 60 * 1000,
      }
    );
  },

  adminPurgeInactive(token: string) {
    return apiRequest<{ deleted: number }>(
      "/admin/channels/purge-inactive",
      { method: "POST", authToken: token }
    );
  },

  /** No auth — only for admin accounts. Returns a one-time token in JSON (no email from server). */
  requestAdminPasswordReset(email: string) {
    return apiRequest<{
      detail: string;
      reset_token: string | null;
      token_expires_in_minutes: number;
    }>("/auth/admin/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    });
  },

  adminResetPassword(email: string, token: string, newPassword: string) {
    return apiRequest<{ detail: string }>("/auth/admin/reset-password", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        new_password: newPassword,
      }),
    });
  },
};
