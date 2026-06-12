"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";

type AuditLog = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  admin_user: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export default function AuditLogsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!user?.is_admin) {
      router.push("/admin/login");
      return;
    }
    loadAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router, offset]);

  const loadAuditLogs = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/audit-logs?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setTotal(data.total);
      } else {
        toast.error("Failed to load audit logs");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  const actionColor = (action: string) => {
    switch (action) {
      case "import":
        return "text-emerald-400";
      case "edit":
        return "text-blue-400";
      case "delete":
        return "text-rose-400";
      case "sync":
        return "text-amber-400";
      default:
        return "text-zinc-400";
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="border-b border-border-subtle px-6 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle hover:bg-surface-secondary transition"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
              Audit Logs
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Admin actions and playlist management history
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 p-6 sm:p-8">
        {/* Refresh button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOffset(0)}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition"
            style={{
              background: "rgba(245,166,35,0.1)",
              border: "1px solid rgba(245,166,35,0.3)",
              color: "var(--primary-accent)",
            }}
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Logs table */}
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw size={24} className="mx-auto animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-subtle p-12 text-center" style={{ background: "rgba(245,166,35,0.05)" }}>
            <p style={{ color: "var(--text-muted)" }}>No audit logs yet. Admin actions will appear here.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border-subtle overflow-hidden" style={{ background: "var(--bg-card)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "rgba(0,0,0,0.2)" }}>
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>
                      Time
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>
                      Action
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>
                      Entity
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>
                      Admin
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border-subtle hover:bg-white/5 transition">
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {formatDate(log.created_at)}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${actionColor(log.action)}`}>
                        {log.action.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {log.entity_type}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-main)" }}>
                        {log.entity_id || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {log.admin_user || "System"}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs">
                        {log.details ? (
                          <code style={{ color: "var(--text-muted)", fontSize: "10px" }} title={JSON.stringify(log.details, null, 2)}>
                            {Object.keys(log.details).slice(0, 2).join(", ")}
                            {Object.keys(log.details).length > 2 && "…"}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && logs.length > 0 && (
          <div className="flex items-center justify-between text-sm" style={{ color: "var(--text-muted)" }}>
            <span>
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} logs
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="rounded-lg px-3 py-1 border border-border-subtle hover:bg-white/5 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="rounded-lg px-3 py-1 border border-border-subtle hover:bg-white/5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
