import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Player = Database["public"]["Tables"]["players"]["Row"];
export type PlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
export type PlayerUpdate = Database["public"]["Tables"]["players"]["Update"];

export type VipLevel = 1 | 2 | 3 | 4 | 5;

export interface PlayerWithTasks extends Player {
  tasks: { count: number }[];
}

export type PlayerFormData = Omit<Player, "id" | "created_at" | "last_email_sent">;

export const vipTierName: Record<VipLevel, string> = {
  1: "Bronze",
  2: "Silver",
  3: "Gold",
  4: "Platinum",
  5: "Diamond",
};

export const vipConfig: Record<VipLevel, { name: string; color: string; bgColor: string }> = {
    1: { name: "Bronze", color: "text-amber-700 dark:text-amber-300", bgColor: "bg-amber-100 dark:bg-amber-900" },
    2: { name: "Silver", color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-100 dark:bg-slate-900" },
    3: { name: "Gold", color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-100 dark:bg-yellow-900" },
    4: { name: "Platinum", color: "text-cyan-700 dark:text-cyan-300", bgColor: "bg-cyan-100 dark:bg-cyan-900" },
    5: { name: "Diamond", color: "text-indigo-700 dark:text-indigo-300", bgColor: "bg-indigo-100 dark:bg-indigo-900" },
};

export const getFullName = (player: { firstname: string; lastname: string }): string => {
  return `${player.firstname} ${player.lastname}`.trim();
};


export const playerService = {
  async getPlayers(): Promise<PlayerWithTasks[]> {
    const { data, error } = await supabase
      .from("players")
      .select("*, tasks(count)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching players:", error);
      throw error;
    }
    return data || [];
  },

  async getPlayerById(id: string): Promise<Player | null> {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(`Error fetching player with id ${id}:`, error);
      // Don't throw for 404s, just return null
      if (error.code === "PGRST116") {
        return null;
      }
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
    // Make sure last_email_sent is either a valid ISO string or null
    if (playerData.last_email_sent && !isNaN(new Date(playerData.last_email_sent).getTime())) {
        playerData.last_email_sent = new Date(playerData.last_email_sent).toISOString();
    } else {
        // If it's invalid, don't send it. Supabase might reject it.
        // Or set to null if that's the desired behavior for empty/invalid dates.
        delete playerData.last_email_sent;
    }

    const { data, error } = await supabase
      .from("players")
      .update(playerData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating player with id ${id}:`, error);
      throw error;
    }
    return data;
  },

  async deletePlayer(id: string): Promise<void> {
    const { error } = await supabase.from("players").delete().eq("id", id);

    if (error) {
      console.error(`Error deleting player with id ${id}:`, error);
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
      .gt("vip_level", 0);

    if (error) {
      console.error("Error getting VIP player count:", error);
      return 0;
    }
    return count || 0;
  },
};
