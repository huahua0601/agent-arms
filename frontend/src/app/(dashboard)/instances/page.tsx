"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Instance, PaginatedResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Play, Square, RotateCw, Trash2, FileText, Heart, Box } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

const STATUS_DOT: Record<string, string> = { running: "bg-emerald-500", stopped: "bg-gray-400", pending: "bg-amber-500", error: "bg-destructive" };

export default function InstancesPage() {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logsDialog, setLogsDialog] = useState<{ open: boolean; logs: string; id: number | null }>({ open: false, logs: "", id: null });
  const [form, setForm] = useState({ server_id: "", server_name: "", image: "", command: "", cpu_limit: "0.5", memory_limit: "256m" });

  const fetchInstances = useCallback(async () => {
    try { const data = await api.get<PaginatedResponse<Instance>>(`/api/instances?page=${page}&page_size=20`); setInstances(data.items); setTotal(data.total); } catch {}
  }, [page]);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  const handleCreate = async () => {
    try {
      await api.post("/api/instances", { server_id: parseInt(form.server_id), server_name: form.server_name || undefined, image: form.image, command: form.command || undefined, cpu_limit: form.cpu_limit, memory_limit: form.memory_limit });
      toast.success("Instance created"); setDialogOpen(false); fetchInstances();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const action = async (id: number, act: string) => {
    try { await api.post(`/api/instances/${id}/${act}`); toast.success(`Instance ${act}ed`); fetchInstances(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ message: "Delete this instance?", variant: "danger" })) return;
    try { await api.del(`/api/instances/${id}`); toast.success("Deleted"); fetchInstances(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const viewLogs = async (id: number) => {
    try { const data = await api.get<{ logs: string }>(`/api/instances/${id}/logs?tail=200`); setLogsDialog({ open: true, logs: data.logs, id }); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const checkHealth = async (id: number) => {
    try { const data = await api.get<{ status: string; response_time_ms: number | null }>(`/api/instances/${id}/health`); toast.success(`Health: ${data.status}${data.response_time_ms ? ` (${data.response_time_ms}ms)` : ""}`); fetchInstances(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.instances.title}</h1>
          <p className="text-sm text-muted-foreground">{total} {t.instances.subtitle}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 rounded-md shadow-sm text-sm font-medium"><Plus className="h-4 w-4 mr-2" />{t.instances.create}</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>{t.instances.create}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label className="text-xs font-medium">{t.instances.server_id} *</Label><Input value={form.server_id} onChange={(e) => setForm({ ...form, server_id: e.target.value })} className="h-9" placeholder="1" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">{t.instances.server_name}</Label><Input value={form.server_name} onChange={(e) => setForm({ ...form, server_name: e.target.value })} className="h-9" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">{t.instances.docker_image} *</Label><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="h-9" placeholder="node:20-alpine" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">{t.instances.command}</Label><Input value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} className="h-9" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs font-medium">{t.instances.cpu_limit}</Label><Input value={form.cpu_limit} onChange={(e) => setForm({ ...form, cpu_limit: e.target.value })} className="h-9" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-medium">{t.instances.memory}</Label><Input value={form.memory_limit} onChange={(e) => setForm({ ...form, memory_limit: e.target.value })} className="h-9" /></div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button><Button size="sm" onClick={handleCreate} disabled={!form.server_id || !form.image}>{t.common.create}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table Card */}
      <Card className="rounded-lg border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold text-muted-foreground">ID</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.instances.server_name}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.instances.image}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.instances.port}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.common.status}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t.instances.resources}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground w-44">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((inst) => (
                <TableRow key={inst.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{inst.id}</TableCell>
                  <TableCell className="text-sm font-medium">{inst.server_name || `Server #${inst.server_id}`}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate text-muted-foreground">{inst.image || "—"}</TableCell>
                  <TableCell className="text-sm">{inst.port || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[inst.status] || "bg-gray-400"}`} />
                      <span className="text-xs capitalize">{inst.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inst.cpu_limit} CPU / {inst.memory_limit}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {(inst.status === "stopped" || inst.status === "error") && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Start" onClick={() => action(inst.id, "start")}><Play className="h-3.5 w-3.5 text-emerald-500" /></Button>}
                      {inst.status === "running" && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Stop" onClick={() => action(inst.id, "stop")}><Square className="h-3.5 w-3.5 text-amber-500" /></Button>}
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Restart" onClick={() => action(inst.id, "restart")}><RotateCw className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Logs" onClick={() => viewLogs(inst.id)}><FileText className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Health" onClick={() => checkHealth(inst.id)}><Heart className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="Delete" onClick={() => handleDelete(inst.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {instances.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Box className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{t.instances.no_instances}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" className="rounded-md" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t.common.previous}</Button>
          <span className="text-sm text-muted-foreground self-center px-4">{t.common.page} {page} {t.common.of} {Math.ceil(total / 20)}</span>
          <Button variant="outline" size="sm" className="rounded-md" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>{t.common.next}</Button>
        </div>
      )}

      {/* Logs Dialog */}
      <Dialog open={logsDialog.open} onOpenChange={(o) => setLogsDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader><DialogTitle>{t.instances.logs_title} — #{logsDialog.id}</DialogTitle></DialogHeader>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono leading-relaxed">{logsDialog.logs || t.instances.no_logs}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
