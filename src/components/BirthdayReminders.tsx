import { useState, useEffect } from "react";
import { playerService, Player, getFullName } from "@/services/playerService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cake, ChevronDown, ChevronUp, User, ExternalLink, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { format, differenceInDays, isSameDay, addDays, subDays, startOfDay } from "date-fns";

interface BirthdayPlayer {
  player: Player;
  status: "tomorrow" | "today" | "yesterday";
}

interface DismissedBirthdays {
  [playerId: string]: string; // playerId -> ISO date string when dismissed
}

const STORAGE_KEY = "dismissed_birthday_reminders";

export function BirthdayReminders() {
  const [birthdayPlayers, setBirthdayPlayers] = useState<BirthdayPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedBirthdays, setDismissedBirthdays] = useState<DismissedBirthdays>({});

  useEffect(() => {
    // Load dismissed birthdays from localStorage
    loadDismissedBirthdays();
    fetchBirthdayReminders();
  }, []);

  const loadDismissedBirthdays = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const dismissed: DismissedBirthdays = JSON.parse(stored);
        const today = startOfDay(new Date()).toISOString();
        
        // Filter out dismissals from previous days
        const currentDismissals: DismissedBirthdays = {};
        Object.entries(dismissed).forEach(([playerId, dismissedDate]) => {
          if (dismissedDate === today) {
            currentDismissals[playerId] = dismissedDate;
          }
        });
        
        setDismissedBirthdays(currentDismissals);
        // Update localStorage with cleaned data
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentDismissals));
      }
    } catch (error) {
      console.error("Error loading dismissed birthdays:", error);
    }
  };

  const dismissBirthday = (playerId: string) => {
    const today = startOfDay(new Date()).toISOString();
    const updated = {
      ...dismissedBirthdays,
      [playerId]: today
    };
    
    setDismissedBirthdays(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const fetchBirthdayReminders = async () => {
    try {
      setLoading(true);
      const players = await playerService.getPlayers();
      const today = new Date();
      const tomorrow = addDays(today, 1);
      const yesterday = subDays(today, 1);

      const birthdayMatches: BirthdayPlayer[] = [];

      players.forEach((player) => {
        if (!player.dob) return;

        const dob = new Date(player.dob);
        const birthdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        const birthdayTomorrow = new Date(tomorrow.getFullYear(), dob.getMonth(), dob.getDate());
        const birthdayYesterday = new Date(yesterday.getFullYear(), dob.getMonth(), dob.getDate());

        if (isSameDay(birthdayThisYear, today)) {
          birthdayMatches.push({ player, status: "today" });
        } else if (isSameDay(birthdayTomorrow, tomorrow)) {
          birthdayMatches.push({ player, status: "tomorrow" });
        } else if (isSameDay(birthdayYesterday, yesterday)) {
          birthdayMatches.push({ player, status: "yesterday" });
        }
      });

      // Sort: today first, then tomorrow, then yesterday
      birthdayMatches.sort((a, b) => {
        const order = { today: 0, tomorrow: 1, yesterday: 2 };
        return order[a.status] - order[b.status];
      });

      setBirthdayPlayers(birthdayMatches);
    } catch (error) {
      console.error("Error fetching birthday reminders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: "tomorrow" | "today" | "yesterday") => {
    switch (status) {
      case "today":
        return {
          label: "Birthday Today!",
          color: "bg-pink-600 dark:bg-pink-700 text-white border-0 animate-pulse",
          cardColor: "border-pink-400 dark:border-pink-600 bg-pink-50/70 dark:bg-pink-950/40",
          icon: "🎉",
        };
      case "tomorrow":
        return {
          label: "Birthday Tomorrow",
          color: "bg-purple-600 dark:bg-purple-700 text-white border-0",
          cardColor: "border-purple-400 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-950/30",
          icon: "🎂",
        };
      case "yesterday":
        return {
          label: "Birthday Was Yesterday",
          color: "bg-gray-500 dark:bg-gray-600 text-white border-0",
          cardColor: "border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/30",
          icon: "🎈",
        };
    }
  };

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <Card className="border-2">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Filter out dismissed birthdays
  const activeBirthdayPlayers = birthdayPlayers.filter(
    bp => !dismissedBirthdays[bp.player.id]
  );

  if (activeBirthdayPlayers.length === 0) {
    return null;
  }

  const todayCount = activeBirthdayPlayers.filter(bp => bp.status === "today").length;
  const tomorrowCount = activeBirthdayPlayers.filter(bp => bp.status === "tomorrow").length;
  const yesterdayCount = activeBirthdayPlayers.filter(bp => bp.status === "yesterday").length;

  return (
    <Card className="border-2 border-pink-200 dark:border-pink-800 bg-gradient-to-br from-pink-50/50 via-purple-50/30 to-blue-50/20 dark:from-pink-950/20 dark:via-purple-950/10 dark:to-blue-950/10 shadow-lg">
      <CardHeader className="border-b-2 border-pink-200/60 dark:border-pink-800/60 bg-gradient-to-r from-pink-100/50 to-purple-100/50 dark:from-pink-950/30 dark:to-purple-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 shadow-md">
              <Cake className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Birthday Reminders
                <Badge className="bg-pink-600 dark:bg-pink-700 text-white border-0">
                  {activeBirthdayPlayers.length}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {todayCount > 0 && `${todayCount} today`}
                {todayCount > 0 && tomorrowCount > 0 && ", "}
                {tomorrowCount > 0 && `${tomorrowCount} tomorrow`}
                {(todayCount > 0 || tomorrowCount > 0) && yesterdayCount > 0 && ", "}
                {yesterdayCount > 0 && `${yesterdayCount} yesterday`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-6">
          <div className="space-y-2">
            {activeBirthdayPlayers.map((birthdayPlayer) => {
              const config = getStatusConfig(birthdayPlayer.status);
              const age = calculateAge(birthdayPlayer.player.dob!);
              const turningAge = birthdayPlayer.status === "tomorrow" ? age + 1 : age;

              return (
                <div
                  key={birthdayPlayer.player.id}
                  className={`p-4 rounded-lg border-2 ${config.cardColor} transition-all hover:shadow-md`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={config.color}>
                          {config.icon} {config.label}
                        </Badge>
                        <Badge variant="outline" className="border-2">
                          {birthdayPlayer.status === "tomorrow" 
                            ? `Turning ${turningAge}` 
                            : birthdayPlayer.status === "today"
                              ? `Turns ${turningAge} today`
                              : `Turned ${turningAge} yesterday`
                          }
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span className="font-semibold text-lg">{getFullName(birthdayPlayer.player)}</span>
                        <span className="text-muted-foreground text-sm">
                          (@{birthdayPlayer.player.username})
                        </span>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Date of Birth:</span>{" "}
                        {format(new Date(birthdayPlayer.player.dob!), "MMMM d, yyyy")}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="border-2 gap-1.5"
                      >
                        <Link href={`/player/${birthdayPlayer.player.id}`}>
                          View Player
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => dismissBirthday(birthdayPlayer.player.id)}
                        className="gap-1.5 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                      >
                        <Check className="w-3 h-3" />
                        Ok, got it!
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
