import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, Clock, Eye, ListPlus, Phone, UserRound, X } from "lucide-react";
import { format } from "date-fns";
import type { FollowUpItem, FollowUpStatus } from "@/lib/followup";
import { getFullName } from "@/services/playerService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dismissFollowUp,
  FOLLOW_UP_TTL_MS,
  FOLLOW_UP_VIEWED_EVENT,
  getContactedFollowUps,
  getDismissedFollowUps,
  getViewedFollowUps,
} from "@/lib/dashboardSync";

interface FollowUpQueueProps {
  items: FollowUpItem[];
  onAddFollowUp?: () => void;
}

const statusStyles: Record<FollowUpStatus, { label: string; className: string }> = {
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  },
  today: {
    label: "Today",
    className: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  soon: {
    label: "Soon",
    className: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  attention: {
    label: "Attention",
    className: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  },
  healthy: {
    label: "Healthy",
    className: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
  },
};

const NEW_FOLLOW_UP_MS = 60 * 60 * 1000;

const reasonBadgeStyles: Record<string, string> = {
  Manual: "border-yellow-400 bg-yellow-100 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  "Recent call": "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  "No calls": "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  Cadence: "border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  Overdue: "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
  "Due today": "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  "Due soon": "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  Birthday: "border-pink-300 bg-pink-100 text-pink-700 dark:border-pink-800 dark:bg-pink-950/40 dark:text-pink-300",
  "Missing info": "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  Preferences: "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  "Good time": "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
};

function formatDueDate(dueDate?: string | null) {
  if (!dueDate) return null;
  return format(new Date(dueDate), "MMM d, h:mm a");
}

function isNewFollowUp(queueCreatedAt?: string | null) {
  if (!queueCreatedAt) return false;
  const createdAt = new Date(queueCreatedAt).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt < NEW_FOLLOW_UP_MS;
}

export function FollowUpQueue({ items, onAddFollowUp }: FollowUpQueueProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewedPlayers, setViewedPlayers] = useState<Record<string, string>>({});
  const [dismissedPlayers, setDismissedPlayers] = useState<Record<string, string>>({});
  const [contactedPlayers, setContactedPlayers] = useState<Record<string, string>>({});
  const pageSize = 6;
  const visibleItems = useMemo(() => {
    const now = Date.now();
    const unviewed: FollowUpItem[] = [];
    const recentlyViewed: FollowUpItem[] = [];

    items.forEach((item) => {
      if (dismissedPlayers[item.player.id]) {
        return;
      }

      const viewedAt = viewedPlayers[item.player.id];
      if (!viewedAt) {
        unviewed.push(item);
        return;
      }

      const viewedTime = new Date(viewedAt).getTime();
      if (!Number.isFinite(viewedTime) || now - viewedTime >= FOLLOW_UP_TTL_MS) {
        return;
      }

      recentlyViewed.push(item);
    });

    return [...unviewed, ...recentlyViewed];
  }, [items, dismissedPlayers, viewedPlayers]);
  const overdueCount = visibleItems.filter((item) => item.status === "overdue" && !viewedPlayers[item.player.id]).length;
  const todayCount = visibleItems.filter((item) => item.status === "today" && !viewedPlayers[item.player.id]).length;
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const remainingItems = Math.max(0, visibleItems.length - safePage * pageSize);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleItems.slice(start, start + pageSize);
  }, [visibleItems, safePage]);

  useEffect(() => {
    const loadFollowUpState = () => {
      setViewedPlayers(getViewedFollowUps());
      setDismissedPlayers(getDismissedFollowUps());
      setContactedPlayers(getContactedFollowUps());
    };

    loadFollowUpState();
    window.addEventListener(FOLLOW_UP_VIEWED_EVENT, loadFollowUpState);
    window.addEventListener("focus", loadFollowUpState);

    return () => {
      window.removeEventListener(FOLLOW_UP_VIEWED_EVENT, loadFollowUpState);
      window.removeEventListener("focus", loadFollowUpState);
    };
  }, []);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleDismiss = (playerId: string) => {
    dismissFollowUp(playerId);
    setDismissedPlayers(getDismissedFollowUps());
  };

  return (
    <Card className="h-full border-primary/35 shadow-md shadow-primary/5">
      <CardHeader className="min-h-[80px] border-b-2 border-primary/15 bg-muted/25 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              Follow-Up Queue
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ordered by when each follow-up entered the queue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onAddFollowUp && (
              <Button size="sm" variant="outline" onClick={onAddFollowUp} className="h-7 gap-1.5 px-2 text-xs">
                <ListPlus className="h-3.5 w-3.5" />
                Add to Queue
              </Button>
            )}
            <Badge variant="outline" className="border-2">
              {visibleItems.length} to review
            </Badge>
            {overdueCount > 0 && (
              <Badge className="bg-red-600 text-white hover:bg-red-600">
                {overdueCount} overdue
              </Badge>
            )}
            {todayCount > 0 && (
              <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                {todayCount} today
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-80px)] flex-col p-3">
        {visibleItems.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-3 rounded-lg border-2 border-green-200 bg-green-50 p-4 text-green-800 shadow-sm dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-semibold">All relationships look current.</p>
              <p className="text-sm opacity-80">No unviewed or recently viewed follow-ups need attention right now.</p>
            </div>
          </div>
        ) : (
          <>
          <div className="grid flex-1 grid-cols-1 gap-2 min-[700px]:grid-flow-col min-[700px]:grid-rows-2 min-[700px]:auto-cols-fr">
            {pageItems.map((item) => {
              const status = statusStyles[item.status];
              const dueDate = formatDueDate(item.dueDate);
              const hasBeenViewed = Boolean(viewedPlayers[item.player.id]);
              const hasLocalContact = Boolean(contactedPlayers[item.player.id]);
              const lastCallTime = item.lastCallAt ? new Date(item.lastCallAt).getTime() : null;
              const wasContactedRecently =
                hasLocalContact || (lastCallTime !== null && Number.isFinite(lastCallTime) && Date.now() - lastCallTime < FOLLOW_UP_TTL_MS);
              const isNew = isNewFollowUp(item.queueCreatedAt) && !hasBeenViewed && !wasContactedRecently;
              const reasonClassName = reasonBadgeStyles[item.reasonBadge] || "border-primary/30 bg-primary/5 text-primary";
              const cardStateClassName = isNew
                ? "border-yellow-400 bg-yellow-50/80 shadow-yellow-500/10 dark:border-yellow-700 dark:bg-yellow-950/25"
                : hasBeenViewed
                  ? "border-green-300 bg-green-50/50 shadow-green-500/5 dark:border-green-900 dark:bg-green-950/20"
                  : "border-border/70 bg-card";

              return (
                <div
                  key={item.player.id}
                  className={`flex min-h-0 flex-col justify-between rounded-md border-2 p-2 shadow-sm transition-colors hover:border-primary/45 ${
                    cardStateClassName
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/player/${item.player.id}`}
                          className="block truncate text-sm font-bold leading-tight text-indigo-700 hover:text-indigo-800 hover:underline dark:text-indigo-300 dark:hover:text-indigo-200"
                        >
                          {getFullName(item.player)}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">@{item.player.username}</p>
                      </div>
                      {wasContactedRecently ? (
                        <Badge variant="outline" className="gap-1 border-blue-300 bg-blue-100 px-1.5 py-0 text-[11px] text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                          <Phone className="h-3 w-3" />
                          Called
                        </Badge>
                      ) : hasBeenViewed ? (
                        <Badge variant="outline" className="gap-1 border-green-300 bg-green-100 px-1.5 py-0 text-[11px] text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
                          <Check className="h-3 w-3" />
                          Followed up
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={`${status.className} px-1.5 py-0 text-[11px]`}>
                          {status.label}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {isNew && (
                        <Badge variant="outline" className="border-yellow-500 bg-yellow-200 px-1.5 py-0 text-[11px] text-yellow-900 dark:border-yellow-600 dark:bg-yellow-900/60 dark:text-yellow-200">
                          New
                        </Badge>
                      )}
                      <Badge variant="outline" className={`${reasonClassName} px-1.5 py-0 text-[11px]`}>
                        {item.reasonBadge}
                      </Badge>
                      <Badge variant="outline" className="border-indigo-300 bg-indigo-100 px-1.5 py-0 text-[11px] text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                        VIP {item.player.vip_level || 3} - {item.cadenceLabel.split("every ")[1] || "cadence"}
                      </Badge>
                      {item.activeTaskCount > 0 && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-100 px-1.5 py-0 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{item.activeTaskCount} tasks</Badge>
                      )}
                      {item.activeCallCount > 0 && (
                        <Badge variant="outline" className="gap-1 border-blue-300 px-1.5 py-0 text-[11px] text-blue-700 dark:border-blue-800 dark:text-blue-300">
                          <Phone className="h-3 w-3" />
                          {item.activeCallCount}
                        </Badge>
                      )}
                    </div>

                    <p className="line-clamp-1 text-xs font-medium">
                      {wasContactedRecently ? "Call logged recently" : item.manualFollowUpNote || item.primaryReason}
                    </p>
                    <div className="grid gap-1 text-[11px] text-muted-foreground min-[700px]:grid-cols-2">
                      <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                        <Clock className="h-3 w-3" />
                        {item.lastContactLabel}
                      </span>
                      {dueDate && (
                      <span className="inline-flex items-center gap-1 rounded border border-purple-200 bg-purple-100 px-1.5 py-0.5 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                        <UserRound className="h-3 w-3" />
                        {dueDate}
                      </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 border-t-2 border-border/50 pt-1.5">
                    <span className="line-clamp-1 text-[11px] font-semibold">
                      {wasContactedRecently ? "Call logged recently" : hasBeenViewed ? "You opened this" : item.nextAction}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                        onClick={() => handleDismiss(item.player.id)}
                      >
                        <X className="h-3 w-3" />
                        Dismiss
                      </Button>
                      <Button asChild size="sm" variant={hasBeenViewed ? "secondary" : "outline"} className="h-6 gap-1 px-2 text-xs">
                        <Link href={`/player/${item.player.id}`}>
                          Open
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              Batch {safePage} / {totalPages}
              {remainingItems > 0 && (
                <Badge variant="outline" className="ml-1 border-primary/40 px-1.5 py-0 text-[10px] text-primary">
                  {remainingItems} more
                </Badge>
              )}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safePage <= 1}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`h-7 w-7 ${remainingItems > 0 ? "border-primary text-primary" : ""}`}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safePage >= totalPages}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
