import { useState, useEffect } from "react";
import { taskService, Task } from "@/services/taskService";
import { playerService, getFullName } from "@/services/playerService";
import { Button } from "@/components/ui/button";
import { Ban, Phone, User, X } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import Link from "next/link";
import { notifyDashboardRefresh } from "@/lib/dashboardSync";

interface CallReminderData {
  task: Task;
  playerName: string;
  playerUsername: string;
}

export function CallReminderNotification() {
  const [activeReminder, setActiveReminder] = useState<CallReminderData | null>(null);
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkForUpcomingCalls = async () => {
      try {
        const allTasks = await taskService.getAllTasks();
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

        // Find call tasks that are 5-10 minutes away and not dismissed
        const upcomingCalls = allTasks.filter(task => {
          if (!task.is_call || !task.due_date || task.status === "completed" || task.status === "cancelled") {
            return false;
          }
          
          if (dismissedCallIds.has(task.id)) {
            return false;
          }

          const callTime = new Date(task.due_date);
          return callTime >= fiveMinutesFromNow && callTime <= tenMinutesFromNow;
        });

        // Show reminder for the nearest upcoming call
        if (upcomingCalls.length > 0 && !activeReminder) {
          const nearestCall = upcomingCalls.sort((a, b) => 
            new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
          )[0];

          const player = await playerService.getPlayerById(nearestCall.player_id);
          
          if (player) {
            setActiveReminder({
              task: nearestCall,
              playerName: getFullName(player),
              playerUsername: player.username,
            });
          }
        }
      } catch (error) {
        console.error("Error checking for upcoming calls:", error);
      }
    };

    // Check immediately
    checkForUpcomingCalls();

    // Check every 30 seconds
    const interval = setInterval(checkForUpcomingCalls, 30000);

    return () => clearInterval(interval);
  }, [activeReminder, dismissedCallIds]);

  const handleDismiss = () => {
    if (activeReminder) {
      setDismissedCallIds(prev => new Set(prev).add(activeReminder.task.id));
      setActiveReminder(null);
    }
  };

  const handleOpenPlayer = () => {
    handleDismiss();
  };

  const handleCancelCall = async () => {
    if (!activeReminder) return;

    try {
      await taskService.updateTask(activeReminder.task.id, { status: "cancelled" });
      notifyDashboardRefresh();
      setDismissedCallIds(prev => new Set(prev).add(activeReminder.task.id));
      setActiveReminder(null);
    } catch (error) {
      console.error("Error cancelling call reminder:", error);
    }
  };

  if (!activeReminder) return null;

  const callTime = new Date(activeReminder.task.due_date!);
  const minutesUntilCall = Math.round((callTime.getTime() - new Date().getTime()) / (60 * 1000));
  const minutesLabel = minutesUntilCall <= 1 ? "1 minute" : `${minutesUntilCall} minutes`;
  const callReason = activeReminder.task.call_topic || "the scheduled reason";
  const logCallHref = activeReminder.task.call_topic
    ? `/player/${activeReminder.task.player_id}?action=log-call&callTaskId=${activeReminder.task.id}&callReason=${encodeURIComponent(activeReminder.task.call_topic)}`
    : `/player/${activeReminder.task.player_id}?action=log-call&callTaskId=${activeReminder.task.id}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-lg border-2 border-sky-400 bg-background/95 p-3 shadow-2xl shadow-sky-950/15 backdrop-blur dark:border-sky-700"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full text-muted-foreground hover:bg-muted"
        aria-label="Dismiss call reminder"
      >
        <X className="h-3.5 w-3.5" />
      </Button>

      <div className="pr-7">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-600 shadow-sm">
            <Phone className="h-4 w-4 text-white" />
          </div>
          <p className="text-sm leading-5 text-foreground">
            You have an upcoming call to{" "}
            <span className="font-bold text-sky-800 dark:text-sky-200">{activeReminder.playerName}</span>{" "}
            <span className="text-xs font-medium text-muted-foreground">(@{activeReminder.playerUsername})</span>{" "}
            for <span className="font-bold">{callReason}</span> in{" "}
            <span className="font-bold text-sky-700 dark:text-sky-300">{minutesLabel}</span>.
          </p>
        </div>

        {activeReminder.task.phone_number && (
          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50/70 px-2 py-1 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/35 dark:text-sky-100">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-mono font-semibold">{activeReminder.task.phone_number}</span>
            <CopyButton text={activeReminder.task.phone_number} label="Phone" />
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Button
            variant="outline"
            asChild
            onClick={handleOpenPlayer}
            className="h-8 gap-1.5 border-2 px-2 text-xs"
          >
            <Link href={`/player/${activeReminder.task.player_id}`}>
              <User className="h-3.5 w-3.5" />
              View
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={handleCancelCall}
            className="h-8 gap-1.5 border-2 border-red-300 px-2 text-xs text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            <Ban className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            asChild
            onClick={handleOpenPlayer}
            className="h-8 gap-1.5 bg-sky-600 px-2 text-xs text-white hover:bg-sky-700"
          >
            <Link href={logCallHref}>
              <Phone className="h-3.5 w-3.5" />
              Log
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
