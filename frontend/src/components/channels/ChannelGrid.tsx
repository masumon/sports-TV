import { ChannelCard, type ChannelCardData } from "./ChannelCard";

type ChannelGridProps = {
  channels: ChannelCardData[];
  activeId?: number | null;
  onSelect?: (channel: ChannelCardData) => void;
  isLive?: boolean;
  className?: string;
};

export function ChannelGrid({ channels, activeId, onSelect, isLive = false, className }: ChannelGridProps) {
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
