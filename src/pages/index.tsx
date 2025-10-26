import { useState, useEffect } from "react";
import { playerService, PlayerWithTasks, PlayerInsert, PlayerUpdate } from "@/services/playerService";
import { taskService } from "@/services/taskService";
import { PlayersTable } from "@/components/PlayersTable";
import { Button } from "@/components/ui/button";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Crown, ListTodo } from "lucide-react";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export default function Home() {
  const [players, setPlayers] = useState<PlayerWithTasks[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [vipPlayers, setVipPlayers] = useState(0);
  const [activeTasks, setActiveTasks] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [playersData, total, vip, tasks] = await Promise.all([
        playerService.getPlayers(),
        playerService.getTotalPlayerCount(),
        playerService.getVipPlayerCount(),
        taskService.getActiveTaskCount(),
      ]);
      setPlayers(playersData);
      setTotalPlayers(total);
      setVipPlayers(vip);
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

  return (
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
            <ThemeSwitch />
            <Button 
              onClick={() => setIsFormOpen(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              Add New Player
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Players</CardTitle>
              <Users className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div>
                  <p className="text-3xl font-bold">{totalPlayers}</p>
                  <p className="text-xs text-muted-foreground mt-1">Active in database</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">VIP Players</CardTitle>
              <Crown className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div>
                  <p className="text-3xl font-bold">{vipPlayers}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalPlayers > 0 ? `${Math.round((vipPlayers / totalPlayers) * 100)}% of total` : "No players yet"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Tasks</CardTitle>
              <ListTodo className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div>
                  <p className="text-3xl font-bold">{activeTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending & in progress</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Players Directory</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage and view all casino players
                </p>
              </div>
            </div>
          </CardHeader>
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
    </div>
  );
}
