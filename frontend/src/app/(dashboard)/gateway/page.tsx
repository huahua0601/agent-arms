"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type {
  PaginatedResponse,
  GatewayCallLog,
  GatewayOverview,
  GatewayTrendPoint,
  TopItem,
} from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Zap,
  CheckCircle,
  Timer,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function GatewayPage() {
  const { t, locale } = useI18n();
  const [overview, setOverview] = useState<GatewayOverview | null>(null);
  const [trend, setTrend] = useState<GatewayTrendPoint[]>([]);
  const [topServers, setTopServers] = useState<TopItem[]>([]);
  const [topTools, setTopTools] = useState<TopItem[]>([]);
  const [topUsers, setTopUsers] = useState<TopItem[]>([]);
  const [logs, setLogs] = useState<GatewayCallLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [trendDays, setTrendDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pageSize = 15;

  const loadData = useCallback(async () => {
    try {
      const [ov, tr, ts, tt, tu] = await Promise.allSettled([
        api.get<GatewayOverview>("/api/gateway/stats/overview"),
        api.get<GatewayTrendPoint[]>(`/api/gateway/stats/trend?days=${trendDays}`),
        api.get<TopItem[]>("/api/gateway/stats/top-servers?limit=8"),
        api.get<TopItem[]>("/api/gateway/stats/top-tools?limit=8"),
        api.get<TopItem[]>("/api/gateway/stats/top-users?limit=8"),
      ]);
      if (ov.status === "fulfilled") setOverview(ov.value);
      if (tr.status === "fulfilled") setTrend(tr.value);
      if (ts.status === "fulfilled") setTopServers(ts.value);
      if (tt.status === "fulfilled") setTopTools(tt.value);
      if (tu.status === "fulfilled") setTopUsers(tu.value);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trendDays]);

  const loadLogs = useCallback(async () => {
    try {
      let url = `/api/gateway/logs?page=${logsPage}&page_size=${pageSize}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      const data = await api.get<PaginatedResponse<GatewayCallLog>>(url);
      setLogs(data.items);
      setLogsTotal(data.total);
    } catch {}
  }, [logsPage, filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleRefresh = () => { setRefreshing(true); loadData(); loadLogs(); };
  const totalPages = Math.ceil(logsTotal / pageSize) || 1;

  const stats = overview
    ? [
        { label: t.gateway.total_calls, value: overview.total_calls.toLocaleString(), icon: Activity, gradient: "from-indigo-500 to-indigo-600" },
        { label: t.gateway.today_calls, value: overview.today_calls.toLocaleString(), icon: Zap, gradient: "from-violet-500 to-violet-600" },
        { label: t.gateway.success_rate, value: `${overview.success_rate}%`, icon: CheckCircle, gradient: "from-emerald-500 to-emerald-600" },
        { label: t.gateway.avg_latency, value: `${overview.avg_latency_ms}${t.gateway.ms}`, icon: Timer, gradient: "from-amber-500 to-amber-600" },
        { label: t.gateway.errors_today, value: overview.error_count_today.toLocaleString(), icon: AlertTriangle, gradient: "from-red-500 to-red-600" },
      ]
    : [];

  const areaOpts: ApexCharts.ApexOptions = {
    chart: { type: "area", toolbar: { show: false }, fontFamily: "Inter, sans-serif" },
    colors: ["#4f46e5", "#10b981", "#ef4444"],
    stroke: { width: 2, curve: "smooth" },
    fill: { type: "gradient", gradient: { shadeIntensity: 0.1, opacityFrom: 0.3, opacityTo: 0.05 } },
    xaxis: { categories: trend.map((p) => p.date.slice(5)), labels: { style: { colors: "#6b7280", fontSize: "11px" } } },
    yaxis: { labels: { style: { colors: "#6b7280", fontSize: "11px" } } },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 4 },
    legend: { show: true, position: "top", horizontalAlign: "right", labels: { colors: "#6b7280" } },
    tooltip: { theme: "light" },
    dataLabels: { enabled: false },
  };
  const areaSeries = [
    { name: locale === "zh" ? "总调用" : "Total", data: trend.map((p) => p.total) },
    { name: locale === "zh" ? "成功" : "Success", data: trend.map((p) => p.success) },
    { name: locale === "zh" ? "错误" : "Error", data: trend.map((p) => p.error) },
  ];

  const barOpts = (categories: string[]): ApexCharts.ApexOptions => ({
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "Inter, sans-serif" },
    plotOptions: { bar: { horizontal: true, barHeight: "60%", borderRadius: 4 } },
    colors: ["#4f46e5"],
    xaxis: { categories, labels: { style: { colors: "#6b7280", fontSize: "11px" } } },
    yaxis: { labels: { style: { colors: "#6b7280", fontSize: "11px" }, maxWidth: 180 } },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 4 },
    dataLabels: { enabled: true, style: { fontSize: "11px" } },
    tooltip: { theme: "light" },
  });

  const statusBadge = (status: string | null) => {
    if (status === "success") return <Badge className="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-0 text-[11px]">{t.gateway.success}</Badge>;
    if (status === "timeout") return <Badge className="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-0 text-[11px]">{t.gateway.timeout}</Badge>;
    return <Badge className="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-0 text-[11px]">{t.gateway.error}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.gateway.title}</h1>
          <p className="text-sm text-muted-foreground">{t.gateway.subtitle}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? t.common.loading : locale === "zh" ? "刷新" : "Refresh"}
        </button>
      </div>

      {/* Endpoint Info */}
      <Card className="rounded-lg border-0 shadow-sm bg-gradient-to-r from-primary/5 via-card to-card">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{t.gateway.endpoint_hint}</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{t.gateway.endpoint_desc}</p>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted px-3 py-1.5 rounded-md font-mono">POST /gateway/mcp</code>
                <button onClick={() => navigator.clipboard.writeText("POST /gateway/mcp")} className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="hidden md:block text-xs text-muted-foreground bg-muted rounded-lg p-3 font-mono max-w-md">
              <p className="text-foreground font-semibold mb-1">{t.gateway.usage_example}:</p>
              <p>curl -X POST /gateway/mcp \</p>
              <p>&nbsp; -H &quot;Authorization: Bearer mcp_xxx&quot; \</p>
              <p>&nbsp; -H &quot;X-MCP-Server: namespace&quot; \</p>
              <p>&nbsp; -d &#123;&quot;jsonrpc&quot;:&quot;2.0&quot;, ...&#125;</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-lg border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${s.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                <s.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend Chart */}
      <Card className="rounded-lg border-0 shadow-sm">
        <div className="px-6 pt-5 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t.gateway.trend}</h3>
          <div className="flex gap-1.5">
            {[7, 30].map((d) => (
              <button
                key={d}
                onClick={() => setTrendDays(d)}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  trendDays === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {d === 7 ? t.gateway.days_7 : t.gateway.days_30}
              </button>
            ))}
          </div>
        </div>
        <CardContent className="px-4 pb-4">
          {trend.length > 0 ? (
            <Chart options={areaOpts} series={areaSeries} type="area" height={280} />
          ) : (
            <p className="text-center py-12 text-sm text-muted-foreground">{t.gateway.no_data}</p>
          )}
        </CardContent>
      </Card>

      {/* Top Rankings */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-lg border-0 shadow-sm">
          <div className="px-6 pt-5 pb-2"><h3 className="text-sm font-semibold text-foreground">{t.gateway.top_servers}</h3></div>
          <CardContent className="px-4 pb-4">
            {topServers.length > 0 ? (
              <Chart options={barOpts(topServers.map((s) => s.name))} series={[{ name: t.gateway.calls, data: topServers.map((s) => s.value) }]} type="bar" height={Math.max(200, topServers.length * 40)} />
            ) : <p className="text-center py-8 text-sm text-muted-foreground">{t.gateway.no_data}</p>}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-0 shadow-sm">
          <div className="px-6 pt-5 pb-2"><h3 className="text-sm font-semibold text-foreground">{t.gateway.top_tools}</h3></div>
          <CardContent className="px-4 pb-4">
            {topTools.length > 0 ? (
              <Chart options={barOpts(topTools.map((item) => item.name))} series={[{ name: t.gateway.calls, data: topTools.map((item) => item.value) }]} type="bar" height={Math.max(200, topTools.length * 40)} />
            ) : <p className="text-center py-8 text-sm text-muted-foreground">{t.gateway.no_data}</p>}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-0 shadow-sm">
          <div className="px-6 pt-5 pb-2"><h3 className="text-sm font-semibold text-foreground">{t.gateway.top_users}</h3></div>
          <CardContent className="px-4 pb-4">
            {topUsers.length > 0 ? (
              <div className="space-y-2 mt-2">
                {topUsers.map((u, i) => (
                  <div key={u.name} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50 transition-colors">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{u.name}</p></div>
                    <span className="text-sm font-semibold text-foreground">{u.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-8 text-sm text-muted-foreground">{t.gateway.no_data}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Call Logs Table */}
      <Card className="rounded-lg border-0 shadow-sm">
        <div className="px-6 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{t.gateway.recent_logs}</h3>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setLogsPage(1); }}
            className="text-xs border border-border rounded-md px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t.gateway.filter_status}</option>
            <option value="success">{t.gateway.success}</option>
            <option value="error">{t.gateway.error}</option>
            <option value="timeout">{t.gateway.timeout}</option>
          </select>
        </div>
        <CardContent className="px-0 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-muted/30">
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">{t.gateway.time}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">{t.gateway.user}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">{t.gateway.server}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">{t.gateway.method}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">{t.gateway.tool}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">{t.gateway.status}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">{t.gateway.latency}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">{t.gateway.ip}</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3 text-xs text-muted-foreground whitespace-nowrap">{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</td>
                    <td className="px-6 py-3 text-sm text-foreground">{log.username || "-"}</td>
                    <td className="px-6 py-3"><span className="font-mono text-xs text-foreground">{log.server_namespace || "-"}</span></td>
                    <td className="px-6 py-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.method || "-"}</code></td>
                    <td className="px-6 py-3 text-xs text-foreground">{log.tool_name || "-"}</td>
                    <td className="px-6 py-3">{statusBadge(log.response_status)}</td>
                    <td className="px-6 py-3 text-xs text-muted-foreground whitespace-nowrap">{log.latency_ms != null ? `${log.latency_ms}ms` : "-"}</td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">{log.ip_address || "-"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">{t.gateway.no_data}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {logsTotal > pageSize && (
            <div className="flex items-center justify-between px-6 pt-4">
              <p className="text-xs text-muted-foreground">{t.common.total} {logsTotal}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setLogsPage((p) => Math.max(1, p - 1))} disabled={logsPage <= 1} className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-30 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-xs text-muted-foreground">{t.common.page} {logsPage} {t.common.of} {totalPages}</span>
                <button onClick={() => setLogsPage((p) => Math.min(totalPages, p + 1))} disabled={logsPage >= totalPages} className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-30 transition-colors"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
