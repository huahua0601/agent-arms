"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Skill, PaginatedResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Sparkles, User, Globe, Lock } from "lucide-react";

interface SkillTag { id: number; name: string }

const CAT_COLORS: Record<string, string> = {
  general: "#4f46e5", coding: "#7c3aed", devops: "#f59e0b", data: "#3b82f6",
  security: "#ef4444", writing: "#10b981", research: "#ec4899",
  automation: "#f97316", integration: "#06b6d4", other: "#6b7280",
};

export default function SkillsPage() {
  const { t } = useI18n();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tags, setTags] = useState<SkillTag[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const fetchSkills = useCallback(async () => {
    try {
      let url = `/api/skills?page=${page}&page_size=12`;
      if (search) url += `&search=${search}`;
      if (selectedCat) url += `&category=${selectedCat}`;
      if (selectedTags.length) url += `&tags=${selectedTags.join(",")}`;
      const data = await api.get<PaginatedResponse<Skill>>(url);
      setSkills(data.items); setTotal(data.total);
    } catch {}
  }, [page, search, selectedCat, selectedTags]);

  const fetchTags = useCallback(async () => { try { setTags(await api.get<SkillTag[]>("/api/skill-tags")); } catch {} }, []);
  useEffect(() => { fetchSkills(); }, [fetchSkills]);
  useEffect(() => { fetchTags(); }, [fetchTags]);

  const cats = (t.skills as Record<string, unknown>).categories as Record<string, string>;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t.skills.title}</h2>
          <p className="text-sm text-muted-foreground">{total} {t.skills.registered}</p>
        </div>
        <Link href="/skills/new">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 rounded-md shadow-sm text-sm font-medium">
            <Plus className="h-4 w-4 mr-2" />{t.skills.create}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="rounded-lg border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t.skills.search} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-9 pl-9 bg-muted/50 border-0" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={!selectedCat ? "default" : "outline"} className="cursor-pointer text-xs h-7 px-3 rounded-md" onClick={() => { setSelectedCat(""); setPage(1); }}>{t.common.all}</Badge>
            {Object.entries(cats).map(([key, label]) => (
              <Badge key={key} variant={selectedCat === key ? "default" : "outline"} className="cursor-pointer text-xs h-7 px-3 rounded-md" onClick={() => { setSelectedCat(selectedCat === key ? "" : key); setPage(1); }}>{label}</Badge>
            ))}
          </div>
          {tags.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-1">
              {tags.map((tag) => (
                <Badge key={tag.id} variant={selectedTags.includes(tag.name) ? "default" : "outline"} className="cursor-pointer text-[11px] h-6 rounded-md" onClick={() => { setSelectedTags((p) => p.includes(tag.name) ? p.filter((x) => x !== tag.name) : [...p, tag.name]); setPage(1); }}>{tag.name}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {skills.map((s) => (
          <Link key={s.id} href={`/skills/${s.id}`}>
            <Card className="rounded-lg border-0 shadow-sm hover:shadow-md transition-all cursor-pointer h-full group">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${CAT_COLORS[s.category] || "#4f46e5"}12` }}>
                      <Sparkles className="h-5 w-5" style={{ color: CAT_COLORS[s.category] || "#4f46e5" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{s.namespace}</p>
                    </div>
                  </div>
                  {s.is_public ? <Globe className="h-4 w-4 text-muted-foreground shrink-0" /> : <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{s.description || "—"}</p>
                {s.trigger_pattern && <p className="text-[11px] text-muted-foreground bg-muted rounded-md px-2 py-1 font-mono truncate">{s.trigger_pattern}</p>}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <User className="h-3 w-3" /><span>{s.author_name || `#${s.author_id}`}</span>
                    <span>&middot;</span><span>v{s.version}</span>
                  </div>
                  <Badge className="border-0 text-[10px] h-5 rounded" style={{ backgroundColor: `${CAT_COLORS[s.category] || "#4f46e5"}12`, color: CAT_COLORS[s.category] || "#4f46e5" }}>{cats[s.category] || s.category}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {skills.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-base font-medium">{t.skills.no_skills}</p>
          <p className="text-sm mt-1">{t.skills.no_skills_hint}</p>
        </div>
      )}

      {total > 12 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" className="rounded-md" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t.common.previous}</Button>
          <span className="text-sm text-muted-foreground self-center px-4">{t.common.page} {page} {t.common.of} {Math.ceil(total / 12)}</span>
          <Button variant="outline" size="sm" className="rounded-md" disabled={page * 12 >= total} onClick={() => setPage(page + 1)}>{t.common.next}</Button>
        </div>
      )}
    </div>
  );
}
