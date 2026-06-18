import { ChannelCard, type ChannelCardData } from "./ChannelCard";

type ChannelGridProps = {
  channels: ChannelCardData[];
  activeId?: number | null;
  onSelect?: (channel: ChannelCardData) => void;
  isLive?: boolean;
  className?: string;
};

export function ChannelGrid({ channels, activeId, onSelect, isLive = false, className }: ChannelGridProps) {
  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-subtle bg-surface-secondary/50 py-10 px-5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)" }}>
          <span className="text-xl" aria-hidden>📺</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">কোনো চ্যানেল পাওয়া যায়নি</p>
          <p className="mt-1 text-xs text-muted-foreground">আপনার ফিল্টার বা সার্চ টার্ম সামঞ্জস্য করে দেখুন</p>
        </div>
        <ul className="mt-1.5 text-xs text-muted-foreground space-y-1">
          <li>✓ সার্চ টেক্সট পরিবর্তন করুন</li>
          <li>✓ অন্য ক্যাটাগরি বেছে নিন</li>
          <li>✓ সব ফিল্টার সরান এবং আবার চেষ্টা করুন</li>
        </ul>
      </div>
    );
  }

  return (
    <div
      role="list"
      className={`grid grid-cols-3 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-3.5 xl:gap-4 ${className ?? ""}`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 520px" }}
    >
      {channels.map((channel) => (
        <div key={channel.id} role="listitem" style={{ contentVisibility: "auto" }}>
          <ChannelCard
            channel={channel}
            active={activeId === channel.id}
            isLive={isLive}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  );
}
