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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, Calendar, DollarSign, Crown, FileText, Plus, Edit, Save, X, Check, LogOut, Bell, AlertCircle, Clock, User, ListPlus, CalendarCheck } from "lucide-react";
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
import { markFollowUpContacted, markFollowUpViewed, notifyDashboardRefresh } from "@/lib/dashboardSync";
import { ManualFollowUpDialog } from "@/components/ManualFollowUpDialog";
import { manualFollowUpService } from "@/services/manualFollowUpService";
import { followUpViewedService } from "@/services/followUpViewedService";

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
  const [draftPreferences, setDraftPreferences] = useState<PlayerPreferences>({});
  const [completingCallId, setCompletingCallId] = useState<string | null>(null);
  const [checkedAlertTasks, setCheckedAlertTasks] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [showAllCallLogs, setShowAllCallLogs] = useState(false);
  const [isEditingCallLog, setIsEditingCallLog] = useState(false);
  const [editedCallTopic, setEditedCallTopic] = useState("");
  const [editedCallNotes, setEditedCallNotes] = useState("");
  const [isSavingCallLog, setIsSavingCallLog] = useState(false);
  const [isManualCallLogOpen, setIsManualCallLogOpen] = useState(false);
  const [isManualFollowUpOpen, setIsManualFollowUpOpen] = useState(false);
  const [followUpViewedAt, setFollowUpViewedAt] = useState<string | null>(null);

  const fetchPlayerData = async (options?: { background?: boolean }) => {
    if (!id || typeof id !== "string") return;

    try {
      if (!options?.background) {
        setLoading(true);
      }
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

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  useEffect(() => {
    if (!player?.id) return;

    const viewedTimer = window.setTimeout(() => {
      markFollowUpViewed(player.id);
      setFollowUpViewedAt(new Date().toISOString());
      followUpViewedService.markViewed(player.id, user?.id || null)
        .then((viewed) => {
          setFollowUpViewedAt(viewed.last_viewed_at);
          notifyDashboardRefresh();
        })
        .catch((error) => {
          console.error("Error persisting follow-up viewed state:", error);
        });
    }, 10000);

    return () => window.clearTimeout(viewedTimer);
  }, [player?.id, user?.id]);

  useEffect(() => {
    if (!player?.id) return;

    followUpViewedService.getViewedPlayer(player.id, user?.id || null)
      .then((viewed) => setFollowUpViewedAt(viewed?.last_viewed_at || null))
      .catch((error) => console.error("Error loading follow-up viewed state:", error));
  }, [player?.id, user?.id]);

  const handleTaskCreate = async (taskData: any) => {
    if (!player) return;

    try {
      await taskService.createTask({ ...taskData, player_id: player.id });
      notifyDashboardRefresh();
      toast({ title: "Task created", description: "New task has been added successfully." });
      setIsTaskFormOpen(false);
      fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error creating task:", error);
      toast({ title: "Error", description: "Could not create task.", variant: "destructive" });
    }
  };

  const handleTaskUpdate = async (taskData: any) => {
    if (!editingTask) return;

    try {
      await taskService.updateTask(editingTask.id, taskData);
      notifyDashboardRefresh();
      toast({ title: "Task updated", description: "Task has been updated successfully." });
      setIsTaskFormOpen(false);
      setEditingTask(null);
      fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: "Error", description: "Could not update task.", variant: "destructive" });
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      notifyDashboardRefresh();
      toast({ title: "Task deleted", description: "Task has been removed successfully." });
      fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Error", description: "Could not delete task.", variant: "destructive" });
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId);
      notifyDashboardRefresh();
      toast({ title: "Task completed", description: "Task marked as completed." });
      // Remove from checked tasks and refresh
      setCheckedAlertTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      fetchPlayerData({ background: true });
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

  const handleCallComplete = async (taskId: string, notes?: string, durationMinutes?: number, callTopic?: string) => {
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }

    try {
      await taskService.completeCallTask(taskId, user.id, notes, durationMinutes, callTopic);
      if (player?.id) {
        markFollowUpContacted(player.id);
      }
      notifyDashboardRefresh();
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
      fetchPlayerData({ background: true });
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

  const handleManualCallLog = async (notes?: string, durationMinutes?: number, callTopic?: string) => {
    if (!user || !player) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }

    try {
      const completedAt = new Date().toISOString();
      const callLog = await callLogService.createCallLog({
        user_id: user.id,
        player_id: player.id,
        phone_number: player.phone || "",
        call_topic: callTopic || "Relationship call",
        call_time: completedAt,
        completed_at: completedAt,
        notes: notes || null,
        duration_minutes: durationMinutes || null,
      });

      setCallLogs((current) => [callLog, ...current]);
      markFollowUpContacted(player.id);
      notifyDashboardRefresh();
      setIsManualCallLogOpen(false);
      toast({
        title: "Call logged",
        description: "The call has been added to this player's history.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error logging call:", error);
      toast({
        title: "Error",
        description: "Could not log the call. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDialogCallComplete = async (notes?: string, durationMinutes?: number, callTopic?: string) => {
    if (!completingCallId) return;
    await handleCallComplete(completingCallId, notes, durationMinutes, callTopic);
  };

  const handleManualFollowUpCreate = async (note: string) => {
    if (!player) return;

    try {
      await manualFollowUpService.createManualFollowUp({
        player_id: player.id,
        manager_id: user?.id || null,
        note,
        status: "active",
      });
      notifyDashboardRefresh();
      setIsManualFollowUpOpen(false);
      toast({
        title: "Added to follow-up queue",
        description: "The note will appear on this player's follow-up card.",
      });
    } catch (error) {
      console.error("Error creating manual follow-up:", error);
      toast({
        title: "Error",
        description: "Could not add this player to the follow-up queue.",
        variant: "destructive",
      });
    }
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
      notifyDashboardRefresh();
      toast({ title: "Player updated", description: "Player information has been updated successfully." });
      setIsPlayerFormOpen(false);
      fetchPlayerData({ background: true });
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
      notifyDashboardRefresh();
      toast({ title: "Notes saved", description: "Player notes have been updated successfully." });
      setIsEditingNotes(false);
      fetchPlayerData({ background: true });
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

  const handleStartEditingPreferences = () => {
    // Initialize draft preferences with current values
    const currentPrefs = parsePreferences(player?.preferences);
    
    // Get time values, falling back to defaults if null/undefined
    const timeFrom = player?.preferred_time_from ?? 9;
    const timeTo = player?.preferred_time_to ?? 21;
    
    setDraftPreferences({
      ...currentPrefs,
      preferred_time_from: timeFrom,
      preferred_time_to: timeTo
    });
    setIsEditingPreferences(true);
  };

  const handleSavePreferences = async () => {
    if (!player) return;

    try {
      // Extract the time preferences - these go in SEPARATE database columns
      const timeFrom = draftPreferences.preferred_time_from ?? 9;
      const timeTo = draftPreferences.preferred_time_to ?? 21;
      
      // CRITICAL: Remove time fields from preferences object - they belong in separate columns
      const preferencesForJson = { ...draftPreferences };
      delete preferencesForJson.preferred_time_from;
      delete preferencesForJson.preferred_time_to;


      // CRITICAL FIX: Ensure we're sending integers, not strings or other types
      const timeFromInt = typeof timeFrom === 'number' ? timeFrom : parseInt(String(timeFrom), 10) || 9;
      const timeToInt = typeof timeTo === 'number' ? timeTo : parseInt(String(timeTo), 10) || 21;
      
      // Build update object with proper typing
      const updateData = { 
        preferences: preferencesForJson as any, // Only comm channels and language
        preferred_time_from: timeFromInt,       // Separate integer column
        preferred_time_to: timeToInt            // Separate integer column
      };
      
      await playerService.updatePlayer(player.id, updateData);
      notifyDashboardRefresh();
      
      toast({ title: "Preferences saved", description: "Player preferences have been updated successfully." });
      setIsEditingPreferences(false);
      
      await fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({ title: "Error", description: "Could not save preferences.", variant: "destructive" });
    }
  };

  const handleCancelPreferencesEdit = () => {
    setDraftPreferences({});
    setIsEditingPreferences(false);
  };

  const handleEditCallLog = () => {
    if (selectedCallLog) {
      setEditedCallTopic(selectedCallLog.call_topic || "");
      setEditedCallNotes(selectedCallLog.notes || "");
      setIsEditingCallLog(true);
    }
  };

  const handleSaveCallLog = async () => {
    if (!selectedCallLog) return;

    try {
      setIsSavingCallLog(true);
      await callLogService.updateCallLog(selectedCallLog.id, {
        call_topic: editedCallTopic,
        notes: editedCallNotes,
      });
      notifyDashboardRefresh();

      // Optimistically update UI
      const updatedCallLogs = callLogs.map(log => 
        log.id === selectedCallLog.id 
          ? { ...log, call_topic: editedCallTopic, notes: editedCallNotes } 
          : log
      );
      setCallLogs(updatedCallLogs);
      setSelectedCallLog(prev => prev ? { ...prev, call_topic: editedCallTopic, notes: editedCallNotes } : null);

      toast({ 
        title: "Call log updated", 
        description: "Call details have been saved successfully." 
      });
      setIsEditingCallLog(false);
    } catch (error) {
      console.error("Error updating call log:", error);
      toast({ 
        title: "Error", 
        description: "Could not update call log.", 
        variant: "destructive" 
      });
    } finally {
      setIsSavingCallLog(false);
    }
  };

  const handleCancelCallLogEdit = () => {
    setEditedCallTopic("");
    setEditedCallNotes("");
    setIsEditingCallLog(false);
  };

  const handleCloseCallLogDialog = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedCallLog(null);
      setIsEditingCallLog(false);
      setEditedCallTopic("");
      setEditedCallNotes("");
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
  const lastCallAt = callLogs[0]?.completed_at || callLogs[0]?.call_time || null;

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
              <Button
                size="default"
                onClick={() => setIsManualCallLogOpen(true)}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Phone className="w-4 h-4" />
                Log Call
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => setIsManualFollowUpOpen(true)}
                className="gap-2 border-primary/40"
              >
                <ListPlus className="w-4 h-4" />
                Add to Queue
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
                      {followUpViewedAt && (
                        <Badge variant="outline" className="gap-1 border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                          <CalendarCheck className="h-3.5 w-3.5" />
                          Followed up {formatDistanceToNow(new Date(followUpViewedAt), { addSuffix: true })}
                        </Badge>
                      )}
                      {lastCallAt && (
                        <Badge variant="outline" className="gap-1 border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                          <Phone className="h-3.5 w-3.5" />
                          Called {formatDistanceToNow(new Date(lastCallAt), { addSuffix: true })}
                        </Badge>
                      )}
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
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6">
          {followUpViewedAt && (
            <Alert className="border-2 border-green-300 bg-green-50/80 dark:border-green-800 dark:bg-green-950/30">
              <CalendarCheck className="h-5 w-5 text-green-700 dark:text-green-300" />
              <AlertTitle className="font-bold text-green-900 dark:text-green-100">
                Follow-up attention recorded
              </AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                This player is marked as followed up. Last follow-up{" "}
                {formatDistanceToNow(new Date(followUpViewedAt), { addSuffix: true })}.
              </AlertDescription>
            </Alert>
          )}

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
              <Card className="border-border shadow-md transition-all hover:shadow-lg">
                <CardHeader className="border-b-2 border-border/60 bg-muted/20 py-3">
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
                    <div className="flex items-center gap-1.5 rounded-lg border-2 border-slate-200 bg-slate-50/50 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/20">
                      <User className="w-3 h-3 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                      <span className="font-semibold whitespace-nowrap text-[11px] text-muted-foreground">User ID:</span>
                      <span className="font-mono text-sm font-bold text-foreground truncate">{player.user_id}</span>
                      <CopyButton text={player.user_id} label="User ID" size="sm" />
                    </div>

                    <div className="flex items-center gap-1.5 rounded-lg border-2 border-purple-200 bg-purple-50/50 p-1.5 shadow-sm dark:border-purple-800 dark:bg-purple-950/20">
                      <User className="w-3 h-3 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      <span className="font-semibold whitespace-nowrap text-[11px] text-muted-foreground">Gender:</span>
                      <span className="text-sm font-bold text-foreground capitalize truncate">{player.gender || "Not specified"}</span>
                      <CopyButton text={player.gender || "Not specified"} label="Gender" size="sm" />
                    </div>

                    <div className="flex items-center gap-1.5 rounded-lg border-2 border-blue-200 bg-blue-50/50 p-1.5 shadow-sm dark:border-blue-800 dark:bg-blue-950/20">
                      <Mail className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="font-semibold whitespace-nowrap text-[11px] text-muted-foreground">Email:</span>
                      <span className="text-sm font-medium text-foreground truncate">{player.email}</span>
                      <CopyButton text={player.email} label="Email" size="sm" />
                    </div>

                    {player.phone && (
                      <div className="flex items-center gap-1.5 rounded-lg border-2 border-green-200 bg-green-50/50 p-1.5 shadow-sm dark:border-green-800 dark:bg-green-950/20">
                        <Phone className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="font-semibold whitespace-nowrap text-[11px] text-muted-foreground">Phone:</span>
                        <span className="text-sm font-medium text-foreground truncate">{player.phone}</span>
                        <CopyButton text={player.phone} label="Phone" size="sm" />
                      </div>
                    )}

                    {player.dob && (
                      <div className="flex items-center gap-1.5 rounded-lg border-2 border-pink-200 bg-pink-50/50 p-1.5 shadow-sm dark:border-pink-800 dark:bg-pink-950/20">
                        <Calendar className="w-3 h-3 text-pink-600 dark:text-pink-400 flex-shrink-0" />
                        <span className="font-semibold whitespace-nowrap text-[11px] text-muted-foreground">DOB:</span>
                        <span className="text-sm font-medium text-foreground truncate">{format(new Date(player.dob), "PPP")}</span>
                        <CopyButton text={format(new Date(player.dob), "PPP")} label="Date of Birth" size="sm" />
                      </div>
                    )}

                    {player.casino && (
                      <div className="flex items-center gap-1.5 rounded-lg border-2 border-amber-200 bg-amber-50/50 p-1.5 shadow-sm dark:border-amber-800 dark:bg-amber-950/20">
                        <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span className="font-semibold whitespace-nowrap text-[11px] text-muted-foreground">Casino:</span>
                        <span className="text-sm font-medium text-foreground truncate">{player.casino}</span>
                        <CopyButton text={player.casino} label="Casino" size="sm" />
                      </div>
                    )}

                    {player.last_email_sent && (
                      <div className="flex items-center gap-1.5 rounded-lg border-2 border-indigo-200 bg-indigo-50/50 p-1.5 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/20">
                        <Mail className="w-3 h-3 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                        <span className="font-semibold whitespace-nowrap text-[11px] text-muted-foreground">Last Email:</span>
                        <span className="text-sm font-medium text-foreground truncate">{format(new Date(player.last_email_sent), "PPP")}</span>
                        <CopyButton text={format(new Date(player.last_email_sent), "PPP")} label="Last Email Sent" size="sm" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-md transition-all hover:shadow-lg">
                <CardHeader className="border-b-2 border-border/60 bg-muted/20 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Preferences</CardTitle>
                    {!isEditingPreferences && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleStartEditingPreferences}
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
                        preferences={draftPreferences}
                        onUpdate={setDraftPreferences}
                      />
                      <div className="flex gap-2 justify-end pt-2 border-t border-border/40">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleCancelPreferencesEdit}
                          className="h-7 px-2 text-xs"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                        <Button 
                          size="sm"
                          onClick={handleSavePreferences}
                          className="h-7 px-2 text-xs"
                        >
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-lg border-2 border-border/60 bg-muted/10 p-3 shadow-sm">
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

                      <div className="rounded-lg border-2 border-border/60 bg-muted/10 p-3 shadow-sm">
                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Contact Settings
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Preferred Time:</span>
                            <span className="font-medium">
                              {(() => {
                                if (player.preferred_time_from && player.preferred_time_to) {
                                  return `${player.preferred_time_from}h to ${player.preferred_time_to}h`;
                                }
                                return "Not specified";
                              })()}
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

              {/* Tasks & Reminders moved here to align with left column */}
              <Card className="border-primary/30 shadow-md shadow-primary/5 transition-all hover:border-primary/45 hover:shadow-xl">
                <CardHeader className="border-b-2 border-primary/15 bg-muted/30">
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
            </div>

            <div className="space-y-4">
              <Card className="border-border shadow-md transition-all hover:shadow-lg">
                <CardHeader className="border-b-2 border-border/60 bg-muted/20 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Notes</CardTitle>
                    {!isEditingNotes && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsEditingNotes(true)}
                        className="h-7 px-2 text-xs"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="py-3">
                  {isEditingNotes ? (
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
                  ) : (
                    <div className="space-y-2">
                      {player.notes ? (
                        <div className="group relative rounded-lg border-2 border-border/60 bg-muted/10 p-3 shadow-sm">
                          <p className="text-sm whitespace-pre-wrap min-h-[100px] text-foreground">
                            {player.notes}
                          </p>
                          <div className="absolute top-2 right-2">
                            <CopyButton text={player.notes} label="Notes" size="sm" />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 border border-dashed border-border/60 rounded-lg bg-muted/10">
                          <FileText className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-xs text-muted-foreground">No notes yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-blue-300/80 shadow-md shadow-blue-500/5 transition-all hover:shadow-lg dark:border-blue-800">
                <CardHeader className="border-b-2 border-blue-200/70 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 py-3 dark:border-blue-900/70 dark:from-blue-950/30 dark:to-indigo-950/30">
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
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsManualCallLogOpen(true)}
                        className="h-7 px-2 text-xs border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300"
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        Log
                      </Button>
                    {callLogs.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllCallLogs(!showAllCallLogs)}
                        className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      >
                        {showAllCallLogs ? (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            Show Recent
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            Show All ({callLogs.length})
                          </>
                        )}
                      </Button>
                    )}
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
                    <div className={`space-y-1.5 ${showAllCallLogs ? 'max-h-[600px]' : 'max-h-[320px]'} overflow-y-auto transition-all duration-300 ease-in-out scrollbar-thin scrollbar-thumb-blue-300 dark:scrollbar-thumb-blue-700 scrollbar-track-transparent`}>
                      {(showAllCallLogs ? callLogs : callLogs.slice(0, 5)).map((log, index) => (
                        <button
                          key={log.id}
                          onClick={() => setSelectedCallLog(log)}
                          className="w-full rounded-lg border-2 border-blue-200 bg-blue-50/50 p-1.5 text-left shadow-sm transition-all hover:scale-[1.01] hover:bg-blue-100/70 hover:shadow-md active:scale-[0.99] dark:border-blue-800 dark:bg-blue-950/20 dark:hover:bg-blue-900/30"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge className="bg-blue-600 dark:bg-blue-700 text-white border-0 text-[10px] px-1 py-0">
                                  Call #{callLogs.length - index}
                                </Badge>
                                {log.duration_minutes && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {log.duration_minutes}m
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium truncate">
                                {log.call_topic || "Call completed"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {format(new Date(log.call_time), "MMM d, yyyy • h:mm a")}
                              </p>
                            </div>
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(log.completed_at || log.call_time), { addSuffix: true })}
                            </div>
                          </div>
                        </button>
                      ))}
                      {!showAllCallLogs && callLogs.length > 5 && (
                        <div className="pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllCallLogs(true)}
                            className="w-full h-8 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 font-medium"
                          >
                            <Clock className="w-3 h-3 mr-1.5" />
                            View {callLogs.length - 5} More Calls
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
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

        <CallCompletionDialog
          isOpen={isManualCallLogOpen}
          onClose={() => setIsManualCallLogOpen(false)}
          onComplete={handleManualCallLog}
          phoneNumber={player.phone}
          title="Log Call"
          confirmLabel="Save Call Log"
        />

        <ManualFollowUpDialog
          isOpen={isManualFollowUpOpen}
          onClose={() => setIsManualFollowUpOpen(false)}
          onSubmit={handleManualFollowUpCreate}
          playerName={getFullName(player)}
        />

        <Dialog open={selectedCallLog !== null} onOpenChange={handleCloseCallLogDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Call Details
                </DialogTitle>
                {!isEditingCallLog && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleEditCallLog}
                    className="h-7 px-2 text-xs"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
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

                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold">Call Topic</span>
                    </div>
                    {isEditingCallLog ? (
                      <Input
                        value={editedCallTopic}
                        onChange={(e) => setEditedCallTopic(e.target.value)}
                        className="w-full text-sm"
                        placeholder="Enter call topic..."
                      />
                    ) : (
                      <p className="text-sm font-medium truncate">
                        {selectedCallLog.call_topic || "No topic specified"}
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold">Call Notes</span>
                    </div>
                    {isEditingCallLog ? (
                      <Textarea
                        value={editedCallNotes}
                        onChange={(e) => setEditedCallNotes(e.target.value)}
                        rows={4}
                        className="resize-none text-sm"
                        placeholder="Add notes about this call..."
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap pl-6 text-foreground">
                        {selectedCallLog.notes || "No notes available"}
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold">Completed At</span>
                    </div>
                    <p className="text-sm pl-6">{format(new Date(selectedCallLog.completed_at || selectedCallLog.call_time), "PPPP 'at' p")}</p>
                  </div>
                </div>

                {isEditingCallLog && (
                  <div className="flex gap-2 justify-end pt-3 mt-3 border-t border-border/40">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCancelCallLogEdit}
                      disabled={isSavingCallLog}
                      className="h-8 px-3 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSaveCallLog}
                      disabled={isSavingCallLog}
                      className="h-8 px-3 text-xs"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      {isSavingCallLog ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
