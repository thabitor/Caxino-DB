import { useState, useEffect } from "react";
import { playerService, PlayerWithTasks, PlayerInsert, PlayerUpdate } from "@/services/playerService";
import { PlayersTable } from "@/components/PlayersTable";
import { Button } from "@/components/ui/button";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [players, setPlayers] = useState<PlayerWithTasks[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [vipPlayers, setVipPlayers] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [playersData, total, vip] = await Promise.all([
        playerService.getPlayers(),
        playerService.getTotalPlayerCount(),
        playerService.getVipPlayerCount(),
      ]);
      setPlayers(playersData);
      setTotalPlayers(total);
      setVipPlayers(vip);
    } catch (error) {
      toast({ title: "Error fetching data", description: "Could not load dashboard data.", variant: "destructive" });
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
    try {
      await playerService.deletePlayer(playerId);
      toast({ title: "Player deleted", description: "The player has been successfully deleted." });
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Error", description: "Could not delete the player.", variant: "destructive" });
    }
  };

  const handleFormSubmit = async (formData: PlayerInsert | PlayerUpdate) => {
    try {
      if (editingPlayer) {
        await playerService.updatePlayer(editingPlayer.id, formData as PlayerUpdate);
        toast({ title: "Player updated", description: "Player details have been successfully updated." });
      } else {
        await playerService.createPlayer(formData as PlayerInsert);
        toast({ title: "Player created", description: "New player has been successfully added." });
      }
      setIsFormOpen(false);
      setEditingPlayer(null);
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Error", description: "Could not save player details.", variant: "destructive" });
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingPlayer(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-6 bg-card border-b">
        <h1 className="text-xl font-semibold">Caxino CRM</h1>
        <Button onClick={() => setIsFormOpen(true)}>Add New Player</Button>
      </header>

      <main className="flex-1 p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Players</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-1/4" /> : <p className="text-3xl font-bold">{totalPlayers}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>VIP Players</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-1/4" /> : <p className="text-3xl font-bold">{vipPlayers}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {/* This will require taskService, to be implemented */}
              {loading ? <Skeleton className="h-8 w-1/4" /> : <p className="text-3xl font-bold">N/A</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <PlayersTable players={players} onEdit={handleEdit} onDelete={handleDelete} />
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
