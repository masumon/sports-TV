import type { LucideIcon } from "lucide-react";
import { Globe, Menu, Radio, Search, Trophy } from "lucide-react";
import type { ViewerModule } from "@/lib/types";

export type NavItemId = "wc" | "live" | "sports" | "search" | "more";

export type NavItem = {
  id: NavItemId;
  label: string;
  icon: LucideIcon;
  action?: "search" | "more" | "module";
  module?: ViewerModule;
};

export const PRIMARY_NAV: NavItem[] = [
  { id: "wc",     label: "WC 2026", icon: Trophy, action: "module", module: "world_cup_2026" },
  { id: "live",   label: "Live",    icon: Radio,  action: "module", module: "live_matches"   },
  { id: "sports", label: "Sports",  icon: Globe,  action: "module", module: "global_sports"  },
  { id: "search", label: "Search",  icon: Search, action: "search"                           },
  { id: "more",   label: "More",    icon: Menu,   action: "more"                             },
];
