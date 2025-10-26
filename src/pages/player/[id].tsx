import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { playerService, Player, getFullName, vipConfig, VipLevel } from "@/services/playerService";
import { taskService, Task } from "@/services/taskService";
import { TaskList } from "@/components/TaskList";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, Calendar, DollarSign, Crown, FileText, Plus } from "lucide-react";
import { format } from "date-fns";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export default function PlayerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [player, setPlayer] = useState<Player | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toast } = useToast();

  const fetchPlayerData = async () => {
    if (!id || typeof id !== "string") return;

    try {
      setLoading(true);
      const [playerData, tasksData] = await Promise.all([
        playerService.getPlayerById(id),
        taskService.getTasksByPlayerId(id),
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
      setTasks(tasksData);
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

  const handleTaskCreate = async (taskData: any) => {
    if (!player) return;

    try {
      await taskService.createTask({ ...taskData, player_id: player.id });
      toast({ title: "Task created", description: "New task has been added successfully." });
      setIsTaskFormOpen(false);
      fetchPlayerData();
    } catch (error) {
      console.error("Error creating task:", error);
      toast({ title: "Error", description: "Could not create task.", variant: "destructive" });
    }
  };

  const handleTaskUpdate = async (taskData: any) => {
    if (!editingTask) return;

    try {
      await taskService.updateTask(editingTask.id, taskData);
      toast({ title: "Task updated", description: "Task has been updated successfully." });
      setIsTaskFormOpen(false);
      setEditingTask(null);
      fetchPlayerData();
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: "Error", description: "Could not update task.", variant: "destructive" });
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      toast({ title: "Task deleted", description: "Task has been removed successfully." });
      fetchPlayerData();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Error", description: "Could not delete task.", variant: "destructive" });
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId);
      toast({ title: "Task completed", description: "Task marked as completed." });
      fetchPlayerData();
    } catch (error) {
      console.error("Error completing task:", error);
      toast({ title: "Error", description: "Could not complete task.", variant: "destructive" });
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

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 border-b">
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

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 border-b shadow-sm">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{getFullName(player)}</h1>
              <p className="text-sm text-muted-foreground">@{player.username}</p>
            </div>
          </div>
          <ThemeSwitch />
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Player Information</CardTitle>
                <Badge className={`${vipInfo.bgColor} ${vipInfo.color}`}>
                  {vipInfo.name}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </div>
                  <p className="font-medium">{player.email}</p>
                </div>

                {player.phone && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>Phone</span>
                    </div>
                    <p className="font-medium">{player.phone}</p>
                  </div>
                )}

                {player.dob && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Date of Birth</span>
                    </div>
                    <p className="font-medium">{format(new Date(player.dob), "PPP")}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4" />
                    <span>Total Deposits</span>
                  </div>
                  <p className="font-medium">${Number(player.total_deposits || 0).toLocaleString()}</p>
                </div>

                {player.casino && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Crown className="w-4 h-4" />
                      <span>Casino</span>
                    </div>
                    <p className="font-medium">{player.casino}</p>
                  </div>
                )}

                {player.last_email_sent && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span>Last Email Sent</span>
                    </div>
                    <p className="font-medium">{format(new Date(player.last_email_sent), "PPP")}</p>
                  </div>
                )}
              </div>

              {player.notes && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span>Notes</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                      {player.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <span className="text-sm text-muted-foreground">User ID</span>
                <span className="font-mono text-sm">{player.user_id}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <span className="text-sm text-muted-foreground">Gender</span>
                <span className="font-medium capitalize">{player.gender || "Not specified"}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <span className="text-sm text-muted-foreground">Active Tasks</span>
                <span className="font-bold text-lg">{tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tasks & Reminders</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage player-related tasks and follow-ups
                </p>
              </div>
              <Button onClick={() => setIsTaskFormOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={tasks}
              onEdit={handleEditTask}
              onDelete={handleTaskDelete}
              onComplete={handleTaskComplete}
            />
          </CardContent>
        </Card>
      </main>

      <TaskFormDialog
        isOpen={isTaskFormOpen}
        onClose={handleTaskFormClose}
        onSubmit={editingTask ? handleTaskUpdate : handleTaskCreate}
        task={editingTask}
        playerId={player.id}
      />
    </div>
  );
}
