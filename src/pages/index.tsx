import { useState, useCallback, useEffect, useRef } from "react";
import { playerService, PlayerWithTasks, PlayerInsert, PlayerUpdate, getFullName, vipConfig, VipLevel } from "@/services/playerService";
import { taskService } from "@/services/taskService";
import { callLogService, type CallLog } from "@/services/callLogService";
import { manualFollowUpService } from "@/services/manualFollowUpService";
import { followUpViewedService } from "@/services/followUpViewedService";
import { PlayersTable } from "@/components/PlayersTable";
import { Button } from "@/components/ui/button";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Crown, ListTodo, LogOut, AlertCircle, Phone } from "lucide-react";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { TaskAlertsPanel } from "@/components/TaskAlertsPanel";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { CallReminderNotification } from "@/components/CallReminderNotification";
import { BirthdayReminders } from "@/components/BirthdayReminders";
import { UpcomingBirthdaysPanel } from "@/components/UpcomingBirthdaysPanel";
import { ExcelUploadDialog } from "@/components/ExcelUploadDialog";
import { FollowUpQueue } from "@/components/FollowUpQueue";
import { buildFollowUpQueue, FollowUpItem } from "@/lib/followup";
import { clearRecentFollowUpActivity, DASHBOARD_REFRESH_EVENT, FOLLOW_UP_RECENT_ACTIVITY_TTL_MS, FOLLOW_UP_TTL_MS, FOLLOW_UP_VIEWED_EVENT, type ActionHistoryActivity, FollowUpRecentActivity, getDashboardRefreshToken, getHighlightedFollowUps, getRecentFollowUpActivity, getRecentFollowUpActivityClearedAt, restoreDismissedFollowUp } from "@/lib/dashboardSync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualFollowUpDialog } from "@/components/ManualFollowUpDialog";
import { ManualFollowUpPickerDialog } from "@/components/ManualFollowUpPickerDialog";
import { RecentFollowUpsPanel } from "@/components/RecentFollowUpsPanel";
import { PlayerFlyout } from "@/components/PlayerFlyout";

export default function Home() {
  const [players, setPlayers] = useState<PlayerWithTasks[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [vipDistribution, setVipDistribution] = useState<Record<VipLevel, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [activeTasks, setActiveTasks] = useState(0);
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);
  const [followUpViewedAtByPlayer, setFollowUpViewedAtByPlayer] = useState<Record<string, string>>({});
  const [lastCallAtByPlayer, setLastCallAtByPlayer] = useState<Record<string, string>>({});
  const [monthlyCallCountByPlayer, setMonthlyCallCountByPlayer] = useState<Record<string, number>>({});
  const [actionHistory, setActionHistory] = useState<ActionHistoryActivity[]>([]);
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

  const mergeRecentFollowUpActivity = useCallback((persistedOpened: { player_id: string; last_viewed_at: string }[]) => {
    const cutoff = Date.now() - FOLLOW_UP_RECENT_ACTIVITY_TTL_MS;
    const clearedAt = getRecentFollowUpActivityClearedAt();
    const clearedAtTime = clearedAt ? new Date(clearedAt).getTime() : null;
    const isAfterClear = (timestamp: string) => {
      if (!clearedAtTime || !Number.isFinite(clearedAtTime)) return true;

      const activityTime = new Date(timestamp).getTime();
      return Number.isFinite(activityTime) && activityTime > clearedAtTime;
    };
    const openedFromDb = persistedOpened
      .filter((viewed) => {
        const timestamp = new Date(viewed.last_viewed_at).getTime();
        return Number.isFinite(timestamp) && timestamp >= cutoff && isAfterClear(viewed.last_viewed_at);
      })
      .map((viewed): FollowUpRecentActivity => ({
        playerId: viewed.player_id,
        type: "opened",
        timestamp: viewed.last_viewed_at,
      }));

    const merged = [...getRecentFollowUpActivity().filter((activity) => isAfterClear(activity.timestamp)), ...openedFromDb];
    const latestByKey = new Map<string, FollowUpRecentActivity>();

    merged.forEach((activity) => {
      const key = `${activity.playerId}:${activity.type}`;
      const existing = latestByKey.get(key);
      if (!existing || new Date(activity.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        latestByKey.set(key, activity);
      }
    });

    return Array.from(latestByKey.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, []);

  const buildActionHistory = useCallback((
    playersData: PlayerWithTasks[],
    callLogs: CallLog[],
    followUpActivity: FollowUpRecentActivity[]
  ): ActionHistoryActivity[] => {
    const cutoff = Date.now() - FOLLOW_UP_RECENT_ACTIVITY_TTL_MS;
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
          type: "call_logged",
          timestamp: timestamp as string,
          detail: callLog.call_topic,
        };
      })
      .filter((activity): activity is ActionHistoryActivity => Boolean(activity));
    const callsByPlayer = callEvents.reduce<Record<string, number[]>>((byPlayer, activity) => {
      byPlayer[activity.playerId] = [...(byPlayer[activity.playerId] || []), new Date(activity.timestamp).getTime()];
      return byPlayer;
    }, {});
    const followUpEvents = followUpActivity
      .filter((activity) => isValidTimestamp(activity.timestamp))
      .filter((activity) => {
        const activityTime = new Date(activity.timestamp).getTime();
        return !(callsByPlayer[activity.playerId] || []).some((callTime) => Math.abs(callTime - activityTime) <= FOLLOW_UP_TTL_MS);
      })
      .map((activity): ActionHistoryActivity => ({
        playerId: activity.playerId,
        type: activity.type === "dismissed" ? "follow_up_dismissed" : "follow_up_opened",
        timestamp: activity.timestamp,
      }));
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

    return [...callEvents, ...followUpEvents, ...playerEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 40);
  }, []);

  const getPersistedOpenedForRecent = useCallback(
    () =>
      Object.entries(followUpViewedAtByPlayer).map(([player_id, last_viewed_at]) => ({
        player_id,
        last_viewed_at,
      })),
    [followUpViewedAtByPlayer]
  );

  const fetchDashboardData = useCallback(async (options?: { background?: boolean }) => {
    try {
      if (!options?.background || !hasLoadedDashboard.current) {
        setLoading(true);
      }
      const [playersData, total, distribution, tasks, callLogs, manualFollowUps, viewedPlayers] = await Promise.all([
        playerService.getPlayers(),
        playerService.getTotalPlayerCount(),
        playerService.getVipLevelDistribution(),
        taskService.getActiveTasks(),
        callLogService.getAllCallLogs(),
        manualFollowUpService.getActiveManualFollowUps(),
        followUpViewedService.getRecentViewedPlayers(user?.id || null),
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
      setActiveTasks(tasks.length);
      setFollowUpItems(buildFollowUpQueue(playersData, tasks, callLogs, manualFollowUps));
      setFollowUpViewedAtByPlayer({ ...localViewed, ...persistedViewed });
      setLastCallAtByPlayer(latestCallsByPlayer);
      setMonthlyCallCountByPlayer(monthlyCallsByPlayer);
      const followUpActivity = mergeRecentFollowUpActivity(viewedPlayers);
      setActionHistory(buildActionHistory(playersData, callLogs, followUpActivity));
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
  }, [buildActionHistory, mergeRecentFollowUpActivity, toast, user?.id]);

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
  }, [fetchDashboardData, getPersistedOpenedForRecent, mergeRecentFollowUpActivity]);

  const handleRestoreDismissedFollowUp = (playerId: string) => {
    restoreDismissedFollowUp(playerId);
    fetchDashboardData({ background: true });
  };

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
  const scheduledCalls = followUpItems.reduce((total, item) => total + item.activeCallCount, 0);

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

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 lg:p-5">
          <Tabs defaultValue="relationship" className="flex h-full min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <TabsList className="h-10 justify-start rounded-md border-2 border-border/70 bg-muted/35 p-1 shadow-sm">
                <TabsTrigger value="relationship" className="h-8 px-4 text-xs">
                  Relationship Workspace
                </TabsTrigger>
                <TabsTrigger value="directory" className="h-8 px-4 text-xs">
                  Players Directory
                </TabsTrigger>
              </TabsList>
              <div className="hidden text-xs font-medium text-muted-foreground sm:block">
                Focused views for queue work and player management
              </div>
            </div>

            <TabsContent value="relationship" className="m-0 min-h-0 flex-1 overflow-hidden">
          <section className="h-full min-h-0 overflow-hidden rounded-lg border-2 border-border/80 bg-card shadow-md shadow-black/5 dark:border-border/70 dark:shadow-black/20">
            <Tabs defaultValue="followups" className="flex h-full min-w-0 flex-col">
              <div className="flex items-end justify-between gap-3 border-b-2 border-border/60 bg-muted/20 px-3 pt-2">
                <TabsList className="h-9 justify-start rounded-none bg-transparent p-0">
                  <TabsTrigger
                    value="followups"
                    className="h-9 rounded-b-none rounded-t-md border-2 border-b-0 bg-muted/35 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                  >
                    Follow-ups
                  </TabsTrigger>
                  <TabsTrigger
                    value="alerts"
                    className="h-9 rounded-b-none rounded-t-md border-2 border-b-0 bg-muted/35 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                  >
                    Alerts
                  </TabsTrigger>
                  <TabsTrigger
                    value="birthdays"
                    className="h-9 rounded-b-none rounded-t-md border-2 border-b-0 bg-muted/35 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                  >
                    Birthdays
                  </TabsTrigger>
                </TabsList>
                <div className="hidden pb-2 text-xs font-medium text-muted-foreground sm:block">
                  Relationship workspace
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-rows-[560px_560px_220px] gap-3 overflow-y-auto p-3 lg:grid-cols-[260px_minmax(0,1fr)_260px] lg:grid-rows-none lg:overflow-hidden 2xl:grid-cols-[300px_minmax(0,1fr)_340px]">
                <div className="grid min-h-0 gap-3 min-[520px]:grid-rows-[260px_minmax(0,1fr)]">
                  <Card className="h-full overflow-hidden border-2 border-emerald-300/80 bg-emerald-50/20 shadow-md shadow-emerald-500/5 dark:border-emerald-800 dark:bg-emerald-950/10">
                    <CardHeader className="min-h-[68px] border-b-2 border-emerald-200/80 bg-emerald-100/35 py-2.5 dark:border-emerald-900/70 dark:bg-emerald-950/25">
                      <div className="flex h-full items-center justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <AlertCircle className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                            Manager Snapshot
                          </CardTitle>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Current workload summary.
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid h-[calc(100%-68px)] content-start gap-2 p-3 text-sm">
                      <div className="grid gap-1.5">
                        <div className="flex items-center justify-between rounded-md border border-emerald-200/80 bg-emerald-50/45 px-2.5 py-1.5 shadow-sm shadow-emerald-500/5 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                          <span className="text-xs font-semibold text-muted-foreground">To Review</span>
                          <span className="text-base font-bold tabular-nums">{followUpItems.length}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/85 px-2.5 py-1.5 text-red-800 shadow-sm shadow-red-500/5 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                          <span className="text-xs font-semibold opacity-85">Overdue</span>
                          <span className="text-base font-bold tabular-nums">{overdueFollowUps}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50/85 px-2.5 py-1.5 text-blue-800 shadow-sm shadow-blue-500/5 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                          <span className="text-xs font-semibold opacity-85">Due Today</span>
                          <span className="text-base font-bold tabular-nums">{todayFollowUps}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-cyan-200/80 bg-cyan-50/45 px-2.5 py-1.5 shadow-sm shadow-cyan-500/5 dark:border-cyan-900/70 dark:bg-cyan-950/20">
                          <span className="text-xs font-semibold text-muted-foreground">Scheduled Calls</span>
                          <span className="text-base font-bold tabular-nums">{scheduledCalls}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <UpcomingBirthdaysPanel players={players} />
                </div>

                <div className="min-h-0 min-w-0">
                  <TabsContent value="followups" className="m-0 h-full">
                    <FollowUpQueue
                      items={followUpItems}
                      onAddFollowUp={() => setIsQueueFollowUpOpen(true)}
                      onOpenPlayer={setFlyoutPlayerId}
                    />
                  </TabsContent>
                  <TabsContent value="alerts" className="m-0 h-full">
                    <TaskAlertsPanel />
                  </TabsContent>
                  <TabsContent value="birthdays" className="m-0 h-full">
                    <BirthdayReminders />
                  </TabsContent>
                </div>

                <div className="min-h-0">
                  <RecentFollowUpsPanel
                    activities={actionHistory}
                    players={players}
                    onRestore={handleRestoreDismissedFollowUp}
                    onClear={handleClearRecentFollowUps}
                  />
                </div>
              </div>
            </Tabs>
          </section>
            </TabsContent>

            <TabsContent value="directory" className="m-0 min-h-0 flex-1 overflow-hidden">
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

            <div className="shrink-0 px-4 pb-3">
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-indigo-200/80 bg-indigo-50/40 px-3 py-2 shadow-sm shadow-indigo-500/5 dark:border-indigo-900/70 dark:bg-indigo-950/20">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-muted-foreground">Total:</span>
                    <span className="text-sm font-bold">{totalPlayers}</span>
                  </div>

                  <div className="h-5 w-px bg-border" />

                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-muted-foreground">VIP:</span>
                    <div className="flex items-center gap-1.5">
                      {(Object.keys(vipDistribution).map(Number) as VipLevel[]).sort((a, b) => b - a).map((level) => {
                        const count = vipDistribution[level];
                        const config = vipConfig[level];
                        if (!config || count === 0) return null;
                        return (
                          <Badge 
                            key={level} 
                            variant="secondary" 
                            className={`text-xs px-1.5 py-0 ${config.bgColor} ${config.color} border-0`}
                          >
                            L{level}: {count}
                          </Badge>
                        );
                      })}
                      {Object.values(vipDistribution).every(c => c === 0) && (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>

                  <div className="h-5 w-px bg-border" />

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-muted-foreground">Scheduled Calls:</span>
                    <span className="text-sm font-bold">{scheduledCalls}</span>
                  </div>

                  <div className="h-5 w-px bg-border" />

                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-muted-foreground">Active Tasks:</span>
                    <span className="text-sm font-bold">{activeTasks}</span>
                  </div>
                </div>
              )}
            </div>

            <CardContent className="min-h-0 flex-1 px-4 pb-4">
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
                />
              )}
            </CardContent>
          </Card>
            </TabsContent>
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

        <ManualFollowUpPickerDialog
          isOpen={isQueueFollowUpOpen}
          onClose={() => setIsQueueFollowUpOpen(false)}
          onSubmit={handleQueueManualFollowUpCreate}
          players={players}
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
