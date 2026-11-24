import {
  Bell, Gift, Heart, Home, LayoutDashboard, Leaf, Megaphone, Search, ShieldCheck, ShoppingBasket, Sparkles, Trophy, User, Wheat,
  HelpCircle, ClipboardList, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; public?: boolean; adminOnly?: boolean };

/** Every section of the app. The sidebar and the phone menu are both built from this one list. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/find-food", label: "Find Food", icon: ShoppingBasket, public: true },
  { href: "/donate", label: "Donate Food", icon: Heart },
  { href: "/farmer-market", label: "Farmer Market", icon: Wheat, public: true },
  { href: "/ai", label: "AI Recommendations", icon: Sparkles },
  { href: "/promote", label: "Promote & Advertise", icon: Megaphone },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/activity", label: "My Activity", icon: ClipboardList },
  { href: "/credits", label: "Promotional Credits", icon: Gift },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, public: true },
  { href: "/profile", label: "Profile & Settings", icon: User },
  { href: "/help", label: "Help & Food Safety", icon: HelpCircle, public: true },
  { href: "/admin", label: "Administration", icon: ShieldCheck, adminOnly: true },
];

/** The five phone tabs. Everything else is reachable from the Menu button. */
export const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/find-food", label: "Explore", icon: Search },
  { href: "/donate", label: "Post", icon: Leaf },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
