import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PlayerTouchpoint = Database["public"]["Tables"]["player_touchpoints"]["Row"];
export type PlayerTouchpointInsert = Database["public"]["Tables"]["player_touchpoints"]["Insert"];

export const playerTouchpointService = {
  async getRecentTouchpoints(cutoffIso: string): Promise<PlayerTouchpoint[]> {
    const { data, error } = await supabase
      .from("player_touchpoints")
      .select("*")
      .gte("occurred_at", cutoffIso)
      .order("occurred_at", { ascending: false });

    if (error) {
      console.error("Error fetching recent player touchpoints:", error);
      throw error;
    }

    return data || [];
  },

  async getTouchpointsByPlayerId(playerId: string): Promise<PlayerTouchpoint[]> {
    const { data, error } = await supabase
      .from("player_touchpoints")
      .select("*")
      .eq("player_id", playerId)
      .order("occurred_at", { ascending: false });

    if (error) {
      console.error(`Error fetching touchpoints for player ${playerId}:`, error);
      throw error;
    }

    return data || [];
  },

  async createTouchpoint(touchpoint: PlayerTouchpointInsert): Promise<PlayerTouchpoint> {
    const { data, error } = await supabase
      .from("player_touchpoints")
      .insert([touchpoint])
      .select()
      .single();

    if (error) {
      console.error("Error creating player touchpoint:", error);
      throw error;
    }

    return data;
  },
};
