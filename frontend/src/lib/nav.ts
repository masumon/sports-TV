import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Home, Menu, Radio, Search } from "lucide-react";

export type NavItemId = "home" | "live" | "sports" | "search" | "more";

export type NavItem = {
  id: NavItemId;
  label: string;
  labelBn: string;
  href?: Route;
  icon: LucideIcon;
  action?: "search" | "more";
};

export const PRIMARY_NAV: NavItem[] = [
  { id: "home", label: "Home", labelBn: "হোম", href: "/", icon: Home },
  { id: "live", label: "Live Matches", labelBn: "লাইভ", href: "/live", icon: Radio },
  { id: "sports", label: "Sports", labelBn: "খেলা", href: "/sports", icon: CalendarDays },
  { id: "search", label: "Search", labelBn: "খুঁজুন", icon: Search, action: "search" },
  { id: "more", label: "More", labelBn: "আরও", icon: Menu, action: "more" },
];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.action) return false;
  if (item.id === "home") return pathname === "/";
  if (!item.href) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
