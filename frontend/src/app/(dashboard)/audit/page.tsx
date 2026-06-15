"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { AuditLog, PaginatedResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter, Activity, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { toast } from "sonner";

export default function AuditPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ username: "", action: "", resource_type: "", status: "" });
  const [stats, setStats] = useState<{ total_events: number; today_events: number; success_count: number; failure_count: number } | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      let url = `/api/audit/logs?page=${page}&page_size=50`;
      if (filters.username) url += `&username=${filters.username}`;
      if (filters.action) url += `&action=${filters.action}`;
      if (filters.status) url += `&status=${filters.status}`;
      const data = await api.get<PaginatedResponse<AuditLog>>(url);
      setLogs(data.items); setTotal(data.total);
    } catch {}
  }, [page, filters]);

  const fetchStats = useCallback(async () => {
    try { setStats(await api.get("/api/audit/stats")); } catch {}
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleExport = async () => {
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/audit/logs/export`;
      const token = localStorage.getItem("access_token");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "audit_logs.csv"; a.click();
      toast.success("Exported");
    } catch { toast.error("Export failed"); }
  };

  const statCards = stats ? [
    { label: t.audit.stats_total, value: stats.total_events, icon: Activity, gradient: "from-indigo-500 to-indigo-600" },
    { label: t.audit.stats_today, value: stats.today_events, icon: Clock, gradient: "from-amber-500 to-amber-600" },
    { label: t.audit.stats_success, value: stats.success_count, icon: CheckCircle, gradient: "from-emerald-500 to-emerald-600" },
    { label: t.audit.stats_failures, value: stats.failure_count, icon: XCircle, gradient: "from-red-500 to-red-600" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.audit.title}</h1>
          <p className="text-sm text-muted-foreground">{total} {t.audit.total_events}</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 rounded-md" onClick={handleExport}><Download className="h-4 w-4 mr-1.5" />{t.common.export_csv}</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card key={s.label} className="rounded-lg border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${s.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                  <s.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="rounded-lg border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Input placeholder={`${t.audit.username}...`} value={filters.username} onChange={(e) => { setFilters({ ...filters, username: e.target.value }); setPage(1); }} className="h-9 w-36 text-sm bg-muted/50 border-0" />
            <Input placeholder={`${t.audit.action}...`} value={filters.action} onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1); }} className="h-9 w-44 text-sm bg-muted/50 border-0" />
            <Select value={filters.status || "all"} onValueChange={(v) => { setFilters({ ...filters, status: !v || v === "all" ? "" : v }); setPage(1); }}>
              <SelectTrigger className="w-28 h-9 text-sm"><SelectValue placeholder={t.common.status} /></SelectTrigger>
              <SelectContent><SelectItem value="all">{t.common.all}</SelectItem><SelectItem value="success">{t.common.success}</SelectItem><SelectItem value="failure">{t.common.failure}</SelectItem></SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.audit.time}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.audit.username}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.audit.action}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.audit.resource}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.audit.ip}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.common.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{log.username || "—"}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[180px] truncate">{log.action}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] h-5 rounded">{log.resource_type}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.ip_address || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${log.status === "success" ? "bg-emerald-500" : "bg-destructive"}`} />
                      <span className="text-xs">{log.status}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {logs.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{t.audit.no_logs}</p>
            </div>
          )}
          {total > 50 && (
            <div className="flex justify-center gap-2 p-4 border-t border-border">
              <Button variant="outline" size="sm" className="rounded-md" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground self-center px-3">Page {page} of {Math.ceil(total / 50)}</span>
              <Button variant="outline" size="sm" className="rounded-md" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
