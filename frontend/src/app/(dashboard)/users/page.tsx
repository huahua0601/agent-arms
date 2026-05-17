"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { parseApiError, validateEmail, validatePassword, validateUsername, validationMessage } from "@/lib/error-utils";
import type { User, Role, PaginatedResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, Pencil, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

export default function UsersPage() {
  const { t, locale } = useI18n();
  const { confirm } = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ username: "", email: "", password: "", display_name: "", role_ids: [] as number[] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try { const q = search ? `&search=${search}` : ""; const data = await api.get<PaginatedResponse<User>>(`/api/users?page=${page}&page_size=20${q}`); setUsers(data.items); setTotal(data.total); } catch {}
  }, [page, search]);
  const fetchRoles = useCallback(async () => { try { setRoles(await api.get<Role[]>("/api/roles")); } catch {} }, []);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const openCreate = () => { setEditing(null); setErrors({}); setForm({ username: "", email: "", password: "", display_name: "", role_ids: [] }); setDialogOpen(true); };
  const openEdit = (u: User) => { setEditing(u); setErrors({}); setForm({ username: u.username, email: u.email, password: "", display_name: u.display_name || "", role_ids: u.roles.map((r) => r.id) }); setDialogOpen(true); };

  const validateForm = (): boolean => {
    const e: Record<string, string> = {};
    if (!editing) {
      const uErr = validateUsername(form.username);
      if (uErr) e.username = validationMessage(uErr, locale);
      const pErr = validatePassword(form.password);
      if (pErr) e.password = validationMessage(pErr, locale);
    } else if (form.password) {
      const pErr = validatePassword(form.password);
      if (pErr) e.password = validationMessage(pErr, locale);
    }
    const eErr = validateEmail(form.email);
    if (eErr) e.email = validationMessage(eErr, locale);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      if (editing) { const body: Record<string, unknown> = { email: form.email, display_name: form.display_name, role_ids: form.role_ids }; if (form.password) body.password = form.password; await api.put(`/api/users/${editing.id}`, body); }
      else { await api.post("/api/users", form); }
      toast.success(t.common.success); setDialogOpen(false); fetchUsers();
    } catch (err: unknown) {
      const msg = parseApiError(err, locale);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };
  const handleDelete = async (id: number) => { if (!await confirm({ message: t.common.confirm_delete, variant: "danger" })) return; try { await api.del(`/api/users/${id}`); toast.success(t.common.success); fetchUsers(); } catch (e: unknown) { toast.error(parseApiError(e, locale)); } };
  const toggleRole = (rid: number) => setForm((f) => ({ ...f, role_ids: f.role_ids.includes(rid) ? f.role_ids.filter((x) => x !== rid) : [...f.role_ids, rid] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-foreground">{t.users.title}</h2><p className="text-sm text-muted-foreground mt-1">{total} {t.users.total_users}</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-4 rounded-xl shadow-sm font-semibold text-sm" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t.users.add_user}</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? t.users.edit_user : t.users.create_user}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              {!editing && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t.auth.username}</Label>
                  <Input value={form.username} onChange={(e) => { setForm({ ...form, username: e.target.value }); if (errors.username) setErrors({ ...errors, username: "" }); }} className={`h-9 ${errors.username ? "border-destructive focus-visible:ring-destructive/30" : ""}`} />
                  {errors.username && <p className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.username}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.users.email}</Label>
                <Input type="email" placeholder="user@example.com" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: "" }); }} className={`h-9 ${errors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}`} />
                {errors.email && <p className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{editing ? t.users.new_password : t.auth.password}</Label>
                <Input type="password" placeholder={editing ? (locale === "zh" ? "留空则不修改" : "Leave blank to keep") : (locale === "zh" ? "至少 6 位" : "At least 6 characters")} value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); if (errors.password) setErrors({ ...errors, password: "" }); }} className={`h-9 ${errors.password ? "border-destructive focus-visible:ring-destructive/30" : ""}`} />
                {errors.password && <p className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.password}</p>}
              </div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">{t.users.display_name}</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-9" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">{t.users.roles}</Label><div className="flex flex-wrap gap-1.5">{roles.map((r) => (<Badge key={r.id} variant={form.role_ids.includes(r.id) ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => toggleRole(r.id)}>{r.name}</Badge>))}</div></div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button><Button size="sm" onClick={handleSave} disabled={submitting}>{submitting ? t.common.loading : t.common.save}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-xl border border-border shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border"><div className="relative max-w-sm"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder={t.users.search} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-9 pl-8 text-sm" /></div></div>
          <Table>
            <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-xs">{t.auth.username}</TableHead><TableHead className="text-xs">{t.users.email}</TableHead><TableHead className="text-xs">{t.users.roles}</TableHead><TableHead className="text-xs">{t.common.status}</TableHead><TableHead className="text-xs w-20">{t.common.actions}</TableHead></TableRow></TableHeader>
            <TableBody>{users.map((u) => (
              <TableRow key={u.id} className="hover:bg-muted/30">
                <TableCell><div className="flex items-center gap-2.5"><Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-primary text-white font-semibold">{u.username[0].toUpperCase()}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{u.display_name || u.username}</p><p className="text-[11px] text-muted-foreground">@{u.username}</p></div></div></TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell><div className="flex gap-1 flex-wrap">{u.roles.map((r) => <Badge key={r.id} variant="secondary" className="text-[10px] h-5">{r.name}</Badge>)}</div></TableCell>
                <TableCell><div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${u.is_active ? "bg-[#13deb9]" : "bg-destructive"}`} /><span className="text-xs">{u.is_active ? t.common.active : t.common.inactive}</span></div></TableCell>
                <TableCell><div className="flex gap-0.5"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(u.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          {total > 20 && <div className="flex justify-center gap-2 p-4 border-t"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t.common.previous}</Button><span className="text-sm text-muted-foreground self-center px-3">{t.common.page} {page}</span><Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>{t.common.next}</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}
