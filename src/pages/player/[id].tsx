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

interface PlayerPreferences {
  communication?: {
    email?: boolean;
    sms?: boolean;
    phone?: boolean;
  };
  contact_time?: "morning" | "afternoon" | "evening" | "any";
  marketing_consent?: boolean;
  language?: string;
  notifications?: {
    promotions?: boolean;
    account_updates?: boolean;
    game_results?: boolean;
  };
}

const contactTimeLabels = {
  morning: "Morning (9 AM - 12 PM)",
  afternoon: "Afternoon (12 PM - 5 PM)",
  evening: "Evening (5 PM - 9 PM)",
  any: "Any Time",
};

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
  const [completingCallId, setCompletingCallId] = useState<string | null>(null);
  const [checkedAlertTasks, setCheckedAlertTasks] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { signOut, user } = useAuth();

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
                      <CopyButton text={getFullName(player)} label="Name" size="sm" />
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

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-2 hover:shadow-xl transition-all hover:border-primary/20">
              <CardHeader className="border-b-2 border-border/40 bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle>Player Information</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsPlayerFormOpen(true)}
                    className="h-8 px-3 border-2 hover:bg-accent"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1 p-3 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold">Email</span>
                      </div>
                      <CopyButton text={player.email} label="Email" />
                    </div>
                    <p className="font-medium text-sm">{player.email}</p>
                  </div>

                  {player.phone && (
                    <div className="space-y-1 p-3 rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="font-semibold">Phone</span>
                      </div>
                      <p className="font-medium text-sm">{player.phone}</p>
                    </div>
                  )}

                  {player.dob && (
                    <div className="space-y-1 p-3 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="font-semibold">Date of Birth</span>
                      </div>
                      <p className="font-medium text-sm">{format(new Date(player.dob), "PPP")}</p>
                    </div>
                  )}

                  <div className="space-y-1 p-3 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-semibold">Total Deposits</span>
                    </div>
                    <p className="font-medium text-sm">${Number(player.total_deposits || 0).toLocaleString()}</p>
                  </div>

                  {player.casino && (
                    <div className="space-y-1 p-3 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="font-semibold">Casino</span>
                      </div>
                      <p className="font-medium text-sm">{player.casino}</p>
                    </div>
                  )}

                  {player.last_email_sent && (
                    <div className="space-y-1 p-3 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-semibold">Last Email Sent</span>
                      </div>
                      <p className="font-medium text-sm">{format(new Date(player.last_email_sent), "PPP")}</p>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />
                
                <div className="space-y-3 p-4 rounded-lg border-2 border-border/60 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FileText className="w-4 h-4" />
                      <span>Notes</span>
                      {player.notes && !isEditingNotes && (
                        <CopyButton text={player.notes} label="Notes" size="sm" />
                      )}
                    </div>
                    {!isEditingNotes && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsEditingNotes(true)}
                        className="h-8 px-3 border-2"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {isEditingNotes ? (
                    <div className="space-y-2">
                      <Textarea
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        rows={4}
                        className="resize-none border-2"
                        placeholder="Add notes about this player..."
                      />
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleCancelNotesEdit}
                          disabled={isSavingNotes}
                          className="border-2"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button 
                          size="sm"
                          onClick={handleSaveNotes}
                          disabled={isSavingNotes}
                          className="border-2 border-primary"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {isSavingNotes ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap bg-background p-3 rounded-lg border-2 border-border/40">
                      {player.notes || "No notes added yet."}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-2 hover:shadow-xl transition-all hover:border-primary/20">
                <CardHeader className="border-b-2 border-border/40 bg-muted/30">
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <span className="text-sm font-semibold text-muted-foreground">User ID</span>
                    <span className="font-mono text-sm font-bold">{player.user_id}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                    <span className="text-sm font-semibold text-muted-foreground">Gender</span>
                    <span className="font-bold capitalize">{player.gender || "Not specified"}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <span className="text-sm font-semibold text-muted-foreground">Active Tasks</span>
                    <span className="font-bold text-xl">{tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:shadow-xl transition-all hover:border-primary/20">
                <CardHeader className="border-b-2 border-border/40 bg-muted/30">
                  <CardTitle className="text-lg">Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="p-3 rounded-lg border-2 border-border/40 bg-muted/20">
                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Communication
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                        <span className="text-muted-foreground font-medium">Email</span>
                        {preferences.communication?.email !== false ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                        <span className="text-muted-foreground font-medium">SMS</span>
                        {preferences.communication?.sms !== false ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                        <span className="text-muted-foreground font-medium">Phone</span>
                        {preferences.communication?.phone !== false ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm p-3 rounded-lg border-2 border-border/40 bg-muted/20">
                    <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                      <span className="text-muted-foreground font-medium">Contact Time</span>
                      <span className="font-semibold text-xs">
                        {contactTimeLabels[preferences.contact_time || "any"]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                      <span className="text-muted-foreground font-medium">Language</span>
                      <span className="font-semibold">
                        {languageLabels[preferences.language || "en"]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                      <span className="text-muted-foreground font-medium">Marketing</span>
                      {preferences.marketing_consent ? (
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="p-3 rounded-lg border-2 border-border/40 bg-muted/20">
                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Notifications
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                        <span className="text-muted-foreground font-medium">Promotions</span>
                        {preferences.notifications?.promotions !== false ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                        <span className="text-muted-foreground font-medium">Account Updates</span>
                        {preferences.notifications?.account_updates !== false ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                        <span className="text-muted-foreground font-medium">Game Results</span>
                        {preferences.notifications?.game_results !== false ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    </div>
                  </div>
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

          <Card className="border-2 hover:shadow-xl transition-all hover:border-primary/20">
            <CardHeader className="border-b-2 border-border/40 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Call History
                      <Badge className="bg-blue-600 dark:bg-blue-700 text-white border-0">
                        {callLogs.length}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Complete log of all calls made to this player
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {callLogs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border/60 rounded-lg bg-muted/20">
                  <Phone className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground font-medium mb-1">No call history yet</p>
                  <p className="text-sm text-muted-foreground">
                    Call logs will appear here when calls are completed
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {callLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-blue-600 dark:bg-blue-700 text-white border-0">
                              <Phone className="w-3 h-3 mr-1" />
                              Call Completed
                            </Badge>
                            {log.duration_minutes && (
                              <Badge variant="outline" className="border-2 border-blue-300 dark:border-blue-700">
                                <Clock className="w-3 h-3 mr-1" />
                                {log.duration_minutes} min
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(log.completed_at), { addSuffix: true })}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="font-semibold">Call Time:</span>
                              <span>{format(new Date(log.call_time), "PPp")}</span>
                            </div>

                            {log.phone_number && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="font-semibold">Number:</span>
                                <span className="font-mono">{log.phone_number}</span>
                              </div>
                            )}

                            {log.call_topic && (
                              <div className="flex items-center gap-2 text-sm">
                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="font-semibold">Topic:</span>
                                <span>{log.call_topic}</span>
                              </div>
                            )}
                          </div>

                          {log.notes && (
                            <div className="mt-3 p-3 rounded-lg bg-white dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-semibold">Call Notes:</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                                {log.notes}
                              </p>
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                            Completed at: {format(new Date(log.completed_at), "PPpp")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        <TaskFormDialog
          isOpen={isTaskFormOpen}
          onClose={handleTaskFormClose}
          onSubmit={editingTask ? handleTaskUpdate : handleTaskCreate}
          task={editingTask}
          playerId={player.id}
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
      </div>
    </ProtectedRoute>
  );
}