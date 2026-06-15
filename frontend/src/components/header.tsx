"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sun, Moon, Bell, Menu, LogOut, Search, ChevronRight } from "lucide-react";

export function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();

  const handleLogout = () => { logout(); router.push("/login"); };

  const crumbs = pathname.split("/").filter(Boolean);
  const LABELS: Record<string, string> = {
    dashboard: t.nav.dashboard, servers: t.nav.mcp_servers, skills: t.nav.skills,
    instances: t.nav.instances, users: t.nav.users, roles: t.nav.roles,
    "api-keys": t.nav.api_keys, audit: t.nav.audit_logs, settings: t.nav.settings,
    gateway: "Gateway", reviews: locale === "zh" ? "审核" : "Reviews",
    marketplace: locale === "zh" ? "应用市场" : "Marketplace",
    new: locale === "zh" ? "新建" : "New",
  };
  const pageTitle = LABELS[crumbs[0]] || crumbs[0] || "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-card shadow-sm border-b border-border px-4 lg:px-6">
      {/* Left: Toggle + Page title + Breadcrumb */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="lg:hidden rounded-md p-2 hover:bg-muted text-muted-foreground">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="hidden sm:block">
          <h1 className="text-base font-semibold text-foreground leading-none">{pageTitle}</h1>
          <nav className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              const label = LABELS[c] || c;
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  <span className={isLast ? "text-primary font-medium" : ""}>{label}</span>
                </span>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-muted rounded-md px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={locale === "zh" ? "搜索..." : "Search..."}
            className="bg-transparent border-none outline-none text-sm w-32 placeholder:text-muted-foreground"
          />
        </div>

        <Button
          variant="ghost" size="icon"
          className="h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          title={locale === "zh" ? "English" : "中文"}
        >
          <span className="text-xs font-bold">{locale === "zh" ? "En" : "中"}</span>
        </Button>

        <Button
          variant="ghost" size="icon"
          className="h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {user && (
          <button onClick={() => router.push("/settings")} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{user.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="hidden lg:block text-left">
              <p className="text-sm font-medium leading-none text-foreground">{user.display_name || user.username}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{user.roles?.[0]?.name || "user"}</p>
            </div>
          </button>
        )}

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleLogout} title={t.common.sign_out}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
