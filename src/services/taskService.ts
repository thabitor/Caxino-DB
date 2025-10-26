import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Define application-level types here
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  playerId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TaskFormData = Omit<Task, "id" | "createdAt" | "updatedAt">;

export const priorityOrder: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type DbTask = Database["public"]["Tables"]["tasks"]["Row"];

const mapDbTaskToTask = (dbTask: DbTask): Task => {
  return {
    id: dbTask.id,
    playerId: dbTask.player_id,
    title: dbTask.title,
    description: dbTask.description || "",
    priority: dbTask.priority as TaskPriority,
    completed: dbTask.status === "completed",
    dueDate: dbTask.due_date || null,
    createdAt: dbTask.created_at,
    updatedAt: dbTask.updated_at,
  };
};

export const taskService = {
  getByPlayerId: async (playerId: string): Promise<Task[]> => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks for player:", error);
      return [];
    }

    const tasks = data.map(mapDbTaskToTask);
    return tasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return 0;
    });
  },

  create: async (taskData: TaskFormData): Promise<Task | undefined> => {
    const { data: created, error } = await supabase
      .from("tasks")
      .insert([
        {
          player_id: taskData.playerId,
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          status: taskData.completed ? "completed" : "pending",
          due_date: taskData.dueDate,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating task:", error);
      return undefined;
    }
    return created ? mapDbTaskToTask(created) : undefined;
  },

  update: async (
    id: string,
    taskData: Partial<TaskFormData>
  ): Promise<Task | undefined> => {
    const { data: updated, error } = await supabase
      .from("tasks")
      .update({
        player_id: taskData.playerId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        status: taskData.completed === undefined ? undefined : taskData.completed ? "completed" : "pending",
        due_date: taskData.dueDate,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating task:", error);
      return undefined;
    }
    return updated ? mapDbTaskToTask(updated) : undefined;
  },

  toggleComplete: async (taskId: string): Promise<Task | undefined> => {
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", taskId)
      .single();

    if (fetchError) {
      console.error("Error fetching task to toggle:", fetchError);
      return undefined;
    }

    const newStatus = currentTask.status === "completed" ? "pending" : "completed";

    return taskService.update(taskId, { completed: newStatus === "completed" });
  },
  
  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      console.error("Error deleting task:", error);
      return false;
    }
    return true;
  },

  getTaskCountByPlayerId: async (playerId: string): Promise<{ total: number; pending: number }> => {
    const { data, error } = await supabase
      .from("tasks")
      .select("status", { count: "exact" })
      .eq("player_id", playerId);

    if (error) {
      console.error("Error fetching task count:", error);
      return { total: 0, pending: 0 };
    }
    
    const total = data?.length || 0;
    const pending = data?.filter((t) => t.status === "pending").length || 0;
    return { total, pending };
  },
};
