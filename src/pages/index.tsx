import { useState, useCallback, useEffect, useRef } from "react";
import { playerService, PlayerWithTasks, PlayerInsert, PlayerUpdate, getFullName, vipConfig, VipLevel } from "@/services/playerService";
import { taskService } from "@/services/taskService";
import { callLogService } from "@/services/callLogService";
import { manualFollowUpService } from "@/services/manualFollowUpService";
import { followUpViewedService } from "@/services/followUpViewedService";
import { PlayersTable } from "@/components/PlayersTable";
import { Button } from "@/components/ui/button";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Crown, ListTodo, LogOut, ChevronDown, ChevronUp, AlertCircle, Phone } from "lucide-react";
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
import { DASHBOARD_REFRESH_EVENT, getDashboardRefreshToken, getHighlightedFollowUps } from "@/lib/dashboardSync";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualFollowUpDialog } from "@/components/ManualFollowUpDialog";
import { ManualFollowUpPickerDialog } from "@/components/ManualFollowUpPickerDialog";

export default function Home() {
  const [players, setPlayers] = useState<PlayerWithTasks[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [vipDistribution, setVipDistribution] = useState<Record<VipLevel, number>>({ 3: 0, 4: 0, 5: 0 });
  const [activeTasks, setActiveTasks] = useState(0);
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);
  const [followUpViewedAtByPlayer, setFollowUpViewedAtByPlayer] = useState<Record<string, string>>({});
  const [lastCallAtByPlayer, setLastCallAtByPlayer] = useState<Record<string, string>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedDashboard = useRef(false);
  const lastRefreshToken = useRef<string | null>(null);
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [followUpPlayer, setFollowUpPlayer] = useState<PlayerWithTasks | null>(null);
  const [isQueueFollowUpOpen, setIsQueueFollowUpOpen] = useState(false);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(true);

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
      setPlayers(playersData);
      setTotalPlayers(total);
      setVipDistribution(distribution);
      setActiveTasks(tasks.length);
      setFollowUpItems(buildFollowUpQueue(playersData, tasks, callLogs, manualFollowUps));
      setFollowUpViewedAtByPlayer({ ...localViewed, ...persistedViewed });
      setLastCallAtByPlayer(latestCallsByPlayer);
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
  }, [toast, user?.id]);

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

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        refreshIfChanged();
      }
    };

    window.addEventListener(DASHBOARD_REFRESH_EVENT, refreshIfChanged);
    window.addEventListener("focus", refreshIfChanged);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, refreshIfChanged);
      window.removeEventListener("focus", refreshIfChanged);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [fetchDashboardData]);

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
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 border-b shadow-sm">
          <div className="flex items-center justify-between h-14 px-4 lg:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                  Caxino CRM
                </h1>
                <p className="text-xs text-muted-foreground">Player Management System</p>
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

        <main className="flex-1 space-y-4 p-4 lg:p-5">
          <section className="overflow-hidden rounded-lg border-2 border-border/80 bg-card shadow-md shadow-black/5 dark:border-border/70 dark:shadow-black/20">
            <Tabs defaultValue="followups" className="min-w-0">
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

              <div className="grid h-[560px] gap-3 p-3 min-[520px]:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-h-0 min-w-0">
                  <TabsContent value="followups" className="m-0 h-full">
                    <FollowUpQueue items={followUpItems} onAddFollowUp={() => setIsQueueFollowUpOpen(true)} />
                  </TabsContent>
                  <TabsContent value="alerts" className="m-0 h-full">
                    <TaskAlertsPanel />
                  </TabsContent>
                  <TabsContent value="birthdays" className="m-0 h-full">
                    <BirthdayReminders />
                  </TabsContent>
                </div>

                <div className="grid min-h-0 gap-3 min-[520px]:grid-rows-[300px_minmax(0,1fr)]">
                  <Card className="h-full overflow-hidden border-primary/35 shadow-md shadow-primary/5">
                    <CardHeader className="min-h-[80px] border-b-2 border-primary/15 bg-muted/25 py-2.5">
                      <div className="flex h-full items-center justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            Manager Snapshot
                          </CardTitle>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Current workload and VIP mix.
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid h-[calc(100%-80px)] gap-2 p-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border-2 border-border/70 bg-muted/20 p-2 shadow-sm">
                          <p className="text-xs text-muted-foreground">Review</p>
                          <p className="text-lg font-bold">{followUpItems.length}</p>
                        </div>
                        <div className="rounded-md border-2 border-red-200 bg-red-50 p-2 text-red-800 shadow-sm shadow-red-500/5 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                          <p className="text-xs opacity-80">Overdue</p>
                          <p className="text-lg font-bold">{overdueFollowUps}</p>
                        </div>
                        <div className="rounded-md border-2 border-blue-200 bg-blue-50 p-2 text-blue-800 shadow-sm shadow-blue-500/5 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                          <p className="text-xs opacity-80">Today</p>
                          <p className="text-lg font-bold">{todayFollowUps}</p>
                        </div>
                        <div className="rounded-md border-2 border-border/70 bg-muted/20 p-2 shadow-sm">
                          <p className="text-xs text-muted-foreground">Calls</p>
                          <p className="text-lg font-bold">{scheduledCalls}</p>
                        </div>
                      </div>
                      <div className="rounded-md border-2 border-border/70 p-2 shadow-sm">
                        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <Crown className="h-3.5 w-3.5" />
                          VIP Mix
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(Object.keys(vipDistribution).map(Number) as VipLevel[]).sort((a, b) => b - a).map((level) => (
                            <Badge key={level} variant="secondary" className="text-xs">
                              L{level}: {vipDistribution[level]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <UpcomingBirthdaysPanel players={players} />
                </div>
              </div>
            </Tabs>
          </section>

          <Collapsible open={isDirectoryOpen} onOpenChange={setIsDirectoryOpen}>
          <Card className="border-border shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="py-3">
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
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  >
                    Add New Player
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      {isDirectoryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
            </CardHeader>

            <div className="px-4 pb-3">
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-border/70 bg-muted/30 px-3 py-2 shadow-sm">
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

            <CollapsibleContent>
            <CardContent className="px-4 pb-4">
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
                  followUpViewedAtByPlayer={followUpViewedAtByPlayer}
                  lastCallAtByPlayer={lastCallAtByPlayer}
                />
              )}
            </CardContent>
            </CollapsibleContent>
          </Card>
          </Collapsible>
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
      </div>
    </ProtectedRoute>
  );
}
