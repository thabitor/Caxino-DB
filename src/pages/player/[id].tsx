
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Player } from "@/types/player";
import { Task } from "@/types/task";
import { playerService } from "@/services/playerService";
import { taskService } from "@/services/taskService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Star,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { vipConfig } from "@/types/player";
import { TaskList } from "@/components/TaskList";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { useToast } from "@/hooks/use-toast";

export default function PlayerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [player, setPlayer] = useState<Player | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (id && typeof id === "string") {
      loadPlayerData(id);
    }
  }, [id]);

  const loadPlayerData = (playerId: string) => {
    const playerData = playerService.getById(playerId);
    if (playerData) {
      setPlayer(playerData);
      const playerTasks = taskService.getByPlayerId(playerId);
      setTasks(playerTasks);
    } else {
      router.push("/");
    }
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleTaskSubmit = (data: any) => {
    if (!player) return;

    if (editingTask) {
      taskService.update(editingTask.id, data);
      toast({
        title: "Task Updated",
        description: "The reminder has been updated successfully.",
      });
    } else {
      taskService.create({ ...data, playerId: player.id });
      toast({
        title: "Task Created",
        description: "New reminder has been added successfully.",
      });
    }
    
    loadPlayerData(player.id);
    setTaskDialogOpen(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!player) return;
    
    if (confirm("Are you sure you want to delete this task?")) {
      taskService.delete(taskId);
      toast({
        title: "Task Deleted",
        description: "The reminder has been removed.",
        variant: "destructive",
      });
      loadPlayerData(player.id);
    }
  };

  const handleToggleComplete = (taskId: string) => {
    if (!player) return;
    
    taskService.toggleComplete(taskId);
    loadPlayerData(player.id);
  };

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Loading player data...</p>
        </div>
      </div>
    );
  }

  const vipInfo = vipConfig[player.vipLevel];
  const pendingTasks = tasks.filter(t => !t.completed).length;
  const completedTasks = tasks.filter(t => t.completed).length;

  return (
    <>
      <Head>
        <title>{player.firstname} {player.lastname} - Caxino CRM</title>
        <meta name="description" content={`Player profile for ${player.firstname} ${player.lastname}`} />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Players
                  </Button>
                </Link>
                <Separator orientation="vertical" className="h-6" />
                <div>
                  <h1 className="text-xl font-bold">{player.firstname} {player.lastname}</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">@{player.username}</p>
                </div>
              </div>
              <ThemeSwitch />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Player Overview</span>
                    <Badge className={vipInfo.bgColor}>
                      <Star className="w-3 h-3 mr-1" />
                      VIP Level {player.vipLevel}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">User ID</p>
                        <p className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{player.userId}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Date of Birth</p>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <p>{new Date(player.dob).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Gender</p>
                        <p className="capitalize">{player.gender}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Casino</p>
                        <p>{player.casino}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Email</p>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <a href={`mailto:${player.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {player.email}
                          </a>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Phone</p>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <a href={`tel:${player.phone}`} className="hover:underline">
                            {player.phone}
                          </a>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Total Deposits</p>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <p className="text-lg font-bold">${player.totalDeposits.toLocaleString()}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Last Email Sent</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <p className="text-sm">
                            {player.lastEmailSent ? new Date(player.lastEmailSent).toLocaleString() : "Never"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {player.preferences && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Preferences</p>
                        <p className="text-sm bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">{player.preferences}</p>
                      </div>
                    </>
                  )}

                  {player.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Notes</p>
                        <p className="text-sm bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">{player.notes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{pendingTasks}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Pending Tasks</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{completedTasks}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Completed</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Tasks & Reminders</CardTitle>
                    <Button onClick={handleAddTask} size="sm" className="gap-2">
                      <Plus className="w-4 h-4" />
                      Add Task
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <TaskList
                    tasks={tasks}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                    onToggleComplete={handleToggleComplete}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <TaskFormDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          onSubmit={handleTaskSubmit}
          task={editingTask}
          playerId={player.id}
        />
      </div>
    </>
  );
}
