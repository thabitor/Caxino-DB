import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ManualFollowUp = Database["public"]["Tables"]["manual_follow_ups"]["Row"];
export type ManualFollowUpInsert = Database["public"]["Tables"]["manual_follow_ups"]["Insert"];
export type ManualFollowUpUpdate = Database["public"]["Tables"]["manual_follow_ups"]["Update"];

export const manualFollowUpService = {
  async getActiveManualFollowUps(): Promise<ManualFollowUp[]> {
    const { data, error } = await supabase
      .from("manual_follow_ups")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching manual follow-ups:", error);
      throw error;
    }

    return data || [];
  },

  async createManualFollowUp(followUp: ManualFollowUpInsert): Promise<ManualFollowUp> {
    const { data, error } = await supabase
      .from("manual_follow_ups")
      .insert([followUp])
      .select()
      .single();

    if (error) {
      console.error("Error creating manual follow-up:", error);
      throw error;
    }

    return data;
  },

  async resolveManualFollowUp(id: string): Promise<ManualFollowUp> {
    const { data, error } = await supabase
      .from("manual_follow_ups")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error resolving manual follow-up ${id}:`, error);
      throw error;
    }

    return data;
  },
};
