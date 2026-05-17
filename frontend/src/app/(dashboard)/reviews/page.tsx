"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { PaginatedResponse, ReviewRequest } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, Server, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function ReviewsPage() {
  const { t, locale } = useI18n();
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [comment, setComment] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const pageSize = 15;

  const load = useCallback(async () => {
    const url = `/api/reviews?page=${page}&page_size=${pageSize}${filter ? `&status=${filter}` : ""}`;
    const d = await api.get<PaginatedResponse<ReviewRequest>>(url);
    setReviews(d.items); setTotal(d.total);
    const pc = await api.get<{ count: number }>("/api/reviews/pending-count");
    setPendingCount(pc.count);
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/reviews/${id}/approve`, comment ? { comment } : {});
      toast.success(t.reviews.approved);
      setActiveId(null); setComment("");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t.common.failure); }
  };

  const handleReject = async (id: number) => {
    try {
      await api.post(`/api/reviews/${id}/reject`, { comment: comment || "Rejected" });
      toast.success(t.reviews.rejected);
      setActiveId(null); setComment("");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t.common.failure); }
  };

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge className="bg-[#fef5e5] text-[#ffae1f] border-0 text-[11px]"><Clock className="h-3 w-3 mr-1" />{t.reviews.pending}</Badge>;
    if (status === "approved") return <Badge className="bg-[#e6fffa] text-[#13deb9] border-0 text-[11px]"><CheckCircle className="h-3 w-3 mr-1" />{t.reviews.approved}</Badge>;
    return <Badge className="bg-[#fdede8] text-[#fa896b] border-0 text-[11px]"><XCircle className="h-3 w-3 mr-1" />{t.reviews.rejected}</Badge>;
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.reviews.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.reviews.subtitle}</p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-[#fef5e5] text-[#ffae1f] border-0 text-sm px-3 py-1">
            {pendingCount} {t.reviews.pending_count}
          </Badge>
        )}
      </div>

      <div className="flex gap-2">
        {["", "pending", "approved", "rejected"].map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            className="rounded-xl text-xs"
            onClick={() => { setFilter(s); setPage(1); }}
          >
            {s === "" ? t.common.all : t.reviews[s as keyof typeof t.reviews] || s}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {reviews.map((r) => (
          <Card key={r.id} className="rounded-xl border border-border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    {r.resource_type === "server" ? <Server className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.resource_name || `${r.resource_type} #${r.resource_id}`}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{t.reviews.submitter}: {r.submitter_name}</span>
                      {r.team_slug && <span>@ {r.team_slug}</span>}
                      <span>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : ""}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(r.status)}
                </div>
              </div>

              {r.review_comment && (
                <div className="mt-3 p-2.5 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  <span className="font-medium">{r.reviewer_name}:</span> {r.review_comment}
                </div>
              )}

              {r.status === "pending" && (
                <div className="mt-3 flex items-center gap-2">
                  {activeId === r.id ? (
                    <>
                      <Input
                        value={comment} onChange={(e) => setComment(e.target.value)}
                        placeholder={t.reviews.comment} className="flex-1 h-9 rounded-lg text-xs"
                      />
                      <Button size="sm" className="rounded-lg bg-[#13deb9] hover:bg-[#13deb9]/90 text-white h-9 px-3 text-xs" onClick={() => handleApprove(r.id)}>{t.reviews.approve}</Button>
                      <Button size="sm" variant="destructive" className="rounded-lg h-9 px-3 text-xs" onClick={() => handleReject(r.id)}>{t.reviews.reject}</Button>
                      <Button size="sm" variant="ghost" className="rounded-lg h-9 px-3 text-xs" onClick={() => { setActiveId(null); setComment(""); }}>{t.common.cancel}</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => setActiveId(r.id)}>{locale === "zh" ? "审核" : "Review"}</Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {reviews.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">{t.reviews.no_reviews}</div>
        )}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{t.common.total} {total}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-xs text-muted-foreground">{t.common.page} {page} {t.common.of} {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
