
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export default function HomePage() {
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("caxino_players");
    if (stored) {
      const players = JSON.parse(stored);
      setPlayerCount(players.length);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
              Caxino CRM
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Casino Player Management System
          </p>
        </div>

        {/* Stats Card */}
        <div className="grid gap-6 mb-8 md:grid-cols-3">
          <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardDescription>Total Players</CardDescription>
              <CardTitle className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {playerCount}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardDescription>Active Today</CardDescription>
              <CardTitle className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                0
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardDescription>New This Week</CardDescription>
              <CardTitle className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                0
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Players Table Card */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Players Database</CardTitle>
                <CardDescription>
                  Manage your casino player information
                </CardDescription>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Player
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No players yet</p>
              <p className="text-sm">
                Please share the column structure for the players table
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
