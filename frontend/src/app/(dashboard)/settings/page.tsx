"use client";

import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, Shield, Server } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{t.settings.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.settings.subtitle}</p>
      </div>

      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg bg-primary/12 text-primary font-semibold">{user?.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{user?.display_name || user?.username}</CardTitle>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              <div className="flex gap-1.5 mt-1.5">
                {user?.roles.map((r) => <Badge key={r.id} variant="secondary" className="text-[10px] h-5">{r.name}</Badge>)}
                {user?.is_superadmin && <Badge className="text-[10px] h-5">{t.settings.super_admin}</Badge>}
              </div>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{t.auth.username}</span>
            <span className="font-medium">{user?.username}</span>
            <span className="text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{t.users.email}</span>
            <span>{user?.email}</span>
            <span className="text-muted-foreground flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />{t.common.status}</span>
            <span><Badge variant={user?.is_active ? "default" : "destructive"} className="text-[10px] h-5">{user?.is_active ? "Active" : "Inactive"}</Badge></span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader><CardTitle className="text-sm font-semibold">{t.settings.platform}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5"><Server className="h-3.5 w-3.5" />Platform</span>
            <span>{t.settings.platform_name}</span>
            <span className="text-muted-foreground">API Gateway</span>
            <span className="font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</span>
            <span className="text-muted-foreground">Architecture</span>
            <span>{t.settings.architecture}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
