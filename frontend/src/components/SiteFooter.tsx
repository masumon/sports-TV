import { ExternalLink, Heart } from "lucide-react";
import Link from "next/link";

const DEVELOPER_SITE = "https://mumainsumon.netlify.app/";
const REPO_HINT = "https://github.com/masumon/sports-TV";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/95 text-slate-400 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-6 lg:px-8">
        <div className="max-w-md space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">Global Sports Live TV</p>
          <p className="text-sm leading-relaxed text-slate-300">
            লাইভ স্পোর্টস চ্যানেল ডিরেক্টরি, HLS প্লেয়ার এবং রিয়েল-টাইম স্কোর ওভারলে — FastAPI + Next.js মনোরেপো। PWA হিসেবে ইনস্টল
            করতে ব্রাউজার মেনু থেকে &quot;Install app&quot; বেছে নিন।
          </p>
        </div>

        <div className="flex flex-col gap-4 text-sm md:text-right">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">ডেভেলপমেন্ট ও আর্কিটেকচার</p>
            <Link
              href={DEVELOPER_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 font-medium text-sky-300 transition hover:text-sky-200"
            >
              Mumain Ahmed — AI Solution Architect
              <ExternalLink size={14} className="opacity-70 group-hover:opacity-100" />
            </Link>
            <p className="mt-1 text-xs text-slate-500">ফুল-স্ট্যাক · এন্টারপ্রাইজ সিস্টেম · পোর্টফোলিও ও যোগাযোগ</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-end">
            <Link
              href={REPO_HINT}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 underline-offset-4 transition hover:text-slate-300 hover:underline"
            >
              সোর্স কোড (GitHub)
            </Link>
            <span className="hidden text-slate-700 sm:inline">·</span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Heart size={12} className="text-rose-400/80" />
              Built with Next.js 15 &amp; FastAPI
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-900/80 py-4 text-center text-[11px] text-slate-600">
        © {new Date().getFullYear()} Global Sports Live TV · সমস্ত স্ট্রিম তৃতীয় পক্ষের উৎসের জন্য দায়বদ্ধ নয়
      </div>
    </footer>
  );
}
