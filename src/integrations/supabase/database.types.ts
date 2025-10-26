export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      players: {
        Row: {
          id: string
          user_id: string | null
          username: string
          firstname: string | null
          lastname: string | null
          dob: string | null
          gender: string | null
          email: string | null
          phone_number: string | null
          casino: string | null
          vip_level: number
          total_deposits: number | null
          last_email_sent: string | null
          preferences: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          username: string
          firstname?: string | null
          lastname?: string | null
          dob?: string | null
          gender?: string | null
          email?: string | null
          phone_number?: string | null
          casino?: string | null
          vip_level?: number
          total_deposits?: number | null
          last_email_sent?: string | null
          preferences?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          username?: string
          firstname?: string | null
          lastname?: string | null
          dob?: string | null
          gender?: string | null
          email?: string | null
          phone_number?: string | null
          casino?: string | null
          vip_level?: number
          total_deposits?: number | null
          last_email_sent?: string | null
          preferences?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          player_id: string
          title: string
          description: string | null
          priority: string
          status: string
          due_date: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          player_id: string
          title: string
          description?: string | null
          priority?: string
          status?: string
          due_date?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          player_id?: string
          title?: string
          description?: string | null
          priority?: string
          status?: string
          due_date?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_player_id_fkey"
            columns: ["player_id"]
            referencedRelation: "players"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}