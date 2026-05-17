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
import { Plus, Play, Square, RotateCw, Trash2, FileText, Heart } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

const STATUS_DOT: Record<string, string> = { running: "bg-[#13deb9]", stopped: "bg-gray-400", pending: "bg-[#ffae1f]", error: "bg-destructive" };

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
    try { const data = await api.get<PaginatedResponse<Instance>>(`/api/instances?page=${page}&page_size=20`); setInstances(data.items); setTotal(data.total); } catch { /* ignore */ }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.instances.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} {t.instances.subtitle}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-4 rounded-xl shadow-sm font-semibold text-sm"><Plus className="h-4 w-4 mr-2" />{t.instances.create}</Button>} />
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

      <Card className="rounded-xl border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">ID</TableHead>
                <TableHead className="text-xs">{t.instances.server_name}</TableHead>
                <TableHead className="text-xs">{t.instances.image}</TableHead>
                <TableHead className="text-xs">{t.instances.port}</TableHead>
                <TableHead className="text-xs">{t.common.status}</TableHead>
                <TableHead className="text-xs">{t.instances.resources}</TableHead>
                <TableHead className="text-xs w-44">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((inst) => (
                <TableRow key={inst.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">#{inst.id}</TableCell>
                  <TableCell className="text-sm font-medium">{inst.server_name || `Server #${inst.server_id}`}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate">{inst.image || "—"}</TableCell>
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
                      {(inst.status === "stopped" || inst.status === "error") && <Button variant="ghost" size="icon" className="h-7 w-7" title="Start" onClick={() => action(inst.id, "start")}><Play className="h-3.5 w-3.5 text-[#13deb9]" /></Button>}
                      {inst.status === "running" && <Button variant="ghost" size="icon" className="h-7 w-7" title="Stop" onClick={() => action(inst.id, "stop")}><Square className="h-3.5 w-3.5 text-[#ffae1f]" /></Button>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Restart" onClick={() => action(inst.id, "restart")}><RotateCw className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Logs" onClick={() => viewLogs(inst.id)}><FileText className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Health" onClick={() => checkHealth(inst.id)}><Heart className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => handleDelete(inst.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {instances.length === 0 && <p className="text-center py-12 text-sm text-muted-foreground">{t.instances.no_instances}</p>}
        </CardContent>
      </Card>

      <Dialog open={logsDialog.open} onOpenChange={(o) => setLogsDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader><DialogTitle>{t.instances.logs_title} — #{logsDialog.id}</DialogTitle></DialogHeader>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono leading-relaxed">{logsDialog.logs || t.instances.no_logs}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
