import type { Player } from "@/types/player";
import type { Task } from "@/types/task";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Map camelCase app types to snake_case DB types
type CamelToSnake<T> = {
  [K in keyof T as K extends string ? CamelToSnakeCase<K> : K]: T[K];
};

type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Uppercase<T>
      ? `_${Lowercase<T>}`
      : T}${CamelToSnakeCase<U>}`
  : S;

// Base types from your application
type PlayerBase = Omit<Player, "id" | "createdAt" | "updatedAt">;
type TaskBase = Omit<Task, "id" | "createdAt" | "updatedAt" | "completed"> & { status: "pending" | "completed" };

// Supabase table definitions using your application's types
export interface Database {
  public: {
    Tables: {
      players: {
        Row: CamelToSnake<Player>;
        Insert: CamelToSnake<PlayerBase>;
        Update: Partial<CamelToSnake<PlayerBase>>;
      };
      tasks: {
        Row: CamelToSnake<Task> & { player_id: string };
        Insert: CamelToSnake<TaskBase> & { player_id: string };
        Update: Partial<CamelToSnake<TaskBase>> & { player_id?: string };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
