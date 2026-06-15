"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { McpServer, Tag, PaginatedResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Server, Wrench, FileText, MessageSquare } from "lucide-react";

interface ServerListItem extends McpServer { tool_count?: number; resource_count?: number; prompt_count?: number; health_status?: string; health_latency_ms?: number }

export default function ServersPage() {
  const { t } = useI18n();
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const fetchServers = useCallback(async () => {
    try {
      let url = `/api/servers?page=${page}&page_size=12`;
      if (search) url += `&search=${search}`;
      if (selectedTags.length) url += `&tags=${selectedTags.join(",")}`;
      const data = await api.get<PaginatedResponse<ServerListItem>>(url);
      setServers(data.items); setTotal(data.total);
    } catch {}
  }, [page, search, selectedTags]);

  const fetchTags = useCallback(async () => { try { setTags(await api.get<Tag[]>("/api/tags")); } catch {} }, []);
  useEffect(() => { fetchServers(); }, [fetchServers]);
  useEffect(() => { fetchTags(); }, [fetchTags]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t.servers.title}</h2>
          <p className="text-sm text-muted-foreground">{total} {t.servers.registered}</p>
        </div>
        <Link href="/servers/new">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 rounded-md shadow-sm text-sm font-medium">
            <Plus className="h-4 w-4 mr-2" />{t.servers.register}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="rounded-lg border-0 shadow-sm">
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t.servers.search} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-9 pl-9 bg-muted/50 border-0" />
          </div>
          {tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.name) ? "default" : "outline"}
                  className="cursor-pointer text-xs h-7 px-3 rounded-md"
                  onClick={() => { setSelectedTags((p) => p.includes(tag.name) ? p.filter((x) => x !== tag.name) : [...p, tag.name]); setPage(1); }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {servers.map((s) => (
          <Link key={s.id} href={`/servers/${s.id}`}>
            <Card className="rounded-lg border-0 shadow-sm hover:shadow-md transition-all cursor-pointer h-full group">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 flex items-center justify-center shrink-0">
                      <Server className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{s.namespace}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5 rounded">{s.transport_type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{s.description || t.servers.no_description}</p>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{s.tool_count ?? 0}</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{s.resource_count ?? 0}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{s.prompt_count ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${s.health_status === "healthy" ? "bg-emerald-500" : s.health_status === "offline" || s.health_status === "error" || s.health_status === "unhealthy" ? "bg-destructive" : "bg-gray-300"}`} />
                    <span className={`text-[10px] font-medium ${s.status === "active" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{s.status}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {servers.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Server className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-base font-medium">{t.servers.no_servers}</p>
          <p className="text-sm mt-1">{t.servers.no_servers_hint}</p>
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
