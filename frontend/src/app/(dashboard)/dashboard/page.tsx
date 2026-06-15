"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import type { PaginatedResponse, McpServer, Instance, AuditLog, GatewayOverview } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Server, Sparkles, Box, Users, ArrowRight, TrendingUp, TrendingDown, Waypoints, Activity } from "lucide-react";
import Link from "next/link";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [sc, setSc] = useState(0);
  const [ic, setIc] = useState(0);
  const [uc, setUc] = useState(0);
  const [skc, setSkc] = useState(0);
  const [ri, setRi] = useState(0);
  const [gwCalls, setGwCalls] = useState(0);
  const [recentServers, setRecentServers] = useState<McpServer[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const load = async () => {
      const [s, i, u, a, sk, gw] = await Promise.allSettled([
        api.get<PaginatedResponse<McpServer>>("/api/servers?page=1&page_size=5"),
        api.get<PaginatedResponse<Instance>>("/api/instances?page=1&page_size=100"),
        api.get<PaginatedResponse<unknown>>("/api/users?page=1&page_size=1"),
        api.get<PaginatedResponse<AuditLog>>("/api/audit/logs?page=1&page_size=6"),
        api.get<PaginatedResponse<unknown>>("/api/skills?page=1&page_size=1"),
        api.get<GatewayOverview>("/api/gateway/stats/overview"),
      ]);
      if (s.status === "fulfilled") { setSc(s.value.total); setRecentServers(s.value.items); }
      if (i.status === "fulfilled") { setIc(i.value.total); setRi(i.value.items.filter((x) => x.status === "running").length); }
      if (u.status === "fulfilled") setUc(u.value.total);
      if (a.status === "fulfilled") setRecentLogs(a.value.items);
      if (sk.status === "fulfilled") setSkc(sk.value.total);
      if (gw.status === "fulfilled") setGwCalls(gw.value.today_calls);
    };
    load();
  }, []);

  const stats = [
    { label: t.dashboard.servers, value: sc, icon: Server, trend: "+12%", up: true, gradient: "from-indigo-500 to-indigo-600" },
    { label: t.nav.skills, value: skc, icon: Sparkles, trend: "+8%", up: true, gradient: "from-violet-500 to-violet-600" },
    { label: t.dashboard.running_instances, value: `${ri}/${ic}`, icon: Box, trend: "+5%", up: true, gradient: "from-emerald-500 to-emerald-600" },
    { label: t.nav.gateway, value: gwCalls, icon: Waypoints, trend: "+24%", up: true, gradient: "from-amber-500 to-amber-600" },
  ];

  const areaOpts: ApexCharts.ApexOptions = {
    chart: { type: "area", sparkline: { enabled: false }, toolbar: { show: false }, fontFamily: "Inter, sans-serif" },
    colors: ["#4f46e5", "#8b5cf6"],
    stroke: { width: 2, curve: "smooth" },
    fill: { type: "gradient", gradient: { shadeIntensity: 0.1, opacityFrom: 0.3, opacityTo: 0.05 } },
    xaxis: { categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], labels: { style: { colors: "#6b7280", fontSize: "11px" } } },
    yaxis: { labels: { style: { colors: "#6b7280", fontSize: "11px" } } },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 4, padding: { left: 4, right: 4 } },
    legend: { show: true, position: "top", horizontalAlign: "right", labels: { colors: "#6b7280" }, markers: { size: 4, shape: "circle" as const } },
    tooltip: { theme: "light" },
    dataLabels: { enabled: false },
  };
  const areaSeries = [
    { name: locale === "zh" ? "MCP 服务" : "MCP Servers", data: [2, 4, 3, 6, 5, sc || 8] },
    { name: locale === "zh" ? "技能" : "Skills", data: [1, 2, 3, 2, 4, skc || 5] },
  ];

  const barOpts: ApexCharts.ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "Inter, sans-serif" },
    colors: ["#4f46e5"],
    plotOptions: { bar: { borderRadius: 4, columnWidth: "50%" } },
    xaxis: { categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], labels: { style: { colors: "#6b7280", fontSize: "11px" } } },
    yaxis: { labels: { style: { colors: "#6b7280", fontSize: "11px" } } },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: "light" },
  };
  const barSeries = [{ name: locale === "zh" ? "API 调用" : "API Calls", data: [44, 55, 57, 56, 61, 58, 63] }];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-lg border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-5">
                <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${s.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                  <s.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold text-foreground leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{s.label}</p>
                </div>
                <div className={`flex items-center gap-0.5 text-xs font-medium ${s.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {s.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {s.trend}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 rounded-lg border-0 shadow-sm">
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{locale === "zh" ? "注册趋势" : "Registration Trend"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{locale === "zh" ? "MCP 服务 & 技能增长" : "MCP Servers & Skills growth"}</p>
            </div>
          </div>
          <CardContent className="px-4 pb-4">
            <Chart options={areaOpts} series={areaSeries} type="area" height={280} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-1 rounded-lg border-0 shadow-sm">
          <div className="px-6 pt-5 pb-2">
            <h3 className="text-sm font-semibold text-foreground">{locale === "zh" ? "周 API 流量" : "Weekly API Traffic"}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{locale === "zh" ? "网关调用量" : "Gateway call volume"}</p>
          </div>
          <CardContent className="px-4 pb-4">
            <Chart options={barOpts} series={barSeries} type="bar" height={280} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 xl:grid-cols-5">
        {/* Recent Servers Table */}
        <Card className="xl:col-span-3 rounded-lg border-0 shadow-sm">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t.dashboard.recent_servers}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{locale === "zh" ? "最近注册的服务" : "Recently registered servers"}</p>
            </div>
            <Link href="/servers" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium transition-colors">
              {t.common.view_all}<ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <CardContent className="px-6 pb-5">
            {recentServers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4">{locale === "zh" ? "名称" : "Name"}</th>
                      <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4">Namespace</th>
                      <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4">{locale === "zh" ? "传输" : "Transport"}</th>
                      <th className="text-left text-xs font-medium text-muted-foreground pb-3">{locale === "zh" ? "状态" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentServers.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <Link href={`/servers/${s.id}`} className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{s.name[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">{s.name}</span>
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{s.namespace}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary" className="text-[11px]">{s.transport_type}</Badge>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-xs text-muted-foreground">{s.status || "active"}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">{t.dashboard.no_servers}</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Timeline */}
        <Card className="xl:col-span-2 rounded-lg border-0 shadow-sm">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t.dashboard.recent_activity}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{locale === "zh" ? "最新操作记录" : "Latest operations"}</p>
            </div>
            <Link href="/audit" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium transition-colors">
              {t.common.view_all}<ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <CardContent className="px-6 pb-5">
            {recentLogs.length > 0 ? (
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {recentLogs.map((log) => (
                  <div key={log.id} className="relative">
                    <div className={`absolute left-[-21px] top-1 h-3.5 w-3.5 rounded-full border-2 border-card ${log.status === "success" ? "bg-emerald-500" : "bg-destructive"}`} />
                    <p className="text-sm text-foreground leading-tight font-medium">{log.action}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground">{log.username || "system"}</span>
                      <span className="text-[11px] text-muted-foreground/60">&middot;</span>
                      <span className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{t.dashboard.no_activity}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
