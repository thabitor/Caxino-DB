import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, History, Lock, Phone, PhoneOff, PlusCircle, ShieldAlert, Trash2, Unlock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActionHistoryActivity, ActionHistoryActivityType } from "@/lib/dashboardSync";
import { getFullName, type Player } from "@/services/playerService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecentFollowUpsPanelProps {
  activities: ActionHistoryActivity[];
  players: Player[];
  onClear?: () => void;
}

const actionStyles: Record<ActionHistoryActivityType, { label: string; className: string; icon: typeof History }> = {
  call_logged: {
    label: "Call logged",
    className: "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    icon: Phone,
  },
  call_no_answer: {
    label: "No answer",
    className: "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
    icon: PhoneOff,
  },
  vip_upgraded: {
    label: "VIP upgraded",
    className: "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: ArrowUp,
  },
  vip_downgraded: {
    label: "VIP downgraded",
    className: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    icon: ArrowDown,
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
  bonus_abuser_flagged: {
    label: "Bonus flag",
    className: "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
    icon: ShieldAlert,
  },
};

function getActionSentence(activity: ActionHistoryActivity, playerName: string) {
  const detail = activity.detail?.trim();

  switch (activity.type) {
    case "call_logged":
      return detail
        ? `${playerName} had a call logged for ${detail}.`
        : `${playerName} had a call logged.`;
    case "call_no_answer":
      return detail
        ? `${playerName} was called for ${detail}, but there was no answer.`
        : `${playerName} was called, but there was no answer.`;
    case "vip_upgraded":
      return detail
        ? `${playerName} was upgraded. ${detail}`
        : `${playerName} was upgraded to a higher VIP level.`;
    case "vip_downgraded":
      return detail
        ? `${playerName} was downgraded. ${detail}`
        : `${playerName} was downgraded to a lower VIP level.`;
    case "account_closed":
      return detail
        ? `${playerName}'s account was closed for ${detail}.`
        : `${playerName}'s account was closed.`;
    case "account_reopened":
      return `${playerName}'s account was reopened.`;
    case "bonus_abuser_flagged":
      return `${playerName} was marked as a bonus abuser.`;
    case "player_added":
      return `${playerName} was added to the player directory.`;
    default:
      return `${playerName} had an action recorded.`;
  }
}

export function RecentFollowUpsPanel({ activities, players, onClear }: RecentFollowUpsPanelProps) {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const recentActivities = activities.slice(0, 80);

  return (
    <Card className="h-full border-2 border-violet-300/80 bg-violet-50/20 shadow-md shadow-violet-500/5 dark:border-violet-800 dark:bg-violet-950/10">
      <CardHeader className="min-h-[64px] border-b-2 border-violet-200/80 bg-violet-100/35 py-2.5 dark:border-violet-900/70 dark:bg-violet-950/25">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4 text-violet-700 dark:text-violet-300" />
              Action Log
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Calls, account changes, VIP movement, bonus flags, and new players from the last 30 days.
            </p>
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
              const playerName = player ? getFullName(player) : "Unknown player";
              const style = actionStyles[activity.type];
              const Icon = style.icon;
              const sentence = getActionSentence(activity, playerName);

              return (
                <div
                  key={`${activity.playerId}-${activity.type}-${activity.timestamp}`}
                  className="flex items-start justify-between gap-3 rounded-md border-2 border-border/60 bg-background/70 px-3 py-2.5 shadow-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`gap-1 px-2 py-0.5 text-[11px] ${style.className}`}
                      >
                        <Icon className="h-3 w-3" />
                        {style.label}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {sentence}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {player ? `@${player.username}` : activity.playerId}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
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
