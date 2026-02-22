import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/database.types";
import * as z from "zod";

export type Player = Database["public"]["Tables"]["players"]["Row"];
export type PlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
export type PlayerUpdate = Database["public"]["Tables"]["players"]["Update"];
export type PlayerWithTasks = Player & { 
  tasks: { count: number; call_count: number }[];
  earliest_task_due_date?: string | null;
};

export type VipLevel = 3 | 4 | 5;

export const playerSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  firstname: z.string().min(1, "First name is required"),
  lastname: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  dob: z.date().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  casino: z.string().optional(),
  vip_level: z.coerce.number().min(3).max(5) as z.ZodType<VipLevel>,
  last_email_sent: z.date().optional(),
  preferences: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, { message: "Invalid JSON format" }),
  notes: z.string().optional(),
});

export type PlayerFormData = z.infer<typeof playerSchema>;

export const vipConfig: Record<VipLevel, { name: string; color: string; bgColor: string }> = {
  3: { name: "Gold", color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
  4: { name: "Platinum", color: "text-cyan-700 dark:text-cyan-300", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
  5: { name: "Diamond", color: "text-indigo-700 dark:text-indigo-300", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
};

export const getFullName = (player: { firstname: string | null; lastname: string | null }): string => {
  return `${player.firstname || ""} ${player.lastname || ""}`.trim() || "Unknown";
};

export const playerService = {
  async getPlayers(): Promise<PlayerWithTasks[]> {
    const { data, error } = await supabase
      .from("players")
      .select(`
        *,
        tasks!tasks_player_id_fkey(
          id,
          is_call,
          due_date,
          status
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching players:", error);
      throw error;
    }

    const playersWithCounts = (data || []).map((player: any) => {
      const tasks = player.tasks || [];
      
      // Filter only active tasks (not completed or cancelled)
      const activeTasks = tasks.filter((task: any) => 
        task.status !== "completed" && task.status !== "cancelled"
      );
      
      // Count normal tasks (is_call is false or null)
      const taskCount = activeTasks.filter((task: any) => !task.is_call).length;
      
      // Count call tasks (is_call is true)
      const callCount = activeTasks.filter((task: any) => task.is_call === true).length;

      // Find earliest due date among active tasks
      const tasksWithDates = activeTasks.filter((task: any) => task.due_date);
      const earliestDueDate = tasksWithDates.length > 0
        ? tasksWithDates.reduce((earliest: any, task: any) => {
            const taskDate = new Date(task.due_date);
            const earliestDate = new Date(earliest.due_date);
            return taskDate < earliestDate ? task : earliest;
          }).due_date
        : null;

      return {
        ...player,
        tasks: [{ count: taskCount, call_count: callCount }],
        earliest_task_due_date: earliestDueDate,
      };
    });

    return playersWithCounts as PlayerWithTasks[];
  },

  async getPlayerById(id: string): Promise<Player | null> {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      console.error(`Error fetching player ${id}:`, error);
      throw error;
    }
    return data;
  },

  async createPlayer(playerData: PlayerInsert): Promise<Player> {
    const { data, error } = await supabase
      .from("players")
      .insert([playerData])
      .select()
      .single();

    if (error) {
      console.error("Error creating player:", error);
      throw error;
    }
    return data;
  },

  async updatePlayer(id: string, playerData: PlayerUpdate): Promise<Player> {
    console.log("=== PLAYER SERVICE UPDATE ===");
    console.log("Player ID:", id);
    console.log("Update data being sent to Supabase:", JSON.stringify(playerData, null, 2));
    console.log("preferred_time_from in update:", playerData.preferred_time_from, "Type:", typeof playerData.preferred_time_from);
    console.log("preferred_time_to in update:", playerData.preferred_time_to, "Type:", typeof playerData.preferred_time_to);
    
    const { data, error } = await supabase
      .from("players")
      .update(playerData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating player ${id}:`, error);
      throw error;
    }
    
    console.log("=== PLAYER SERVICE UPDATE RESPONSE ===");
    console.log("Returned player data:", JSON.stringify(data, null, 2));
    console.log("preferred_time_from in response:", data.preferred_time_from, "Type:", typeof data.preferred_time_from);
    console.log("preferred_time_to in response:", data.preferred_time_to, "Type:", typeof data.preferred_time_to);
    
    return data;
  },

  async deletePlayer(id: string): Promise<void> {
    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`Error deleting player ${id}:`, error);
      throw error;
    }
  },

  async getTotalPlayerCount(): Promise<number> {
    const { count, error } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Error getting total player count:", error);
      return 0;
    }
    return count || 0;
  },

  async getVipPlayerCount(): Promise<number> {
    const { count, error } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .gte("vip_level", 1);

    if (error) {
      console.error("Error getting VIP player count:", error);
      return 0;
    }
    return count || 0;
  },

  async getVipLevelDistribution(): Promise<Record<VipLevel, number>> {
    const distribution: Record<VipLevel, number> = { 3: 0, 4: 0, 5: 0 };
    
    const { data, error } = await supabase
      .from("players")
      .select("vip_level");

    if (error) {
      console.error("Error getting VIP level distribution:", error);
      return distribution;
    }

    data?.forEach((player) => {
      const level = player.vip_level as VipLevel;
      if (level >= 3 && level <= 5) {
        distribution[level]++;
      }
    });

    return distribution;
  },

  async getPlayersByVipLevel(vipLevel: VipLevel): Promise<Player[]> {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("vip_level", vipLevel)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`Error fetching VIP level ${vipLevel} players:`, error);
      throw error;
    }
    return data || [];
  },
};

export async function bulkCreatePlayers(
  players: Partial<PlayerInsert>[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < players.length; i++) {
    try {
      const playerData = players[i];
      
      // Skip empty rows (check for firstname/lastname instead of name)
      if (!playerData.firstname && !playerData.lastname && !playerData.phone && !playerData.email) {
        continue;
      }

      await playerService.createPlayer(playerData as PlayerInsert);
      results.success++;
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`Row ${i + 1}: ${errorMessage}`);
    }
  }

  return results;
}
