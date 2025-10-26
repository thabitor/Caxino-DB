import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Define application-level types here
export type VipLevel = 1 | 2 | 3 | 4 | 5;

export interface Player {
  id: string;
  userId: string;
  username: string;
  firstname: string;
  lastname: string;
  dob: string;
  gender: "Male" | "Female" | "Other" | "Prefer not to say";
  email: string;
  phone: string;
  casino: string;
  vipLevel: VipLevel;
  totalDeposits: number;
  lastEmailSent: string | null;
  preferences: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PlayerFormData = Omit<Player, "id" | "createdAt" | "updatedAt">;

export const vipConfig: Record<VipLevel, { name: string; color: string; bgColor: string }> = {
    1: { name: "Bronze", color: "text-amber-800 dark:text-amber-300", bgColor: "bg-amber-100 dark:bg-amber-900" },
    2: { name: "Silver", color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-200 dark:bg-slate-700" },
    3: { name: "Gold", color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-100 dark:bg-yellow-900" },
    4: { name: "Platinum", color: "text-cyan-700 dark:text-cyan-300", bgColor: "bg-cyan-100 dark:bg-cyan-900" },
    5: { name: "Diamond", color: "text-indigo-700 dark:text-indigo-300", bgColor: "bg-indigo-100 dark:bg-indigo-900" },
};

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
