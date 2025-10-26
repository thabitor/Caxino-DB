import { Player, PlayerFormData, VipLevel } from "@/types/player";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type DbPlayer = Database["public"]["Tables"]["players"]["Row"];

const mapDbPlayerToPlayer = (dbPlayer: DbPlayer): Player => {
  return {
    id: dbPlayer.id,
    userId: dbPlayer.user_id,
    username: dbPlayer.username,
    firstname: dbPlayer.firstname,
    lastname: dbPlayer.lastname,
    dob: dbPlayer.dob || "",
    gender: (dbPlayer.gender as Player["gender"]) || "Prefer not to say",
    email: dbPlayer.email,
    phone: dbPlayer.phone || "",
    casino: dbPlayer.casino || "",
    vipLevel: (dbPlayer.vip_level as VipLevel) || 1,
    totalDeposits: dbPlayer.total_deposits || 0,
    lastEmailSent: dbPlayer.last_email_sent || null,
    preferences: dbPlayer.preferences || "",
    notes: dbPlayer.notes || "",
    createdAt: dbPlayer.created_at,
    updatedAt: dbPlayer.updated_at,
  };
};

export const playerService = {
  getAll: async (): Promise<Player[]> => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching players:", error);
      return [];
    }
    return data.map(mapDbPlayerToPlayer);
  },

  getById: async (id: string): Promise<Player | undefined> => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching player:", error);
      return undefined;
    }
    return data ? mapDbPlayerToPlayer(data) : undefined;
  },

  create: async (playerData: PlayerFormData): Promise<Player | undefined> => {
    const { data: created, error } = await supabase
      .from("players")
      .insert([
        {
          user_id: playerData.userId,
          username: playerData.username,
          firstname: playerData.firstname,
          lastname: playerData.lastname,
          dob: playerData.dob,
          gender: playerData.gender,
          email: playerData.email,
          phone: playerData.phone,
          casino: playerData.casino,
          vip_level: playerData.vipLevel,
          total_deposits: playerData.totalDeposits,
          last_email_sent: playerData.lastEmailSent,
          preferences: playerData.preferences,
          notes: playerData.notes,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating player:", error);
      return undefined;
    }
    return created ? mapDbPlayerToPlayer(created) : undefined;
  },

  update: async (
    id: string,
    playerData: Partial<PlayerFormData>
  ): Promise<Player | undefined> => {
    const { data: updated, error } = await supabase
      .from("players")
      .update({
        user_id: playerData.userId,
        username: playerData.username,
        firstname: playerData.firstname,
        lastname: playerData.lastname,
        dob: playerData.dob,
        gender: playerData.gender,
        email: playerData.email,
        phone: playerData.phone,
        casino: playerData.casino,
        vip_level: playerData.vipLevel,
        total_deposits: playerData.totalDeposits,
        last_email_sent: playerData.lastEmailSent,
        preferences: playerData.preferences,
        notes: playerData.notes,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating player:", error);
      return undefined;
    }
    return updated ? mapDbPlayerToPlayer(updated) : undefined;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) {
      console.error("Error deleting player:", error);
      return false;
    }
    return true;
  },
};
