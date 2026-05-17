"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sun, Moon, Bell, Menu, LogOut, User, ChevronRight } from "lucide-react";

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
    new: locale === "zh" ? "新建" : "New",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-card border-b border-border px-4 lg:px-6">
      {/* Left: Toggle + Breadcrumb */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="lg:hidden rounded-xl p-2 hover:bg-muted text-muted-foreground">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <nav className="hidden sm:flex items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            const label = LABELS[c] || c;
            return (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
                <span className={isLast ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
              </span>
            );
          })}
        </nav>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost" size="icon"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          title={locale === "zh" ? "English" : "中文"}
        >
          <span className="text-xs font-bold">{locale === "zh" ? "En" : "中"}</span>
        </Button>

        <Button
          variant="ghost" size="icon"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted relative">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {user && (
          <button onClick={() => router.push("/settings")} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-muted transition-colors">
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{user.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold leading-none text-foreground">{user.display_name || user.username}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{user.roles?.[0]?.name || "user"}</p>
            </div>
          </button>
        )}

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleLogout} title={t.common.sign_out}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
