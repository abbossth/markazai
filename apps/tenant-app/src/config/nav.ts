import {
  ChartColumn,
  Funnel,
  LayoutDashboard,
  Presentation,
  Settings,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { key: string; href: string; icon: LucideIcon };

export const MAIN_NAV: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "leads", href: "/leads", icon: Funnel },
  { key: "teachers", href: "/teachers", icon: Presentation },
  { key: "groups", href: "/groups", icon: UsersRound },
  { key: "students", href: "/students", icon: Users },
  { key: "finance", href: "/finance", icon: Wallet },
  { key: "reports", href: "/reports", icon: ChartColumn },
];

export const SETTINGS_NAV: NavItem = { key: "settings", href: "/settings", icon: Settings };
