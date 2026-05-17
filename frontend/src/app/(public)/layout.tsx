"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Store, LogIn, LayoutDashboard, LogOut, Globe } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7fa] dark:bg-[#171c23]">
      {/* Public Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-6 h-16 flex items-center justify-between">
          <Link href="/marketplace" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Store className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-foreground leading-tight">{t.brand.name}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {locale === "zh" ? "应用市场" : "Marketplace"}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-xl"
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
              title={locale === "zh" ? "English" : "中文"}
            >
              <Globe className="h-4 w-4" />
            </Button>

            {mounted && !loading && user ? (
              <>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="rounded-xl gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.nav.dashboard}</span>
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <button className="flex items-center gap-2 rounded-xl hover:bg-muted px-2 py-1.5 transition-colors">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                          {(user.username || "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline text-sm font-medium text-foreground">
                        {user.display_name || user.username}
                      </span>
                    </button>
                  } />
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                      {t.nav.settings}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { logout(); router.push("/marketplace"); }}>
                      <LogOut className="h-4 w-4 mr-2" />
                      {t.common.sign_out}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link href="/login">
                <Button className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                  <LogIn className="h-4 w-4" />
                  {t.auth.sign_in}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-5 lg:p-8">
        <div className="max-w-[1600px] mx-auto">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-6">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-6 text-center text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">{t.brand.name}</span>
            {" · "}
            {locale === "zh" ? "企业级 MCP 和 Agent 技能注册中心" : "Enterprise MCP & Agent Skill Registry"}
          </p>
        </div>
      </footer>
    </div>
  );
}
