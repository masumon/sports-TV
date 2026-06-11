import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: "পেজ পাওয়া যায়নি",
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#080a11] px-4 text-center text-white">
      <Image src={BRAND.logo.png} alt={BRAND.name} width={72} height={72} className="mb-4 object-contain opacity-90" />
      <div className="mb-4 text-7xl font-extrabold text-amber-500 tabular-nums">404</div>
      <h1 className="mb-2 text-xl font-bold">পেজটি পাওয়া যায়নি</h1>
      <p className="mb-8 text-sm text-zinc-400">
        আপনি যে পেজটি খুঁজছেন সেটি সরানো হয়েছে বা ঠিকানাটি ভুল।
      </p>
      <Link
        href="/"
        className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 active:scale-95"
      >
        হোমে ফিরে যান
      </Link>
    </div>
  );
}
