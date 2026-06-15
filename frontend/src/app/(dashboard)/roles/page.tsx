"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Role, Permission } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Shield, Check, Save, X, ChevronDown, Search, Crown } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

const ACTION_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  create: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20" },
  read:   { bg: "bg-indigo-50 dark:bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", ring: "ring-indigo-500/20" },
  update: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20" },
  delete: { bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-600 dark:text-red-400", ring: "ring-red-500/20" },
  export: { bg: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/20" },
};

const ROLE_GRADIENTS = ["from-indigo-500 to-indigo-600", "from-emerald-500 to-emerald-600", "from-amber-500 to-amber-600", "from-red-500 to-red-600", "from-violet-500 to-violet-600", "from-cyan-500 to-cyan-600"];

export default function RolesPage() {
  const { t, locale } = useI18n();
  const { confirm } = useConfirm();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permission_ids: [] as number[] });
  const [expandedRoleId, setExpandedRoleId] = useState<number | null>(null);
  const [dirtyPerms, setDirtyPerms] = useState<Record<number, Set<number>>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const fetchRoles = useCallback(async () => { try { setRoles(await api.get<Role[]>("/api/roles")); } catch {} }, []);
  const fetchPerms = useCallback(async () => { try { setPermissions(await api.get<Permission[]>("/api/permissions")); } catch {} }, []);
  useEffect(() => { fetchRoles(); fetchPerms(); }, [fetchRoles, fetchPerms]);

  const openCreate = () => { setEditing(null); setForm({ name: "", description: "", permission_ids: [] }); setDialogOpen(true); };

  const handleSave = async () => {
    try {
      if (editing) { await api.put(`/api/roles/${editing.id}`, form); toast.success(locale === "zh" ? "角色已更新" : "Role updated"); }
      else { await api.post("/api/roles", form); toast.success(locale === "zh" ? "角色已创建" : "Role created"); }
      setDialogOpen(false); fetchRoles();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ message: locale === "zh" ? "确定删除此角色？" : "Delete this role?", variant: "danger" })) return;
    try { await api.del(`/api/roles/${id}`); toast.success(t.common.success); fetchRoles(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const togglePerm = (pid: number) => setForm((f) => ({ ...f, permission_ids: f.permission_ids.includes(pid) ? f.permission_ids.filter((x) => x !== pid) : [...f.permission_ids, pid] }));

  const groupedPerms = useMemo(() => {
    const m: Record<string, Permission[]> = {};
    for (const p of permissions) (m[p.resource] ||= []).push(p);
    return m;
  }, [permissions]);

  const getRolePermIds = (role: Role): Set<number> => {
    if (dirtyPerms[role.id]) return dirtyPerms[role.id];
    return new Set(role.permissions.map((p) => p.id));
  };

  const toggleRolePerm = (role: Role, permId: number) => {
    if (role.is_system) { toast.error(locale === "zh" ? "系统角色不可修改" : "Cannot modify system role"); return; }
    setDirtyPerms((prev) => {
      const curr = prev[role.id] || new Set(role.permissions.map((p) => p.id));
      const next = new Set(curr);
      if (next.has(permId)) next.delete(permId); else next.add(permId);
      return { ...prev, [role.id]: next };
    });
  };

  const toggleResource = (role: Role, resource: string) => {
    if (role.is_system) return;
    const perms = groupedPerms[resource] || [];
    const curr = dirtyPerms[role.id] || new Set(role.permissions.map((p) => p.id));
    const allSelected = perms.every((p) => curr.has(p.id));
    const next = new Set(curr);
    perms.forEach((p) => { if (allSelected) next.delete(p.id); else next.add(p.id); });
    setDirtyPerms((prev) => ({ ...prev, [role.id]: next }));
  };

  const saveRole = async (role: Role) => {
    const ids = dirtyPerms[role.id];
    if (!ids) return;
    setSaving(role.id);
    try {
      await api.put(`/api/roles/${role.id}`, { permission_ids: Array.from(ids) });
      toast.success(locale === "zh" ? "已保存" : "Saved");
      setDirtyPerms((prev) => { const n = { ...prev }; delete n[role.id]; return n; });
      fetchRoles();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(null); }
  };

  const cancelRoleEdit = (roleId: number) => { setDirtyPerms((prev) => { const n = { ...prev }; delete n[roleId]; return n; }); };

  const filteredRoles = roles.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.roles.title}</h1>
          <p className="text-sm text-muted-foreground">{t.roles.subtitle}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 rounded-md shadow-sm text-sm font-medium" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t.roles.add_role}</Button>} />
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? t.roles.edit_role : t.roles.create_role}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label className="text-xs font-medium">{t.roles.name}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium">{t.roles.description}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-9" /></div>
              <div className="space-y-3">
                <Label className="text-xs font-medium">{t.roles.permission_matrix}</Label>
                {Object.entries(groupedPerms).map(([resource, perms]) => (
                  <div key={resource} className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{resource.replace("_", " ")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map((p) => (<Badge key={p.id} variant={form.permission_ids.includes(p.id) ? "default" : "outline"} className="cursor-pointer text-xs rounded-md" onClick={() => togglePerm(p.id)}>{p.action}</Badge>))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button><Button size="sm" onClick={handleSave}>{t.common.save}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={locale === "zh" ? "搜索角色..." : "Search roles..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 rounded-md bg-muted/50 border-0" />
      </div>

      {/* Roles list */}
      <div className="space-y-3">
        {filteredRoles.map((role, idx) => {
          const isExpanded = expandedRoleId === role.id;
          const isDirty = !!dirtyPerms[role.id];
          const currentIds = getRolePermIds(role);
          const gradient = ROLE_GRADIENTS[idx % ROLE_GRADIENTS.length];

          return (
            <Card key={role.id} className={`rounded-lg border-0 shadow-sm transition-all ${isDirty ? "ring-1 ring-amber-500/30" : ""}`}>
              <CardContent className="p-0">
                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setExpandedRoleId(isExpanded ? null : role.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                      {role.name === "superadmin" ? <Crown className="h-5 w-5 text-white" /> : <Shield className="h-5 w-5 text-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{role.name}</h3>
                        {role.is_system && <Badge variant="secondary" className="text-[10px] h-5 rounded">{t.roles.system}</Badge>}
                        {isDirty && <Badge className="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-0 text-[10px] h-5">{locale === "zh" ? "未保存" : "Unsaved"}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{role.description || "-"}</p>
                      <p className="text-[11px] text-muted-foreground mt-1"><span className="font-semibold text-foreground">{currentIds.size}</span> / {permissions.length} {t.roles.permissions}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!role.is_system && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={(e) => { e.stopPropagation(); handleDelete(role.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-4 bg-muted/5">
                    {role.is_system && (
                      <div className="mb-3 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
                        {locale === "zh" ? "这是系统预置角色，权限不可修改。如需自定义，请创建新角色。" : "This is a system role. Permissions cannot be modified. Create a new role for custom permissions."}
                      </div>
                    )}
                    <div className="space-y-3">
                      {Object.entries(groupedPerms).map(([resource, perms]) => {
                        const allSelected = perms.every((p) => currentIds.has(p.id));
                        return (
                          <div key={resource} className="rounded-lg border border-border bg-card p-3">
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{resource.replace(/_/g, " ")}</span>
                                <span className="text-[10px] text-muted-foreground">{perms.filter((p) => currentIds.has(p.id)).length} / {perms.length}</span>
                              </div>
                              {!role.is_system && (
                                <button onClick={() => toggleResource(role, resource)} className="text-[10px] font-medium text-primary hover:underline">
                                  {allSelected ? (locale === "zh" ? "全部取消" : "Clear all") : (locale === "zh" ? "全部选中" : "Select all")}
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {perms.map((p) => {
                                const checked = currentIds.has(p.id);
                                const color = ACTION_COLORS[p.action] || ACTION_COLORS.read;
                                return (
                                  <button key={p.id} onClick={() => toggleRolePerm(role, p.id)} disabled={role.is_system}
                                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${checked ? `${color.bg} ${color.text} ring-1 ${color.ring}` : "bg-muted/50 text-muted-foreground hover:bg-muted"} ${role.is_system ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                                    <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${checked ? `${color.text} border-current bg-current/10` : "border-border bg-card"}`}>
                                      {checked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                    </span>
                                    {p.action}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!role.is_system && isDirty && (
                      <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-border">
                        <Button variant="outline" size="sm" className="rounded-md" onClick={() => cancelRoleEdit(role.id)}><X className="h-3.5 w-3.5 mr-1.5" />{t.common.cancel}</Button>
                        <Button size="sm" className="rounded-md" disabled={saving === role.id} onClick={() => saveRole(role)}><Save className="h-3.5 w-3.5 mr-1.5" />{saving === role.id ? t.common.loading : t.common.save}</Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filteredRoles.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{locale === "zh" ? "未找到角色" : "No roles found"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
