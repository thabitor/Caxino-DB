import { useState, useEffect } from "react";
import Head from "next/head";
import { Player } from "@/services/playerService";
import { playerService } from "@/services/playerService";
import { PlayersTable } from "@/components/PlayersTable";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Users, TrendingUp, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    const loadedPlayers = await playerService.getAll();
    setPlayers(loadedPlayers);
  };

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setDialogOpen(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: any) => {
    if (editingPlayer) {
      const updated = await playerService.update(editingPlayer.id, data);
      if (updated) {
        toast({
          title: "Player Updated",
          description: `${data.firstname} ${data.lastname} has been updated successfully.`,
        });
      }
    } else {
      await playerService.create(data);
      toast({
        title: "Player Added",
        description: `${data.firstname} ${data.lastname} has been added successfully.`,
      });
    }
    await loadPlayers();
    setDialogOpen(false);
    setEditingPlayer(null);
  };

  const handleDeletePlayer = async (id: string) => {
    if (confirm("Are you sure you want to delete this player?")) {
      const success = await playerService.delete(id);
      if (success) {
        toast({
          title: "Player Deleted",
          description: "The player has been removed from the system.",
          variant: "destructive",
        });
        await loadPlayers();
      }
    }
  };

  const totalDeposits = players.reduce((sum, player) => sum + player.totalDeposits, 0);
  const vipPlayers = players.filter((p) => p.vipLevel >= 4).length;

  return (
    <>
      <Head>
        <title>Caxino CRM - Player Management</title>
        <meta name="description" content="Casino player management system" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    Caxino CRM
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Player Management System</p>
                </div>
              </div>
              <ThemeSwitch />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Players</p>
                    <p className="text-3xl font-bold mt-2">{players.length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">High-Tier VIPs</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">(Level 4-5)</p>
                    <p className="text-3xl font-bold mt-1">{vipPlayers}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Deposits</p>
                    <p className="text-3xl font-bold mt-2">
                      ${totalDeposits.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Players Database</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Manage casino player information and statistics
                </p>
              </div>
              <Button onClick={handleAddPlayer} className="gap-2">
                <UserPlus className="w-4 h-4" />
                Add Player
              </Button>
            </div>

            <PlayersTable
              players={players}
              onEdit={handleEditPlayer}
              onDelete={handleDeletePlayer}
            />
          </div>
        </main>

        <PlayerFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          player={editingPlayer}
        />
      </div>
    </>
  );
}
