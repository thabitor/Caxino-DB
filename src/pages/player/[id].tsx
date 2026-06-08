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
import { ArrowLeft, ArrowUp, ArrowDown, Mail, Phone, PhoneOff, Calendar, DollarSign, Crown, FileText, Plus, Edit, Save, X, Check, LogOut, Bell, AlertCircle, Clock, User, ListPlus, CalendarCheck, ShieldAlert, Send } from "lucide-react";
import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
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
import { manualFollowUpService, ManualFollowUp } from "@/services/manualFollowUpService";
import { followUpViewedService } from "@/services/followUpViewedService";
import { playerTouchpointService, PlayerTouchpoint } from "@/services/playerTouchpointService";

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

const getLastCallBadgeClass = (lastCallAt?: string | null) => {
  if (!lastCallAt) {
    return "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300";
  }

  const callDate = new Date(lastCallAt);
  if (!Number.isFinite(callDate.getTime())) {
    return "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300";
  }

  const daysSinceCall = differenceInCalendarDays(new Date(), callDate);
  return daysSinceCall > 30
    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
    : "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300";
};

const CALL_REASONS = ["Reward", "Payment", "Tech issue"] as const;

const ACCOUNT_CLOSURE_REASONS = ["GA", "Self harm", "RG", "QL", "LT", "Normal"] as const;
const REOPENABLE_REASONS = ["GA", "Normal"] as const;
const BREAK_DURATIONS = [
  { label: "2 weeks", weeks: 2 },
  { label: "4 weeks", weeks: 4 },
  { label: "6 weeks", weeks: 6 },
  { label: "8 weeks", weeks: 8 },
] as const;

type AccountClosureReason = typeof ACCOUNT_CLOSURE_REASONS[number];
type AccountClosureType = "break" | "permanent";

function parseCallReasons(value?: string | null) {
  if (!value) return [];
  return CALL_REASONS.filter((reason) => value.split(",").map((item) => item.trim()).includes(reason));
}

function toggleCallReason(currentValue: string, callReason: typeof CALL_REASONS[number], checked: boolean) {
  const currentReasons = parseCallReasons(currentValue);
  const nextReasons = checked
    ? currentReasons.includes(callReason) ? currentReasons : [...currentReasons, callReason]
    : currentReasons.filter((reason) => reason !== callReason);

  return nextReasons.join(", ");
}

function normalizeCallTopic(value?: string | null) {
  const topic = value?.trim();
  if (!topic || topic.toLowerCase() === "no answer") {
    return null;
  }

  return topic;
}

function isNoAnswerCallLog(log?: Pick<CallLog, "notes"> | null) {
  return Boolean(log?.notes?.toLowerCase().includes("no answer. contact attempt recorded at"));
}

function getCanonicalAccountStatus(status?: string | null) {
  return (status || "open").trim().toLowerCase();
}

function getClosureKind(type?: string | null) {
  return type === "break" ? "temporary" : "permanent";
}

function getClosureLabel(type?: string | null) {
  return getClosureKind(type) === "temporary" ? "Temporary break" : "Permanently closed";
}

function getClosureBadgeClass(type?: string | null) {
  return getClosureKind(type) === "temporary"
    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
    : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-300";
}

export default function PlayerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const isEmbedded = router.query.embed === "1";
  const [player, setPlayer] = useState<Player | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [noteLogs, setNoteLogs] = useState<PlayerTouchpoint[]>([]);
  const [manualFollowUps, setManualFollowUps] = useState<ManualFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [taskFormDefaultIsCall, setTaskFormDefaultIsCall] = useState(false);
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState<PlayerPreferences>({});
  const [draftContactEmailOnly, setDraftContactEmailOnly] = useState(false);
  const [draftTelegramMember, setDraftTelegramMember] = useState(false);
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
  const [prefilledManualCallTopic, setPrefilledManualCallTopic] = useState<string | null>(null);
  const [prefilledManualCallTaskId, setPrefilledManualCallTaskId] = useState<string | null>(null);
  const [isManualFollowUpOpen, setIsManualFollowUpOpen] = useState(false);
  const [followUpViewedAt, setFollowUpViewedAt] = useState<string | null>(null);
  const [isAccountClosureOpen, setIsAccountClosureOpen] = useState(false);
  const [isExceptionalReopenOpen, setIsExceptionalReopenOpen] = useState(false);
  const [closureReasons, setClosureReasons] = useState<AccountClosureReason[]>([]);
  const [closureType, setClosureType] = useState<AccountClosureType>("break");
  const [breakWeeks, setBreakWeeks] = useState<string>("2");
  const [customBreakWeeks, setCustomBreakWeeks] = useState("");
  const [isSavingClosure, setIsSavingClosure] = useState(false);
  const [isDowngradeDialogOpen, setIsDowngradeDialogOpen] = useState(false);
  const [isSavingDowngrade, setIsSavingDowngrade] = useState(false);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [isSavingUpgrade, setIsSavingUpgrade] = useState(false);
  const [isSavingBonusFlag, setIsSavingBonusFlag] = useState(false);

  const fetchPlayerData = async (options?: { background?: boolean }) => {
    if (!id || typeof id !== "string") return;

    try {
      if (!options?.background) {
        setLoading(true);
      }
      const [playerData, tasksData, callLogsData, touchpointsData, manualFollowUpsData] = await Promise.all([
        playerService.getPlayerById(id),
        taskService.getTasksByPlayerId(id),
        callLogService.getCallLogsByPlayerId(id),
        playerTouchpointService.getTouchpointsByPlayerId(id),
        manualFollowUpService.getManualFollowUpsByPlayerId(id),
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
      setNoteLogs(touchpointsData.filter((touchpoint) => touchpoint.touchpoint_type === "note"));
      setManualFollowUps(manualFollowUpsData);
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
    if (!player?.id || router.query.action !== "log-call") return;

    const callReason = typeof router.query.callReason === "string"
      ? normalizeCallTopic(router.query.callReason)
      : null;
    const callTaskId = typeof router.query.callTaskId === "string" ? router.query.callTaskId : null;
    setPrefilledManualCallTopic(callReason);
    setPrefilledManualCallTaskId(callTaskId);
    setIsManualCallLogOpen(true);
    const { action, callReason: _callReason, callTaskId: _callTaskId, ...restQuery } = router.query;
    router.replace(
      { pathname: router.pathname, query: restQuery },
      undefined,
      { shallow: true }
    );
  }, [player?.id, router]);

  useEffect(() => {
    if (!player?.id) return;
    if (getCanonicalAccountStatus(player.account_status) === "closed") {
      setFollowUpViewedAt(null);
      return;
    }

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
  }, [player?.id, player?.account_status, user?.id]);

  useEffect(() => {
    if (!player?.id) return;
    if (getCanonicalAccountStatus(player.account_status) === "closed") {
      setFollowUpViewedAt(null);
      return;
    }

    followUpViewedService.getViewedPlayer(player.id, user?.id || null)
      .then((viewed) => setFollowUpViewedAt(viewed?.last_viewed_at || null))
      .catch((error) => console.error("Error loading follow-up viewed state:", error));
  }, [player?.id, player?.account_status, user?.id]);

  const handleTaskCreate = async (taskData: any) => {
    if (!player) return;

    try {
      await taskService.createTask({ ...taskData, player_id: player.id });
      notifyDashboardRefresh();
      toast({ title: "Task created", description: "New task has been added successfully." });
      setIsTaskFormOpen(false);
      setTaskFormDefaultIsCall(false);
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
      setTaskFormDefaultIsCall(false);
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

  const handleCallCancel = async (taskId: string) => {
    try {
      await taskService.updateTask(taskId, { status: "cancelled" });
      notifyDashboardRefresh();
      toast({
        title: "Scheduled call cancelled",
        description: "The call reminder has been dismissed and removed from active scheduled calls.",
      });
      setCheckedAlertTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error cancelling scheduled call:", error);
      toast({ title: "Error", description: "Could not cancel the scheduled call.", variant: "destructive" });
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
      const isNoAnswer = notes?.toLowerCase().includes("no answer. contact attempt recorded at");
      toast({ 
        title: isNoAnswer ? "No answer recorded" : "Call completed", 
        description: isNoAnswer
          ? "The unanswered call attempt was added to this player's history."
          : "Call task marked as completed and logged successfully.",
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

  const handleManualCallLog = async (notes?: string, durationMinutes?: number, callReason?: string) => {
    if (!user || !player) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }

    try {
      const completedAt = new Date().toISOString();
      const callLog = await callLogService.createCallLog({
        user_id: user.id,
        player_id: player.id,
        task_id: prefilledManualCallTaskId,
        phone_number: player.phone || "",
        call_topic: normalizeCallTopic(callReason),
        call_time: completedAt,
        completed_at: completedAt,
        notes: notes || null,
        duration_minutes: durationMinutes || null,
      });

      if (prefilledManualCallTaskId) {
        await taskService.completeTask(prefilledManualCallTaskId);
      }

      setCallLogs((current) => [callLog, ...current]);
      markFollowUpContacted(player.id);
      notifyDashboardRefresh();
      setIsManualCallLogOpen(false);
      setPrefilledManualCallTopic(null);
      setPrefilledManualCallTaskId(null);
      const isNoAnswer = notes?.toLowerCase().includes("no answer. contact attempt recorded at");
      toast({
        title: isNoAnswer ? "No answer recorded" : "Call logged",
        description: isNoAnswer
          ? "The unanswered call attempt was added to this player's history."
          : "The call has been added to this player's history.",
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
    if (getCanonicalAccountStatus(player.account_status) === "closed") {
      toast({
        title: "Closed account",
        description: "Closed accounts cannot be added to the follow-up queue.",
        variant: "destructive",
      });
      setIsManualFollowUpOpen(false);
      return;
    }

    try {
      const followUp = await manualFollowUpService.createManualFollowUp({
        player_id: player.id,
        manager_id: user?.id || null,
        note,
        status: "active",
      });
      setManualFollowUps((current) => [followUp, ...current]);
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
    setTaskFormDefaultIsCall(false);
    setIsTaskFormOpen(true);
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setTaskFormDefaultIsCall(false);
    setIsTaskFormOpen(true);
  };

  const handleScheduleCall = () => {
    setEditingTask(null);
    setTaskFormDefaultIsCall(true);
    setIsTaskFormOpen(true);
  };

  const handleTaskFormClose = () => {
    setIsTaskFormOpen(false);
    setEditingTask(null);
    setTaskFormDefaultIsCall(false);
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

  const handleCloseAccount = async () => {
    if (!player || closureReasons.length === 0) return;

    const canChooseBreak = closureReasons.every((reason) =>
      REOPENABLE_REASONS.includes(reason as typeof REOPENABLE_REASONS[number])
    );
    const finalClosureType: AccountClosureType = canChooseBreak ? closureType : "permanent";
    const selectedWeeks = breakWeeks === "custom" ? Number(customBreakWeeks) : Number(breakWeeks);
    const closureReasonText = closureReasons.join(", ");

    if (finalClosureType === "break" && (!Number.isFinite(selectedWeeks) || selectedWeeks <= 0)) {
      toast({
        title: "Break duration required",
        description: "Choose a break duration or enter a valid custom number of weeks.",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    const closureUntil =
      finalClosureType === "break"
        ? new Date(now.getTime() + selectedWeeks * 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    try {
      setIsSavingClosure(true);
      await Promise.all([
        playerService.updatePlayer(player.id, {
          account_status: "closed",
          account_closure_reason: closureReasonText,
          account_closure_type: finalClosureType,
          account_closure_until: closureUntil,
          account_closed_at: now.toISOString(),
          account_reopened_at: null,
        }),
        manualFollowUpService.resolveActiveManualFollowUpsForPlayer(player.id),
      ]);
      setFollowUpViewedAt(null);
      setManualFollowUps((current) => current.map((followUp) => (
        followUp.status === "active"
          ? { ...followUp, status: "resolved", resolved_at: now.toISOString() }
          : followUp
      )));
      notifyDashboardRefresh();
      toast({
        title: "Account closed",
        description:
          finalClosureType === "break"
            ? `Reminder set for ${selectedWeeks} week${selectedWeeks === 1 ? "" : "s"}. The account stays closed until you reopen it.`
            : "Permanent closure recorded.",
      });
      setIsAccountClosureOpen(false);
      setClosureReasons([]);
      setClosureType("break");
      setBreakWeeks("2");
      setCustomBreakWeeks("");
      fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error closing account:", error);
      toast({ title: "Error", description: "Could not close the account.", variant: "destructive" });
    } finally {
      setIsSavingClosure(false);
    }
  };

  const handleReopenAccount = async (options?: { exceptional?: boolean }) => {
    if (!player) return;

    try {
      setIsSavingClosure(true);
      await playerService.updatePlayer(player.id, {
        account_status: "open",
        account_reopened_at: new Date().toISOString(),
      });
      if (options?.exceptional) {
        await playerTouchpointService.createTouchpoint({
          player_id: player.id,
          manager_id: user?.id || null,
          touchpoint_type: "note",
          title: "Exceptional account reopen",
          body: `Account exceptionally reopened after permanent closure${player.account_closure_reason ? ` (${player.account_closure_reason})` : ""}.`,
          occurred_at: new Date().toISOString(),
          source_table: "players",
          source_id: player.id,
        });
      }
      notifyDashboardRefresh();
      toast({
        title: options?.exceptional ? "Account exceptionally reopened" : "Account reopened",
        description: options?.exceptional
          ? "The permanent closure was overridden and the account is marked open."
          : "The account is marked open again.",
      });
      setIsExceptionalReopenOpen(false);
      fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error reopening account:", error);
      toast({ title: "Error", description: "Could not reopen the account.", variant: "destructive" });
    } finally {
      setIsSavingClosure(false);
    }
  };

  const handleVipDowngrade = async (newLevel: VipLevel) => {
    if (!player || !user) return;
    const currentLevel = (player.vip_level || 1) as VipLevel;
    if (newLevel >= currentLevel) return;

    try {
      setIsSavingDowngrade(true);
      const updatedPlayer = await playerService.updatePlayer(player.id, { vip_level: newLevel });
      await playerTouchpointService.createTouchpoint({
        player_id: player.id,
        manager_id: user.id,
        touchpoint_type: "note",
        title: "VIP level downgraded",
        body: `VIP level changed from ${currentLevel} to ${newLevel}.`,
        occurred_at: new Date().toISOString(),
        source_table: "players",
        source_id: player.id,
      });
      setPlayer(updatedPlayer);
      notifyDashboardRefresh();
      toast({
        title: "VIP downgraded",
        description: `Player moved from VIP ${currentLevel} to VIP ${newLevel}.`,
      });
      setIsDowngradeDialogOpen(false);
      fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error downgrading VIP level:", error);
      toast({ title: "Error", description: "Could not downgrade the VIP level.", variant: "destructive" });
    } finally {
      setIsSavingDowngrade(false);
    }
  };

  const handleVipUpgrade = async (newLevel: VipLevel) => {
    if (!player || !user) return;
    const currentLevel = (player.vip_level || 1) as VipLevel;
    if (newLevel <= currentLevel) return;

    try {
      setIsSavingUpgrade(true);
      const updatedPlayer = await playerService.updatePlayer(player.id, { vip_level: newLevel });
      await playerTouchpointService.createTouchpoint({
        player_id: player.id,
        manager_id: user.id,
        touchpoint_type: "note",
        title: "VIP level upgraded",
        body: `VIP level changed from ${currentLevel} to ${newLevel}.`,
        occurred_at: new Date().toISOString(),
        source_table: "players",
        source_id: player.id,
      });
      setPlayer(updatedPlayer);
      notifyDashboardRefresh();
      toast({
        title: "VIP upgraded",
        description: `Player moved from VIP ${currentLevel} to VIP ${newLevel}.`,
      });
      setIsUpgradeDialogOpen(false);
      fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error upgrading VIP level:", error);
      toast({ title: "Error", description: "Could not upgrade the VIP level.", variant: "destructive" });
    } finally {
      setIsSavingUpgrade(false);
    }
  };

  const handleBonusAbuserToggle = async () => {
    if (!player) return;

    const nextValue = !player.bonus_abuser;
    const now = new Date().toISOString();

    try {
      setIsSavingBonusFlag(true);
      const updatedPlayer = await playerService.updatePlayer(player.id, {
        bonus_abuser: nextValue,
        bonus_abuser_marked_at: nextValue ? now : null,
      });
      await playerTouchpointService.createTouchpoint({
        player_id: player.id,
        manager_id: user?.id || null,
        touchpoint_type: "note",
        title: nextValue ? "Bonus abuser flag added" : "Bonus abuser flag removed",
        body: nextValue
          ? "Player marked as a bonus abuser."
          : "Bonus abuser flag removed from player.",
        occurred_at: now,
        source_table: "players",
        source_id: player.id,
      });

      setPlayer(updatedPlayer);
      notifyDashboardRefresh();
      toast({
        title: nextValue ? "Bonus abuser marked" : "Bonus abuser removed",
        description: nextValue
          ? "This player is now flagged as a bonus abuser."
          : "The bonus abuser flag has been removed.",
      });
      fetchPlayerData({ background: true });
    } catch (error) {
      console.error("Error updating bonus abuser flag:", error);
      toast({ title: "Error", description: "Could not update bonus abuser flag.", variant: "destructive" });
    } finally {
      setIsSavingBonusFlag(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!player || !notesValue.trim()) {
      toast({ title: "Note required", description: "Add a note before saving.", variant: "destructive" });
      return;
    }

    try {
      setIsSavingNotes(true);
      const now = new Date().toISOString();
      const [noteLog] = await Promise.all([
        playerTouchpointService.createTouchpoint({
          player_id: player.id,
          manager_id: user?.id || null,
          touchpoint_type: "note",
          title: "Manager note",
          body: notesValue.trim(),
          occurred_at: now,
          source_table: "player_touchpoints",
        }),
        playerService.updatePlayer(player.id, { notes: notesValue.trim() }),
      ]);
      setNoteLogs((current) => [noteLog, ...current]);
      setPlayer((current) => current ? { ...current, notes: notesValue.trim() } : current);
      notifyDashboardRefresh();
      toast({ title: "Note logged", description: "The note was added to this player's note history." });
      setIsNoteDialogOpen(false);
      setNotesValue("");
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({ title: "Error", description: "Could not save notes.", variant: "destructive" });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCancelNotesEdit = () => {
    setNotesValue("");
    setIsNoteDialogOpen(false);
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
    setDraftContactEmailOnly(player?.contact_email_only ?? false);
    setDraftTelegramMember(player?.telegram_member ?? false);
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
        preferred_time_to: timeToInt,           // Separate integer column
        contact_email_only: draftContactEmailOnly,
        telegram_member: draftTelegramMember,
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
    setDraftContactEmailOnly(false);
    setDraftTelegramMember(false);
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
      const normalizedCallTopic = normalizeCallTopic(editedCallTopic);
      await callLogService.updateCallLog(selectedCallLog.id, {
        call_topic: normalizedCallTopic,
        notes: editedCallNotes,
      });
      notifyDashboardRefresh();

      // Optimistically update UI
      const updatedCallLogs = callLogs.map(log => 
        log.id === selectedCallLog.id 
          ? { ...log, call_topic: normalizedCallTopic, notes: editedCallNotes } 
          : log
      );
      setCallLogs(updatedCallLogs);
      setSelectedCallLog(prev => prev ? { ...prev, call_topic: normalizedCallTopic, notes: editedCallNotes } : null);

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
      <div className="flex min-h-screen flex-col bg-background">
        {!isEmbedded && (
          <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 border-b-2">
            <div className="flex items-center justify-between h-16 px-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </header>
        )}
        <main className={`flex-1 space-y-6 ${isEmbedded ? "p-3" : "p-6"}`}>
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </main>
      </div>
    );
  }

  if (!player) {
    return null;
  }

  const vipInfo = vipConfig[(player.vip_level || 1) as VipLevel];
  const preferences = parsePreferences(player.preferences);

  const pendingTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && !t.is_call);
  const pendingCalls = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.is_call);
  const lastCallAt = callLogs[0]?.completed_at || callLogs[0]?.call_time || null;
  const accountStatus = getCanonicalAccountStatus(player.account_status);
  const isAccountClosed = accountStatus === "closed";
  const visibleFollowUpViewedAt = isAccountClosed ? null : followUpViewedAt;
  const isBreakClosure = isAccountClosed && player.account_closure_type === "break";
  const closureLabel = getClosureLabel(player.account_closure_type);
  const closureBadgeClass = getClosureBadgeClass(player.account_closure_type);
  const accountStatusLabel = isAccountClosed ? closureLabel : "Open";
  const accountStatusDetail = isAccountClosed ? player.account_closure_reason || "Unspecified" : null;
  const canReopenAccount = isBreakClosure && REOPENABLE_REASONS.includes(player.account_closure_reason as typeof REOPENABLE_REASONS[number]);
  const breakEndsAt = player.account_closure_until ? new Date(player.account_closure_until) : null;
  const isBreakDue = Boolean(isBreakClosure && breakEndsAt && breakEndsAt.getTime() <= Date.now());
  const goToDirectory = () => router.push({ pathname: "/", query: { tab: "directory" } });
  const handleBackNavigation = () => {
    const from = Array.isArray(router.query.from) ? router.query.from[0] : router.query.from;
    if (from === "window" || (typeof window !== "undefined" && window.history.length <= 1)) {
      goToDirectory();
      return;
    }
    router.back();
  };
  const activeManualFollowUp = isAccountClosed ? null : manualFollowUps.find((followUp) => followUp.status === "active");
  const currentVipLevel = (player.vip_level || 1) as VipLevel;
  const upgradeLevels = (Object.keys(vipConfig).map(Number) as VipLevel[])
    .filter((level) => level > currentVipLevel)
    .sort((a, b) => a - b);
  const downgradeLevels = (Object.keys(vipConfig).map(Number) as VipLevel[])
    .filter((level) => level < currentVipLevel)
    .sort((a, b) => b - a);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        {!isEmbedded && (
        <header className="sticky top-0 z-10 border-b-2 border-border/60 bg-background/90 shadow-md backdrop-blur-lg">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border/60 px-4 py-2 lg:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-1.5 border-2 font-semibold hover:bg-muted/50"
                onClick={handleBackNavigation}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                asChild 
                className="h-8 gap-1.5 border-2 font-semibold hover:bg-muted/50"
              >
                <Link href={{ pathname: "/", query: { tab: "directory" } }}>
                  Directory
                </Link>
              </Button>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {user && (
                <div className="hidden items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 md:flex">
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
          <div className="px-4 py-3 lg:px-5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="inline-flex min-w-0 items-center gap-2 truncate text-2xl font-extrabold tracking-tight">
                <span className="truncate">{getFullName(player)}</span>
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    isAccountClosed
                      ? closureBadgeClass
                      : "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                  }`}
                  title={accountStatusDetail ? `${accountStatusLabel}: ${accountStatusDetail}` : accountStatusLabel}
                  aria-label={accountStatusDetail ? `${accountStatusLabel}: ${accountStatusDetail}` : accountStatusLabel}
                >
                  {isAccountClosed ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                </span>
                {isAccountClosed && (
                  <span className={`truncate text-xs font-semibold ${isBreakClosure ? "text-blue-700 dark:text-blue-300" : "text-rose-700 dark:text-rose-300"}`}>
                    {accountStatusLabel}
                  </span>
                )}
              </h1>
              <CopyButton text={getFullName(player)} label="Name" />
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-muted-foreground">
                @{player.username}
                <CopyButton text={player.username} label="Username" size="icon" className="h-7 w-7" />
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-semibold text-muted-foreground/80">
                {player.user_id}
                <CopyButton text={player.user_id} label="User ID" size="icon" className="h-7 w-7" />
              </span>
              <Badge className={`${vipInfo.bgColor} ${vipInfo.color} font-semibold`} title={`VIP level ${player.vip_level}: ${vipInfo.name}`}>
                {player.vip_level} - {vipInfo.name}
              </Badge>
              {player.bonus_abuser && (
                <Badge variant="outline" title="Marked as a bonus abuser" className="gap-1 border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Bonus abuser
                </Badge>
              )}
              {player.contact_email_only && (
                <Badge variant="outline" title="Prefers exclusive email contact" className="gap-1 border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
                  <Mail className="h-3.5 w-3.5" />
                  Email only
                </Badge>
              )}
              {player.telegram_member && (
                <Badge variant="outline" title="Telegram group member" className="gap-1 border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                  <Send className="h-3.5 w-3.5" />
                  Telegram
                </Badge>
              )}
              {visibleFollowUpViewedAt && (
                <Badge variant="outline" title={`Followed up ${formatDistanceToNow(new Date(visibleFollowUpViewedAt), { addSuffix: true })}`} className="gap-1 border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Followed up {formatDistanceToNow(new Date(visibleFollowUpViewedAt), { addSuffix: true })}
                </Badge>
              )}
              {lastCallAt && (
                <Badge variant="outline" title={`Last called ${formatDistanceToNow(new Date(lastCallAt), { addSuffix: true })}`} className={`gap-1 ${getLastCallBadgeClass(lastCallAt)}`}>
                  <Phone className="h-3.5 w-3.5" />
                  Last called {formatDistanceToNow(new Date(lastCallAt), { addSuffix: true })}
                </Badge>
              )}
              {pendingCalls.length > 0 && (
                <Badge variant="outline" title={`${pendingCalls.length} scheduled call${pendingCalls.length === 1 ? "" : "s"} pending`} className="gap-1 border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
                  <Clock className="h-3.5 w-3.5" />
                  {pendingCalls.length === 1 ? "Scheduled call" : `${pendingCalls.length} scheduled calls`}
                </Badge>
              )}
            </div>
          </div>
        </header>
        )}

        <main className={`flex-1 space-y-4 ${isEmbedded ? "p-3 lg:p-4" : "p-4 lg:p-5"}`}>
          {isEmbedded && (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border-2 border-border/70 bg-card/90 p-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="inline-flex min-w-0 items-center gap-2 truncate text-2xl font-extrabold tracking-tight">
                    <span className="truncate">{getFullName(player)}</span>
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        isAccountClosed
                          ? closureBadgeClass
                          : "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                      }`}
                      title={accountStatusDetail ? `${accountStatusLabel}: ${accountStatusDetail}` : accountStatusLabel}
                      aria-label={accountStatusDetail ? `${accountStatusLabel}: ${accountStatusDetail}` : accountStatusLabel}
                    >
                      {isAccountClosed ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </span>
                    {isAccountClosed && (
                      <span className={`truncate text-xs font-semibold ${isBreakClosure ? "text-blue-700 dark:text-blue-300" : "text-rose-700 dark:text-rose-300"}`}>
                        {accountStatusLabel}
                      </span>
                    )}
                  </h1>
                  <CopyButton text={getFullName(player)} label="Name" />
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-muted-foreground">
                    @{player.username}
                    <CopyButton text={player.username} label="Username" size="icon" className="h-7 w-7" />
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-semibold text-muted-foreground/80">
                    {player.user_id}
                    <CopyButton text={player.user_id} label="User ID" size="icon" className="h-7 w-7" />
                  </span>
                  <Badge className={`${vipInfo.bgColor} ${vipInfo.color} font-semibold`} title={`VIP level ${player.vip_level}: ${vipInfo.name}`}>
                    {player.vip_level} - {vipInfo.name}
                  </Badge>
                  {player.bonus_abuser && (
                    <Badge variant="outline" title="Marked as a bonus abuser" className="gap-1 border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Bonus abuser
                    </Badge>
                  )}
                  {player.contact_email_only && (
                    <Badge variant="outline" title="Prefers exclusive email contact" className="gap-1 border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
                      <Mail className="h-3.5 w-3.5" />
                      Email only
                    </Badge>
                  )}
                  {player.telegram_member && (
                    <Badge variant="outline" title="Telegram group member" className="gap-1 border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                      <Send className="h-3.5 w-3.5" />
                      Telegram
                    </Badge>
                  )}
                  {visibleFollowUpViewedAt && (
                    <Badge variant="outline" title={`Followed up ${formatDistanceToNow(new Date(visibleFollowUpViewedAt), { addSuffix: true })}`} className="gap-1 border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      Followed up {formatDistanceToNow(new Date(visibleFollowUpViewedAt), { addSuffix: true })}
                    </Badge>
                  )}
                  {lastCallAt && (
                    <Badge variant="outline" title={`Last called ${formatDistanceToNow(new Date(lastCallAt), { addSuffix: true })}`} className={`gap-1 ${getLastCallBadgeClass(lastCallAt)}`}>
                      <Phone className="h-3.5 w-3.5" />
                      Last called {formatDistanceToNow(new Date(lastCallAt), { addSuffix: true })}
                    </Badge>
                  )}
                  {pendingCalls.length > 0 && (
                    <Badge variant="outline" title={`${pendingCalls.length} scheduled call${pendingCalls.length === 1 ? "" : "s"} pending`} className="gap-1 border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
                      <Clock className="h-3.5 w-3.5" />
                      {pendingCalls.length === 1 ? "Scheduled call" : `${pendingCalls.length} scheduled calls`}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          {visibleFollowUpViewedAt && (
            <Alert className="border-2 border-green-300 bg-green-50/80 dark:border-green-800 dark:bg-green-950/30">
              <CalendarCheck className="h-5 w-5 text-green-700 dark:text-green-300" />
              <AlertTitle className="font-bold text-green-900 dark:text-green-100">
                Follow-up attention recorded
              </AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                This player is marked as followed up. Last follow-up{" "}
                {formatDistanceToNow(new Date(visibleFollowUpViewedAt), { addSuffix: true })}.
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

          {pendingTasks.length > 0 && (
                <Alert className="border-2 border-amber-300 bg-amber-50/80 py-3 dark:border-amber-800 dark:bg-amber-950/30">
                  <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-base font-bold text-amber-900 dark:text-amber-100">
                    Pending Tasks ({pendingTasks.length})
                  </AlertTitle>
                  <AlertDescription className="mt-2 text-amber-800 dark:text-amber-200">
                    <div className="space-y-1.5">
                      {pendingTasks.slice(0, 3).map(task => (
                        <div key={task.id} className="rounded border border-amber-200 bg-white p-2 dark:border-amber-800 dark:bg-amber-900/20">
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

          <div className={`grid gap-4 ${
            isEmbedded
              ? "lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]"
              : "xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"
          }`}>
            <div className="space-y-4">
              <Card className="border-2 border-indigo-300/80 bg-indigo-50/15 shadow-md shadow-indigo-500/5 transition-all hover:shadow-lg dark:border-indigo-800 dark:bg-indigo-950/10">
                <CardHeader className="border-b-2 border-indigo-200/80 bg-indigo-100/35 py-3 dark:border-indigo-900/70 dark:bg-indigo-950/25">
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
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
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

              <Card className="border-2 border-violet-300/80 bg-violet-50/15 shadow-md shadow-violet-500/5 transition-all hover:shadow-lg dark:border-violet-800 dark:bg-violet-950/10">
                <CardHeader className="border-b-2 border-violet-200/80 bg-violet-100/35 py-3 dark:border-violet-900/70 dark:bg-violet-950/25">
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
                <CardContent className="py-3">
                  {isEditingPreferences ? (
                    <div className="space-y-3">
                      <PreferencesEditor 
                        preferences={draftPreferences}
                        onUpdate={setDraftPreferences}
                        contactEmailOnly={draftContactEmailOnly}
                        telegramMember={draftTelegramMember}
                        onContactFlagsUpdate={({ contactEmailOnly, telegramMember }) => {
                          setDraftContactEmailOnly(contactEmailOnly);
                          setDraftTelegramMember(telegramMember);
                        }}
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
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-lg border-2 border-violet-200/80 bg-violet-50/40 p-3 shadow-sm dark:border-violet-900/70 dark:bg-violet-950/20">
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
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Email only:</span>
                            <div className="flex items-center gap-1">
                              {player.contact_email_only ? (
                                <>
                                  <Check className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                  <span className="font-medium">Yes</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">No</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Telegram:</span>
                            <div className="flex items-center gap-1">
                              {player.telegram_member ? (
                                <>
                                  <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                  <span className="font-medium">Member</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">Not marked</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border-2 border-cyan-200/80 bg-cyan-50/40 p-3 shadow-sm dark:border-cyan-900/70 dark:bg-cyan-950/20">
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
              <Card className="border-2 border-amber-300/80 bg-amber-50/15 shadow-md shadow-amber-500/5 transition-all hover:shadow-lg dark:border-amber-800 dark:bg-amber-950/10">
                <CardHeader className="border-b-2 border-amber-200/80 bg-amber-100/35 py-3 dark:border-amber-900/70 dark:bg-amber-950/25">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Tasks & Reminders</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Manage player-related tasks and follow-ups
                      </p>
                    </div>
                    <Button onClick={handleAddTask} size="sm" className="border-2 border-primary">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <TaskList
                    tasks={tasks.filter((task) => !task.is_call)}
                    onEdit={handleEditTask}
                    onDelete={handleTaskDelete}
                    onComplete={handleTaskComplete}
                    onCompleteCall={handleCallComplete}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card className="order-1 border-2 border-slate-300/90 bg-slate-50/30 shadow-md shadow-slate-500/5 transition-all hover:shadow-lg dark:border-slate-700 dark:bg-slate-950/20">
                <CardHeader className="border-b-2 border-slate-200/90 bg-slate-100/60 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ListPlus className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                        Action Repository
                      </CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">One place for player actions</p>
                    </div>
                    {activeManualFollowUp && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        In queue
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      onClick={handleScheduleCall}
                      disabled={isAccountClosed}
                      className="h-9 justify-start gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Phone className="h-4 w-4" />
                      Schedule Call
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsManualCallLogOpen(true)}
                      className="h-9 justify-start gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <Phone className="h-4 w-4" />
                      Log Call
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNotesValue("");
                        setIsNoteDialogOpen(true);
                      }}
                      className="h-9 justify-start gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      <FileText className="h-4 w-4" />
                      Add Note
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsManualFollowUpOpen(true)}
                      disabled={isAccountClosed}
                      className="h-9 justify-start gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
                    >
                      <ListPlus className="h-4 w-4" />
                      Add to Queue
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsUpgradeDialogOpen(true)}
                      disabled={upgradeLevels.length === 0}
                      className="h-9 justify-start gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      <ArrowUp className="h-4 w-4" />
                      Upgrade VIP
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDowngradeDialogOpen(true)}
                      disabled={downgradeLevels.length === 0}
                      className="h-9 justify-start gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/30"
                    >
                      <ArrowDown className="h-4 w-4" />
                      Downgrade VIP
                    </Button>
                    <Button
                      variant={player.bonus_abuser ? "outline" : "default"}
                      size="sm"
                      onClick={handleBonusAbuserToggle}
                      disabled={isSavingBonusFlag}
                      className={
                        player.bonus_abuser
                          ? "h-9 justify-start gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950/30"
                          : "h-9 justify-start gap-2 border-2 border-orange-500 bg-orange-500 font-bold text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 dark:border-orange-500 dark:bg-orange-600 dark:hover:bg-orange-700"
                      }
                    >
                      <ShieldAlert className="h-4 w-4" />
                      {player.bonus_abuser ? "Remove Bonus Flag" : "Bonus Abuser"}
                    </Button>
                    {isAccountClosed && canReopenAccount ? (
                      <Button
                        variant={isBreakDue ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleReopenAccount()}
                        disabled={isSavingClosure}
                        className="h-9 justify-start gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Reopen
                      </Button>
                    ) : isAccountClosed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsExceptionalReopenOpen(true)}
                        disabled={isSavingClosure}
                        className="h-9 justify-start gap-2 border-amber-400 bg-amber-100 text-amber-900 shadow-sm hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
                      >
                        <AlertCircle className="h-4 w-4" />
                        Exceptionally Reopen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setIsAccountClosureOpen(true)}
                        disabled={isAccountClosed}
                        className="h-9 justify-start gap-2 border-2 border-red-700 bg-red-600 font-bold text-white shadow-md shadow-red-500/20 ring-2 ring-red-200 hover:bg-red-700 dark:border-red-500 dark:bg-red-700 dark:ring-red-950 dark:hover:bg-red-800"
                      >
                        <X className="h-4 w-4" />
                        Close Account
                      </Button>
                    )}
                  </div>
                  {activeManualFollowUp ? (
                    <div className="rounded-md border-2 border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-300">
                      Added to queue {formatDistanceToNow(new Date(activeManualFollowUp.created_at), { addSuffix: true })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-300 p-2 text-xs text-muted-foreground dark:border-slate-700">
                      {isAccountClosed
                        ? "Closed accounts are excluded from the follow-up queue."
                        : "Queue action will be marked here after this player is added."}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="order-3 border-2 border-blue-300/80 bg-blue-50/15 shadow-md shadow-blue-500/5 transition-all hover:shadow-lg dark:border-blue-800 dark:bg-blue-950/10">
                <CardHeader className="border-b-2 border-blue-200/80 bg-blue-100/35 py-3 dark:border-blue-900/70 dark:bg-blue-950/25">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Phone className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                      Scheduled Calls
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                        {pendingCalls.length}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={handleScheduleCall}
                        disabled={isAccountClosed}
                        className="h-7 gap-1.5 bg-blue-600 px-2 text-xs hover:bg-blue-700"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Schedule
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-3">
                  {pendingCalls.length > 0 ? (
                    <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                      {pendingCalls.map((call) => (
                        <div key={call.id} className="rounded-md border-2 border-blue-200/80 bg-background/80 p-2 text-sm shadow-sm dark:border-blue-900/70">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{call.title}</p>
                              {call.phone_number && (
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {call.phone_number}
                                </p>
                              )}
                              {call.due_date && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(call.due_date), "PPp")}
                                </p>
                              )}
                            </div>
                            <Badge className="shrink-0 border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                              {call.priority}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-blue-200/60 pt-2 dark:border-blue-900/60">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`call-rail-done-${call.id}`}
                                checked={checkedAlertTasks.has(call.id)}
                                onCheckedChange={(checked) => handleAlertCheckboxChange(call, checked as boolean)}
                              />
                              <label htmlFor={`call-rail-done-${call.id}`} className="cursor-pointer text-xs font-semibold">
                                Mark as Done
                              </label>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCallCancel(call.id)}
                              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 py-8 text-center">
                      <Phone className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">No scheduled calls</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="order-2 border-2 border-emerald-300/80 bg-emerald-50/15 shadow-md shadow-emerald-500/5 transition-all hover:shadow-lg dark:border-emerald-800 dark:bg-emerald-950/10">
                <CardHeader className="border-b-2 border-emerald-200/80 bg-emerald-100/35 py-3 dark:border-emerald-900/70 dark:bg-emerald-950/25">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                      Note Log
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                        {noteLogs.length}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNotesValue("");
                          setIsNoteDialogOpen(true);
                        }}
                        className="h-7 px-2 text-xs border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-3">
                  {noteLogs.length > 0 ? (
                    <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                      {noteLogs.map((note) => (
                        <div key={note.id} className="rounded-lg border-2 border-emerald-200/80 bg-emerald-50/30 p-3 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/20">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              {formatDistanceToNow(new Date(note.occurred_at), { addSuffix: true })}
                            </p>
                            {note.body && <CopyButton text={note.body} label="Note" size="sm" />}
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 py-8 text-center">
                      <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">No note logs yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="order-4 border-2 border-blue-300/80 bg-blue-50/15 shadow-md shadow-blue-500/5 transition-all hover:shadow-lg dark:border-blue-800 dark:bg-blue-950/10">
                <CardHeader className="border-b-2 border-blue-200/80 bg-blue-100/35 py-3 dark:border-blue-900/70 dark:bg-blue-950/25">
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
                      {(showAllCallLogs ? callLogs : callLogs.slice(0, 5)).map((log, index) => {
                        const isNoAnswer = isNoAnswerCallLog(log);

                        return (
                          <button
                            key={log.id}
                            onClick={() => setSelectedCallLog(log)}
                            className={`w-full rounded-lg border-2 p-1.5 text-left shadow-sm transition-all hover:scale-[1.01] hover:shadow-md active:scale-[0.99] ${
                              isNoAnswer
                                ? "border-orange-300 bg-orange-50/80 hover:bg-orange-100/80 dark:border-orange-800 dark:bg-orange-950/25 dark:hover:bg-orange-900/30"
                                : "border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 dark:border-blue-800 dark:bg-blue-950/20 dark:hover:bg-blue-900/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <Badge className={`${isNoAnswer ? "bg-orange-600 dark:bg-orange-700" : "bg-blue-600 dark:bg-blue-700"} text-white border-0 text-[10px] px-1 py-0`}>
                                    {isNoAnswer ? (
                                      <>
                                        <PhoneOff className="mr-1 h-3 w-3" />
                                        No answer
                                      </>
                                    ) : (
                                      <>Call #{callLogs.length - index}</>
                                    )}
                                  </Badge>
                                  {log.duration_minutes && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {log.duration_minutes}m
                                    </span>
                                  )}
                                </div>
                                <p className={`text-sm font-medium truncate ${isNoAnswer ? "text-orange-900 dark:text-orange-200" : ""}`}>
                                  {normalizeCallTopic(log.call_topic) || "No reason specified"}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {format(new Date(log.call_time), "MMM d, yyyy 'at' h:mm:ss a")}
                                </p>
                              </div>
                              <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(log.completed_at || log.call_time), { addSuffix: true })}
                              </div>
                            </div>
                          </button>
                        );
                      })}
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
          defaultIsCall={taskFormDefaultIsCall}
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
          onClose={() => {
            setIsManualCallLogOpen(false);
            setPrefilledManualCallTopic(null);
            setPrefilledManualCallTaskId(null);
          }}
          onComplete={handleManualCallLog}
          callTopic={prefilledManualCallTopic}
          phoneNumber={player.phone}
          title="Log Call"
          confirmLabel="Save Call Log"
        />

        <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <FileText className="h-5 w-5" />
                Add Note
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea
                value={notesValue}
                onChange={(event) => setNotesValue(event.target.value)}
                rows={6}
                className="resize-none text-sm"
                placeholder="Add a manager note about this player..."
              />
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="ghost" onClick={handleCancelNotesEdit} disabled={isSavingNotes}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveNotes} disabled={isSavingNotes || !notesValue.trim()}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingNotes ? "Saving..." : "Save Note"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDowngradeDialogOpen} onOpenChange={setIsDowngradeDialogOpen}>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                <ArrowDown className="h-5 w-5" />
                Downgrade VIP Level
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border-2 border-violet-200 bg-violet-50/50 p-3 text-sm dark:border-violet-900 dark:bg-violet-950/20">
                Current level: <span className="font-semibold">VIP {currentVipLevel} - {vipConfig[currentVipLevel].name}</span>
              </div>
              {downgradeLevels.length > 0 ? (
                <div className="grid gap-2">
                  {downgradeLevels.map((level) => (
                    <Button
                      key={level}
                      type="button"
                      variant="outline"
                      onClick={() => handleVipDowngrade(level)}
                      disabled={isSavingDowngrade}
                      className="justify-start border-2"
                    >
                      VIP {level} - {vipConfig[level].name}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This player is already at the lowest VIP level.</p>
              )}
              <div className="flex justify-end border-t pt-3">
                <Button type="button" variant="ghost" onClick={() => setIsDowngradeDialogOpen(false)} disabled={isSavingDowngrade}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <ArrowUp className="h-5 w-5" />
                Upgrade VIP Level
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border-2 border-emerald-200 bg-emerald-50/50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
                Current level: <span className="font-semibold">VIP {currentVipLevel} - {vipConfig[currentVipLevel].name}</span>
              </div>
              {upgradeLevels.length > 0 ? (
                <div className="grid gap-2">
                  {upgradeLevels.map((level) => (
                    <Button
                      key={level}
                      type="button"
                      variant="outline"
                      onClick={() => handleVipUpgrade(level)}
                      disabled={isSavingUpgrade}
                      className="justify-start border-2"
                    >
                      VIP {level} - {vipConfig[level].name}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This player is already at the highest VIP level.</p>
              )}
              <div className="flex justify-end border-t pt-3">
                <Button type="button" variant="ghost" onClick={() => setIsUpgradeDialogOpen(false)} disabled={isSavingUpgrade}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isAccountClosureOpen} onOpenChange={setIsAccountClosureOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <X className="h-5 w-5" />
                Close Account
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Closure reasons</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ACCOUNT_CLOSURE_REASONS.map((reason) => {
                    const isSelected = closureReasons.includes(reason);

                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          setClosureReasons((current) => {
                            const next = current.includes(reason)
                              ? current.filter((selectedReason) => selectedReason !== reason)
                              : [...current, reason];

                            if (
                              next.length > 0 &&
                              !next.every((selectedReason) =>
                                REOPENABLE_REASONS.includes(selectedReason as typeof REOPENABLE_REASONS[number])
                              )
                            ) {
                              setClosureType("permanent");
                            }

                            return next;
                          });
                        }}
                        className={`flex h-9 items-center gap-2 rounded-md border-2 px-3 text-left text-sm font-semibold transition-colors ${
                          isSelected
                            ? "border-red-500 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
                            : "border-border bg-background hover:bg-muted/60"
                        }`}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none h-3.5 w-3.5" />
                        {reason}
                      </button>
                    );
                  })}
                </div>
              </div>

              {closureReasons.length > 0 && closureReasons.every((reason) => REOPENABLE_REASONS.includes(reason as typeof REOPENABLE_REASONS[number])) ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Closure type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={closureType === "break" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setClosureType("break")}
                      >
                        Temporary break
                      </Button>
                      <Button
                        type="button"
                        variant={closureType === "permanent" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setClosureType("permanent")}
                      >
                        Permanent closure
                      </Button>
                    </div>
                  </div>

                  {closureType === "break" && (
                    <div className="space-y-2 rounded-md border-2 border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                      <label className="text-sm font-semibold">Break duration</label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {BREAK_DURATIONS.map((duration) => (
                          <Button
                            key={duration.weeks}
                            type="button"
                            variant={breakWeeks === String(duration.weeks) ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBreakWeeks(String(duration.weeks))}
                          >
                            {duration.label}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          variant={breakWeeks === "custom" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setBreakWeeks("custom")}
                        >
                          Custom
                        </Button>
                      </div>
                      {breakWeeks === "custom" && (
                        <Input
                          type="number"
                          min="1"
                          value={customBreakWeeks}
                          onChange={(event) => setCustomBreakWeeks(event.target.value)}
                          placeholder="Weeks"
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        A dashboard reminder appears when the break period is over. The account remains closed until you reopen it.
                      </p>
                    </div>
                  )}
                </>
              ) : closureReasons.length > 0 ? (
                <div className="rounded-md border-2 border-red-200 bg-red-50/60 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  One or more selected reasons require permanent closure. Reopening later requires the exceptional reopen confirmation.
                </div>
              ) : null}

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="ghost" onClick={() => setIsAccountClosureOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCloseAccount}
                  disabled={closureReasons.length === 0 || isSavingClosure}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isSavingClosure ? "Closing..." : "Close Account"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isExceptionalReopenOpen} onOpenChange={setIsExceptionalReopenOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-5 w-5" />
                Exceptionally Reopen Account
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border-2 border-amber-300 bg-amber-50/80 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-semibold">Please confirm this exception.</p>
                <p className="mt-1">
                  This account was permanently closed
                  {player.account_closure_reason ? ` for ${player.account_closure_reason}` : ""}. Reopening it will mark the account as open again and log an exceptional reopen note.
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsExceptionalReopenOpen(false)}
                  disabled={isSavingClosure}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => handleReopenAccount({ exceptional: true })}
                  disabled={isSavingClosure}
                  className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
                >
                  {isSavingClosure ? "Reopening..." : "Confirm Reopen"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                  <Badge className={`${isNoAnswerCallLog(selectedCallLog) ? "bg-orange-600 dark:bg-orange-700" : "bg-blue-600 dark:bg-blue-700"} text-white border-0`}>
                    {isNoAnswerCallLog(selectedCallLog) ? (
                      <PhoneOff className="w-3 h-3 mr-1" />
                    ) : (
                      <Phone className="w-3 h-3 mr-1" />
                    )}
                    {isNoAnswerCallLog(selectedCallLog) ? "No Answer" : "Call Completed"}
                  </Badge>
                  {selectedCallLog.duration_minutes && (
                    <Badge variant="outline" className="border-2 border-blue-300 dark:border-blue-700">
                      <Clock className="w-3 h-3 mr-1" />
                      {selectedCallLog.duration_minutes} minutes
                    </Badge>
                  )}
                </div>

                {isNoAnswerCallLog(selectedCallLog) && (
                  <div className="rounded-lg border-2 border-orange-300 bg-orange-50/80 p-3 text-orange-900 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <PhoneOff className="h-4 w-4" />
                      No answer contact attempt
                    </div>
                    <p className="mt-1 text-xs opacity-80">
                      This call was attempted but the player did not answer. The call reason remains recorded below.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold">Call Time</span>
                    </div>
                    <p className="text-sm pl-6">{format(new Date(selectedCallLog.call_time), "PPPP 'at' h:mm:ss a")}</p>
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
                      <span className="font-semibold">Call Reason</span>
                    </div>
                    {isEditingCallLog ? (
                      <div className="grid gap-2 rounded-md border-2 border-blue-200 bg-background/70 p-2 dark:border-blue-900">
                        {CALL_REASONS.map((callReason) => (
                          <label key={callReason} className="flex cursor-pointer items-center gap-2 rounded border border-blue-100 bg-blue-50/40 px-2 py-1.5 text-sm dark:border-blue-900 dark:bg-blue-950/20">
                            <Checkbox
                              checked={parseCallReasons(editedCallTopic).includes(callReason)}
                              onCheckedChange={(checked) => setEditedCallTopic((current) => toggleCallReason(current, callReason, checked === true))}
                            />
                            <span className="font-medium">{callReason}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-medium truncate">
                        {normalizeCallTopic(selectedCallLog.call_topic) || "No reason specified"}
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
                    <p className="text-sm pl-6">{format(new Date(selectedCallLog.completed_at || selectedCallLog.call_time), "PPPP 'at' h:mm:ss a")}</p>
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
