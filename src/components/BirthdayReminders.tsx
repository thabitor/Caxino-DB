import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake, Check, ExternalLink, User } from "lucide-react";
import { startOfDay } from "date-fns";
import { playerService, getFullName } from "@/services/playerService";
import { formatBirthdayDate, getBirthdayTimingLabel, getUpcomingBirthdays, UpcomingBirthday } from "@/lib/birthdays";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DismissedBirthdays {
  [playerId: string]: string;
}

const STORAGE_KEY = "dismissed_birthday_reminders";

function getTimingBadgeClass(daysUntil: number) {
  if (daysUntil === 0) {
    return "birthday-timing-badge birthday-timing-today";
  }

  if (daysUntil === 1) {
    return "birthday-timing-badge birthday-timing-tomorrow";
  }

  return "birthday-timing-badge birthday-timing-week";
}

export function BirthdayReminders() {
  const [birthdayPlayers, setBirthdayPlayers] = useState<UpcomingBirthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedBirthdays, setDismissedBirthdays] = useState<DismissedBirthdays>({});

  useEffect(() => {
    loadDismissedBirthdays();
    fetchBirthdayReminders();
  }, []);

  const loadDismissedBirthdays = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const dismissed: DismissedBirthdays = JSON.parse(stored);
      const today = startOfDay(new Date()).toISOString();
      const currentDismissals = Object.fromEntries(
        Object.entries(dismissed).filter(([, dismissedDate]) => dismissedDate === today)
      );

      setDismissedBirthdays(currentDismissals);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentDismissals));
    } catch (error) {
      console.error("Error loading dismissed birthdays:", error);
    }
  };

  const dismissBirthday = (playerId: string) => {
    const updated = {
      ...dismissedBirthdays,
      [playerId]: startOfDay(new Date()).toISOString(),
    };

    setDismissedBirthdays(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const fetchBirthdayReminders = async () => {
    try {
      setLoading(true);
      const players = await playerService.getPlayers();
      setBirthdayPlayers(getUpcomingBirthdays(players, { withinDays: 7 }));
    } catch (error) {
      console.error("Error fetching birthday reminders:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeBirthdayPlayers = birthdayPlayers.filter(
    (birthday) => !dismissedBirthdays[birthday.player.id]
  );
  const todayCount = activeBirthdayPlayers.filter((birthday) => birthday.daysUntil === 0).length;
  const tomorrowCount = activeBirthdayPlayers.filter((birthday) => birthday.daysUntil === 1).length;
  const weekCount = activeBirthdayPlayers.filter((birthday) => birthday.daysUntil <= 7).length;

  return (
    <Card className="h-full border-2 border-pink-200 bg-pink-50/40 shadow-sm dark:border-pink-800 dark:bg-pink-950/10">
      <CardHeader className="min-h-[80px] border-b-2 border-pink-200/60 bg-pink-100/50 py-2.5 dark:border-pink-800/60 dark:bg-pink-950/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-pink-600 shadow-sm">
              <Cake className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                Birthday Reminders
                <Badge className="border-0 bg-pink-600 text-white dark:bg-pink-700">
                  {activeBirthdayPlayers.length}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {activeBirthdayPlayers.length > 0
                  ? `${todayCount} today, ${tomorrowCount} tomorrow, ${weekCount} this week`
                  : "No birthdays coming up for the next week"}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-80px)] overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : activeBirthdayPlayers.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-border/70 bg-background/60 p-4 text-center">
            <div>
              <p className="font-semibold">No birthdays coming up for the next week.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This tab will populate when a player is within seven days of their birthday.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {activeBirthdayPlayers.map((birthday) => (
              <div
                key={birthday.player.id}
                className="rounded-md border-2 border-pink-200/70 bg-background/70 p-3 shadow-sm shadow-pink-500/5 transition-colors hover:border-pink-300 dark:border-pink-900/70 dark:hover:border-pink-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={getTimingBadgeClass(birthday.daysUntil)}>
                        {getBirthdayTimingLabel(birthday.daysUntil)}
                      </Badge>
                      <Badge variant="outline" className="border-2">
                        Turning {birthday.turningAge}
                      </Badge>
                    </div>

                    <div className="flex min-w-0 items-center gap-2">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate font-semibold">{getFullName(birthday.player)}</span>
                      <span className="truncate text-sm text-muted-foreground">@{birthday.player.username}</span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Next birthday:</span>{" "}
                      {formatBirthdayDate(birthday.nextBirthday)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <Button size="sm" variant="outline" asChild className="h-8 gap-1.5 border-2 px-2 text-xs">
                      <Link href={`/player/${birthday.player.id}`}>
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => dismissBirthday(birthday.player.id)}
                      className="h-8 gap-1.5 bg-green-600 px-2 text-xs hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                    >
                      <Check className="h-3 w-3" />
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
