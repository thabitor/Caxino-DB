import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, Clock, Eye, GripVertical, ListPlus, Phone, UserRound, X } from "lucide-react";
import { format } from "date-fns";
import type { FollowUpItem, FollowUpStatus } from "@/lib/followup";
import { getFullName } from "@/services/playerService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  onOpenPlayer?: (playerId: string) => void;
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
const LEGACY_FOLLOW_UP_QUEUE_ORDER_KEY = "followUpQueueOrder";
const FOLLOW_UP_QUEUE_ORDER_KEY = "followUpQueueOrder:v2";
const FOLLOW_UP_QUEUE_PAGE_KEY = "followUpQueuePage";
const CARD_MIN_HEIGHT = 150;
const CARD_GAP = 8;

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

function getStoredQueueOrder() {
  if (typeof window === "undefined") return [];

  try {
    localStorage.removeItem(LEGACY_FOLLOW_UP_QUEUE_ORDER_KEY);
    const stored = JSON.parse(localStorage.getItem(FOLLOW_UP_QUEUE_ORDER_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    localStorage.removeItem(FOLLOW_UP_QUEUE_ORDER_KEY);
    return [];
  }
}

function saveStoredQueueOrder(playerIds: string[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(FOLLOW_UP_QUEUE_ORDER_KEY, JSON.stringify(playerIds));
}

function getStoredQueuePage() {
  if (typeof window === "undefined") return 1;

  const stored = Number(localStorage.getItem(FOLLOW_UP_QUEUE_PAGE_KEY));
  return Number.isInteger(stored) && stored > 0 ? stored : 1;
}

function saveStoredQueuePage(page: number) {
  if (typeof window === "undefined") return;

  localStorage.setItem(FOLLOW_UP_QUEUE_PAGE_KEY, String(page));
}

export function FollowUpQueue({ items, onAddFollowUp, onOpenPlayer }: FollowUpQueueProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [gridRowCount, setGridRowCount] = useState(2);
  const [viewedPlayers, setViewedPlayers] = useState<Record<string, string>>({});
  const [dismissedPlayers, setDismissedPlayers] = useState<Record<string, string>>({});
  const [contactedPlayers, setContactedPlayers] = useState<Record<string, string>>({});
  const [orderedPlayerIds, setOrderedPlayerIds] = useState<string[]>([]);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverPlayerId, setDragOverPlayerId] = useState<string | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const gridRef = useRef<HTMLDivElement | null>(null);
  const visibleItemsByState = useMemo(() => {
    const now = Date.now();

    return items.filter((item) => {
      if (dismissedPlayers[item.player.id]) {
        return false;
      }

      const viewedAt = viewedPlayers[item.player.id];
      if (!viewedAt) {
        return true;
      }

      const viewedTime = new Date(viewedAt).getTime();
      if (!Number.isFinite(viewedTime) || now - viewedTime >= FOLLOW_UP_TTL_MS) {
        return false;
      }

      return true;
    });
  }, [items, dismissedPlayers, viewedPlayers]);
  const visibleItems = useMemo(() => {
    if (visibleItemsByState.length === 0) return [];

    const itemById = new Map(visibleItemsByState.map((item) => [item.player.id, item]));
    const orderedIdsInQueue = orderedPlayerIds.filter((id) => itemById.has(id));
    const newIds = visibleItemsByState
      .map((item) => item.player.id)
      .filter((id) => !orderedIdsInQueue.includes(id));
    const nextIds = [...orderedIdsInQueue, ...newIds];

    return nextIds
      .map((id) => itemById.get(id))
      .filter((item): item is FollowUpItem => Boolean(item));
  }, [orderedPlayerIds, visibleItemsByState]);
  const overdueCount = visibleItems.filter((item) => item.status === "overdue" && !viewedPlayers[item.player.id]).length;
  const todayCount = visibleItems.filter((item) => item.status === "today" && !viewedPlayers[item.player.id]).length;
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const remainingItems = Math.max(0, visibleItems.length - safePage * pageSize);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleItems.slice(start, start + pageSize);
  }, [visibleItems, safePage]);
  const selectedVisibleCount = visibleItems.filter((item) => selectedPlayerIds.has(item.player.id)).length;
  const selectedPageCount = pageItems.filter((item) => selectedPlayerIds.has(item.player.id)).length;
  const isPageSelected = pageItems.length > 0 && selectedPageCount === pageItems.length;

  useEffect(() => {
    const gridElement = gridRef.current;
    if (!gridElement) return;

    const updateBatchSize = () => {
      const width = gridElement.clientWidth;
      const height = gridElement.clientHeight;
      const columns = width >= 1100 ? 3 : width >= 760 ? 2 : 1;
      const rows = Math.max(1, Math.floor((height + CARD_GAP) / (CARD_MIN_HEIGHT + CARD_GAP)));
      const nextPageSize = Math.max(6, columns * rows);

      setGridRowCount(rows);
      setPageSize(nextPageSize);
    };

    updateBatchSize();

    const resizeObserver = new ResizeObserver(updateBatchSize);
    resizeObserver.observe(gridElement);

    return () => resizeObserver.disconnect();
  }, [visibleItems.length]);

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
    setOrderedPlayerIds(getStoredQueueOrder());
    setCurrentPage(getStoredQueuePage());
  }, []);

  useEffect(() => {
    const visibleIds = visibleItemsByState.map((item) => item.player.id);
    setOrderedPlayerIds((currentOrder) => {
      const currentVisibleOrder = currentOrder.filter((id) => visibleIds.includes(id));
      const newIds = visibleIds.filter((id) => !currentVisibleOrder.includes(id));
      const nextOrder = [...currentVisibleOrder, ...newIds];

      if (
        nextOrder.length === currentOrder.length &&
        nextOrder.every((id, index) => id === currentOrder[index])
      ) {
        return currentOrder;
      }

      saveStoredQueueOrder(nextOrder);
      return nextOrder;
    });
  }, [visibleItemsByState]);

  useEffect(() => {
    setCurrentPage((page) => {
      const nextPage = Math.min(Math.max(1, page), totalPages);
      saveStoredQueuePage(nextPage);
      return nextPage;
    });
  }, [totalPages]);

  const updateCurrentPage = (getNextPage: (page: number) => number) => {
    setCurrentPage((page) => {
      const nextPage = Math.min(Math.max(1, getNextPage(page)), totalPages);
      saveStoredQueuePage(nextPage);
      return nextPage;
    });
  };

  useEffect(() => {
    const visibleIds = new Set(visibleItems.map((item) => item.player.id));
    setSelectedPlayerIds((currentSelection) => {
      const nextSelection = new Set(
        Array.from(currentSelection).filter((playerId) => visibleIds.has(playerId))
      );

      if (nextSelection.size === currentSelection.size) {
        return currentSelection;
      }

      return nextSelection;
    });
  }, [visibleItems]);

  const handleDismiss = (playerId: string) => {
    dismissFollowUp(playerId);
    setDismissedPlayers(getDismissedFollowUps());
    setSelectedPlayerIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);
      nextSelection.delete(playerId);
      return nextSelection;
    });
  };

  const handleBulkDismiss = (playerIds: string[]) => {
    if (playerIds.length === 0) return;

    playerIds.forEach((playerId) => dismissFollowUp(playerId));
    setDismissedPlayers(getDismissedFollowUps());
    setSelectedPlayerIds((currentSelection) => {
      const dismissedIds = new Set(playerIds);
      return new Set(Array.from(currentSelection).filter((playerId) => !dismissedIds.has(playerId)));
    });
  };

  const handleToggleSelection = (playerId: string, checked: boolean) => {
    setSelectedPlayerIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (checked) {
        nextSelection.add(playerId);
      } else {
        nextSelection.delete(playerId);
      }

      return nextSelection;
    });
  };

  const handleTogglePageSelection = (checked: boolean) => {
    const pageIds = pageItems.map((item) => item.player.id);

    setSelectedPlayerIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      pageIds.forEach((playerId) => {
        if (checked) {
          nextSelection.add(playerId);
        } else {
          nextSelection.delete(playerId);
        }
      });

      return nextSelection;
    });
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, playerId: string) => {
    setDraggedPlayerId(playerId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", playerId);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, playerId: string) => {
    if (!draggedPlayerId || draggedPlayerId === playerId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverPlayerId(playerId);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetPlayerId: string) => {
    event.preventDefault();
    const sourcePlayerId = draggedPlayerId || event.dataTransfer.getData("text/plain");

    setDraggedPlayerId(null);
    setDragOverPlayerId(null);

    if (!sourcePlayerId || sourcePlayerId === targetPlayerId) return;

    setOrderedPlayerIds((currentOrder) => {
      const visibleIds = visibleItems.map((item) => item.player.id);
      const baseOrder = [
        ...currentOrder.filter((id) => visibleIds.includes(id)),
        ...visibleIds.filter((id) => !currentOrder.includes(id)),
      ];
      const fromIndex = baseOrder.indexOf(sourcePlayerId);
      const toIndex = baseOrder.indexOf(targetPlayerId);

      if (fromIndex === -1 || toIndex === -1) return currentOrder;

      const nextOrder = [...baseOrder];
      const [movedId] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, movedId);
      saveStoredQueueOrder(nextOrder);
      return nextOrder;
    });
  };

  const handleDragEnd = () => {
    setDraggedPlayerId(null);
    setDragOverPlayerId(null);
  };

  return (
    <Card className="h-full border-2 border-cyan-300/80 bg-cyan-50/20 shadow-md shadow-cyan-500/5 dark:border-cyan-800 dark:bg-cyan-950/10">
      <CardHeader className="min-h-[80px] border-b-2 border-cyan-200/80 bg-cyan-100/40 py-2.5 dark:border-cyan-900/70 dark:bg-cyan-950/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
              Follow-Up Queue
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ordered by when each follow-up entered the queue.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
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
      <CardContent className="flex h-[calc(100%-80px)] min-h-0 flex-col p-3">
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
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border-2 border-cyan-200/80 bg-background/70 px-2 py-1.5 text-xs shadow-sm dark:border-cyan-900/70">
            <div className="flex min-w-0 items-center gap-2">
              <Checkbox
                checked={isPageSelected}
                onCheckedChange={(checked) => handleTogglePageSelection(checked === true)}
                aria-label="Select current batch"
                className="h-3.5 w-3.5"
              />
              <span className="truncate font-medium">
                Select batch
              </span>
              {selectedVisibleCount > 0 && (
                <Badge variant="outline" className="border-cyan-300 px-1.5 py-0 text-[10px] text-cyan-700 dark:border-cyan-800 dark:text-cyan-300">
                  {selectedVisibleCount} selected
                </Badge>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 px-2 text-xs"
                disabled={selectedVisibleCount === 0}
                onClick={() => handleBulkDismiss(Array.from(selectedPlayerIds))}
              >
                <X className="h-3 w-3" />
                Dismiss Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => handleBulkDismiss(visibleItems.map((item) => item.player.id))}
              >
                Dismiss All
              </Button>
            </div>
          </div>
          <div
            ref={gridRef}
            className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 transition-all duration-300 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3 min-[1100px]:overflow-hidden"
            style={{
              gridAutoRows: `minmax(${CARD_MIN_HEIGHT}px, 1fr)`,
              gridTemplateRows: `repeat(${gridRowCount}, minmax(${CARD_MIN_HEIGHT}px, 1fr))`,
            }}
          >
            {pageItems.map((item) => {
              const status = statusStyles[item.status];
              const dueDate = formatDueDate(item.dueDate);
              const hasBeenViewed = Boolean(viewedPlayers[item.player.id]);
              const hasLocalContact = Boolean(contactedPlayers[item.player.id]);
              const lastCallTime = item.lastCallAt ? new Date(item.lastCallAt).getTime() : null;
              const wasContactedRecently =
                hasLocalContact || (lastCallTime !== null && Number.isFinite(lastCallTime) && Date.now() - lastCallTime < FOLLOW_UP_TTL_MS);
              const isNew = isNewFollowUp(item.queueCreatedAt) && !hasBeenViewed && !wasContactedRecently;
              const isSelected = selectedPlayerIds.has(item.player.id);
              const reasonClassName = reasonBadgeStyles[item.reasonBadge] || "border-primary/30 bg-primary/5 text-primary";
              const cardStateClassName = isNew
                ? "border-yellow-400 bg-yellow-50/80 shadow-yellow-500/10 dark:border-yellow-700 dark:bg-yellow-950/25"
                : hasBeenViewed
                  ? "border-green-300 bg-green-50/50 shadow-green-500/5 dark:border-green-900 dark:bg-green-950/20"
                  : "border-border/70 bg-card";

              return (
                <div
                  key={item.player.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, item.player.id)}
                  onDragOver={(event) => handleDragOver(event, item.player.id)}
                  onDrop={(event) => handleDrop(event, item.player.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex min-h-[150px] min-w-0 scroll-mt-2 flex-col justify-between rounded-md border-2 p-2 shadow-sm transition-all duration-200 ease-out hover:border-primary/45 ${
                    cardStateClassName
                  } ${
                    draggedPlayerId === item.player.id ? "opacity-60 ring-2 ring-primary/40" : ""
                  } ${
                    dragOverPlayerId === item.player.id ? "ring-2 ring-primary ring-offset-2" : ""
                  } ${
                    isSelected ? "ring-2 ring-cyan-500/70 ring-offset-1" : ""
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex min-w-0 items-start gap-1">
                        <span
                          className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center"
                          draggable={false}
                          onDragStart={(event) => event.preventDefault()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleToggleSelection(item.player.id, checked === true)}
                            aria-label={`Select ${getFullName(item.player)}`}
                            className="h-3.5 w-3.5"
                          />
                        </span>
                        <span
                          className="mt-0.5 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded border border-border/70 bg-background/80 text-muted-foreground active:cursor-grabbing"
                          title="Drag to reorder"
                          aria-label="Drag to reorder"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpenPlayer?.(item.player.id)}
                            className="block max-w-full truncate text-left text-sm font-bold leading-tight text-indigo-700 hover:text-indigo-800 hover:underline dark:text-indigo-300 dark:hover:text-indigo-200"
                          >
                            {getFullName(item.player)}
                          </button>
                          <p className="truncate text-xs text-muted-foreground">@{item.player.username}</p>
                        </div>
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
                    <div className="grid gap-1 text-[11px] text-muted-foreground min-[520px]:grid-cols-1 min-[1100px]:grid-cols-2">
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

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t-2 border-border/50 pt-1.5">
                    <span className="line-clamp-1 text-[11px] font-semibold">
                      {wasContactedRecently ? "Call logged recently" : hasBeenViewed ? "You opened this" : item.nextAction}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                        onClick={() => handleDismiss(item.player.id)}
                      >
                        <X className="h-3 w-3" />
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant={hasBeenViewed ? "secondary" : "outline"}
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={() => onOpenPlayer?.(item.player.id)}
                      >
                        Open
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              Batch {safePage} / {totalPages}
              {remainingItems > 0 && (
                <Badge variant="outline" className="ml-1 border-primary/40 px-1.5 py-0 text-[10px] text-primary">
                  {remainingItems} more
                </Badge>
              )}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => updateCurrentPage((page) => page - 1)}
                disabled={safePage <= 1}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`h-7 w-7 ${remainingItems > 0 ? "border-primary text-primary" : ""}`}
                onClick={() => updateCurrentPage((page) => page + 1)}
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
