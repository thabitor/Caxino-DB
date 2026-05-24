import Link from "next/link";
import { CheckCircle2, ExternalLink, History, Lock, Phone, PlusCircle, RotateCcw, Trash2, Unlock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActionHistoryActivity, ActionHistoryActivityType } from "@/lib/dashboardSync";
import { getFullName, type Player } from "@/services/playerService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecentFollowUpsPanelProps {
  activities: ActionHistoryActivity[];
  players: Player[];
  onRestore?: (playerId: string) => void;
  onClear?: () => void;
}

const actionStyles: Record<ActionHistoryActivityType, { label: string; className: string; icon: typeof History }> = {
  follow_up_opened: {
    label: "Followed up",
    className: "border-green-300 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300",
    icon: CheckCircle2,
  },
  follow_up_dismissed: {
    label: "Dismissed",
    className: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
    icon: XCircle,
  },
  call_logged: {
    label: "Call logged",
    className: "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    icon: Phone,
  },
  account_closed: {
    label: "Closed",
    className: "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
    icon: Lock,
  },
  account_reopened: {
    label: "Reopened",
    className: "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: Unlock,
  },
  player_added: {
    label: "New player",
    className: "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
    icon: PlusCircle,
  },
};

export function RecentFollowUpsPanel({ activities, players, onRestore, onClear }: RecentFollowUpsPanelProps) {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const recentActivities = activities.slice(0, 12);

  return (
    <Card className="h-full border-2 border-violet-300/80 bg-violet-50/20 shadow-md shadow-violet-500/5 dark:border-violet-800 dark:bg-violet-950/10">
      <CardHeader className="min-h-[64px] border-b-2 border-violet-200/80 bg-violet-100/35 py-2.5 dark:border-violet-900/70 dark:bg-violet-950/25">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4 text-violet-700 dark:text-violet-300" />
              Action History
            </CardTitle>
            <p className="text-xs text-muted-foreground">Recent actions from the last 3 days.</p>
          </div>
          {recentActivities.length > 0 && onClear && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-2 text-xs"
              onClick={onClear}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-64px)] overflow-y-auto p-2">
        {recentActivities.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground">
            No recent actions yet.
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentActivities.map((activity) => {
              const player = playersById.get(activity.playerId);
              const style = actionStyles[activity.type];
              const Icon = style.icon;
              const isDismissed = activity.type === "follow_up_dismissed";

              return (
                <div
                  key={`${activity.playerId}-${activity.type}-${activity.timestamp}`}
                  className="flex items-center justify-between gap-2 rounded-md border-2 border-border/60 bg-background/70 px-2 py-1.5 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {player ? getFullName(player) : "Unknown player"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {player ? `@${player.username}` : activity.playerId}
                    </p>
                    {activity.detail && (
                      <p className="truncate text-[10px] text-muted-foreground/80">
                        {activity.detail}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`gap-1 px-1.5 py-0 text-[10px] ${style.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      {style.label}
                    </Badge>
                    <span className="w-14 text-right text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                    {isDismissed && onRestore && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/30"
                        title="Put back in queue"
                        onClick={() => onRestore(activity.playerId)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                    {player && (
                      <Button asChild variant="ghost" size="icon" className="h-6 w-6">
                        <Link href={`/player/${player.id}`}>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
