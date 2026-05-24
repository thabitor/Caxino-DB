import { useState, useEffect } from "react";
import Link from "next/link";
import { taskService, Task } from "@/services/taskService";
import { playerService, Player, getFullName } from "@/services/playerService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Clock, ExternalLink, Calendar, User, Phone, X } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/CopyButton";
import { CallCompletionDialog } from "@/components/CallCompletionDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface TaskWithPlayer extends Task {
  player_name: string;
  player_username: string;
}

const DISMISSED_TASKS_KEY = "dismissedTaskReminders";

export function TaskAlertsPanel() {
  const [todayCalls, setTodayCalls] = useState<TaskWithPlayer[]>([]);
  const [regularTasks, setRegularTasks] = useState<TaskWithPlayer[]>([]);
  const [closureReminders, setClosureReminders] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingCallId, setCompletingCallId] = useState<string | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  const [dismissedTasks, setDismissedTasks] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadDismissedTasks();
    fetchAlerts();
  }, []);

  const loadDismissedTasks = () => {
    try {
      const stored = localStorage.getItem(DISMISSED_TASKS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const today = new Date().toDateString();
        
        if (data.date === today) {
          setDismissedTasks(new Set(data.taskIds));
        } else {
          localStorage.removeItem(DISMISSED_TASKS_KEY);
          setDismissedTasks(new Set());
        }
      }
    } catch (error) {
      console.error("Error loading dismissed tasks:", error);
      setDismissedTasks(new Set());
    }
  };

  const saveDismissedTasks = (taskIds: Set<string>) => {
    try {
      const today = new Date().toDateString();
      const data = {
        date: today,
        taskIds: Array.from(taskIds)
      };
      localStorage.setItem(DISMISSED_TASKS_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Error saving dismissed tasks:", error);
    }
  };

  const handleDismissTask = (taskId: string) => {
    const newDismissed = new Set(dismissedTasks);
    newDismissed.add(taskId);
    setDismissedTasks(newDismissed);
    saveDismissedTasks(newDismissed);
    
    toast({
      title: "Reminder dismissed",
      description: "This reminder has been acknowledged and will be hidden until tomorrow.",
      duration: 3000
    });
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const [allTasks, allPlayers] = await Promise.all([
        taskService.getAllTasks(),
        playerService.getPlayers(),
      ]);
      const activeTasks = allTasks.filter(task => 
        task.status !== "completed" && task.status !== "cancelled"
      );

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const tasksWithPlayers = await Promise.all(
        activeTasks.map(async (task) => {
          const player = await playerService.getPlayerById(task.player_id);
          return {
            ...task,
            player_name: player ? getFullName(player) : "Unknown Player",
            player_username: player?.username || "unknown",
          };
        })
      );

      const calls = tasksWithPlayers.filter(task => task.is_call);
      const regularTasksList = tasksWithPlayers.filter(task => !task.is_call);

      const todaysCallsList = calls.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate >= todayStart && dueDate < todayEnd;
      }).sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

      const urgentRegularTasks = regularTasksList.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate <= next24Hours;
      }).sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

      setTodayCalls(todaysCallsList);
      setRegularTasks(urgentRegularTasks);
      setClosureReminders(
        allPlayers
          .filter((player) => (
            player.account_status === "closed" &&
            player.account_closure_type === "break" &&
            Boolean(player.account_closure_until) &&
            new Date(player.account_closure_until!).getTime() <= Date.now()
          ))
          .sort((a, b) => (
            new Date(a.account_closure_until!).getTime() - new Date(b.account_closure_until!).getTime()
          ))
      );
      
      setCheckedTasks(new Set());
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId);
      toast({ 
        title: "Task completed", 
        description: "Task marked as completed successfully.",
        duration: 3000
      });
      setCheckedTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      fetchAlerts();
    } catch (error) {
      console.error("Error completing task:", error);
      toast({ 
        title: "Error", 
        description: "Could not complete task. Please try again.", 
        variant: "destructive" 
      });
      setCheckedTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleCallComplete = async (notes?: string, durationMinutes?: number) => {
    if (!completingCallId || !user) {
      toast({ title: "Error", description: "Missing required data.", variant: "destructive" });
      return;
    }

    try {
      await taskService.completeCallTask(completingCallId, user.id, notes, durationMinutes);
      toast({ 
        title: "Call completed", 
        description: "Call logged successfully and task marked as complete.",
        duration: 3000
      });
      setCheckedTasks(prev => {
        const next = new Set(prev);
        next.delete(completingCallId);
        return next;
      });
      setCompletingCallId(null);
      fetchAlerts();
    } catch (error) {
      console.error("Error completing call:", error);
      toast({ 
        title: "Error", 
        description: "Could not complete call. Please try again.", 
        variant: "destructive" 
      });
      if (completingCallId) {
        setCheckedTasks(prev => {
          const next = new Set(prev);
          next.delete(completingCallId);
          return next;
        });
      }
    }
  };

  const handleCallDialogClose = () => {
    if (completingCallId) {
      setCheckedTasks(prev => {
        const next = new Set(prev);
        next.delete(completingCallId);
        return next;
      });
      setCompletingCallId(null);
    }
  };

  const handleCheckboxChange = (task: TaskWithPlayer, checked: boolean) => {
    if (checked) {
      setCheckedTasks(prev => new Set(prev).add(task.id));
      if (task.is_call) {
        setCompletingCallId(task.id);
      } else {
        handleTaskComplete(task.id);
      }
    } else {
      setCheckedTasks(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400";
      case "medium": return "bg-amber-100 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400";
      case "low": return "bg-blue-100 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400";
      default: return "bg-muted border-border";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800";
      case "in_progress": return "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800";
      default: return "bg-muted";
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const renderTaskCard = (task: TaskWithPlayer, isCall: boolean) => {
    const cardBorderColor = isCall 
      ? "border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" 
      : isOverdue(task.due_date!)
        ? getPriorityColor(task.priority)
        : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20";

    const isChecked = checkedTasks.has(task.id);

    return (
      <div
        key={task.id}
        className={`relative rounded-lg border-2 p-4 shadow-sm ${cardBorderColor} transition-all hover:shadow-md`}
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDismissTask(task.id)}
          className="absolute top-2 right-2 h-8 px-3 gap-1.5 hover:bg-muted/80"
          title="Dismiss this reminder"
        >
          <X className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Ok, got it!</span>
        </Button>

        <div className="flex items-start justify-between gap-4 pr-24">
          <div className="flex items-start gap-3 flex-1">
            <div className="pt-1 flex flex-col items-center space-y-1">
              <Checkbox
                id={`task-done-${task.id}`}
                checked={isChecked}
                onCheckedChange={(checked) => handleCheckboxChange(task, checked as boolean)}
                className="h-5 w-5 border-2"
              />
               <label htmlFor={`task-done-${task.id}`} className="text-xs font-semibold cursor-pointer text-center leading-tight">
                Mark as<br/>Done
              </label>
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {isCall && (
                  <Badge className="bg-blue-600 dark:bg-blue-700 text-white border-0 gap-1">
                    <Phone className="w-3 h-3" />
                    Call Scheduled
                  </Badge>
                )}
                <Badge className={getStatusColor(task.status)}>
                  {task.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="capitalize border-2">
                  {task.priority} priority
                </Badge>
                {isOverdue(task.due_date!) && (
                  <Badge className="bg-red-600 dark:bg-red-700 text-white border-0 animate-pulse">
                    OVERDUE
                  </Badge>
                )}
              </div>

              <h4 className="font-semibold text-base flex items-center gap-2">
                {isCall && <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                {task.title}
              </h4>

              {isCall && task.phone_number && (
                <div className="flex items-center gap-2 rounded border-2 border-blue-200 bg-blue-100/50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
                  <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-mono text-sm font-medium">{task.phone_number}</span>
                  <CopyButton text={task.phone_number} label="Phone" />
                </div>
              )}

              {isCall && task.call_topic && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Reason:</span> {task.call_topic}
                </div>
              )}

              {!isCall && task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {task.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{task.player_name}</span>
                  <span className="text-muted-foreground">(@{task.player_username})</span>
                </div>
                <div className={`flex items-center gap-1.5 font-semibold ${isOverdue(task.due_date!) ? "text-red-600 dark:text-red-400" : isCall ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`}>
                  <Calendar className="w-4 h-4" />
                  <span>
                    {isCall && !isOverdue(task.due_date!) 
                      ? `Call at ${format(new Date(task.due_date!), "PPp")}`
                      : isOverdue(task.due_date!) 
                        ? `Overdue by ${formatDistanceToNow(new Date(task.due_date!))}` 
                        : `Due ${formatDistanceToNow(new Date(task.due_date!))} from now`
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            asChild
            className="border-2 gap-1.5 shrink-0"
          >
            <Link href={`/player/${task.player_id}`}>
              View Player
              <ExternalLink className="w-3 h-3" />
            </Link>
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="h-full border-2">
        <CardHeader className="min-h-[80px]">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="h-[calc(100%-80px)]">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const visibleCalls = todayCalls.filter(task => !dismissedTasks.has(task.id));
  const visibleRegularTasks = regularTasks.filter(task => !dismissedTasks.has(task.id));
  const totalAlerts = visibleCalls.length + visibleRegularTasks.length + closureReminders.length;

  return (
    <>
      <Card className="h-full border-2 border-amber-200 bg-amber-50/30 shadow-md shadow-amber-500/5 dark:border-amber-800 dark:bg-amber-950/10">
        <CardHeader className="min-h-[80px] border-b-2 border-amber-200/60 bg-amber-100/50 py-2.5 dark:border-amber-800/60 dark:bg-amber-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-600 shadow-sm">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  Task Alerts & Reminders
                  <Badge className="border-0 bg-red-600 text-white dark:bg-red-700">
                    {totalAlerts}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {visibleCalls.length} calls today, {visibleRegularTasks.length} other tasks, {closureReminders.length} closures
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

          <CardContent className="h-[calc(100%-80px)] space-y-4 overflow-y-auto p-3">
            {totalAlerts === 0 && (
              <div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-green-200 bg-green-50/50 p-4 text-center text-green-700 shadow-sm dark:border-green-900 dark:bg-green-950/20 dark:text-green-300">
                <div>
                  <Clock className="mx-auto mb-2 h-5 w-5" />
                  <p className="font-medium">All caught up.</p>
                  <p className="mt-1 text-xs opacity-80">No urgent tasks or upcoming reminders need attention right now.</p>
                </div>
              </div>
            )}
            {visibleCalls.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-lg text-blue-700 dark:text-blue-400">
                    Calls for Today ({visibleCalls.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {visibleCalls.map((task) => renderTaskCard(task, true))}
                </div>
              </div>
            )}

            {closureReminders.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <h3 className="text-lg font-bold text-red-700 dark:text-red-400">
                    Account Breaks Ended ({closureReminders.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {closureReminders.map((player) => (
                    <div
                      key={player.id}
                      className="rounded-lg border-2 border-red-200 bg-red-50/80 p-3 shadow-sm dark:border-red-900 dark:bg-red-950/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{getFullName(player)}</p>
                          <p className="truncate text-xs text-muted-foreground">@{player.username}</p>
                          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                            Break ended {formatDistanceToNow(new Date(player.account_closure_until!), { addSuffix: true })}.
                            Send the reopening email, then reopen the account from the player page.
                          </p>
                        </div>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-2 border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
                        >
                          <Link href={`/player/${player.id}`}>Open</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visibleRegularTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-bold text-lg text-amber-700 dark:text-amber-400">
                    Other Tasks ({visibleRegularTasks.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {visibleRegularTasks.map((task) => renderTaskCard(task, false))}
                </div>
              </div>
            )}
          </CardContent>
      </Card>

      <CallCompletionDialog
        isOpen={completingCallId !== null}
        onClose={handleCallDialogClose}
        onComplete={handleCallComplete}
        callTopic={todayCalls.find(t => t.id === completingCallId)?.call_topic}
        phoneNumber={todayCalls.find(t => t.id === completingCallId)?.phone_number}
      />
    </>
  );
}
