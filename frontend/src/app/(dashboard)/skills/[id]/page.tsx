"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Skill } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trash2, Sparkles, User, Globe, Lock, FileText, History, Copy, Download, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

export default function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t, locale } = useI18n();
  const { confirm } = useConfirm();
  const [skill, setSkill] = useState<Skill | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const fetch = useCallback(async () => {
    try { setSkill(await api.get<Skill>(`/api/skills/${id}`)); }
    catch { toast.error("Not found"); router.push("/skills"); }
  }, [id, router]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    if (!await confirm({ message: t.common.confirm_delete, variant: "danger" })) return;
    try { await api.del(`/api/skills/${id}`); toast.success(t.common.success); router.push("/skills"); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : t.common.failure); }
  };

  const handleSubmitReview = async () => {
    try {
      await api.post("/api/reviews/submit", { resource_type: "skill", resource_id: Number(id) });
      toast.success(locale === "zh" ? "已提交审核，等待管理员批准" : "Submitted for review");
      fetch();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t.common.failure); }
  };

  const copyContent = () => { if (skill) { navigator.clipboard.writeText(skill.content); toast.success("Copied!"); } };
  const cats = (t.skills as Record<string, unknown>).categories as Record<string, string>;

  if (!skill) return <div className="flex items-center justify-center h-64"><div className="h-10 w-10 rounded-full border-[3px] border-primary border-t-transparent animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/skills")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center"><Sparkles className="h-5 w-5 text-primary" /></div>
            <div><h2 className="text-lg font-semibold text-foreground">{skill.name}</h2><p className="text-sm text-muted-foreground font-mono">{skill.namespace}</p></div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyContent}><Copy className="h-4 w-4 mr-2" />Copy</Button>
          {(skill.status === "draft" || skill.status === "rejected") && (
            <Button variant="outline" className="border-[#ffae1f]/50 text-[#ffae1f] hover:bg-[#fef5e5]" onClick={handleSubmitReview}>
              <ClipboardCheck className="h-4 w-4 mr-2" />{locale === "zh" ? "提交审核" : "Submit for Review"}
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />{t.common.delete}</Button>
        </div>
      </div>

      {/* Review Status Banner */}
      {skill.status === "draft" && (
        <div className="rounded-lg bg-[#fef5e5] border border-[#ffae1f]/30 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#ffae1f]/15 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-4 w-4 text-[#ffae1f]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#ffae1f]">
              {locale === "zh" ? "草稿状态" : "Draft Status"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "zh" ? "此技能尚未公开。提交审核后，管理员批准即可在应用市场展示。" : "This skill is not public yet. Submit for review, and it will be displayed in the Marketplace after admin approval."}
            </p>
          </div>
        </div>
      )}
      {skill.status === "pending_review" && (
        <div className="rounded-lg bg-[#ecf2ff] border border-primary/30 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">
              {locale === "zh" ? "审核中" : "Pending Review"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "zh" ? "已提交审核，请等待管理员批准。批准后将自动在应用市场公开。" : "Submitted for review. Once approved, it will be published to the Marketplace."}
            </p>
          </div>
        </div>
      )}
      {skill.status === "rejected" && (
        <div className="rounded-lg bg-[#fdede8] border border-destructive/30 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
            <Trash2 className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              {locale === "zh" ? "审核未通过" : "Rejected"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "zh" ? "审核未通过。修改后可重新提交审核。" : "Review rejected. You can modify and resubmit."}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t.skills.category}</p><Badge className="mt-1 border-0 bg-[#4f46e5]/10 text-[#4f46e5]">{cats[skill.category] || skill.category}</Badge></CardContent></Card>
        <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t.skills.version}</p><p className="text-lg font-bold mt-1">v{skill.version}</p></CardContent></Card>
        <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t.common.status}</p><Badge className={`mt-1 border-0 ${skill.status === "active" ? "bg-[#13deb9]/10 text-[#13deb9]" : "bg-muted text-muted-foreground"}`}>{skill.status}</Badge></CardContent></Card>
        <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t.skills.public}</p><div className="flex items-center gap-1 mt-1">{skill.is_public ? <><Globe className="h-4 w-4 text-[#13deb9]" /><span className="text-sm font-medium">{t.settings.yes}</span></> : <><Lock className="h-4 w-4 text-[#ffae1f]" /><span className="text-sm font-medium">{t.settings.no}</span></>}</div></CardContent></Card>
      </div>

      {skill.description && <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-5"><p className="text-sm text-foreground">{skill.description}</p></CardContent></Card>}

      {skill.trigger_pattern && (
        <Card className="rounded-lg border border-border shadow-sm"><CardContent className="p-5">
          <p className="text-xs text-muted-foreground mb-2">{t.skills.trigger}</p>
          <code className="text-sm bg-muted/50 rounded-lg px-3 py-1.5 font-mono">{skill.trigger_pattern}</code>
        </CardContent></Card>
      )}

      {/* Installation Guide */}
      <Card className="border border-primary/20 rounded-lg bg-primary/[0.03]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{locale === "zh" ? "安装方式" : "Installation"}</h3>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{locale === "zh" ? "公开安装 URL（无需认证）" : "Public Install URL (no auth required)"}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono break-all">{baseUrl}/registry/v1/skills/{skill.namespace}/install</code>
                <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => { navigator.clipboard.writeText(`${baseUrl}/registry/v1/skills/${skill.namespace}/install`); toast.success("Copied!"); }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{locale === "zh" ? "Manifest URL（元数据）" : "Manifest URL (metadata)"}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono break-all">{baseUrl}/registry/v1/skills/{skill.namespace}</code>
                <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => { navigator.clipboard.writeText(`${baseUrl}/registry/v1/skills/${skill.namespace}`); toast.success("Copied!"); }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{locale === "zh" ? "使用 curl 安装" : "Install via curl"}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono break-all">curl -o SKILL.md {baseUrl}/registry/v1/skills/{skill.namespace}/install</code>
                <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => { navigator.clipboard.writeText(`curl -o SKILL.md ${baseUrl}/registry/v1/skills/${skill.namespace}/install`); toast.success("Copied!"); }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{locale === "zh" ? "在 Cursor 中使用" : "Use in Cursor"}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono break-all">curl -o .cursor/skills/{skill.namespace.replace(/\//g, "-")}/SKILL.md {baseUrl}/registry/v1/skills/{skill.namespace}/install</code>
                <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => { navigator.clipboard.writeText(`mkdir -p .cursor/skills/${skill.namespace.replace(/\//g, "-")} && curl -o .cursor/skills/${skill.namespace.replace(/\//g, "-")}/SKILL.md ${baseUrl}/registry/v1/skills/${skill.namespace}/install`); toast.success("Copied!"); }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content" className="gap-1"><FileText className="h-3 w-3" />{t.skills.view_content}</TabsTrigger>
          <TabsTrigger value="versions" className="gap-1"><History className="h-3 w-3" />{t.skills.versions}</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <Card className="rounded-lg border border-border shadow-sm">
            <CardContent className="p-5">
              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground bg-muted/30 rounded-lg p-5 max-h-[600px] overflow-y-auto">{skill.content}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions">
          <Card className="rounded-lg border border-border shadow-sm">
            <CardContent className="p-5">
              {(skill as unknown as { versions?: Array<{ id: number; version: string; changelog?: string; published_at: string }> }).versions?.length ? (
                <div className="space-y-3">
                  {(skill as unknown as { versions: Array<{ id: number; version: string; changelog?: string; published_at: string }> }).versions.map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div><p className="text-sm font-medium">v{v.version}</p>{v.changelog && <p className="text-xs text-muted-foreground mt-0.5">{v.changelog}</p>}</div>
                      <span className="text-xs text-muted-foreground">{new Date(v.published_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-sm text-muted-foreground">{t.common.no_data}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {skill.tags && skill.tags.length > 0 && <div className="flex gap-2 flex-wrap">{skill.tags.map((tag) => <Badge key={tag.id} variant="outline" className="text-xs">{tag.name}</Badge>)}</div>}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><User className="h-3 w-3" />{skill.author_name || `User #${skill.author_id}`}</span>
        <span>Created: {new Date(skill.created_at).toLocaleDateString()}</span>
        {skill.updated_at && <span>Updated: {new Date(skill.updated_at).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}
