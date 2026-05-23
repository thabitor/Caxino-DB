
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CallLog = Database["public"]["Tables"]["call_logs"]["Row"];
export type CallLogInsert = Database["public"]["Tables"]["call_logs"]["Insert"];
export type CallLogUpdate = Database["public"]["Tables"]["call_logs"]["Update"];

export const callLogService = {
  async getAllCallLogs(): Promise<CallLog[]> {
    const { data, error } = await supabase
      .from("call_logs")
      .select("*")
      .order("completed_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error fetching call logs:", error);
      throw error;
    }
    return data || [];
  },

  async createCallLog(callData: CallLogInsert): Promise<CallLog> {
    const payload = {
      ...callData,
      completed_at: callData.completed_at || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("call_logs")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Error creating call log:", error);
      throw error;
    }
    return data;
  },

  async getCallLogsByPlayerId(playerId: string): Promise<CallLog[]> {
    const { data, error } = await supabase
      .from("call_logs")
      .select("*")
      .eq("player_id", playerId)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("call_time", { ascending: false });

    if (error) {
      console.error(`Error fetching call logs for player ${playerId}:`, error);
      throw error;
    }
    return data || [];
  },

  async getCallLogsByUserId(userId: string): Promise<CallLog[]> {
    const { data, error } = await supabase
      .from("call_logs")
      .select("*")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("call_time", { ascending: false });

    if (error) {
      console.error(`Error fetching call logs for user ${userId}:`, error);
      throw error;
    }
    return data || [];
  },

  async updateCallLog(id: string, updates: CallLogUpdate): Promise<CallLog> {
    const { data, error } = await supabase
      .from("call_logs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating call log ${id}:`, error);
      throw error;
    }
    return data;
  },

  async deleteCallLog(id: string): Promise<void> {
    const { error } = await supabase
      .from("call_logs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`Error deleting call log ${id}:`, error);
      throw error;
    }
  },

  async getRecentCallLogs(limit: number = 10): Promise<CallLog[]> {
    const { data, error } = await supabase
      .from("call_logs")
      .select("*")
      .order("completed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent call logs:", error);
      throw error;
    }
    return data || [];
  },
};
