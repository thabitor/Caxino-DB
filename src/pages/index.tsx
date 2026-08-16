import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { playerService, PlayerWithTasks, PlayerInsert, PlayerUpdate, getFullName, vipConfig, VipLevel } from "@/services/playerService";
import { taskService } from "@/services/taskService";
import { callLogService, type CallLog } from "@/services/callLogService";
import { playerTouchpointService, type PlayerTouchpoint } from "@/services/playerTouchpointService";
import { manualFollowUpService } from "@/services/manualFollowUpService";
import { followUpViewedService } from "@/services/followUpViewedService";
import { PlayersTable } from "@/components/PlayersTable";
import { Button } from "@/components/ui/button";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Crown, ListTodo, LogOut, AlertCircle, Phone, CircleCheck, LockKeyhole } from "lucide-react";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { TaskAlertsPanel } from "@/components/TaskAlertsPanel";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { CallReminderNotification } from "@/components/CallReminderNotification";
import { BirthdayReminders } from "@/components/BirthdayReminders";
import { ExcelUploadDialog } from "@/components/ExcelUploadDialog";
import { buildFollowUpQueue, FollowUpItem } from "@/lib/followup";
import { ACTION_LOG_TTL_MS, clearRecentFollowUpActivity, DASHBOARD_REFRESH_EVENT, FOLLOW_UP_VIEWED_EVENT, type ActionHistoryActivity, getDashboardRefreshToken, getHighlightedFollowUps, getRecentFollowUpActivityClearedAt } from "@/lib/dashboardSync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualFollowUpDialog } from "@/components/ManualFollowUpDialog";
import { RecentFollowUpsPanel } from "@/components/RecentFollowUpsPanel";
import { PlayerFlyout } from "@/components/PlayerFlyout";
import { getUpcomingBirthdays } from "@/lib/birthdays";

function TabNotification({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white shadow-sm">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerWithTasks[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [vipDistribution, setVipDistribution] = useState<Record<VipLevel, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [activeTasks, setActiveTasks] = useState(0);
  const [activeScheduledCalls, setActiveScheduledCalls] = useState(0);
  const [openAccounts, setOpenAccounts] = useState(0);
  const [closedAccounts, setClosedAccounts] = useState(0);
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);
  const [followUpViewedAtByPlayer, setFollowUpViewedAtByPlayer] = useState<Record<string, string>>({});
  const [lastCallAtByPlayer, setLastCallAtByPlayer] = useState<Record<string, string>>({});
  const [monthlyCallCountByPlayer, setMonthlyCallCountByPlayer] = useState<Record<string, number>>({});
  const [actionHistory, setActionHistory] = useState<ActionHistoryActivity[]>([]);
  const [alertNotificationCount, setAlertNotificationCount] = useState(0);
  const [scheduledCallAlertCount, setScheduledCallAlertCount] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedDashboard = useRef(false);
  const lastRefreshToken = useRef<string | null>(null);
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [flyoutPlayerId, setFlyoutPlayerId] = useState<string | null>(null);
  const [followUpPlayer, setFollowUpPlayer] = useState<PlayerWithTasks | null>(null);
  const [isQueueFollowUpOpen, setIsQueueFollowUpOpen] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("directory");

  useEffect(() => {
    if (!router.isReady) return;
    const tab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
    const validTabs = new Set(["directory", "tasks", "calls", "birthdays", "action-log"]);
    setActiveMainTab(tab && validTabs.has(tab) ? tab : "directory");
  }, [router.isReady, router.query.tab]);

  const handleMainTabChange = (value: string) => {
    setActiveMainTab(value);
    const nextQuery = { tab: value };
    router.replace({ pathname: "/", query: nextQuery }, undefined, { shallow: true });
  };

  const buildActionHistory = useCallback((
    playersData: PlayerWithTasks[],
    callLogs: CallLog[],
    touchpoints: PlayerTouchpoint[]
  ): ActionHistoryActivity[] => {
    const cutoff = Date.now() - ACTION_LOG_TTL_MS;
    const clearedAt = getRecentFollowUpActivityClearedAt();
    const clearedAtTime = clearedAt ? new Date(clearedAt).getTime() : null;
    const isValidTimestamp = (timestamp?: string | null) => {
      if (!timestamp) return false;
      const time = new Date(timestamp).getTime();
      return Number.isFinite(time) && time >= cutoff && (!clearedAtTime || !Number.isFinite(clearedAtTime) || time > clearedAtTime);
    };
    const callEvents = callLogs
      .map((callLog): ActionHistoryActivity | null => {
        const timestamp = callLog.completed_at || callLog.call_time;
        if (!isValidTimestamp(timestamp)) return null;

        return {
          playerId: callLog.player_id,
          type: callLog.notes?.toLowerCase().includes("no answer. contact attempt recorded at")
            ? "call_no_answer"
            : "call_logged",
          timestamp: timestamp as string,
          detail: callLog.call_topic,
        };
      })
      .filter((activity): activity is ActionHistoryActivity => Boolean(activity));
    const touchpointEvents = touchpoints
      .map((touchpoint): ActionHistoryActivity | null => {
        const title = touchpoint.title?.toLowerCase() || "";
        const timestamp = touchpoint.occurred_at || touchpoint.created_at;
        if (!isValidTimestamp(timestamp)) return null;

        if (title.includes("vip level upgraded")) {
          return {
            playerId: touchpoint.player_id,
            type: "vip_upgraded",
            timestamp,
            detail: touchpoint.body,
          };
        }

        if (title.includes("vip level downgraded")) {
          return {
            playerId: touchpoint.player_id,
            type: "vip_downgraded",
            timestamp,
            detail: touchpoint.body,
          };
        }

        if (title.includes("bonus abuser flag added")) {
          return {
            playerId: touchpoint.player_id,
            type: "bonus_abuser_flagged",
            timestamp,
            detail: touchpoint.body,
          };
        }

        return null;
      })
      .filter((activity): activity is ActionHistoryActivity => Boolean(activity));
    const playerEvents = playersData.flatMap((player): ActionHistoryActivity[] => {
      const events: ActionHistoryActivity[] = [];

      if (isValidTimestamp(player.created_at)) {
        events.push({
          playerId: player.id,
          type: "player_added",
          timestamp: player.created_at,
        });
      }

      if (isValidTimestamp(player.account_closed_at)) {
        events.push({
          playerId: player.id,
          type: "account_closed",
          timestamp: player.account_closed_at,
          detail: player.account_closure_reason,
        });
      }

      if (isValidTimestamp(player.account_reopened_at)) {
        events.push({
          playerId: player.id,
          type: "account_reopened",
          timestamp: player.account_reopened_at,
        });
      }

      return events;
    });

    return [...callEvents, ...touchpointEvents, ...playerEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 120);
  }, []);

  const fetchDashboardData = useCallback(async (options?: { background?: boolean }) => {
    try {
      if (!options?.background || !hasLoadedDashboard.current) {
        setLoading(true);
      }
      const actionLogCutoff = new Date(Date.now() - ACTION_LOG_TTL_MS).toISOString();
      const [playersData, total, distribution, tasks, callLogs, manualFollowUps, viewedPlayers, touchpoints] = await Promise.all([
        playerService.getPlayers(),
        playerService.getTotalPlayerCount(),
        playerService.getVipLevelDistribution(),
        taskService.getActiveTasks(),
        callLogService.getAllCallLogs(),
        manualFollowUpService.getActiveManualFollowUps(),
        followUpViewedService.getRecentViewedPlayers(user?.id || null),
        playerTouchpointService.getRecentTouchpoints(actionLogCutoff),
      ]);
      const localViewed = getHighlightedFollowUps();
      const persistedViewed = Object.fromEntries(
        viewedPlayers.map((viewed) => [viewed.player_id, viewed.last_viewed_at])
      );
      const latestCallsByPlayer = callLogs.reduce<Record<string, string>>((latest, callLog) => {
        const timestamp = callLog.completed_at || callLog.call_time;
        if (!timestamp) return latest;

        const existing = latest[callLog.player_id];
        if (!existing || new Date(timestamp).getTime() > new Date(existing).getTime()) {
          latest[callLog.player_id] = timestamp;
        }

        return latest;
      }, {});
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const alertCalls = tasks.filter((task) => {
        if (!task.is_call || !task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate >= todayStart && dueDate < todayEnd;
      }).length;
      const alertRegularTasks = tasks.filter((task) => {
        if (task.is_call || !task.due_date) return false;
        return new Date(task.due_date) <= next24Hours;
      }).length;
      const alertClosureReminders = playersData.filter((player) => (
        player.account_status === "closed" &&
        player.account_closure_type === "break" &&
        Boolean(player.account_closure_until) &&
        new Date(player.account_closure_until as string).getTime() <= Date.now()
      )).length;
      const monthlyCallsByPlayer = callLogs.reduce<Record<string, number>>((counts, callLog) => {
        const timestamp = callLog.completed_at || callLog.call_time;
        if (!timestamp) return counts;

        const callTime = new Date(timestamp).getTime();
        if (Number.isFinite(callTime) && callTime >= monthStart && callTime < nextMonthStart) {
          counts[callLog.player_id] = (counts[callLog.player_id] || 0) + 1;
        }

        return counts;
      }, {});
      setPlayers(playersData);
      setTotalPlayers(total);
      setVipDistribution(distribution);
      const activeScheduledCallsTotal = tasks.filter((task) => task.is_call).length;
      const activeRegularTasksTotal = tasks.filter((task) => !task.is_call).length;
      const closedAccountsTotal = playersData.filter((player) => (player.account_status || "open").trim().toLowerCase() === "closed").length;
      setActiveTasks(activeRegularTasksTotal);
      setActiveScheduledCalls(activeScheduledCallsTotal);
      setOpenAccounts(Math.max(0, total - closedAccountsTotal));
      setClosedAccounts(closedAccountsTotal);
      setAlertNotificationCount(alertRegularTasks + alertClosureReminders);
      setScheduledCallAlertCount(alertCalls);
      setFollowUpItems(buildFollowUpQueue(playersData, tasks, callLogs, manualFollowUps));
      setFollowUpViewedAtByPlayer({ ...localViewed, ...persistedViewed });
      setLastCallAtByPlayer(latestCallsByPlayer);
      setMonthlyCallCountByPlayer(monthlyCallsByPlayer);
      setActionHistory(buildActionHistory(playersData, callLogs, touchpoints));
      hasLoadedDashboard.current = true;
      lastRefreshToken.current = getDashboardRefreshToken();
    } catch (error) {
      console.error("Dashboard data fetch error:", error);
      toast({ 
        title: "Error fetching data", 
        description: "Could not load dashboard data. Please refresh the page.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, [buildActionHistory, toast, user?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const refreshIfChanged = () => {
      const token = getDashboardRefreshToken();
      if (token && token !== lastRefreshToken.current) {
        fetchDashboardData({ background: true });
      }
    };
    const refreshRecentActivity = () => {
      fetchDashboardData({ background: true });
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        refreshIfChanged();
      }
    };

    window.addEventListener(DASHBOARD_REFRESH_EVENT, refreshIfChanged);
    window.addEventListener(FOLLOW_UP_VIEWED_EVENT, refreshRecentActivity);
    window.addEventListener("focus", refreshIfChanged);
    window.addEventListener("focus", refreshRecentActivity);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, refreshIfChanged);
      window.removeEventListener(FOLLOW_UP_VIEWED_EVENT, refreshRecentActivity);
      window.removeEventListener("focus", refreshIfChanged);
      window.removeEventListener("focus", refreshRecentActivity);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [fetchDashboardData]);

  const handleClearRecentFollowUps = () => {
    clearRecentFollowUpActivity();
    setActionHistory([]);
  };

  const handleEdit = (player: PlayerWithTasks) => {
    setEditingPlayer(player);
    setIsFormOpen(true);
  };

  const handleDelete = async (playerId: string) => {
    if (!confirm("Are you sure you want to delete this player? This action cannot be undone.")) {
      return;
    }

    try {
      await playerService.deletePlayer(playerId);
      toast({ 
        title: "Player deleted", 
        description: "The player has been successfully removed from the system." 
      });
      fetchDashboardData();
    } catch (error) {
      console.error("Delete player error:", error);
      toast({ 
        title: "Error", 
        description: "Could not delete the player. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const handleFormSubmit = async (formData: PlayerInsert | PlayerUpdate) => {
    try {
      if (editingPlayer) {
        await playerService.updatePlayer(editingPlayer.id, formData as PlayerUpdate);
        toast({ 
          title: "Player updated", 
          description: "Player details have been successfully updated." 
        });
      } else {
        await playerService.createPlayer(formData as PlayerInsert);
        toast({ 
          title: "Player created", 
          description: "New player has been successfully added to the system." 
        });
      }
      setIsFormOpen(false);
      setEditingPlayer(null);
      fetchDashboardData();
    } catch (error) {
      console.error("Form submit error:", error);
      toast({ 
        title: "Error", 
        description: "Could not save player details. Please check your input and try again.", 
        variant: "destructive" 
      });
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingPlayer(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ 
        title: "Signed out", 
        description: "You have been successfully signed out." 
      });
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ 
        title: "Error", 
        description: "Could not sign out. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const handleAddTask = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setIsTaskFormOpen(true);
  };

  const handleTaskCreate = async (taskData: any) => {
    if (!selectedPlayerId) return;

    try {
      await taskService.createTask({ ...taskData, player_id: selectedPlayerId });
      toast({ 
        title: "Task created", 
        description: "New task has been added successfully." 
      });
      setIsTaskFormOpen(false);
      setSelectedPlayerId(null);
      fetchDashboardData();
    } catch (error) {
      console.error("Error creating task:", error);
      toast({ 
        title: "Error", 
        description: "Could not create task.", 
        variant: "destructive" 
      });
    }
  };

  const handleTaskFormClose = () => {
    setIsTaskFormOpen(false);
    setSelectedPlayerId(null);
  };

  const handleManualFollowUpCreate = async (note: string) => {
    if (!followUpPlayer) return;
    if ((followUpPlayer.account_status || "open").trim().toLowerCase() === "closed") {
      toast({
        title: "Closed account",
        description: "Closed accounts cannot be added to the follow-up queue.",
        variant: "destructive",
      });
      setFollowUpPlayer(null);
      return;
    }

    try {
      await manualFollowUpService.createManualFollowUp({
        player_id: followUpPlayer.id,
        manager_id: user?.id || null,
        note,
        status: "active",
      });
      toast({
        title: "Added to follow-up queue",
        description: "The note will appear on this player's follow-up card.",
      });
      setFollowUpPlayer(null);
      fetchDashboardData({ background: true });
    } catch (error) {
      console.error("Error creating manual follow-up:", error);
      toast({
        title: "Error",
        description: "Could not add this player to the follow-up queue.",
        variant: "destructive",
      });
    }
  };

  const handleQueueManualFollowUpCreate = async (player: PlayerWithTasks, note: string) => {
    if ((player.account_status || "open").trim().toLowerCase() === "closed") {
      toast({
        title: "Closed account",
        description: "Closed accounts cannot be added to the follow-up queue.",
        variant: "destructive",
      });
      return;
    }

    try {
      await manualFollowUpService.createManualFollowUp({
        player_id: player.id,
        manager_id: user?.id || null,
        note,
        status: "active",
      });
      toast({
        title: "Added to follow-up queue",
        description: "The note will appear on this player's follow-up card.",
      });
      setIsQueueFollowUpOpen(false);
      fetchDashboardData({ background: true });
    } catch (error) {
      console.error("Error creating manual follow-up:", error);
      toast({
        title: "Error",
        description: "Could not add this player to the follow-up queue.",
        variant: "destructive",
      });
    }
  };

  const overdueFollowUps = followUpItems.filter((item) => item.status === "overdue").length;
  const todayFollowUps = followUpItems.filter((item) => item.status === "today").length;
  const scheduledCalls = activeScheduledCalls;
  const alertsCount = alertNotificationCount;
  const scheduledCallAlerts = scheduledCallAlertCount;
  const birthdayNotificationCount = getUpcomingBirthdays(players, { withinDays: 7 }).length;
  const followUpNotificationCount = followUpItems.length;
  const toFollowUpPlayerIds = followUpItems.map((item) => item.player.id);

  return (
    <ProtectedRoute>
      <CallReminderNotification />
      <div className="flex h-screen overflow-hidden flex-col bg-background">
        <header className="sticky top-0 z-10 border-b bg-background/90 shadow-sm backdrop-blur-lg">
          <div className="flex items-center justify-between h-14 px-4 lg:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/25 bg-primary shadow-sm">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-foreground">
                  Caxino CRM
                </h1>
                <p className="text-xs font-medium text-muted-foreground">Relationship operations</p>
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

        <main className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:p-5 2xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="min-h-0 overflow-hidden border-2 border-border/80 bg-card shadow-md shadow-black/5 dark:border-border/70 dark:shadow-black/20">
            <CardContent className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
              <div className="flex items-center gap-3 rounded-md border border-border/70 bg-muted/25 px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold text-foreground">Manager Snapshot</h2>
                  <p className="truncate text-xs text-muted-foreground">All-database workload totals</p>
                </div>
              </div>

              <div className="rounded-md border border-border/70 bg-background/70 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Players
                  </span>
                  <span className="text-lg font-extrabold tabular-nums text-foreground">{loading ? "-" : totalPlayers}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {(Object.keys(vipDistribution).map(Number) as VipLevel[]).sort((a, b) => a - b).map((level) => {
                    const count = vipDistribution[level];
                    const config = vipConfig[level];
                    if (!config) return null;
                    return (
                      <div key={level} className="flex items-center justify-between gap-3 rounded border border-border/60 bg-muted/20 px-2 py-1 text-xs">
                        <span className={`font-semibold ${config.color}`}>VIP Level {level}</span>
                        <span className="font-extrabold tabular-nums text-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid min-w-0 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/70 px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <CircleCheck className="h-3.5 w-3.5" />
                    Open accounts
                  </span>
                  <span className="text-base font-extrabold tabular-nums text-foreground">{loading ? "-" : openAccounts}</span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/70 px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Closed accounts
                  </span>
                  <span className="text-base font-extrabold tabular-nums text-foreground">{loading ? "-" : closedAccounts}</span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/70 px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    Scheduled calls
                  </span>
                  <span className="text-base font-extrabold tabular-nums text-foreground">{loading ? "-" : scheduledCalls}</span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/70 px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <ListTodo className="h-3.5 w-3.5" />
                    Active tasks
                  </span>
                  <span className="text-base font-extrabold tabular-nums text-foreground">{loading ? "-" : activeTasks}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Tabs value={activeMainTab} onValueChange={handleMainTabChange} className="flex h-full min-h-0 flex-1 flex-col">
            <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border/80 bg-card shadow-md shadow-black/5 dark:border-border/70 dark:shadow-black/20">
              <div className="flex items-end justify-between gap-3 border-b-2 border-border/60 bg-muted/20 px-3 pt-2">
                <TabsList className="h-9 justify-start rounded-none bg-transparent p-0">
                  <TabsTrigger
                    value="directory"
                    className="h-9 rounded-b-none rounded-t-md border-2 border-b-0 bg-muted/35 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                  >
                    Directory
                  </TabsTrigger>
                  <TabsTrigger
                    value="tasks"
                    className="h-9 rounded-b-none rounded-t-md border-2 border-b-0 bg-muted/35 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                  >
                    Tasks
                    <TabNotification count={alertsCount} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="calls"
                    className="h-9 rounded-b-none rounded-t-md border-2 border-b-0 bg-muted/35 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                  >
                    Calls
                    <TabNotification count={scheduledCallAlerts} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="birthdays"
                    className="h-9 rounded-b-none rounded-t-md border-2 border-b-0 bg-muted/35 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                  >
                    Birthdays
                    <TabNotification count={birthdayNotificationCount} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="action-log"
                    className="h-9 rounded-b-none rounded-t-md border-2 border-b-0 bg-muted/35 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                  >
                    Action Log
                  </TabsTrigger>
                </TabsList>
                <div className="hidden pb-2 text-xs font-medium text-muted-foreground sm:block">
                  Workspace tabs
                </div>
              </div>

              <div className="min-h-0 min-w-0 flex-1 p-3">
            <TabsContent value="tasks" className="m-0 h-full overflow-hidden">
              <TaskAlertsPanel mode="tasks" />
            </TabsContent>

            <TabsContent value="calls" className="m-0 h-full overflow-hidden">
              <TaskAlertsPanel mode="calls" />
            </TabsContent>

            <TabsContent value="birthdays" className="m-0 h-full overflow-hidden">
              <BirthdayReminders />
            </TabsContent>

            <TabsContent value="action-log" className="m-0 h-full overflow-hidden">
              <RecentFollowUpsPanel
                activities={actionHistory}
                players={players}
                onClear={handleClearRecentFollowUps}
              />
            </TabsContent>
            <TabsContent value="directory" className="m-0 h-full overflow-hidden">
          <Card className="flex h-full min-h-0 flex-col border-2 border-primary/25 bg-card shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="shrink-0 border-b-2 border-border/70 bg-secondary/55 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Players Directory</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Manage and view all casino players
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ExcelUploadDialog onUploadComplete={fetchDashboardData} />
                  <Button 
                    onClick={() => setIsFormOpen(true)}
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Add New Player
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="min-h-0 flex-1 px-4 pb-4 pt-3">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <PlayersTable 
                  players={players} 
                  onEdit={handleEdit} 
                  onDelete={handleDelete}
                  onAddTask={handleAddTask}
                  onAddFollowUp={setFollowUpPlayer}
                  onOpenPlayer={setFlyoutPlayerId}
                  followUpViewedAtByPlayer={followUpViewedAtByPlayer}
                  lastCallAtByPlayer={lastCallAtByPlayer}
                  monthlyCallCountByPlayer={monthlyCallCountByPlayer}
                  toFollowUpPlayerIds={toFollowUpPlayerIds}
                />
              )}
            </CardContent>
          </Card>
            </TabsContent>
              </div>
            </section>
          </Tabs>
        </main>

        <PlayerFormDialog
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          player={editingPlayer}
        />

        <TaskFormDialog
          isOpen={isTaskFormOpen}
          onClose={handleTaskFormClose}
          onSubmit={handleTaskCreate}
          playerId={selectedPlayerId || undefined}
          playerPhone={selectedPlayerId ? players.find(p => p.id === selectedPlayerId)?.phone || undefined : undefined}
          task={null}
        />

        <ManualFollowUpDialog
          isOpen={followUpPlayer !== null}
          onClose={() => setFollowUpPlayer(null)}
          onSubmit={handleManualFollowUpCreate}
          playerName={followUpPlayer ? getFullName(followUpPlayer) : "this player"}
        />


        <PlayerFlyout
          playerId={flyoutPlayerId}
          isOpen={Boolean(flyoutPlayerId)}
          onOpenChange={(open) => {
            if (!open) {
              setFlyoutPlayerId(null);
              fetchDashboardData({ background: true });
            }
          }}
        />
      </div>
    </ProtectedRoute>
  );
}
