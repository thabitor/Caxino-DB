import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { playerService, Player, getFullName, vipConfig, VipLevel } from "@/services/playerService";
import { taskService, Task } from "@/services/taskService";
import { callLogService, CallLog } from "@/services/callLogService";
import { TaskList } from "@/components/TaskList";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, Calendar, DollarSign, Crown, FileText, Plus, Edit, Save, X, Check, LogOut, Bell, AlertCircle, Clock, User } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { CopyButton } from "@/components/CopyButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getBirthdayStatus, getBirthdayBadge } from "@/lib/utils";
import { CallCompletionDialog } from "@/components/CallCompletionDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PreferencesEditor } from "@/components/PreferencesEditor";

interface PlayerPreferences {
  communication?: {
    email?: boolean;
    phone?: boolean;
  };
  preferred_time_from?: number;
  preferred_time_to?: number;
  language?: string;
}

const languageLabels: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ar: "Arabic",
};

export default function PlayerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [player, setPlayer] = useState<Player | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [completingCallId, setCompletingCallId] = useState<string | null>(null);
  const [checkedAlertTasks, setCheckedAlertTasks] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);

  const fetchPlayerData = async () => {
    if (!id || typeof id !== "string") return;

    try {
      setLoading(true);
      const [playerData, tasksData, callLogsData] = await Promise.all([
        playerService.getPlayerById(id),
        taskService.getTasksByPlayerId(id),
        callLogService.getCallLogsByPlayerId(id),
      ]);

      if (!playerData) {
        toast({
          title: "Player not found",
          description: "The requested player does not exist.",
          variant: "destructive",
        });
        router.push("/");
        return;
      }

      setPlayer(playerData);
      setNotesValue(playerData.notes || "");
      setTasks(tasksData);
      setCallLogs(callLogsData);
      // Clear checked tasks state after refresh
      setCheckedAlertTasks(new Set());
    } catch (error) {
      console.error("Error fetching player data:", error);
      toast({
        title: "Error",
        description: "Could not load player details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayerData();
  }, [id]);

  const handleTaskCreate = async (taskData: any) => {
    if (!player) return;

    try {
      await taskService.createTask({ ...taskData, player_id: player.id });
      toast({ title: "Task created", description: "New task has been added successfully." });
      setIsTaskFormOpen(false);
      fetchPlayerData();
    } catch (error) {
      console.error("Error creating task:", error);
      toast({ title: "Error", description: "Could not create task.", variant: "destructive" });
    }
  };

  const handleTaskUpdate = async (taskData: any) => {
    if (!editingTask) return;

    try {
      await taskService.updateTask(editingTask.id, taskData);
      toast({ title: "Task updated", description: "Task has been updated successfully." });
      setIsTaskFormOpen(false);
      setEditingTask(null);
      fetchPlayerData();
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: "Error", description: "Could not update task.", variant: "destructive" });
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      toast({ title: "Task deleted", description: "Task has been removed successfully." });
      fetchPlayerData();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Error", description: "Could not delete task.", variant: "destructive" });
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId);
      toast({ title: "Task completed", description: "Task marked as completed." });
      // Remove from checked tasks and refresh
      setCheckedAlertTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      fetchPlayerData();
    } catch (error) {
      console.error("Error completing task:", error);
      toast({ title: "Error", description: "Could not complete task.", variant: "destructive" });
      // Uncheck on error
      setCheckedAlertTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleCallComplete = async (taskId: string, notes?: string, durationMinutes?: number) => {
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }

    try {
      await taskService.completeCallTask(taskId, user.id, notes, durationMinutes);
      toast({ 
        title: "Call completed", 
        description: "Call task marked as completed and logged successfully.",
        duration: 3000
      });
      // Remove from checked tasks, close dialog, and refresh
      setCheckedAlertTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      if (completingCallId) {
        setCompletingCallId(null);
      }
      fetchPlayerData();
    } catch (error) {
      console.error("Error completing call task:", error);
      toast({ 
        title: "Error", 
        description: "Could not complete call task. Please try again.", 
        variant: "destructive" 
      });
      // Uncheck on error
      if (taskId) {
        setCheckedAlertTasks(prev => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    }
  };

  const handleDialogCallComplete = async (notes?: string, durationMinutes?: number) => {
    if (!completingCallId) return;
    await handleCallComplete(completingCallId, notes, durationMinutes);
  };

  const handleCallDialogClose = () => {
    // Uncheck the checkbox when dialog is cancelled
    if (completingCallId) {
      setCheckedAlertTasks(prev => {
        const next = new Set(prev);
        next.delete(completingCallId);
        return next;
      });
      setCompletingCallId(null);
    }
  };
  
  const handleAlertCheckboxChange = (task: Task, checked: boolean) => {
    if (checked) {
      setCheckedAlertTasks(prev => new Set(prev).add(task.id));
      if (task.is_call) {
        setCompletingCallId(task.id);
      } else {
        handleTaskComplete(task.id);
      }
    } else {
      setCheckedAlertTasks(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleTaskFormClose = () => {
    setIsTaskFormOpen(false);
    setEditingTask(null);
  };

  const handlePlayerUpdate = async (playerData: any) => {
    if (!player) return;

    try {
      await playerService.updatePlayer(player.id, playerData);
      toast({ title: "Player updated", description: "Player information has been updated successfully." });
      setIsPlayerFormOpen(false);
      fetchPlayerData();
    } catch (error) {
      console.error("Error updating player:", error);
      toast({ title: "Error", description: "Could not update player.", variant: "destructive" });
    }
  };

  const handleSaveNotes = async () => {
    if (!player) return;

    try {
      setIsSavingNotes(true);
      await playerService.updatePlayer(player.id, { notes: notesValue });
      toast({ title: "Notes saved", description: "Player notes have been updated successfully." });
      setIsEditingNotes(false);
      fetchPlayerData();
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({ title: "Error", description: "Could not save notes.", variant: "destructive" });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCancelNotesEdit = () => {
    setNotesValue(player?.notes || "");
    setIsEditingNotes(false);
  };

  const handleSavePreferences = async (newPreferences: PlayerPreferences) => {
    if (!player) return;

    try {
      // Extract the time preferences from the preferences object
      const timeFrom = newPreferences.preferred_time_from;
      const timeTo = newPreferences.preferred_time_to;
      
      // Update the player with both the preferences JSON and the individual time columns
      await playerService.updatePlayer(player.id, { 
        preferences: newPreferences as any,
        preferred_time_from: timeFrom,
        preferred_time_to: timeTo
      });
      
      toast({ title: "Preferences saved", description: "Player preferences have been updated successfully." });
      setIsEditingPreferences(false);
      fetchPlayerData();
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({ title: "Error", description: "Could not save preferences.", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ 
        title: "Signed out", 
        description: "You have been successfully signed out." 
      });
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ 
        title: "Error", 
        description: "Could not sign out. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const parsePreferences = (prefs: any): PlayerPreferences => {
    if (!prefs) return {};
    if (typeof prefs === "string") {
      try {
        return JSON.parse(prefs);
      } catch {
        return {};
      }
    }
    return prefs as PlayerPreferences;
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 border-b-2">
          <div className="flex items-center justify-between h-16 px-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </header>
        <main className="flex-1 p-6 space-y-6">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </main>
      </div>
    );
  }

  if (!player) {
    return null;
  }

  const vipInfo = vipConfig[player.vip_level as VipLevel];
  const preferences = parsePreferences(player.preferences);

  const pendingTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && !t.is_call);
  const pendingCalls = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.is_call);

  return (
    <ProtectedRoute>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 border-b-2 border-border/60 shadow-md">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="default" 
                asChild 
                className="hover:bg-muted/50 border-2 gap-2 font-semibold"
              >
                <Link href="/">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Players
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold">{getFullName(player)}</h1>
                      <CopyButton text={getFullName(player)} label="Name" />
                      <Badge className={`${vipInfo.bgColor} ${vipInfo.color} font-semibold`}>
                        {player.vip_level} - {vipInfo.name}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">@{player.username}</p>
                      <CopyButton text={player.username} label="Username" size="sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Signed in as</p>
                    <p className="text-sm font-medium">{user.email}</p>
                  </div>
                </div>
              )}
              <ThemeSwitch />
              <Button 
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6">
          {(() => {
            const birthdayStatus = getBirthdayStatus(player.dob);
            const birthdayBadge = getBirthdayBadge(birthdayStatus);
            
            return birthdayBadge && (
              <Alert className={`border-2 ${birthdayBadge.className.replace('bg-', 'bg-').replace('text-', 'border-').replace('dark:bg-', 'dark:border-')}`}>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{birthdayBadge.emoji}</span>
                  <div>
                    <AlertTitle className="font-bold text-2xl mb-1">
                      {birthdayBadge.text}
                    </AlertTitle>
                    <AlertDescription className="text-base">
                      {birthdayStatus === "today" && `${getFullName(player)} is celebrating their birthday today! 🎉`}
                      {birthdayStatus === "tomorrow" && `${getFullName(player)}'s birthday is tomorrow. Don't forget to send wishes!`}
                      {birthdayStatus === "yesterday" && `${getFullName(player)}'s birthday was yesterday. Hope they had a great day!`}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            );
          })()}

          {(pendingTasks.length > 0 || pendingCalls.length > 0) && (
            <div className="space-y-3">
              {pendingCalls.length > 0 && (
                <Alert className="border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
                  <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-900 dark:text-blue-100 font-bold text-lg">
                    Scheduled Calls ({pendingCalls.length})
                  </AlertTitle>
                  <AlertDescription className="text-blue-800 dark:text-blue-200 mt-2">
                    <div className="space-y-2">
                      {pendingCalls.slice(0, 3).map(call => (
                        <div key={call.id} className="p-2 rounded bg-white dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold">{call.title}</p>
                              {call.phone_number && (
                                <p className="text-sm flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {call.phone_number}
                                </p>
                              )}
                              {call.due_date && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(call.due_date), "PPp")}
                                </p>
                              )}
                            </div>
                            <Badge className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                              {call.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                            <Checkbox
                              id={`call-alert-done-${call.id}`}
                              checked={checkedAlertTasks.has(call.id)}
                              onCheckedChange={(checked) => handleAlertCheckboxChange(call, checked as boolean)}
                            />
                            <label htmlFor={`call-alert-done-${call.id}`} className="text-xs font-semibold cursor-pointer">
                              Mark as Done
                            </label>
                          </div>
                        </div>
                      ))}
                      {pendingCalls.length > 3 && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          +{pendingCalls.length - 3} more scheduled calls
                        </p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {pendingTasks.length > 0 && (
                <Alert className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                  <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-900 dark:text-amber-100 font-bold text-lg">
                    Pending Tasks ({pendingTasks.length})
                  </AlertTitle>
                  <AlertDescription className="text-amber-800 dark:text-amber-200 mt-2">
                    <div className="space-y-2">
                      {pendingTasks.slice(0, 3).map(task => (
                        <div key={task.id} className="p-2 rounded bg-white dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                           <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold">{task.title}</p>
                              {task.description && (
                                <p className="text-sm line-clamp-1">{task.description}</p>
                              )}
                              {task.due_date && (
                                <p className="text-xs text-muted-foreground">
                                  Due: {format(new Date(task.due_date), "PPp")}
                                </p>
                              )}
                            </div>
                            <Badge className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                              {task.priority}
                            </Badge>
                          </div>
                           <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-800/50">
                            <Checkbox
                              id={`task-alert-done-${task.id}`}
                              checked={checkedAlertTasks.has(task.id)}
                              onCheckedChange={(checked) => handleAlertCheckboxChange(task, checked as boolean)}
                            />
                            <label htmlFor={`task-alert-done-${task.id}`} className="text-xs font-semibold cursor-pointer">
                              Mark as Done
                            </label>
                          </div>
                        </div>
                      ))}
                      {pendingTasks.length > 3 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          +{pendingTasks.length - 3} more pending tasks
                        </p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-2 hover:shadow-lg transition-all">
                <CardHeader className="border-b border-border/40 bg-muted/20 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">Player Information</CardTitle>
                      {tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length > 0 && (
                        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs px-1.5 py-0">
                          {tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length} active
                        </Badge>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsPlayerFormOpen(true)}
                      className="h-7 px-2 text-xs"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-0.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <User className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                          <span className="font-semibold">User ID</span>
                        </div>
                        <CopyButton text={player.user_id} label="User ID" size="sm" />
                      </div>
                      <p className="font-mono text-xs font-bold">{player.user_id}</p>
                    </div>

                    <div className="space-y-0.5 p-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <User className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span className="font-semibold">Gender</span>
                        </div>
                        <CopyButton text={player.gender || "Not specified"} label="Gender" size="sm" />
                      </div>
                      <p className="text-xs font-bold capitalize">{player.gender || "Not specified"}</p>
                    </div>

                    <div className="space-y-0.5 p-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Mail className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold">Email</span>
                        </div>
                        <CopyButton text={player.email} label="Email" size="sm" />
                      </div>
                      <p className="text-xs font-medium truncate">{player.email}</p>
                    </div>

                    {player.phone && (
                      <div className="space-y-0.5 p-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Phone className="w-3 h-3 text-green-600 dark:text-green-400" />
                            <span className="font-semibold">Phone</span>
                          </div>
                          <CopyButton text={player.phone} label="Phone" size="sm" />
                        </div>
                        <p className="text-xs font-medium">{player.phone}</p>
                      </div>
                    )}

                    {player.dob && (
                      <div className="space-y-0.5 p-2 rounded-lg border border-pink-200 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Calendar className="w-3 h-3 text-pink-600 dark:text-pink-400" />
                            <span className="font-semibold">Date of Birth</span>
                          </div>
                          <CopyButton text={format(new Date(player.dob), "PPP")} label="Date of Birth" size="sm" />
                        </div>
                        <p className="text-xs font-medium">{format(new Date(player.dob), "PPP")}</p>
                      </div>
                    )}

                    {player.casino && (
                      <div className="space-y-0.5 p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span className="font-semibold">Casino</span>
                          </div>
                          <CopyButton text={player.casino} label="Casino" size="sm" />
                        </div>
                        <p className="text-xs font-medium">{player.casino}</p>
                      </div>
                    )}

                    {player.last_email_sent && (
                      <div className="space-y-0.5 p-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Mail className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            <span className="font-semibold">Last Email Sent</span>
                          </div>
                          <CopyButton text={format(new Date(player.last_email_sent), "PPP")} label="Last Email Sent" size="sm" />
                        </div>
                        <p className="text-xs font-medium">{format(new Date(player.last_email_sent), "PPP")}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-lg transition-all">
                <CardHeader className="border-b border-border/40 bg-muted/20 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Preferences</CardTitle>
                    {!isEditingPreferences && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsEditingPreferences(true)}
                        className="h-7 px-2 text-xs"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="py-4">
                  {isEditingPreferences ? (
                    <div className="space-y-3">
                      <PreferencesEditor 
                        preferences={{
                          ...preferences,
                          preferred_time_from: player.preferred_time_from ?? undefined,
                          preferred_time_to: player.preferred_time_to ?? undefined
                        }}
                        onUpdate={handleSavePreferences}
                      />
                      <div className="flex gap-2 justify-end pt-2 border-t border-border/40">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setIsEditingPreferences(false)}
                          className="h-7 px-2 text-xs"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Communication Channels
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Email:</span>
                            <div className="flex items-center gap-1">
                              {preferences.communication?.email !== false ? (
                                <>
                                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  <span className="font-medium">Enabled</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  <span className="font-medium">Disabled</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Phone:</span>
                            <div className="flex items-center gap-1">
                              {preferences.communication?.phone !== false ? (
                                <>
                                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  <span className="font-medium">Enabled</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  <span className="font-medium">Disabled</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Contact Settings
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Preferred Time:</span>
                            <span className="font-medium">
                              {player.preferred_time_from && player.preferred_time_to
                                ? `${player.preferred_time_from}h to ${player.preferred_time_to}h`
                                : "Not specified"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Language:</span>
                            <span className="font-medium">
                              {languageLabels[preferences.language || "en"]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-2 hover:shadow-lg transition-all">
                <CardHeader className="border-b border-border/40 bg-muted/20 py-3">
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="space-y-2">
                    <Textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      rows={6}
                      className="resize-none text-sm"
                      placeholder="Add notes about this player..."
                    />
                    <div className="flex gap-2 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCancelNotesEdit}
                        disabled={isSavingNotes}
                        className="h-7 px-2 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                        className="h-7 px-2 text-xs"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        {isSavingNotes ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-lg transition-all">
                <CardHeader className="border-b border-border/40 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <CardTitle className="text-base flex items-center gap-2">
                        Call History
                        <Badge className="bg-blue-600 dark:bg-blue-700 text-white border-0 text-xs px-1.5 py-0">
                          {callLogs.length}
                        </Badge>
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-3">
                  {callLogs.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border/60 rounded-lg bg-muted/10">
                      <Phone className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-xs text-muted-foreground">No call history yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                      {callLogs.map((log) => (
                        <button
                          key={log.id}
                          onClick={() => setSelectedCallLog(log)}
                          className="w-full text-left p-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/70 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge className="bg-blue-600 dark:bg-blue-700 text-white border-0 text-[9px] px-1 py-0">
                                  Call
                                </Badge>
                                {log.duration_minutes && (
                                  <span className="text-[9px] text-muted-foreground">
                                    {log.duration_minutes}m
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-medium truncate">
                                {log.call_topic || "Call completed"}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(log.call_time), "MMM d, yyyy • h:mm a")}
                              </p>
                            </div>
                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(log.completed_at), { addSuffix: true })}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-2 hover:shadow-xl transition-all hover:border-primary/20">
            <CardHeader className="border-b-2 border-border/40 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tasks & Reminders</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage player-related tasks and follow-ups
                  </p>
                </div>
                <Button onClick={() => setIsTaskFormOpen(true)} size="sm" className="border-2 border-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <TaskList
                tasks={tasks}
                onEdit={handleEditTask}
                onDelete={handleTaskDelete}
                onComplete={handleTaskComplete}
                onCompleteCall={handleCallComplete}
              />
            </CardContent>
          </Card>
        </main>

        <TaskFormDialog
          isOpen={isTaskFormOpen}
          onClose={handleTaskFormClose}
          onSubmit={editingTask ? handleTaskUpdate : handleTaskCreate}
          task={editingTask}
          playerId={player.id}
          playerPhone={player.phone || undefined}
        />

        <PlayerFormDialog
          isOpen={isPlayerFormOpen}
          onClose={() => setIsPlayerFormOpen(false)}
          onSubmit={handlePlayerUpdate}
          player={player}
        />

        <CallCompletionDialog
          isOpen={completingCallId !== null}
          onClose={handleCallDialogClose}
          onComplete={handleDialogCallComplete}
          callTopic={tasks.find(t => t.id === completingCallId)?.call_topic}
          phoneNumber={tasks.find(t => t.id === completingCallId)?.phone_number}
        />

        <Dialog open={selectedCallLog !== null} onOpenChange={() => setSelectedCallLog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Call Details
              </DialogTitle>
            </DialogHeader>
            {selectedCallLog && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-blue-600 dark:bg-blue-700 text-white border-0">
                    <Phone className="w-3 h-3 mr-1" />
                    Call Completed
                  </Badge>
                  {selectedCallLog.duration_minutes && (
                    <Badge variant="outline" className="border-2 border-blue-300 dark:border-blue-700">
                      <Clock className="w-3 h-3 mr-1" />
                      {selectedCallLog.duration_minutes} minutes
                    </Badge>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold">Call Time</span>
                    </div>
                    <p className="text-sm pl-6">{format(new Date(selectedCallLog.call_time), "PPPP 'at' p")}</p>
                  </div>

                  {selectedCallLog.phone_number && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold">Phone Number</span>
                      </div>
                      <p className="text-sm font-mono pl-6">{selectedCallLog.phone_number}</p>
                    </div>
                  )}

                  {selectedCallLog.call_topic && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold">Call Topic</span>
                      </div>
                      <p className="text-sm pl-6">{selectedCallLog.call_topic}</p>
                    </div>
                  )}

                  {selectedCallLog.notes && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold">Call Notes</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap pl-6 text-muted-foreground">
                        {selectedCallLog.notes}
                      </p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold">Completed At</span>
                    </div>
                    <p className="text-sm pl-6">{format(new Date(selectedCallLog.completed_at), "PPPP 'at' p")}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}