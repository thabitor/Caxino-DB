import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Player, playerService } from "@/services/playerService";
import { Task, TaskInsert, TaskUpdate, taskService } from "@/services/taskService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import TaskList from "@/components/TaskList";
import TaskFormDialog from "@/components/TaskFormDialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlayerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();

  const [player, setPlayer] = useState<Player | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const playerId = typeof id === "string" ? id : "";

  const fetchData = async () => {
    if (!playerId) return;
    try {
      setLoading(true);
      const [playerData, tasksData] = await Promise.all([
        playerService.getPlayerById(playerId),
        taskService.getTasksForPlayer(playerId),
      ]);
      setPlayer(playerData);
      setTasks(tasksData);
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch player details.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [playerId]);

  const handleTaskFormSubmit = async (formData: Omit<Task, "id" | "created_at" | "player_id">) => {
    try {
      if (editingTask) {
        await taskService.updateTask(editingTask.id, formData as TaskUpdate);
        toast({ title: "Task Updated", description: "The task has been successfully updated." });
      } else {
        await taskService.createTask({ ...formData, player_id: playerId } as TaskInsert);
        toast({ title: "Task Created", description: "The new task has been added." });
      }
      setIsTaskFormOpen(false);
      setEditingTask(null);
      fetchData(); // Refresh data
    } catch (error) {
      toast({ title: "Error", description: "Could not save the task.", variant: "destructive" });
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };
  
  const handleDeleteTask = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      toast({ title: "Task Deleted", description: "The task has been removed." });
      fetchData(); // Refresh data
    } catch (error) {
      toast({ title: "Error", description: "Could not delete the task.", variant: "destructive" });
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await taskService.toggleTaskStatus(taskId);
      toast({ title: "Task Status Updated", description: "The task status has been changed." });
      fetchData(); // Refresh data
    } catch (error) {
      toast({ title: "Error", description: "Could not update task status.", variant: "destructive" });
    }
  };

  const handleFormClose = () => {
    setIsTaskFormOpen(false);
    setEditingTask(null);
  };

  if (loading) {
    return (
        <div className="p-6 space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
  }

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-2xl mb-4">Player not found</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link href="/">
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </Link>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>{player.firstname} {player.lastname}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Username:</strong> {player.username}</p>
            <p><strong>Email:</strong> {player.email}</p>
            <p><strong>Phone:</strong> {player.phone_number}</p>
            <p><strong>DOB:</strong> {player.dob ? new Date(player.dob).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Gender:</strong> {player.gender}</p>
            <p><strong>Casino:</strong> {player.casino}</p>
            <p><strong>VIP Level:</strong> {player.vip_level}</p>
            <p><strong>Total Deposits:</strong> ${player.total_deposits}</p>
            <p><strong>Last Email Sent:</strong> {player.last_email_sent ? new Date(player.last_email_sent).toLocaleString() : 'N/A'}</p>
            <p><strong>Preferences:</strong> {player.preferences}</p>
            <p><strong>Notes:</strong> {player.notes}</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tasks & Reminders</CardTitle>
            <Button onClick={() => setIsTaskFormOpen(true)}>Add Task</Button>
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={tasks}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              onToggle={handleToggleTask}
            />
          </CardContent>
        </Card>
      </div>
      
      <TaskFormDialog
        isOpen={isTaskFormOpen}
        onClose={handleFormClose}
        onSubmit={handleTaskFormSubmit}
        task={editingTask}
      />
    </div>
  );
}
