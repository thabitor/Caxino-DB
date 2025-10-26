import { Player, PlayerFormData, VipLevel } from "@/types/player";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type PlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
type PlayerUpdate = Database["public"]["Tables"]["players"]["Update"];

const isVipLevelNumber = (v: unknown): v is VipLevel => {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
};

const normalizeVipLevel = (v: unknown): VipLevel => {
  if (isVipLevelNumber(v)) return v;
  return 1;
};

const mapDbPlayerToPlayer = (dbPlayer: any): Player => {
  return {
    id: dbPlayer.id,
    userId: dbPlayer.user_id,
    username: dbPlayer.username,
    firstname: dbPlayer.firstname,
    lastname: dbPlayer.lastname,
    dob: dbPlayer.dob,
    gender: dbPlayer.gender,
    email: dbPlayer.email,
    phone: dbPlayer.phone,
    casino: dbPlayer.casino,
    vipLevel: normalizeVipLevel(dbPlayer.vip_level),
    totalDeposits: dbPlayer.total_deposits,
    lastEmailSent: dbPlayer.last_email_sent,
    preferences: dbPlayer.preferences,
    notes: dbPlayer.notes,
    createdAt: dbPlayer.created_at,
    updatedAt: dbPlayer.updated_at,
  };
};

const mapPlayerToDbInsert = (data: PlayerFormData): PlayerInsert => {
  return {
    user_id: data.userId,
    username: data.username,
    firstname: data.firstname,
    lastname: data.lastname,
    dob: data.dob || null,
    gender: data.gender || null,
    email: data.email,
    phone: data.phone || null,
    casino: data.casino || null,
    vip_level: normalizeVipLevel(data.vipLevel),
    total_deposits: data.totalDeposits || 0,
    last_email_sent: data.lastEmailSent || null,
    preferences: data.preferences || null,
    notes: data.notes || null,
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

    return (data || []).map(mapDbPlayerToPlayer);
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

  create: async (data: PlayerFormData): Promise<Player | undefined> => {
    const insertData = mapPlayerToDbInsert(data);

    const { data: created, error } = await supabase
      .from("players")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Error creating player:", error);
      return undefined;
    }

    return created ? mapDbPlayerToPlayer(created) : undefined;
  },

  update: async (id: string, data: Partial<PlayerFormData>): Promise<Player | undefined> => {
    const updateData: PlayerUpdate = {};

    if (data.userId !== undefined) updateData.user_id = data.userId;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.firstname !== undefined) updateData.firstname = data.firstname;
    if (data.lastname !== undefined) updateData.lastname = data.lastname;
    if (data.dob !== undefined) updateData.dob = data.dob || null;
    if (data.gender !== undefined) updateData.gender = data.gender || null;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.casino !== undefined) updateData.casino = data.casino || null;
    if (data.vipLevel !== undefined) updateData.vip_level = normalizeVipLevel(data.vipLevel);
    if (data.totalDeposits !== undefined) updateData.total_deposits = data.totalDeposits;
    if (data.lastEmailSent !== undefined) updateData.last_email_sent = data.lastEmailSent || null;
    if (data.preferences !== undefined) updateData.preferences = data.preferences || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    const { data: updated, error } = await supabase
      .from("players")
      .update(updateData)
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
    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting player:", error);
      return false;
    }

    return true;
  },
};
