import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { playerService, Player, getFullName, vipConfig, VipLevel } from "@/services/playerService";
import { taskService, Task } from "@/services/taskService";
import { TaskList } from "@/components/TaskList";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, Calendar, DollarSign, Crown, FileText, Plus, Edit, Save, X, Check } from "lucide-react";
import { format } from "date-fns";
import { ThemeSwitch } from "@/components/ThemeSwitch";

interface PlayerPreferences {
  communication?: {
    email?: boolean;
    sms?: boolean;
    phone?: boolean;
  };
  contact_time?: "morning" | "afternoon" | "evening" | "any";
  marketing_consent?: boolean;
  language?: string;
  notifications?: {
    promotions?: boolean;
    account_updates?: boolean;
    game_results?: boolean;
  };
}

const contactTimeLabels = {
  morning: "Morning (9 AM - 12 PM)",
  afternoon: "Afternoon (12 PM - 5 PM)",
  evening: "Evening (5 PM - 9 PM)",
  any: "Any Time",
};

const languageLabels: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ar: "Arabic",
};

export default function PlayerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [player, setPlayer] = useState<Player | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
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
      setNotesValue(playerData.notes || "");
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

  const handlePlayerUpdate = async (playerData: any) => {
    if (!player) return;

    try {
      await playerService.updatePlayer(player.id, playerData);
      toast({ title: "Player updated", description: "Player information has been updated successfully." });
      setIsPlayerFormOpen(false);
      fetchPlayerData();
    } catch (error) {
      console.error("Error updating player:", error);
      toast({ title: "Error", description: "Could not update player.", variant: "destructive" });
    }
  };

  const handleSaveNotes = async () => {
    if (!player) return;

    try {
      setIsSavingNotes(true);
      await playerService.updatePlayer(player.id, { notes: notesValue });
      toast({ title: "Notes saved", description: "Player notes have been updated successfully." });
      setIsEditingNotes(false);
      fetchPlayerData();
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({ title: "Error", description: "Could not save notes.", variant: "destructive" });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCancelNotesEdit = () => {
    setNotesValue(player?.notes || "");
    setIsEditingNotes(false);
  };

  const parsePreferences = (prefs: any): PlayerPreferences => {
    if (!prefs) return {};
    if (typeof prefs === "string") {
      try {
        return JSON.parse(prefs);
      } catch {
        return {};
      }
    }
    return prefs as PlayerPreferences;
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 border-b-2">
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
  const preferences = parsePreferences(player.preferences);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 border-b-2 border-border/60 shadow-md">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="hover:bg-muted/50">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{getFullName(player)}</h1>
                <Badge className={`${vipInfo.bgColor} ${vipInfo.color} font-semibold`}>
                  {player.vip_level} - {vipInfo.name}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">@{player.username}</p>
            </div>
          </div>
          <ThemeSwitch />
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-2 hover:shadow-xl transition-all hover:border-primary/20">
            <CardHeader className="border-b-2 border-border/40 bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle>Player Information</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsPlayerFormOpen(true)}
                  className="h-8 px-3 border-2 hover:bg-accent"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 p-3 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold">Email</span>
                  </div>
                  <p className="font-medium text-sm">{player.email}</p>
                </div>

                {player.phone && (
                  <div className="space-y-1 p-3 rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="font-semibold">Phone</span>
                    </div>
                    <p className="font-medium text-sm">{player.phone}</p>
                  </div>
                )}

                {player.dob && (
                  <div className="space-y-1 p-3 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-semibold">Date of Birth</span>
                    </div>
                    <p className="font-medium text-sm">{format(new Date(player.dob), "PPP")}</p>
                  </div>
                )}

                <div className="space-y-1 p-3 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold">Total Deposits</span>
                  </div>
                  <p className="font-medium text-sm">${Number(player.total_deposits || 0).toLocaleString()}</p>
                </div>

                {player.casino && (
                  <div className="space-y-1 p-3 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold">Casino</span>
                    </div>
                    <p className="font-medium text-sm">{player.casino}</p>
                  </div>
                )}

                {player.last_email_sent && (
                  <div className="space-y-1 p-3 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-semibold">Last Email Sent</span>
                    </div>
                    <p className="font-medium text-sm">{format(new Date(player.last_email_sent), "PPP")}</p>
                  </div>
                )}
              </div>

              <Separator className="my-4" />
              
              <div className="space-y-3 p-4 rounded-lg border-2 border-border/60 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="w-4 h-4" />
                    <span>Notes</span>
                  </div>
                  {!isEditingNotes && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsEditingNotes(true)}
                      className="h-8 px-3 border-2"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                {isEditingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      rows={4}
                      className="resize-none border-2"
                      placeholder="Add notes about this player..."
                    />
                    <div className="flex gap-2 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCancelNotesEdit}
                        disabled={isSavingNotes}
                        className="border-2"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                        className="border-2 border-primary"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {isSavingNotes ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap bg-background p-3 rounded-lg border-2 border-border/40">
                    {player.notes || "No notes added yet."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-2 hover:shadow-xl transition-all hover:border-primary/20">
              <CardHeader className="border-b-2 border-border/40 bg-muted/30">
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                  <span className="text-sm font-semibold text-muted-foreground">User ID</span>
                  <span className="font-mono text-sm font-bold">{player.user_id}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                  <span className="text-sm font-semibold text-muted-foreground">Gender</span>
                  <span className="font-bold capitalize">{player.gender || "Not specified"}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-200 dark:border-green-800">
                  <span className="text-sm font-semibold text-muted-foreground">Active Tasks</span>
                  <span className="font-bold text-xl">{tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-xl transition-all hover:border-primary/20">
              <CardHeader className="border-b-2 border-border/40 bg-muted/30">
                <CardTitle className="text-lg">Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="p-3 rounded-lg border-2 border-border/40 bg-muted/20">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Communication
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                      <span className="text-muted-foreground font-medium">Email</span>
                      {preferences.communication?.email !== false ? (
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                      <span className="text-muted-foreground font-medium">SMS</span>
                      {preferences.communication?.sms !== false ? (
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                      <span className="text-muted-foreground font-medium">Phone</span>
                      {preferences.communication?.phone !== false ? (
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm p-3 rounded-lg border-2 border-border/40 bg-muted/20">
                  <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                    <span className="text-muted-foreground font-medium">Contact Time</span>
                    <span className="font-semibold text-xs">
                      {contactTimeLabels[preferences.contact_time || "any"]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                    <span className="text-muted-foreground font-medium">Language</span>
                    <span className="font-semibold">
                      {languageLabels[preferences.language || "en"]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                    <span className="text-muted-foreground font-medium">Marketing</span>
                    {preferences.marketing_consent ? (
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                </div>

                <Separator />

                <div className="p-3 rounded-lg border-2 border-border/40 bg-muted/20">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notifications
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                      <span className="text-muted-foreground font-medium">Promotions</span>
                      {preferences.notifications?.promotions !== false ? (
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                      <span className="text-muted-foreground font-medium">Account Updates</span>
                      {preferences.notifications?.account_updates !== false ? (
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background border border-border/30">
                      <span className="text-muted-foreground font-medium">Game Results</span>
                      {preferences.notifications?.game_results !== false ? (
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-2 hover:shadow-xl transition-all hover:border-primary/20">
          <CardHeader className="border-b-2 border-border/40 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tasks & Reminders</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage player-related tasks and follow-ups
                </p>
              </div>
              <Button onClick={() => setIsTaskFormOpen(true)} size="sm" className="border-2 border-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
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

      <PlayerFormDialog
        isOpen={isPlayerFormOpen}
        onClose={() => setIsPlayerFormOpen(false)}
        onSubmit={handlePlayerUpdate}
        player={player}
      />
    </div>
  );
}