import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
export type TaskPriority = "low" | "medium" | "high";

export const taskService = {
  async getTasksForPlayer(playerId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`Error fetching tasks for player ${playerId}:`, error);
      throw error;
    }
    return data || [];
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

  async toggleTaskStatus(taskId: string): Promise<Task | undefined> {
    // First, fetch the current task to get its status
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", taskId)
      .single();

    if (fetchError || !currentTask) {
      console.error("Error fetching task to toggle:", fetchError);
      return undefined;
    }

    const newStatus = currentTask.status === "completed" ? "pending" : "completed";

    // Now, update the task with the new status
    return this.updateTask(taskId, { status: newStatus });
  },

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      console.error(`Error deleting task ${id}:`, error);
      throw error;
    }
  },

  async getActiveTaskCount(): Promise<number> {
    const { count, error } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .neq("status", "completed");

    if (error) {
      console.error("Error getting active task count:", error);
      return 0;
    }
    return count || 0;
  },
};
