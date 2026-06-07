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

export type VipLevel = 1 | 2 | 3 | 4 | 5;

export const playerSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  email: z.string().email("Invalid email address").or(z.literal("")).optional(),
  phone: z.string().optional(),
  dob: z.date().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  casino: z.string().optional(),
  contact_email_only: z.boolean().optional(),
  telegram_member: z.boolean().optional(),
  vip_level: z.coerce.number().min(1).max(5) as z.ZodType<VipLevel>,
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
  1: { name: "Bronze", color: "text-orange-700 dark:text-orange-300", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  2: { name: "Silver", color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-100 dark:bg-slate-800/60" },
  3: { name: "Gold", color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
  4: { name: "Platinum", color: "text-cyan-700 dark:text-cyan-300", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
  5: { name: "Diamond", color: "text-indigo-700 dark:text-indigo-300", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
};

export const getFullName = (player: { firstname: string | null; lastname: string | null }): string => {
  return `${player.firstname || ""} ${player.lastname || ""}`.trim() || "Unknown";
};

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === "string" && value.trim() === "");
}

function cleanIncomingPlayer(playerData: Partial<PlayerInsert>): Partial<PlayerInsert> {
  return Object.fromEntries(
    Object.entries(playerData).filter(([, value]) => isPresent(value))
  ) as Partial<PlayerInsert>;
}

function getImportErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [maybeError.message, maybeError.details, maybeError.hint, maybeError.code]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);

    if (parts.length > 0) return parts.join(" ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

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
      const activeTasks = tasks.filter((task: any) =>
        task.status !== "completed" && task.status !== "cancelled"
      );
      const taskCount = activeTasks.filter((task: any) => !task.is_call).length;
      const callCount = activeTasks.filter((task: any) => task.is_call === true).length;
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
    const distribution: Record<VipLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const { data, error } = await supabase
      .from("players")
      .select("vip_level");

    if (error) {
      console.error("Error getting VIP level distribution:", error);
      return distribution;
    }

    data?.forEach((player) => {
      const level = player.vip_level as VipLevel;
      if (level >= 1 && level <= 5) {
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

  const { data: existingPlayers, error: existingError } = await supabase
    .from("players")
    .select("*");

  if (existingError) {
    console.error("Error fetching existing players before merge:", existingError);
    throw existingError;
  }

  const byUserId = new Map((existingPlayers || []).map((player) => [player.user_id, player]));
  const byUsername = new Map((existingPlayers || []).map((player) => [player.username.toLowerCase(), player]));

  for (let i = 0; i < players.length; i++) {
    try {
      const playerData = cleanIncomingPlayer(players[i]);

      if (!Object.values(playerData).some(isPresent)) {
        continue;
      }

      const userIdMatch = playerData.user_id ? byUserId.get(playerData.user_id) : undefined;
      const usernameMatch = playerData.username ? byUsername.get(playerData.username.toLowerCase()) : undefined;

      if (userIdMatch && usernameMatch && userIdMatch.id !== usernameMatch.id) {
        throw new Error(`User ID matches @${userIdMatch.username}, but username matches user ID ${usernameMatch.user_id}. Resolve this identity conflict before import.`);
      }

      const existingPlayer = userIdMatch || usernameMatch;

      if (existingPlayer) {
        const updates = { ...playerData } as PlayerUpdate;
        delete updates.id;
        const updatedPlayer = await playerService.updatePlayer(existingPlayer.id, updates);
        byUserId.set(updatedPlayer.user_id, updatedPlayer);
        byUsername.set(updatedPlayer.username.toLowerCase(), updatedPlayer);
      } else {
        if (!playerData.user_id || !playerData.username) {
          throw new Error("New players require both user_id and username.");
        }

        const createdPlayer = await playerService.createPlayer(playerData as PlayerInsert);
        byUserId.set(createdPlayer.user_id, createdPlayer);
        byUsername.set(createdPlayer.username.toLowerCase(), createdPlayer);
      }

      results.success++;
    } catch (error) {
      results.failed++;
      const errorMessage = getImportErrorMessage(error);
      results.errors.push(`Row ${i + 1}: ${errorMessage}`);
    }
  }

  return results;
}
