import { subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface FollowUpViewedPlayer {
  id: string;
  player_id: string;
  manager_id: string | null;
  last_viewed_at: string;
  created_at: string;
  updated_at: string;
}

const TABLE_NAME = "follow_up_viewed_players";

export const followUpViewedService = {
  async cleanupExpired(): Promise<void> {
    const cutoff = subMonths(new Date(), 1).toISOString();
    const { error } = await (supabase as any)
      .from(TABLE_NAME)
      .delete()
      .lt("last_viewed_at", cutoff);

    if (error) {
      console.error("Error cleaning expired follow-up viewed players:", error);
      throw error;
    }
  },

  async getRecentViewedPlayers(managerId?: string | null): Promise<FollowUpViewedPlayer[]> {
    await this.cleanupExpired();

    let query = (supabase as any)
      .from(TABLE_NAME)
      .select("*")
      .gte("last_viewed_at", subMonths(new Date(), 1).toISOString())
      .order("last_viewed_at", { ascending: false });

    query = managerId ? query.eq("manager_id", managerId) : query.is("manager_id", null);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching follow-up viewed players:", error);
      throw error;
    }

    return data || [];
  },

  async getViewedPlayer(playerId: string, managerId?: string | null): Promise<FollowUpViewedPlayer | null> {
    await this.cleanupExpired();

    let query = (supabase as any)
      .from(TABLE_NAME)
      .select("*")
      .eq("player_id", playerId)
      .gte("last_viewed_at", subMonths(new Date(), 1).toISOString())
      .limit(1);

    query = managerId ? query.eq("manager_id", managerId) : query.is("manager_id", null);

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching follow-up viewed player ${playerId}:`, error);
      throw error;
    }

    return data?.[0] || null;
  },

  async markViewed(playerId: string, managerId?: string | null): Promise<FollowUpViewedPlayer> {
    await this.cleanupExpired();

    const payload = {
      player_id: playerId,
      manager_id: managerId || null,
      last_viewed_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase as any)
      .from(TABLE_NAME)
      .upsert(payload, { onConflict: "player_id,manager_id" })
      .select()
      .single();

    if (error) {
      console.error(`Error marking follow-up viewed for player ${playerId}:`, error);
      throw error;
    }

    return data;
  },
};
