"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import type { PaginatedResponse, Team } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsersRound, Plus, User, Crown, Shield } from "lucide-react";
import { toast } from "sonner";

export default function TeamsPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<PaginatedResponse<Team>>("/api/teams?page=1&page_size=50").then((d) => { setTeams(d.items); setTotal(d.total); }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!slug || !displayName) return;
    setCreating(true);
    try {
      await api.post("/api/teams", { slug, display_name: displayName, description: desc || null });
      toast.success(t.common.success);
      setShowCreate(false);
      setSlug(""); setDisplayName(""); setDesc("");
      const d = await api.get<PaginatedResponse<Team>>("/api/teams?page=1&page_size=50");
      setTeams(d.items); setTotal(d.total);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t.common.failure); }
    finally { setCreating(false); }
  };

  const roleIcon = (role: string) => {
    if (role === "owner") return <Crown className="h-3 w-3" />;
    if (role === "admin") return <Shield className="h-3 w-3" />;
    return <User className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.teams.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} {locale === "zh" ? "个团队" : "teams"}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4" />{t.teams.create}
        </Button>
      </div>

      {showCreate && (
        <Card className="rounded-xl border border-primary/20 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t.teams.slug}</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="my-team" className="mt-1 rounded-xl" />
                <p className="text-[10px] text-muted-foreground mt-1">{t.teams.slug_hint}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t.teams.display_name}</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="My Team" className="mt-1 rounded-xl" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t.teams.description}</label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl">{t.common.cancel}</Button>
              <Button onClick={handleCreate} disabled={creating || !slug || !displayName} className="rounded-xl bg-primary text-white">{creating ? t.common.loading : t.common.create}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <Link key={team.id} href={`/teams/${team.slug}`}>
            <Card className="rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <UsersRound className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{team.display_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{team.slug}</p>
                  </div>
                  {team.is_personal && <Badge variant="secondary" className="text-[10px] h-5">{t.teams.personal}</Badge>}
                </div>
                {team.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{team.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><UsersRound className="h-3 w-3" />{team.member_count}</span>
                  {team.require_review && <Badge variant="outline" className="text-[10px] h-5">{t.teams.require_review}</Badge>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {teams.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground text-sm">{t.teams.no_teams}</div>
        )}
      </div>
    </div>
  );
}
