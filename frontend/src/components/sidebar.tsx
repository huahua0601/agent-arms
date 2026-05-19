"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard, Server, Sparkles, Box, Users, Shield, Key,
  FileText, Settings, ChevronLeft, Waypoints, UsersRound, ClipboardCheck, Store,
} from "lucide-react";

interface NavItem { labelKey: keyof typeof import("@/lib/i18n/en").en.nav; href: string; icon: React.ComponentType<{ className?: string }>; permission?: string }
interface NavGroup { titleKey: "menu" | "management" | "others"; items: NavItem[] }

const NAV: NavGroup[] = [
  { titleKey: "menu", items: [
    { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
    { labelKey: "marketplace", href: "/marketplace", icon: Store },
    { labelKey: "mcp_servers", href: "/servers", icon: Server },
    { labelKey: "skills", href: "/skills", icon: Sparkles },
    { labelKey: "gateway", href: "/gateway", icon: Waypoints },
    { labelKey: "teams", href: "/teams", icon: UsersRound },
    { labelKey: "instances", href: "/instances", icon: Box },
  ]},
  { titleKey: "management", items: [
    { labelKey: "reviews", href: "/reviews", icon: ClipboardCheck },
    { labelKey: "users", href: "/users", icon: Users, permission: "user:read" },
    { labelKey: "roles", href: "/roles", icon: Shield, permission: "role:read" },
    { labelKey: "api_keys", href: "/api-keys", icon: Key },
  ]},
  { titleKey: "others", items: [
    { labelKey: "audit_logs", href: "/audit", icon: FileText, permission: "audit_log:read" },
    { labelKey: "settings", href: "/settings", icon: Settings },
  ]},
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useI18n();

  const perms = new Set<string>();
  if (user?.is_superadmin) {
    NAV.flatMap((g) => g.items).forEach((i) => i.permission && perms.add(i.permission));
  } else {
    user?.roles?.forEach((r) => r.permissions?.forEach((p) => perms.add(`${p.resource}:${p.action}`)));
  }

  return (
    <aside className={cn(
      "flex flex-col h-screen bg-white/80 dark:bg-card/80 backdrop-blur-xl border-r border-border/50 transition-all duration-300 ease-in-out shrink-0 z-50",
      collapsed ? "w-[70px]" : "w-[270px]"
    )}>
      {/* User Card */}
      {!collapsed ? (
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 p-3 border border-cyan-100/50 dark:border-cyan-900/30">
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-cyan-200 dark:ring-cyan-800">
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-teal-500 text-white text-sm font-bold">
                {user?.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.display_name || user?.username}</p>
              <p className="text-[11px] text-muted-foreground capitalize truncate">{user?.roles?.[0]?.name || "user"}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-4">
          <Avatar className="h-9 w-9 ring-2 ring-cyan-200 dark:ring-cyan-800">
            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-teal-500 text-white text-xs font-bold">
              {user?.username?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
        {NAV.map((group) => {
          const visible = group.items.filter((i) => !i.permission || perms.has(i.permission));
          if (!visible.length) return null;
          return (
            <div key={group.titleKey}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  {t.nav[group.titleKey]}
                </p>
              )}
              <ul className="space-y-0.5">
                {visible.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? t.nav[item.labelKey] : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 relative",
                          active
                            ? "bg-primary/[0.08] text-primary"
                            : "text-foreground/70 hover:bg-muted hover:text-foreground",
                          collapsed && "justify-center px-2"
                        )}
                      >
                        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary" />}
                        <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                        {!collapsed && <span>{t.nav[item.labelKey]}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-border p-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full rounded-xl py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
