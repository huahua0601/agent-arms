"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ApiKey } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Copy, Key } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

export default function ApiKeysPage() {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", scopes: "", expires_in_days: "" });

  const fetchKeys = useCallback(async () => { try { setKeys(await api.get<ApiKey[]>("/api/api-keys")); } catch {} }, []);
  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    try {
      const data = await api.post<ApiKey & { full_key: string }>("/api/api-keys", { name: form.name, scopes: form.scopes ? form.scopes.split(",").map((s) => s.trim()) : [], expires_in_days: form.expires_in_days ? parseInt(form.expires_in_days) : undefined });
      setNewKey(data.full_key); toast.success("API key created"); fetchKeys();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ message: "Revoke this API key?", variant: "danger" })) return;
    try { await api.del(`/api/api-keys/${id}`); toast.success("Revoked"); fetchKeys(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const copyKey = (key: string) => { navigator.clipboard.writeText(key); toast.success("Copied"); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.api_keys.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.api_keys.subtitle}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setNewKey(null); }}>
          <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-4 rounded-xl shadow-sm font-semibold text-sm" onClick={() => { setForm({ name: "", scopes: "", expires_in_days: "" }); setNewKey(null); }}><Plus className="h-4 w-4 mr-2" />{t.api_keys.create}</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>{newKey ? t.api_keys.key_created : t.api_keys.create}</DialogTitle></DialogHeader>
            {newKey ? (
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">{t.api_keys.copy_warning}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted p-3 rounded-lg text-xs font-mono break-all">{newKey}</code>
                  <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => copyKey(newKey)}><Copy className="h-4 w-4" /></Button>
                </div>
                <Button className="w-full" size="sm" onClick={() => setDialogOpen(false)}>{t.common.done}</Button>
              </div>
            ) : (
              <>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5"><Label className="text-xs font-medium">{t.api_keys.name} *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" placeholder="CI/CD Key" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">{t.api_keys.scopes}</Label><Input value={form.scopes} onChange={(e) => setForm({ ...form, scopes: e.target.value })} className="h-9" placeholder="read,write" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">{t.api_keys.expires}</Label><Input value={form.expires_in_days} onChange={(e) => setForm({ ...form, expires_in_days: e.target.value })} className="h-9" placeholder="90" /></div>
                </div>
                <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button><Button size="sm" onClick={handleCreate} disabled={!form.name}>{t.common.create}</Button></DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {keys.map((k) => (
          <Card key={k.id} className="rounded-xl border border-border shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#ffae1f]/10 p-2"><Key className="h-4 w-4 text-[#ffae1f]" /></div>
                <div>
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{k.key_prefix}••••••••</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {k.scopes.length > 0 && <div className="flex gap-1">{k.scopes.map((s) => <Badge key={s} variant="outline" className="text-[10px] h-5">{s}</Badge>)}</div>}
                <span className="text-[11px] text-muted-foreground">{k.expires_at ? `${new Date(k.expires_at).toLocaleDateString()}` : t.api_keys.no_expiry}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(k.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {keys.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-base font-medium">{t.api_keys.no_keys}</p>
            <p className="text-sm mt-1">{t.api_keys.no_keys_hint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
