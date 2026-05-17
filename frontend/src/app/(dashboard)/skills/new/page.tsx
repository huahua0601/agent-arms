"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function NewSkillPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", namespace: "", description: "", content: "", category: "general",
    version: "1.0.0", icon_url: "", is_public: true, trigger_pattern: "", tag_names: "",
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const cats = (t.skills as Record<string, unknown>).categories as Record<string, string>;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = { ...form, tag_names: form.tag_names ? form.tag_names.split(",").map((s) => s.trim()) : [] };
      const res = await api.post<{ id: number }>("/api/skills", payload);
      toast.success(t.common.success);
      router.push(`/skills/${res.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.common.failure);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div><h2 className="text-2xl font-bold text-foreground">{t.skills.create}</h2></div>
      </div>

      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader><CardTitle className="text-base">{t.servers.basic_info}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs font-medium">{t.skills.name} *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-10" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">{t.skills.namespace} *</Label><Input value={form.namespace} onChange={(e) => set("namespace", e.target.value)} placeholder="org.example/my-skill" className="h-10" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-medium">{t.skills.description}</Label><Input value={form.description} onChange={(e) => set("description", e.target.value)} className="h-10" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t.skills.category}</Label>
              <Select value={form.category} onValueChange={(v) => v && set("category", v)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(cats).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">{t.skills.version}</Label><Input value={form.version} onChange={(e) => set("version", e.target.value)} className="h-10" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">{t.servers.tags}</Label><Input value={form.tag_names} onChange={(e) => set("tag_names", e.target.value)} placeholder="ai, automation" className="h-10" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-medium">{t.skills.trigger}</Label><Input value={form.trigger_pattern} onChange={(e) => set("trigger_pattern", e.target.value)} placeholder={t.skills.trigger_hint} className="h-10" /></div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border shadow-sm">
        <CardHeader><CardTitle className="text-base">{t.skills.content} *</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="# My Skill\n\nDescribe what this skill does and how the agent should use it..." rows={16} className="font-mono text-sm" />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>{t.common.cancel}</Button>
        <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleSubmit} disabled={loading || !form.name || !form.namespace || !form.content}>
          {loading ? t.common.loading : t.skills.create}
        </Button>
      </div>
    </div>
  );
}
