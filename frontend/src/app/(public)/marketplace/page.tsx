"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Server, Sparkles, Search, Download, TrendingUp, Store, Wrench, Tag as TagIcon, ExternalLink } from "lucide-react";

interface MarketplaceMcpItem {
  name: string;
  namespace: string;
  description: string | null;
  version: string;
  transport_type: string;
  endpoint_url: string | null;
  auth_type: string;
  health_status: string;
  tags: string[];
  tool_count: number;
  manifest_url: string;
  cursor_config_url: string;
}

interface MarketplaceSkillItem {
  name: string;
  namespace: string;
  description: string | null;
  category: string;
  version: string;
  author: string | null;
  tags: string[];
  downloads: number;
  install_url: string;
  manifest_url: string;
  created_at: string | null;
}

type Tab = "mcp" | "skills";

export default function MarketplacePage() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("mcp");
  const [search, setSearch] = useState("");
  const [mcpItems, setMcpItems] = useState<MarketplaceMcpItem[]>([]);
  const [skillItems, setSkillItems] = useState<MarketplaceSkillItem[]>([]);
  const [mcpTotal, setMcpTotal] = useState(0);
  const [skillTotal, setSkillTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadMcp = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = `/registry/v1/mcp${q ? `?q=${encodeURIComponent(q)}` : ""}`;
      const resp = await fetch(url);
      const data = await resp.json();
      setMcpItems(data.items || []);
      setMcpTotal(data.total || 0);
    } catch { setMcpItems([]); } finally { setLoading(false); }
  }, []);

  const loadSkills = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = `/registry/v1/skills${q ? `?q=${encodeURIComponent(q)}` : ""}`;
      const resp = await fetch(url);
      const data = await resp.json();
      setSkillItems(data.items || []);
      setSkillTotal(data.total || 0);
    } catch { setSkillItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "mcp") loadMcp(search);
    else loadSkills(search);
  }, [tab, search, loadMcp, loadSkills]);

  const categoryColors: Record<string, string> = {
    coding: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    devops: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    data: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    security: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    writing: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    research: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400",
    automation: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    integration: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    general: "bg-muted text-muted-foreground",
    other: "bg-muted text-muted-foreground",
  };

  const healthDot = (status: string) => {
    const color = status === "healthy" ? "bg-emerald-500" :
                  status === "offline" ? "bg-gray-400" :
                  status === "timeout" ? "bg-amber-500" :
                  status === "unknown" ? "bg-gray-300" : "bg-destructive";
    return <span className={`h-2 w-2 rounded-full ${color} ${status === "healthy" ? "animate-pulse" : ""}`} />;
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="rounded-lg border-0 shadow-sm bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden relative">
        <CardContent className="p-8 relative z-10">
          <div className="flex items-start gap-5">
            <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Store className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {locale === "zh" ? "应用市场" : "Marketplace"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
                {locale === "zh"
                  ? "发现并使用经过审核的 MCP 服务和 Agent 技能。所有公开资源均经过管理员审核，确保质量和安全。"
                  : "Discover and use reviewed MCP servers and Agent skills. All public resources have been reviewed by admins to ensure quality and safety."}
              </p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Server className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">{mcpTotal}</span>
                  <span className="text-muted-foreground">{locale === "zh" ? "个 MCP 服务" : "MCP Servers"}</span>
                </div>
                <div className="text-muted-foreground">·</div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">{skillTotal}</span>
                  <span className="text-muted-foreground">{locale === "zh" ? "个 Agent 技能" : "Agent Skills"}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-md border border-border p-0.5 bg-card">
          <button
            onClick={() => setTab("mcp")}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${tab === "mcp" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Server className="h-4 w-4" />
            MCP Servers ({mcpTotal})
          </button>
          <button
            onClick={() => setTab("skills")}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${tab === "skills" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Sparkles className="h-4 w-4" />
            Agent Skills ({skillTotal})
          </button>
        </div>
        <div className="relative max-w-md flex-1 sm:flex-initial sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={locale === "zh" ? `搜索 ${tab === "mcp" ? "MCP 服务" : "技能"}...` : `Search ${tab === "mcp" ? "MCP servers" : "skills"}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-md"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-10 w-10 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
        </div>
      ) : tab === "mcp" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mcpItems.map((item) => (
            <Card key={item.namespace} className="rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Server className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{item.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono truncate">{item.namespace}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">{healthDot(item.health_status)}</div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem] mb-3">
                  {item.description || (locale === "zh" ? "暂无描述" : "No description")}
                </p>
                <div className="flex items-center flex-wrap gap-1.5 mb-3">
                  <Badge variant="secondary" className="text-[10px] h-5">{item.transport_type}</Badge>
                  <Badge variant="outline" className="text-[10px] h-5"><Wrench className="h-2.5 w-2.5 mr-0.5" />{item.tool_count} tools</Badge>
                  {item.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] h-5"><TagIcon className="h-2.5 w-2.5 mr-0.5" />{tag}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Link href={`/servers`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full rounded-lg text-xs">
                      {locale === "zh" ? "详情" : "Details"}
                    </Button>
                  </Link>
                  <a href={item.cursor_config_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button size="sm" className="w-full rounded-lg text-xs bg-primary text-white hover:bg-primary/90">
                      <Download className="h-3 w-3 mr-1" />
                      {locale === "zh" ? "获取配置" : "Config"}
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
          {mcpItems.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{locale === "zh" ? "暂无可用的 MCP 服务" : "No MCP servers available"}</p>
              <p className="text-xs mt-1">{locale === "zh" ? "注册服务后提交审核即可在此展示" : "Submit a server for review to display it here"}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {skillItems.map((item) => (
            <Card key={item.namespace} className="rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{item.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono truncate">{item.namespace}</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] h-5 border-0 ${categoryColors[item.category] || categoryColors.other}`}>{item.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem] mb-3">
                  {item.description || (locale === "zh" ? "暂无描述" : "No description")}
                </p>
                <div className="flex items-center flex-wrap gap-1.5 mb-3">
                  <Badge variant="outline" className="text-[10px] h-5">v{item.version}</Badge>
                  <Badge variant="outline" className="text-[10px] h-5">
                    <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                    {item.downloads} {locale === "zh" ? "次下载" : "downloads"}
                  </Badge>
                  {item.author && <Badge variant="outline" className="text-[10px] h-5">@{item.author}</Badge>}
                </div>
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Link href="/skills" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full rounded-lg text-xs">
                      {locale === "zh" ? "详情" : "Details"}
                    </Button>
                  </Link>
                  <a href={item.install_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button size="sm" className="w-full rounded-lg text-xs bg-primary text-white hover:bg-primary/90">
                      <Download className="h-3 w-3 mr-1" />
                      {locale === "zh" ? "安装" : "Install"}
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
          {skillItems.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{locale === "zh" ? "暂无可用的 Agent 技能" : "No Agent skills available"}</p>
              <p className="text-xs mt-1">{locale === "zh" ? "创建技能后提交审核即可在此展示" : "Create a skill and submit for review to display it here"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
