"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { TeamDetail } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Crown, Shield, User, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

export default function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { t, locale } = useI18n();
  const { confirm } = useConfirm();
  const [team, setTeam] = useState<TeamDetail | null>(null);

  useEffect(() => {
    api.get<TeamDetail>(`/api/teams/${slug}`).then(setTeam).catch(() => router.push("/teams"));
  }, [slug, router]);

  if (!team) return <div className="flex items-center justify-center h-64"><div className="h-10 w-10 rounded-full border-[3px] border-primary border-t-transparent animate-spin" /></div>;

  const roleIcon = (role: string) => {
    if (role === "owner") return <Crown className="h-3.5 w-3.5 text-[#ffae1f]" />;
    if (role === "admin") return <Shield className="h-3.5 w-3.5 text-primary" />;
    return <User className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = { owner: "bg-[#fef5e5] text-[#ffae1f]", admin: "bg-primary/10 text-primary", member: "bg-muted text-muted-foreground" };
    return <Badge className={`${colors[role] || colors.member} border-0 text-[11px] h-5`}>{t.teams[role as keyof typeof t.teams] || role}</Badge>;
  };

  const handleRemove = async (userId: number) => {
    if (!await confirm({ message: t.teams.remove_member, variant: "danger" })) return;
    try {
      await api.del(`/api/teams/${slug}/members/${userId}`);
      toast.success(t.common.success);
      const d = await api.get<TeamDetail>(`/api/teams/${slug}`);
      setTeam(d);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t.common.failure); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/teams")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <UsersRound className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{team.display_name}</h2>
            <p className="text-sm text-muted-foreground font-mono">{team.slug}</p>
          </div>
        </div>
        {team.is_personal && <Badge variant="secondary">{t.teams.personal}</Badge>}
        {team.require_review && <Badge variant="outline">{t.teams.require_review}</Badge>}
      </div>

      {team.description && (
        <Card className="rounded-xl border border-border shadow-sm"><CardContent className="p-5"><p className="text-sm">{team.description}</p></CardContent></Card>
      )}

      <Card className="rounded-xl border border-border shadow-sm">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{t.teams.members} ({team.members.length})</h3>
        </div>
        <CardContent className="px-6 pb-5">
          <div className="space-y-2">
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted/50 transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{(m.username || "?")[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.display_name || m.username}</p>
                  <p className="text-xs text-muted-foreground">@{m.username}</p>
                </div>
                <div className="flex items-center gap-2">
                  {roleIcon(m.role)}
                  {roleBadge(m.role)}
                </div>
                {m.role !== "owner" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(m.user_id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
