"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { McpServer, McpTool, McpResource, McpPrompt, ServerVersion, TunnelToken } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trash2, Wrench, FileText, MessageSquare, History, Globe, RefreshCw, Heart, Loader2, Shield, Download, Copy, FileCode, ClipboardCheck, Radio, Zap } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { toast } from "sonner";

type ServerDetail = McpServer & {
  tools?: McpTool[]; resources?: McpResource[]; prompts?: McpPrompt[]; versions?: ServerVersion[];
  health_status?: string; last_health_check?: string; health_latency_ms?: number;
  auth_config?: Record<string, string>;
  openapi_spec?: Record<string, unknown> | null;
  tunnel_enabled?: boolean;
};

const HEALTH_STYLE: Record<string, { dot: string; label: string }> = {
  healthy: { dot: "bg-[#13deb9]", label: "Healthy" },
  unhealthy: { dot: "bg-destructive", label: "Unhealthy" },
  offline: { dot: "bg-gray-400", label: "Offline" },
  timeout: { dot: "bg-[#ffae1f]", label: "Timeout" },
  error: { dot: "bg-destructive", label: "Error" },
  unknown: { dot: "bg-gray-300", label: "Unknown" },
};

export default function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t, locale } = useI18n();
  const [server, setServer] = useState<ServerDetail | null>(null);
  const [checking, setChecking] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [openapiText, setOpenapiText] = useState("");
  const [openapiConverting, setOpenapiConverting] = useState(false);
  const [showOpenapi, setShowOpenapi] = useState(false);
  const [tunnelTokens, setTunnelTokens] = useState<TunnelToken[]>([]);
  const [showCreateTunnel, setShowCreateTunnel] = useState(false);
  const [newTunnelName, setNewTunnelName] = useState("");
  const [creatingTunnel, setCreatingTunnel] = useState(false);
  const [newTunnelToken, setNewTunnelToken] = useState<TunnelToken | null>(null);
  const { confirm } = useConfirm();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const fetchServer = useCallback(async () => {
    try { setServer(await api.get(`/api/servers/${id}`) as ServerDetail); }
    catch { toast.error(t.common.failure); router.push("/servers"); }
  }, [id, router, t]);

  const fetchTunnelTokens = useCallback(async () => {
    try { setTunnelTokens(await api.get<TunnelToken[]>(`/api/tunnel/tokens?server_id=${id}`)); } catch {}
  }, [id]);

  const handleCreateTunnel = async () => {
    if (!newTunnelName.trim()) return;
    setCreatingTunnel(true);
    try {
      const token = await api.post<TunnelToken>("/api/tunnel/tokens", { name: newTunnelName, server_id: Number(id) });
      setNewTunnelToken(token);
      setNewTunnelName("");
      setShowCreateTunnel(false);
      fetchServer();
      fetchTunnelTokens();
      toast.success(locale === "zh" ? "Tunnel token 已创建" : "Tunnel token created");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setCreatingTunnel(false); }
  };

  const handleDeleteTunnel = async (tokenId: number) => {
    if (!await confirm({ message: locale === "zh" ? "确定删除此 token？删除后 agent 将无法连接" : "Delete this token? Agent will be disconnected.", variant: "danger" })) return;
    try {
      await api.del(`/api/tunnel/tokens/${tokenId}`);
      toast.success(t.common.success);
      fetchTunnelTokens();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  useEffect(() => { fetchServer(); fetchTunnelTokens(); }, [fetchServer, fetchTunnelTokens]);

  const handleDelete = async () => {
    if (!await confirm({ message: t.common.confirm_delete, variant: "danger" })) return;
    try { await api.del(`/api/servers/${id}`); toast.success(t.common.success); router.push("/servers"); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : t.common.failure); }
  };

  const handleHealthCheck = async () => {
    setChecking(true);
    try {
      const result = await api.post<{ status: string; latency_ms?: number; error?: string }>(`/api/servers/${id}/health`);
      if (result.status === "healthy") {
        toast.success(`${locale === "zh" ? "健康" : "Healthy"} — ${result.latency_ms}ms`);
      } else {
        toast.error(`${result.status}: ${result.error || ""}`);
      }
      fetchServer();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.common.failure);
    } finally { setChecking(false); }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const result = await api.post<{ success: boolean; error?: string; tools: number; resources: number; prompts: number }>(`/api/servers/${id}/discover`);
      if (result.success) {
        toast.success(locale === "zh"
          ? `发现完成！${result.tools} 个工具, ${result.resources} 个资源, ${result.prompts} 个提示模板`
          : `Discovered ${result.tools} tools, ${result.resources} resources, ${result.prompts} prompts`);
      } else {
        toast.error(locale === "zh" ? `发现失败: ${result.error}` : `Discovery failed: ${result.error}`);
      }
      fetchServer();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.common.failure);
    } finally { setDiscovering(false); }
  };

  const handleSubmitReview = async () => {
    try {
      await api.post("/api/reviews/submit", { resource_type: "server", resource_id: Number(id) });
      toast.success(locale === "zh" ? "已提交审核，等待管理员批准" : "Submitted for review");
      fetchServer();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t.common.failure); }
  };

  if (!server) return <div className="flex items-center justify-center h-64"><div className="h-10 w-10 rounded-full border-[3px] border-primary border-t-transparent animate-spin" /></div>;

  const handleOpenApiConvert = async () => {
    if (!openapiText.trim()) return;
    setOpenapiConverting(true);
    try {
      let specObj: unknown;
      try { specObj = JSON.parse(openapiText); } catch { specObj = openapiText; }
      const result = await api.post<{ success: boolean; tools_count: number; tools: Array<{ name: string; description: string }>; mcp_endpoint: string }>(`/api/servers/${id}/openapi`, { spec: specObj });
      if (result.success) {
        toast.success(locale === "zh" ? `成功转换 ${result.tools_count} 个工具` : `Converted ${result.tools_count} tools`);
        setShowOpenapi(false);
        setOpenapiText("");
        fetchServer();
      }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setOpenapiConverting(false); }
  };

  const hs = HEALTH_STYLE[server.health_status || "unknown"] || HEALTH_STYLE.unknown;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/servers")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{server.name}</h2>
            <p className="text-sm text-muted-foreground font-mono">{server.namespace}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleHealthCheck} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Heart className="h-4 w-4 mr-2" />}
            {locale === "zh" ? "心跳检测" : "Health Check"}
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleDiscover} disabled={discovering}>
            {discovering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {t.servers.discover}
          </Button>
          {server.source_type !== "openapi" && (
            <Button variant="outline" onClick={() => setShowOpenapi(!showOpenapi)}>
              <FileCode className="h-4 w-4 mr-2" />{locale === "zh" ? "导入 OpenAPI" : "Import OpenAPI"}
            </Button>
          )}
          {(server.status === "draft" || server.status === "rejected") && (
            <Button variant="outline" className="border-[#ffae1f]/50 text-[#ffae1f] hover:bg-[#fef5e5]" onClick={handleSubmitReview}>
              <ClipboardCheck className="h-4 w-4 mr-2" />{locale === "zh" ? "提交审核" : "Submit for Review"}
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />{t.common.delete}</Button>
        </div>
      </div>

      {/* Review Status Banner */}
      {server.status === "draft" && (
        <div className="rounded-lg bg-[#fef5e5] border border-[#ffae1f]/30 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#ffae1f]/15 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-4 w-4 text-[#ffae1f]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#ffae1f]">
              {locale === "zh" ? "草稿状态" : "Draft Status"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "zh" ? "此服务尚未公开。提交审核后，管理员批准即可在应用市场展示。" : "This server is not public yet. Submit for review, and it will be displayed in the Marketplace after admin approval."}
            </p>
          </div>
        </div>
      )}
      {server.status === "pending_review" && (
        <div className="rounded-lg bg-[var(--primary)/5] border border-primary/30 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">
              {locale === "zh" ? "审核中" : "Pending Review"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "zh" ? "已提交审核，请等待管理员批准。批准后将自动在应用市场公开。" : "Submitted for review. Waiting for admin approval. Once approved, it will be published to the Marketplace."}
            </p>
          </div>
        </div>
      )}
      {server.status === "rejected" && (
        <div className="rounded-lg bg-[#fdede8] border border-destructive/30 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
            <Trash2 className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              {locale === "zh" ? "审核未通过" : "Rejected"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "zh" ? "审核未通过。修改后可重新提交审核。" : "Review rejected. You can modify and resubmit for review."}
            </p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t.servers.version}</p>
          <p className="text-lg font-bold mt-1">{server.version}</p>
        </CardContent></Card>
        <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t.servers.transport_type}</p>
          <Badge variant="secondary" className="mt-1">{server.transport_type}</Badge>
        </CardContent></Card>
        <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t.servers.source_type}</p>
          <Badge variant="outline" className="mt-1">{server.source_type}</Badge>
        </CardContent></Card>
        <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t.common.status}</p>
          <Badge className={`mt-1 border-0 ${server.status === "active" ? "bg-[#13deb9]/10 text-[#13deb9]" : "bg-muted text-muted-foreground"}`}>{server.status}</Badge>
        </CardContent></Card>
        <Card className={`border rounded-lg ${server.health_status === "healthy" ? "border-[#12b76a]/30 bg-[#13deb9]/[0.02]" : server.health_status === "unknown" ? "border-border" : "border-[#f04438]/30 bg-destructive/[0.02]"}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{locale === "zh" ? "健康状态" : "Health"}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`h-2.5 w-2.5 rounded-full ${hs.dot} ${server.health_status === "healthy" ? "animate-pulse" : ""}`} />
              <span className="text-sm font-medium">{hs.label}</span>
              {server.health_latency_ms && <span className="text-xs text-muted-foreground">{server.health_latency_ms}ms</span>}
            </div>
            {server.last_health_check && <p className="text-[10px] text-muted-foreground mt-1">{new Date(server.last_health_check).toLocaleString()}</p>}
          </CardContent>
        </Card>
      </div>

      {(server.description || server.endpoint_url || (server.auth_type && server.auth_type !== "none")) && (
        <Card className="rounded-lg border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              {server.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">{t.servers.description}</p>
                  <p className="text-sm">{server.description}</p>
                </div>
              )}
              {server.endpoint_url && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">{t.servers.endpoint}</p>
                  <code className="text-sm bg-muted px-3 py-1.5 rounded-lg font-mono inline-block break-all">{server.endpoint_url}</code>
                </div>
              )}
              {server.auth_type && server.auth_type !== "none" && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs text-muted-foreground">{t.servers.auth_configured}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{t.servers.auth_type}:</span>
                      <Badge variant="secondary" className="text-[11px] h-5">{server.auth_type === "bearer" ? "Bearer Token" : server.auth_type === "api_key" ? "API Key" : "Custom Header"}</Badge>
                    </div>
                    {server.auth_config?.header_name && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{t.servers.auth_key_name}:</span>
                        <span className="font-mono text-xs">{server.auth_config.header_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{t.servers.auth_key_value}:</span>
                      <span className="font-mono text-xs">••••••••</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Integration */}
      <Card className="rounded-lg border border-primary/20 shadow-sm bg-primary/[0.02]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{locale === "zh" ? "Agent 集成" : "Agent Integration"}</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Gateway */}
            <div className="rounded-lg border border-primary/20 p-3 space-y-2 bg-primary/[0.02]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">{locale === "zh" ? "通过 Gateway 连接" : "Connect via Gateway"}</p>
                  <p className="text-[11px] text-muted-foreground">{locale === "zh" ? "通过网关代理调用，自动记录和监控" : "Proxy via Gateway with auto logging & monitoring"}</p>
                </div>
                <Button variant="outline" size="icon" className="shrink-0 h-7 w-7 rounded-lg" onClick={() => {
                  const config = JSON.stringify({
                    mcpServers: {
                      [server.namespace]: {
                        url: `${baseUrl}/gateway/mcp`,
                        transport: "streamable-http",
                        headers: {
                          "Authorization": "Bearer <your-api-key>",
                          "X-MCP-Server": server.namespace
                        }
                      }
                    }
                  }, null, 2);
                  navigator.clipboard.writeText(config);
                  toast.success("Copied!");
                }}><Copy className="h-3 w-3" /></Button>
              </div>
              <pre className="bg-muted rounded-lg px-3 py-2.5 text-[11px] font-mono text-foreground leading-relaxed overflow-x-auto whitespace-pre">{`{
  "mcpServers": {
    "${server.namespace}": {
      "url": "${baseUrl}/gateway/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer <your-api-key>",
        "X-MCP-Server": "${server.namespace}"
      }
    }
  }
}`}</pre>
            </div>

            {/* API Discovery */}
            <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
              <p className="text-xs font-semibold text-foreground">{locale === "zh" ? "公开 API" : "Public API"}</p>
              <p className="text-[11px] text-muted-foreground">{locale === "zh" ? "无需认证的发现接口" : "No-auth discovery endpoints"}</p>
              <code className="block bg-muted rounded-lg px-2.5 py-1.5 text-[11px] font-mono break-all">{baseUrl}/registry/v1/mcp/{server.namespace}</code>
              <code className="block bg-muted rounded-lg px-2.5 py-1.5 text-[11px] font-mono break-all">{baseUrl}/registry/v1/mcp/{server.namespace}/tools</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OpenAPI to MCP — only show for openapi source type or when user wants to import */}
      {(server.source_type === "openapi" || showOpenapi) && (
      <Card className="rounded-lg border border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t.openapi.title}</h3>
              {server.source_type === "openapi" && <Badge className="bg-primary/10 text-primary border-0 text-[10px] h-5">{t.openapi.source_openapi}</Badge>}
            </div>
            <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setShowOpenapi(!showOpenapi)}>
              {showOpenapi ? t.common.cancel : (server.openapi_spec ? (locale === "zh" ? "重新导入" : "Re-import") : t.openapi.paste)}
            </Button>
          </div>

          {server.source_type === "openapi" && server.openapi_spec && !showOpenapi && (
            <div className="space-y-4">
              {/* OpenAPI Spec Info */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3 bg-card space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">OpenAPI Spec</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">{locale === "zh" ? "标题" : "Title"}:</span>
                      <span className="font-medium text-foreground">{(server.openapi_spec as Record<string, any>)?.info?.title || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">{locale === "zh" ? "版本" : "Version"}:</span>
                      <span className="font-mono">{(server.openapi_spec as Record<string, any>)?.info?.version || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">{locale === "zh" ? "基础URL" : "Base URL"}:</span>
                      <span className="font-mono text-[11px] break-all">{(server.openapi_spec as Record<string, any>)?.servers?.[0]?.url || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">{locale === "zh" ? "接口数" : "Paths"}:</span>
                      <span className="font-medium">{Object.keys((server.openapi_spec as Record<string, any>)?.paths || {}).length}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3 bg-card space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t.openapi.mcp_endpoint}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted rounded-lg px-2.5 py-1.5 text-[11px] font-mono break-all">{baseUrl}/mcp/rest/{server.id}</code>
                    <Button variant="outline" size="icon" className="shrink-0 h-7 w-7 rounded-lg" onClick={() => {
                      const config = JSON.stringify({
                        mcpServers: {
                          [server.namespace]: {
                            url: `${baseUrl}/mcp/rest/${server.id}`,
                            transport: "streamable-http",
                            headers: { "Authorization": "Bearer <your-api-key>" }
                          }
                        }
                      }, null, 2);
                      navigator.clipboard.writeText(config);
                      toast.success("Copied!");
                    }}><Copy className="h-3 w-3" /></Button>
                  </div>
                  <pre className="bg-muted rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground leading-relaxed overflow-x-auto whitespace-pre max-h-24">{`{
  "mcpServers": {
    "${server.namespace}": {
      "url": "${baseUrl}/mcp/rest/${server.id}",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}`}</pre>
                </div>
              </div>

              {/* REST → MCP mapping table */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  REST API → MCP Tools ({server.tools?.length || 0})
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 font-semibold text-muted-foreground">MCP Tool</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground">REST API</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground">{locale === "zh" ? "描述" : "Description"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const paths = (server.openapi_spec as Record<string, any>)?.paths || {};
                        const rows: Array<{tool: string; method: string; path: string; desc: string}> = [];
                        for (const [path, methods] of Object.entries(paths)) {
                          for (const [method, op] of Object.entries(methods as Record<string, any>)) {
                            if (["get","post","put","patch","delete"].includes(method)) {
                              rows.push({
                                tool: op.operationId || `${method}_${path}`,
                                method: method.toUpperCase(),
                                path,
                                desc: op.summary || op.description || "",
                              });
                            }
                          }
                        }
                        return rows.map((r, i) => (
                          <tr key={i} className="border-t border-border/50 hover:bg-muted/30">
                            <td className="px-3 py-2 font-mono font-medium text-foreground">{r.tool}</td>
                            <td className="px-3 py-2 font-mono">
                              <Badge variant="outline" className="text-[10px] h-5 mr-1.5 font-bold">{r.method}</Badge>
                              <span className="text-muted-foreground">{r.path}</span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{r.desc}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Raw OpenAPI Spec */}
              <details className="group">
                <summary className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none flex items-center gap-1">
                  <span className="transition-transform group-open:rotate-90">&#9654;</span>
                  {locale === "zh" ? "原始 OpenAPI 规范" : "Raw OpenAPI Spec"}
                </summary>
                <div className="relative mt-2">
                  <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7 rounded-lg z-10" onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(server.openapi_spec, null, 2));
                    toast.success("Copied!");
                  }}><Copy className="h-3 w-3" /></Button>
                  <pre className="bg-muted rounded-lg px-3 py-2.5 text-[10px] font-mono text-foreground leading-relaxed overflow-x-auto whitespace-pre max-h-96 overflow-y-auto border border-border">
                    {JSON.stringify(server.openapi_spec, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}

          {showOpenapi && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{t.openapi.paste_hint}</p>
              <textarea
                value={openapiText}
                onChange={(e) => setOpenapiText(e.target.value)}
                className="w-full h-48 bg-muted rounded-lg px-3 py-2.5 text-xs font-mono text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                placeholder='{"openapi": "3.0.0", "info": {...}, "paths": {...}}'
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setShowOpenapi(false); setOpenapiText(""); }}>{t.common.cancel}</Button>
                <Button size="sm" className="rounded-lg bg-primary text-white" disabled={!openapiText.trim() || openapiConverting} onClick={handleOpenApiConvert}>
                  {openapiConverting ? t.openapi.converting : t.openapi.save}
                </Button>
              </div>
            </div>
          )}

          {!server.openapi_spec && !showOpenapi && (
            <p className="text-xs text-muted-foreground">{t.openapi.no_spec}</p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Tunnel (reverse connection) */}
      <Card className="rounded-lg border border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {locale === "zh" ? "反向 Tunnel 连接" : "Reverse Tunnel"}
              </h3>
              {server.tunnel_enabled && <Badge className="bg-primary/10 text-primary border-0 text-[10px] h-5">Tunnel</Badge>}
              {tunnelTokens.some((t) => t.is_connected) && (
                <Badge className="bg-[#e6fffa] text-[#13deb9] border-0 text-[10px] h-5">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  {locale === "zh" ? "已连接" : "Connected"}
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setShowCreateTunnel(!showCreateTunnel)}>
              {showCreateTunnel ? t.common.cancel : (locale === "zh" ? "新建 Token" : "New Token")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            {locale === "zh"
              ? "适用于部署在私有子网的 MCP 服务。下载并运行 Tunnel Agent，通过 WebSocket 反向连接到此 Registry，无需暴露公网端口。"
              : "For MCP servers behind NAT/firewall. Run the Tunnel Agent locally to establish a reverse WebSocket connection. No public endpoint needed."}
          </p>

          {showCreateTunnel && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 mb-3 space-y-2">
              <Input
                placeholder={locale === "zh" ? "Token 名称（如：办公室服务器）" : "Token name (e.g., office-server)"}
                value={newTunnelName}
                onChange={(e) => setNewTunnelName(e.target.value)}
                className="h-9 rounded-lg text-xs"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" className="rounded-lg bg-primary text-white" disabled={!newTunnelName.trim() || creatingTunnel} onClick={handleCreateTunnel}>
                  {creatingTunnel ? t.common.loading : (locale === "zh" ? "生成" : "Generate")}
                </Button>
              </div>
            </div>
          )}

          {newTunnelToken?.full_token && (
            <div className="rounded-lg border border-[#ffae1f]/30 bg-[#fef5e5] p-3 mb-3">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold text-[#ffae1f]">
                  {locale === "zh" ? "请立即复制！此 Token 只显示一次" : "Copy now! This token is shown only once"}
                </p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNewTunnelToken(null)}>
                  <span className="text-muted-foreground">×</span>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-card rounded-lg px-2.5 py-1.5 text-[11px] font-mono break-all">{newTunnelToken.full_token}</code>
                <Button variant="outline" size="icon" className="shrink-0 h-7 w-7 rounded-lg" onClick={() => { navigator.clipboard.writeText(newTunnelToken.full_token!); toast.success("Copied!"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {tunnelTokens.length > 0 && (
            <div className="space-y-2 mb-3">
              {tunnelTokens.map((tok) => (
                <div key={tok.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card">
                  <div className={`h-2.5 w-2.5 rounded-full ${tok.is_connected ? "bg-[#13deb9] animate-pulse" : "bg-gray-300"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{tok.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <code className="font-mono">{tok.token_prefix}...</code>
                      {tok.is_connected ? (
                        <span className="text-[#13deb9]">{locale === "zh" ? "已连接" : "Connected"}</span>
                      ) : tok.last_connected_at ? (
                        <span>{locale === "zh" ? "上次连接" : "Last connected"}: {new Date(tok.last_connected_at).toLocaleString()}</span>
                      ) : (
                        <span>{locale === "zh" ? "未连接" : "Never connected"}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteTunnel(tok.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {tunnelTokens.length > 0 && (
            <details className="group">
              <summary className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">&#9654;</span>
                {locale === "zh" ? "运行 Tunnel Agent" : "Run Tunnel Agent"}
              </summary>
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  {locale === "zh" ? "在你的私有网络中运行以下命令：" : "Run this command inside your private network:"}
                </p>
                <div className="relative">
                  <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7 rounded-lg z-10" onClick={() => {
                    const cmd = `python agent.py \\\n  --registry ${baseUrl.replace("3000", "8000")} \\\n  --token <your-token> \\\n  --local http://localhost:8080/mcp`;
                    navigator.clipboard.writeText(cmd);
                    toast.success("Copied!");
                  }}><Copy className="h-3 w-3" /></Button>
                  <pre className="bg-muted rounded-lg px-3 py-2.5 text-[11px] font-mono text-foreground leading-relaxed overflow-x-auto whitespace-pre border border-border">{`# 1. Download tunnel agent
git clone https://github.com/your-org/agenthub
cd agenthub/tunnel-agent
pip install -r requirements.txt

# 2. Run (replace <your-token> with the token above)
python agent.py \\
  --registry ${baseUrl.replace("3000", "8000")} \\
  --token <your-token> \\
  --local http://localhost:8080/mcp`}</pre>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {locale === "zh" ? "连接后可通过标准 Gateway 使用：" : "Once connected, use via standard Gateway:"}
                </p>
                <pre className="bg-muted rounded-lg px-3 py-2.5 text-[10px] font-mono text-muted-foreground leading-relaxed overflow-x-auto whitespace-pre border border-border">{`{
  "mcpServers": {
    "${server.namespace}": {
      "url": "${baseUrl}/gateway/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer <api-key>",
        "X-MCP-Server": "${server.namespace}"
      }
    }
  }
}`}</pre>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="tools">
        <TabsList>
          <TabsTrigger value="tools" className="gap-1"><Wrench className="h-3 w-3" />{t.servers.tools} ({server.tools?.length || 0})</TabsTrigger>
          <TabsTrigger value="resources" className="gap-1"><FileText className="h-3 w-3" />{t.servers.resources} ({server.resources?.length || 0})</TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1"><MessageSquare className="h-3 w-3" />{t.servers.prompts} ({server.prompts?.length || 0})</TabsTrigger>
          <TabsTrigger value="versions" className="gap-1"><History className="h-3 w-3" />{t.servers.versions}</TabsTrigger>
        </TabsList>

        <TabsContent value="tools">
          <Card className="rounded-lg border border-border shadow-sm"><CardContent className="pt-6">
            {server.tools?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {server.tools.map((tool) => (
                  <div key={tool.id} className="rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="h-4 w-4 text-primary shrink-0" />
                      <code className="text-sm font-semibold text-foreground">{tool.name}</code>
                    </div>
                    {tool.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{tool.description}</p>
                    )}
                    {tool.input_schema && (
                      <details className="group">
                        <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none">
                          Schema ▸
                        </summary>
                        <pre className="mt-2 text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap break-all">{JSON.stringify(tool.input_schema, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">{locale === "zh" ? "暂无工具，点击「自动发现」从 MCP 服务获取" : "No tools yet. Click \"Discover\" to fetch from the MCP server."}</p>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="resources">
          <Card className="rounded-lg border border-border shadow-sm"><CardContent className="pt-6">
            {server.resources?.length ? (
              <Table>
                <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-xs">{t.servers.name}</TableHead><TableHead className="text-xs">URI</TableHead><TableHead className="text-xs">MIME</TableHead></TableRow></TableHeader>
                <TableBody>{server.resources.map((r) => (
                  <TableRow key={r.id}><TableCell className="font-medium text-sm">{r.name}</TableCell><TableCell className="font-mono text-xs">{r.uri_template}</TableCell><TableCell className="text-sm">{r.mime_type || "—"}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            ) : <p className="text-muted-foreground text-center py-8 text-sm">{t.common.no_data}</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="prompts">
          <Card className="rounded-lg border border-border shadow-sm"><CardContent className="pt-6">
            {server.prompts?.length ? (
              <Table>
                <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-xs">{t.servers.name}</TableHead><TableHead className="text-xs">{t.servers.description}</TableHead></TableRow></TableHeader>
                <TableBody>{server.prompts.map((p) => (
                  <TableRow key={p.id}><TableCell className="font-mono font-medium text-sm">{p.name}</TableCell><TableCell className="text-sm">{p.description || "—"}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            ) : <p className="text-muted-foreground text-center py-8 text-sm">{t.common.no_data}</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="versions">
          <Card className="rounded-lg border border-border shadow-sm"><CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8 text-sm">{t.common.no_data}</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {server.tags && server.tags.length > 0 && <div className="flex gap-2 flex-wrap">{server.tags.map((tag) => <Badge key={tag.id} variant="outline" className="text-xs">{tag.name}</Badge>)}</div>}
    </div>
  );
}
