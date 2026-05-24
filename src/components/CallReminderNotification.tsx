import { useState, useEffect } from "react";
import { taskService, Task } from "@/services/taskService";
import { playerService, getFullName } from "@/services/playerService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Clock, User, X } from "lucide-react";
import { format } from "date-fns";
import { CopyButton } from "@/components/CopyButton";
import Link from "next/link";

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

  if (!activeReminder) return null;

  const callTime = new Date(activeReminder.task.due_date!);
  const minutesUntilCall = Math.round((callTime.getTime() - new Date().getTime()) / (60 * 1000));

  return (
    <Dialog open={!!activeReminder} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md border-4 border-blue-500 dark:border-blue-600 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg animate-pulse">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl text-blue-900 dark:text-blue-100">
                Upcoming Call Reminder
              </DialogTitle>
              <DialogDescription className="text-base font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4" />
                {minutesUntilCall <= 5 
                  ? `Call starts in ${minutesUntilCall} minute${minutesUntilCall !== 1 ? 's' : ''}!`
                  : `Call scheduled in ${minutesUntilCall} minutes`
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="font-medium">Player:</span>
            </div>
            <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20 border-2 border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-lg">{activeReminder.playerName}</p>
              <p className="text-sm text-muted-foreground">@{activeReminder.playerUsername}</p>
            </div>
          </div>

          {activeReminder.task.phone_number && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span className="font-medium">Phone Number:</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700">
                <span className="font-mono text-lg font-semibold flex-1">{activeReminder.task.phone_number}</span>
                <CopyButton text={activeReminder.task.phone_number} label="Phone" />
              </div>
            </div>
          )}

          {activeReminder.task.call_topic && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="font-medium">Call Reason:</span>
              </div>
              <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20 border-2 border-blue-200 dark:border-blue-800">
                <p className="text-sm">{activeReminder.task.call_topic}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Scheduled Time:</span>
            </div>
            <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700">
              <p className="font-semibold text-lg">{format(callTime, "PPp")}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="flex-1 gap-2 border-2"
          >
            <X className="w-4 h-4" />
            Dismiss
          </Button>
          <Button
            asChild
            onClick={handleOpenPlayer}
            className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          >
            <Link href={`/player/${activeReminder.task.player_id}`}>
              <User className="w-4 h-4" />
              View Player
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
