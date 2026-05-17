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
import { Server, Sparkles, Box, Users, ArrowUpRight, ArrowRight, TrendingUp, Waypoints } from "lucide-react";
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
    { label: t.dashboard.servers, value: sc, icon: Server, color: "#5d87ff", bg: "#ecf2ff" },
    { label: t.nav.skills, value: skc, icon: Sparkles, color: "#49beff", bg: "#e8f7ff" },
    { label: t.dashboard.running_instances, value: `${ri}/${ic}`, icon: Box, color: "#13deb9", bg: "#e6fffa" },
    { label: t.nav.gateway, value: gwCalls, icon: Waypoints, color: "#7c3aed", bg: "#f3f0ff" },
    { label: t.dashboard.total_users, value: uc, icon: Users, color: "#ffae1f", bg: "#fef5e5" },
  ];

  const areaOpts: ApexCharts.ApexOptions = {
    chart: { type: "area", sparkline: { enabled: false }, toolbar: { show: false }, fontFamily: "Plus Jakarta Sans" },
    colors: ["#5d87ff", "#49beff"],
    stroke: { width: 2, curve: "smooth" },
    fill: { type: "gradient", gradient: { shadeIntensity: 0, opacityFrom: 0.2, opacityTo: 0 } },
    xaxis: { categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], labels: { style: { colors: "#7c8fac", fontSize: "11px" } } },
    yaxis: { show: false },
    grid: { borderColor: "#e5eaef", strokeDashArray: 4, padding: { left: 0, right: 0 } },
    legend: { show: true, position: "top", horizontalAlign: "right", labels: { colors: "#7c8fac" } },
    tooltip: { theme: "light" },
    dataLabels: { enabled: false },
  };
  const areaSeries = [
    { name: locale === "zh" ? "MCP 服务" : "MCP Servers", data: [2, 4, 3, 6, 5, sc || 8] },
    { name: locale === "zh" ? "技能" : "Skills", data: [1, 2, 3, 2, 4, skc || 5] },
  ];

  const donutOpts: ApexCharts.ApexOptions = {
    chart: { type: "donut", fontFamily: "Plus Jakarta Sans" },
    colors: ["#5d87ff", "#49beff", "#13deb9", "#ffae1f", "#fa896b"],
    labels: [t.dashboard.servers, t.nav.skills, t.nav.instances, t.nav.users, t.nav.audit_logs],
    legend: { position: "bottom", labels: { colors: "#7c8fac" } },
    plotOptions: { pie: { donut: { size: "70%", labels: { show: true, total: { show: true, label: locale === "zh" ? "总计" : "Total", color: "#7c8fac" } } } } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
  };
  const donutSeries = [sc || 3, skc || 2, ic || 1, uc || 1, recentLogs.length || 5];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <Card className="rounded-xl border border-border shadow-sm bg-gradient-to-r from-primary/5 via-card to-card">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{locale === "zh" ? "欢迎回来" : "Welcome back"} 👋</p>
            <h2 className="text-xl font-bold text-foreground mt-1">{user?.display_name || user?.username}</h2>
            <p className="text-muted-foreground text-sm mt-1">{t.dashboard.subtitle}</p>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 text-primary text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              {locale === "zh" ? "系统运行正常" : "System Running"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg }}>
                <s.icon className="h-6 w-6" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-[26px] font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-[13px] text-muted-foreground mt-1">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 xl:grid-cols-7">
        <Card className="xl:col-span-4 rounded-xl border border-border shadow-sm">
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{locale === "zh" ? "注册趋势" : "Registration Trend"}</h3>
          </div>
          <CardContent className="px-4 pb-4">
            <Chart options={areaOpts} series={areaSeries} type="area" height={280} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-3 rounded-xl border border-border shadow-sm">
          <div className="px-6 pt-5 pb-2">
            <h3 className="text-base font-semibold text-foreground">{locale === "zh" ? "资源分布" : "Resource Breakdown"}</h3>
          </div>
          <CardContent className="px-4 pb-4">
            <Chart options={donutOpts} series={donutSeries} type="donut" height={280} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Recent Activity Timeline */}
        <Card className="rounded-xl border border-border shadow-sm">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{t.dashboard.recent_activity}</h3>
            <Link href="/audit" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">{t.common.view_all}<ArrowRight className="h-3 w-3" /></Link>
          </div>
          <CardContent className="px-6 pb-5">
            {recentLogs.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {recentLogs.map((log, i) => (
                  <div key={log.id} className="relative pb-5 last:pb-0">
                    <div className={`absolute left-[-21px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-card ${log.status === "success" ? "bg-[#13deb9]" : "bg-destructive"}`} />
                    <p className="text-sm text-foreground leading-tight">{log.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">{log.username || "system"} &middot; {new Date(log.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">{t.dashboard.no_activity}</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Servers Table */}
        <Card className="rounded-xl border border-border shadow-sm">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{t.dashboard.recent_servers}</h3>
            <Link href="/servers" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">{t.common.view_all}<ArrowRight className="h-3 w-3" /></Link>
          </div>
          <CardContent className="px-6 pb-5">
            {recentServers.length > 0 ? (
              <div className="space-y-3">
                {recentServers.map((s) => (
                  <Link key={s.id} href={`/servers/${s.id}`} className="flex items-center gap-3 rounded-xl p-2.5 -mx-2.5 hover:bg-muted/50 transition-colors">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{s.name[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{s.namespace}</p>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-0 text-[11px] shrink-0">{s.transport_type}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">{t.dashboard.no_servers}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
