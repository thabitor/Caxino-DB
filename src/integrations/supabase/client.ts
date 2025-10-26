import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabaseConfig } from "@/config/supabase.config";

// Use config file credentials directly (bypasses .env.local persistence issues)
const supabaseUrl = supabaseConfig.url;
const supabaseAnonKey = supabaseConfig.anonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase configuration. Please check src/config/supabase.config.ts");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
