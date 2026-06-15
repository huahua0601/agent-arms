"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Server, Sparkles, Box, Users, Shield, Key,
  FileText, Settings, ChevronLeft, Waypoints, ClipboardCheck, Store, Zap,
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
      "flex flex-col h-screen border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0 z-50",
      "bg-white dark:bg-gray-900",
      collapsed ? "w-[72px]" : "w-[260px]"
    )}>
      {/* Brand */}
      <div className={cn(
        "flex items-center h-16 border-b border-sidebar-border shrink-0",
        collapsed ? "justify-center px-2" : "px-5 gap-3"
      )}>
        <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-foreground tracking-tight">AgentArms</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV.map((group) => {
          const visible = group.items.filter((i) => !i.permission || perms.has(i.permission));
          if (!visible.length) return null;
          return (
            <div key={group.titleKey}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.nav[group.titleKey]}
                </p>
              )}
              <ul className="space-y-1">
                {visible.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? t.nav[item.labelKey] : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                          active
                            ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          collapsed && "justify-center px-2"
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary" />
                        )}
                        <item.icon className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )} />
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
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full rounded-md py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
