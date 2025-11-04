
import { useState, useEffect } from "react";
import Link from "next/link";
import { taskService, Task } from "@/services/taskService";
import { playerService, getFullName } from "@/services/playerService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, ChevronDown, ChevronUp, ExternalLink, Calendar, User, Phone } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CopyButton } from "@/components/CopyButton";

interface TaskWithPlayer extends Task {
  player_name: string;
  player_username: string;
}

export function TaskAlertsPanel() {
  const [urgentTasks, setUrgentTasks] = useState<TaskWithPlayer[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const allTasks = await taskService.getAllTasks();
      const activeTasks = allTasks.filter(task => 
        task.status !== "completed" && task.status !== "cancelled"
      );

      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

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

      const urgent = tasksWithPlayers.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate <= now || (dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000);
      });

      const upcoming = tasksWithPlayers.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate > now && dueDate <= threeDaysFromNow && !urgent.includes(task);
      });

      // Sort: calls first, then by due date
      const sortTasksWithCallsFirst = (tasks: TaskWithPlayer[]) => {
        return tasks.sort((a, b) => {
          // First, sort by is_call (calls first)
          if (a.is_call && !b.is_call) return -1;
          if (!a.is_call && b.is_call) return 1;
          // Then by due date
          return new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
        });
      };

      setUrgentTasks(sortTasksWithCallsFirst(urgent));
      setUpcomingTasks(sortTasksWithCallsFirst(upcoming));
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
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

  const renderTaskCard = (task: TaskWithPlayer, isUrgent: boolean) => {
    const isCallTask = task.is_call;
    const cardBorderColor = isCallTask 
      ? "border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" 
      : isUrgent 
        ? getPriorityColor(task.priority)
        : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20";

    return (
      <div
        key={task.id}
        className={`p-4 rounded-lg border-2 ${cardBorderColor} transition-all hover:shadow-md`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {isCallTask && (
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
              {isCallTask && <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              {task.title}
            </h4>

            {isCallTask && task.phone_number && (
              <div className="flex items-center gap-2 p-2 rounded bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-mono text-sm font-medium">{task.phone_number}</span>
                <CopyButton text={task.phone_number} label="Phone" />
              </div>
            )}

            {isCallTask && task.call_topic && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Topic:</span> {task.call_topic}
              </div>
            )}

            {!isCallTask && task.description && (
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
              <div className={`flex items-center gap-1.5 font-semibold ${isOverdue(task.due_date!) ? "text-red-600 dark:text-red-400" : isCallTask ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`}>
                <Calendar className="w-4 h-4" />
                <span>
                  {isCallTask && !isOverdue(task.due_date!) 
                    ? `Call at ${format(new Date(task.due_date!), "PPp")}`
                    : isOverdue(task.due_date!) 
                      ? `Overdue by ${formatDistanceToNow(new Date(task.due_date!))}` 
                      : `Due ${formatDistanceToNow(new Date(task.due_date!))} from now`
                  }
                </span>
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

  const totalAlerts = urgentTasks.length + upcomingTasks.length;

  if (totalAlerts === 0) {
    return (
      <Alert className="border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-green-700 dark:text-green-300 font-medium">
          All caught up! No urgent tasks or upcoming reminders.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-red-50/20 dark:from-amber-950/20 dark:via-orange-950/10 dark:to-red-950/10 shadow-lg">
      <CardHeader className="border-b-2 border-amber-200/60 dark:border-amber-800/60 bg-gradient-to-r from-amber-100/50 to-orange-100/50 dark:from-amber-950/30 dark:to-orange-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-md animate-pulse">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Task Alerts & Reminders
                <Badge className="bg-red-600 dark:bg-red-700 text-white border-0 animate-pulse">
                  {totalAlerts}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {urgentTasks.length} urgent, {upcomingTasks.length} upcoming
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
        <CardContent className="pt-6 space-y-6">
          {urgentTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h3 className="font-bold text-lg text-red-700 dark:text-red-400">
                  Urgent Tasks ({urgentTasks.length})
                </h3>
              </div>
              <div className="space-y-2">
                {urgentTasks.map((task) => renderTaskCard(task, true))}
              </div>
            </div>
          )}

          {upcomingTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-lg text-amber-700 dark:text-amber-400">
                  Upcoming Tasks ({upcomingTasks.length})
                </h3>
              </div>
              <div className="space-y-2">
                {upcomingTasks.map((task) => renderTaskCard(task, false))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
