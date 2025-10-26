import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import * as z from "zod";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export const taskSchema = z.object({
  player_id: z.string().uuid("Invalid player ID"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  due_date: z.date().optional(),
});

export type TaskFormData = z.infer<typeof taskSchema>;

export const priorityConfig: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-gray-700 dark:text-gray-300", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
  medium: { label: "Medium", color: "text-blue-700 dark:text-blue-300", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  high: { label: "High", color: "text-orange-700 dark:text-orange-300", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  urgent: { label: "Urgent", color: "text-red-700 dark:text-red-300", bgColor: "bg-red-100 dark:bg-red-900/30" },
};

export const statusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pending", color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
  in_progress: { label: "In Progress", color: "text-blue-700 dark:text-blue-300", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  completed: { label: "Completed", color: "text-green-700 dark:text-green-300", bgColor: "bg-green-100 dark:bg-green-900/30" },
  cancelled: { label: "Cancelled", color: "text-gray-700 dark:text-gray-300", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
};

export const taskService = {
  async getTasksByPlayerId(playerId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("player_id", playerId)
      .order("priority", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error(`Error fetching tasks for player ${playerId}:`, error);
      throw error;
    }
    return data || [];
  },

  async getTaskById(id: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      console.error(`Error fetching task ${id}:`, error);
      throw error;
    }
    return data;
  },

  async createTask(taskData: TaskInsert): Promise<Task> {
    const { data, error } = await supabase
      .from("tasks")
      .insert([taskData])
      .select()
      .single();

    if (error) {
      console.error("Error creating task:", error);
      throw error;
    }
    return data;
  },

  async updateTask(id: string, taskData: TaskUpdate): Promise<Task> {
    const { data, error } = await supabase
      .from("tasks")
      .update(taskData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating task ${id}:`, error);
      throw error;
    }
    return data;
  },

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`Error deleting task ${id}:`, error);
      throw error;
    }
  },

  async getActiveTasks(): Promise<Task[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .in("status", ["pending", "in_progress"])
      .order("priority", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error fetching active tasks:", error);
      throw error;
    }
    return data || [];
  },

  async getActiveTaskCount(): Promise<number> {
    const { count, error } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"]);

    if (error) {
      console.error("Error getting active task count:", error);
      return 0;
    }
    return count || 0;
  },

  async completeTask(id: string): Promise<Task> {
    const { data, error } = await supabase
      .from("tasks")
      .update({ 
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error completing task ${id}:`, error);
      throw error;
    }
    return data;
  },
};
