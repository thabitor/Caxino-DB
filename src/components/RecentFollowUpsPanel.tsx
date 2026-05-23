import Link from "next/link";
import { CheckCircle2, ExternalLink, History, RotateCcw, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { FollowUpRecentActivity } from "@/lib/dashboardSync";
import { getFullName, type Player } from "@/services/playerService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecentFollowUpsPanelProps {
  activities: FollowUpRecentActivity[];
  players: Player[];
  onRestore?: (playerId: string) => void;
}

export function RecentFollowUpsPanel({ activities, players, onRestore }: RecentFollowUpsPanelProps) {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const recentActivities = activities.slice(0, 12);

  return (
    <Card className="h-full border-slate-300/80 shadow-md shadow-slate-500/5 dark:border-slate-800">
      <CardHeader className="min-h-[64px] border-b-2 border-slate-200/80 bg-muted/20 py-2.5 dark:border-slate-800">
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          Recent Follow Ups
        </CardTitle>
        <p className="text-xs text-muted-foreground">Opened or dismissed in the last 3 days.</p>
      </CardHeader>
      <CardContent className="h-[calc(100%-64px)] overflow-y-auto p-2">
        {recentActivities.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground">
            No follow-ups opened or dismissed yet.
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentActivities.map((activity) => {
              const player = playersById.get(activity.playerId);
              const isDismissed = activity.type === "dismissed";

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
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={
                        isDismissed
                          ? "gap-1 border-slate-300 bg-slate-100 px-1.5 py-0 text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
                          : "gap-1 border-green-300 bg-green-100 px-1.5 py-0 text-[10px] text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
                      }
                    >
                      {isDismissed ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      {isDismissed ? "Dismissed" : "Opened"}
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
