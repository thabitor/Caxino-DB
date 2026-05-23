import Link from "next/link";
import { Cake, ExternalLink } from "lucide-react";
import { Player, getFullName } from "@/services/playerService";
import { formatBirthdayDate, getBirthdayTimingLabel, getUpcomingBirthdays } from "@/lib/birthdays";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UpcomingBirthdaysPanelProps {
  players: Player[];
}

export function UpcomingBirthdaysPanel({ players }: UpcomingBirthdaysPanelProps) {
  const upcoming = getUpcomingBirthdays(players, { limit: 12 });

  return (
    <Card className="h-full border-pink-300/90 shadow-md shadow-pink-500/5 dark:border-pink-800">
      <CardHeader className="min-h-[64px] border-b-2 border-pink-200/70 bg-muted/20 py-2.5 dark:border-pink-900/70">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          Upcoming Birthdays
        </CardTitle>
        <p className="text-xs text-muted-foreground">Next birthdays, nearest first.</p>
      </CardHeader>
      <CardContent className="h-[calc(100%-64px)] overflow-y-auto p-2">
        {upcoming.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground">
            No player birthdays are available.
          </div>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map((birthday) => (
              <div key={birthday.player.id} className="flex items-center justify-between gap-2 rounded-md border-2 border-pink-200/70 bg-background/70 px-2 py-1.5 shadow-sm shadow-pink-500/5 dark:border-pink-900/70">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{getFullName(birthday.player)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">@{birthday.player.username}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {getBirthdayTimingLabel(birthday.daysUntil)}
                  </Badge>
                  <span className="w-10 text-right text-[11px] text-muted-foreground">
                    {formatBirthdayDate(birthday.nextBirthday)}
                  </span>
                  <Button asChild variant="ghost" size="icon" className="h-6 w-6">
                    <Link href={`/player/${birthday.player.id}`}>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
