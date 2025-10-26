import { Task, TaskFormData, priorityOrder, TaskPriority } from "@/types/task";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

const mapDbTaskToTask = (dbTask: any): Task => {
  return {
    id: dbTask.id,
    playerId: dbTask.player_id,
    title: dbTask.title,
    description: dbTask.description || "",
    priority: dbTask.priority as TaskPriority,
    completed: dbTask.status === "completed",
    dueDate: dbTask.due_date,
    createdAt: dbTask.created_at,
    updatedAt: dbTask.updated_at,
  };
};

const mapTaskToDbInsert = (data: TaskFormData): TaskInsert => {
  return {
    player_id: data.playerId || null,
    title: data.title,
    description: data.description || null,
    priority: data.priority,
    status: data.completed ? "completed" : "pending",
    due_date: data.dueDate || null,
  };
};

export const taskService = {
  getAll: async (): Promise<Task[]> => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      return [];
    }

    return (data || []).map(mapDbTaskToTask);
  },

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

    const tasks = (data || []).map(mapDbTaskToTask);

    return tasks.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  },

  getById: async (id: string): Promise<Task | undefined> => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching task:", error);
      return undefined;
    }

    return data ? mapDbTaskToTask(data) : undefined;
  },

  create: async (data: TaskFormData): Promise<Task | undefined> => {
    const insertData = mapTaskToDbInsert(data);

    const { data: created, error } = await supabase
      .from("tasks")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error creating task:", error);
      return undefined;
    }

    return created ? mapDbTaskToTask(created) : undefined;
  },

  update: async (id: string, data: Partial<TaskFormData>): Promise<Task | undefined> => {
    const updateData: TaskUpdate = {};

    if (data.playerId !== undefined) updateData.player_id = data.playerId || null;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.completed !== undefined) updateData.status = data.completed ? "completed" : "pending";
    if (data.dueDate !== undefined) updateData.due_date = data.dueDate || null;

    const { data: updated, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating task:", error);
      return undefined;
    }

    return updated ? mapDbTaskToTask(updated) : undefined;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting task:", error);
      return false;
    }

    return true;
  },

  toggleComplete: async (id: string): Promise<Task | undefined> => {
    const task = await taskService.getById(id);
    if (!task) return undefined;
    return taskService.update(id, { completed: !task.completed });
  },

  getTaskCountByPlayerId: async (playerId: string): Promise<{ total: number; pending: number }> => {
    const { data, error } = await supabase
      .from("tasks")
      .select("status")
      .eq("player_id", playerId);

    if (error) {
      console.error("Error fetching task count:", error);
      return { total: 0, pending: 0 };
    }

    const total = data?.length || 0;
    const pending = data?.filter((t: any) => t.status === "pending").length || 0;

    return { total, pending };
  },
};
