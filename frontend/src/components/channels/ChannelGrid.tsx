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
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-subtle bg-surface-secondary/50 py-12 px-4 text-center">
        <p className="text-sm font-medium text-foreground">No channels found</p>
        <p className="text-xs text-muted-foreground">Try adjusting your filters or search terms</p>
      </div>
    );
  }

  return (
    <div
      role="list"
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:gap-4 ${className ?? ""}`}
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
