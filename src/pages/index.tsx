import { useState, useEffect } from "react";
import { playerService, PlayerWithTasks, PlayerInsert, PlayerUpdate, vipConfig, VipLevel } from "@/services/playerService";
import { taskService } from "@/services/taskService";
import { PlayersTable } from "@/components/PlayersTable";
import { Button } from "@/components/ui/button";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Crown, ListTodo, LogOut } from "lucide-react";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { TaskAlertsPanel } from "@/components/TaskAlertsPanel";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { CallReminderNotification } from "@/components/CallReminderNotification";
import { BirthdayReminders } from "@/components/BirthdayReminders";

export default function Home() {
  const [players, setPlayers] = useState<PlayerWithTasks[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [vipDistribution, setVipDistribution] = useState<Record<VipLevel, number>>({ 3: 0, 4: 0, 5: 0 });
  const [activeTasks, setActiveTasks] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [playersData, total, distribution, tasks] = await Promise.all([
        playerService.getPlayers(),
        playerService.getTotalPlayerCount(),
        playerService.getVipLevelDistribution(),
        taskService.getActiveTaskCount(),
      ]);
      setPlayers(playersData);
      setTotalPlayers(total);
      setVipDistribution(distribution);
      setActiveTasks(tasks);
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
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  return (
    <ProtectedRoute>
      <CallReminderNotification />
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 border-b shadow-sm">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
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

        <main className="flex-1 p-6 space-y-6">
          <TaskAlertsPanel />
          <BirthdayReminders />

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Players Directory</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage and view all casino players
                  </p>
                </div>
                <Button 
                  onClick={() => setIsFormOpen(true)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  Add New Player
                </Button>
              </div>
            </CardHeader>

            <div className="px-6 pb-3">
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="flex items-center gap-6 py-3 px-4 bg-muted/30 rounded-lg border">
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
                    <ListTodo className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-muted-foreground">Active Tasks:</span>
                    <span className="text-sm font-bold">{activeTasks}</span>
                  </div>
                </div>
              )}
            </div>

            <CardContent>
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
                />
              )}
            </CardContent>
          </Card>
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
      </div>
    </ProtectedRoute>
  );
}
