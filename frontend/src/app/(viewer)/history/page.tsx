'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, Trash2 } from 'lucide-react';

interface HistoryEntry { id: number; name: string; logo_url: string | null; module: string; watchedAt: number; }

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gstv-watch-history');
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* */ }
  }, []);

  function clearHistory() {
    localStorage.removeItem('gstv-watch-history');
    localStorage.removeItem('gstv-recently-watched');
    setHistory([]);
  }

  if (!history.length) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
      <Clock size={48} style={{ color: 'var(--text-muted)' }} />
      <p className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>কোনো ইতিহাস নেই</p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>চ্যানেল দেখলে এখানে দেখাবে</p>
      <Link href="/" className="rounded-xl px-5 py-2 text-sm font-bold" style={{ background: 'var(--primary-accent)', color: '#0a0a0f' }}>
        চ্যানেল দেখুন
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-3 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black" style={{ color: 'var(--text-main)' }}>Watch History</h1>
        <button type="button" onClick={clearHistory} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Trash2 size={12} /> Clear All
        </button>
      </div>
      <div className="space-y-2">
        {history.slice().reverse().map((entry, i) => (
          <Link key={i} href={`/?channel_id=${entry.id}`} className="flex items-center gap-3 rounded-xl p-3 transition hover:opacity-80" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {entry.logo_url
              ? (
                <Image
                  src={entry.logo_url}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-lg object-contain bg-white"
                  loading="lazy"
                />
              )
              : <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold" style={{ background: 'var(--primary-accent)', color: '#fff' }}>{entry.name.slice(0,1)}</div>
            }
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold" style={{ color: 'var(--text-main)' }}>{entry.name}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(entry.watchedAt).toLocaleString('bn-BD')}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
