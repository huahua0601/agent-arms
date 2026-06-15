"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

export default function NewServerPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", namespace: "", description: "", version: "0.1.0",
    transport_type: "stdio", endpoint_url: "", source_type: "external",
    readme: "", icon_url: "", tag_names: "",
    auth_type: "none", auth_header_name: "", auth_header_value: "",
  });

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));
  const STEPS = [t.servers.basic_info, t.servers.connection, t.servers.confirm];

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const auth_config = form.auth_type !== "none" ? {
        header_name: form.auth_type === "bearer" ? "Authorization" : (form.auth_header_name || "X-API-Key"),
        header_value: form.auth_type === "bearer" ? `Bearer ${form.auth_header_value}` : form.auth_header_value,
      } : undefined;
      const payload = {
        ...form,
        tag_names: form.tag_names ? form.tag_names.split(",").map((s) => s.trim()) : [],
        auth_type: form.auth_type,
        auth_config,
      };
      const res = await api.post<{ id: number }>("/api/servers", payload);
      toast.success(t.common.success);
      router.push(`/servers/${res.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.common.failure);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t.servers.register_title}</h2>
        <p className="text-sm text-muted-foreground">{t.servers.register_desc}</p>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium ${
              i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</div>
            <span className={`text-sm ${i <= step ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <Card className="rounded-lg border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.servers.name} *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.servers.namespace} *</Label>
                <Input value={form.namespace} onChange={(e) => set("namespace", e.target.value)} placeholder="org.example/my-server" className="h-10" />
                <p className="text-xs text-muted-foreground">{t.servers.namespace_hint}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.servers.description}</Label>
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.servers.tags}</Label>
                <Input value={form.tag_names} onChange={(e) => set("tag_names", e.target.value)} placeholder={t.servers.tags_hint} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.servers.version}</Label>
                <Input value={form.version} onChange={(e) => set("version", e.target.value)} className="h-10" />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.servers.source_type}</Label>
                <Select value={form.source_type} onValueChange={(v) => v && set("source_type", v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">{t.servers.external}</SelectItem>
                    <SelectItem value="managed">{t.servers.managed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.servers.transport_type}</Label>
                <Select value={form.transport_type} onValueChange={(v) => v && set("transport_type", v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stdio">STDIO</SelectItem>
                    <SelectItem value="sse">SSE</SelectItem>
                    <SelectItem value="streamable-http">Streamable HTTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.source_type === "external" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t.servers.endpoint_url}</Label>
                  <Input value={form.endpoint_url} onChange={(e) => set("endpoint_url", e.target.value)} placeholder="https://mcp.example.com/sse" className="h-10" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t.servers.icon_url}</Label>
                <Input value={form.icon_url} onChange={(e) => set("icon_url", e.target.value)} placeholder="https://..." className="h-10" />
              </div>

              <div className="pt-2 border-t border-border">
                <Label className="text-xs font-medium">{t.servers.auth}</Label>
                <div className="mt-2 space-y-3">
                  <Select value={form.auth_type} onValueChange={(v) => v && set("auth_type", v)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.servers.auth_none}</SelectItem>
                      <SelectItem value="api_key">{t.servers.auth_api_key}</SelectItem>
                      <SelectItem value="bearer">{t.servers.auth_bearer}</SelectItem>
                      <SelectItem value="custom_header">{t.servers.auth_header}</SelectItem>
                    </SelectContent>
                  </Select>

                  {form.auth_type !== "none" && (
                    <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
                      {(form.auth_type === "api_key" || form.auth_type === "custom_header") && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">{t.servers.auth_key_name}</Label>
                          <Input value={form.auth_header_name} onChange={(e) => set("auth_header_name", e.target.value)} placeholder={t.servers.auth_key_name_hint} className="h-10" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t.servers.auth_key_value}</Label>
                        <Input type="password" value={form.auth_header_value} onChange={(e) => set("auth_header_value", e.target.value)} placeholder="sk-..." className="h-10 font-mono" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <span className="text-muted-foreground">{t.servers.name}:</span><span className="font-medium">{form.name}</span>
                <span className="text-muted-foreground">{t.servers.namespace}:</span><span className="font-mono">{form.namespace}</span>
                <span className="text-muted-foreground">{t.servers.version}:</span><span>{form.version}</span>
                <span className="text-muted-foreground">{t.servers.source_type}:</span><span>{form.source_type}</span>
                <span className="text-muted-foreground">{t.servers.transport_type}:</span><span>{form.transport_type}</span>
                {form.endpoint_url && (<><span className="text-muted-foreground">{t.servers.endpoint_url}:</span><span className="font-mono break-all">{form.endpoint_url}</span></>)}
                <span className="text-muted-foreground">{t.servers.auth_type}:</span>
                <span>{form.auth_type === "none" ? t.servers.auth_none : form.auth_type === "bearer" ? t.servers.auth_bearer : form.auth_type === "api_key" ? t.servers.auth_api_key : t.servers.auth_header}</span>
                {form.auth_type !== "none" && form.auth_header_value && (<><span className="text-muted-foreground">{t.servers.auth_key_value}:</span><span className="font-mono">••••••••</span></>)}
              </div>
              {form.description && <div><span className="text-muted-foreground">{t.servers.description}:</span><p className="mt-1">{form.description}</p></div>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />{step > 0 ? t.common.previous : t.common.cancel}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setStep(step + 1)} disabled={step === 0 && (!form.name || !form.namespace)}>
            {t.common.next}<ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleSubmit} disabled={loading}>
            {loading ? t.servers.registering : t.servers.register}
          </Button>
        )}
      </div>
    </div>
  );
}
