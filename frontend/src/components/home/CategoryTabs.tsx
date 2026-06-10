"use client";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { PillTab } from "@/components/ui/PillTab";
import type { ViewerModule } from "@/lib/types";

export type CategoryTab = {
  id: ViewerModule | string;
  label: string;
  icon?: string;
  count?: number;
};

type CategoryTabsProps = {
  tabs: CategoryTab[];
  activeCategory: string;
  onChange: (id: string) => void;
  className?: string;
};

export function CategoryTabs({ tabs, activeCategory, onChange, className }: CategoryTabsProps) {
  return (
    <ScrollArea className={className} aria-label="Category tabs">
      {tabs.map((tab) => (
        <PillTab
          key={tab.id}
          active={activeCategory === tab.id}
          onClick={() => onChange(tab.id)}
          icon={tab.icon ? <span aria-hidden>{tab.icon}</span> : undefined}
        >
          <span className="font-semibold">{tab.label}</span>
          {tab.count != null && tab.count > 0 ? (
            <span className="ml-0.5 text-[9px] font-medium tabular-nums opacity-70">
              ({tab.count > 9999 ? "9999+" : tab.count})
            </span>
          ) : null}
        </PillTab>
      ))}
    </ScrollArea>
  );
}
