import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Home, Radio, User } from "lucide-react";

export type NavItemId = "home" | "sports" | "live" | "profile";

export type NavItem = {
  id: NavItemId;
  label: string;
  labelBn: string;
  href: Route;
  icon: LucideIcon;
};

export const PRIMARY_NAV: NavItem[] = [
  { id: "home", label: "Home", labelBn: "হোম", href: "/", icon: Home },
  { id: "sports", label: "Sports", labelBn: "খেলা", href: "/sports", icon: CalendarDays },
  { id: "live", label: "Live", labelBn: "লাইভ", href: "/live", icon: Radio },
  { id: "profile", label: "Profile", labelBn: "প্রোফাইল", href: "/profile", icon: User },
];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.id === "home") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
