"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Eye, EyeOff, Globe } from "lucide-react";
import { toast } from "sonner";
import type { OAuthProvider } from "@/types";

function LoginInner() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale, setLocale } = useI18n();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    if (accessToken && refreshToken) {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      toast.success(t.auth.welcome_back);
      router.push("/dashboard");
      return;
    }
    api.get<OAuthProvider[]>("/api/auth/oauth/providers").then(setOauthProviders).catch(() => {});
  }, [searchParams, router, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await login(username, password); toast.success(t.auth.welcome_back); router.push("/dashboard"); }
    catch { toast.error(t.auth.invalid_credentials); }
    finally { setLoading(false); }
  };

  const handleOAuth = async (provider: string) => {
    try {
      const data = await api.get<{ url: string }>(`/api/auth/oauth/${provider}/authorize`);
      window.location.href = data.url;
    } catch { toast.error("OAuth error"); }
  };

  const providerLabel = (p: OAuthProvider) => {
    const prefix = locale === "zh" ? t.oauth.sign_in_with : t.oauth.sign_in_with;
    return `${prefix} ${p.name} ${locale === "zh" ? "登录" : ""}`.trim();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(79,70,229,0.08)_0%,_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(139,92,246,0.06)_0%,_transparent_50%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-indigo-200/20 to-transparent rounded-full blur-3xl" />
      <div className="absolute top-6 right-6">
        <Button variant="outline" size="sm" onClick={() => setLocale(locale === "zh" ? "en" : "zh")} className="text-xs h-8 rounded-md">
          {locale === "zh" ? "English" : "中文"}
        </Button>
      </div>

      <Card className="w-full max-w-[420px] mx-4 rounded-xl border-0 shadow-xl backdrop-blur-sm relative z-10">
        <CardContent className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{t.brand.name}</h1>
              <p className="text-xs text-muted-foreground">{locale === "zh" ? "企业级 AI Agent 能力中心" : "Enterprise AI Agent Capability Hub"}</p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-foreground">{t.auth.sign_in}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">{t.auth.sign_in_desc}</p>

          {oauthProviders.length > 0 && (
            <div className="space-y-2 mb-6">
              {oauthProviders.map((p) => (
                <Button key={p.id} variant="outline" className="w-full h-11 rounded-md gap-2 text-sm font-medium" onClick={() => handleOAuth(p.id)}>
                  <Globe className="h-4 w-4" />
                  {providerLabel(p)}
                </Button>
              ))}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">or</span></div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t.auth.username}</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" className="h-11 rounded-md bg-muted/30" required />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t.auth.password}</Label>
              <div className="relative">
                <Input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 rounded-md pr-11 bg-muted/30" required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />{t.auth.signing_in}</span> : t.auth.sign_in}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">{t.auth.default_hint}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-10 w-10 rounded-full border-[3px] border-primary border-t-transparent animate-spin" /></div>}>
      <LoginInner />
    </Suspense>
  );
}
