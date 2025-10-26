/**
 * Supabase Configuration
 * This file contains hardcoded Supabase credentials as a workaround for .env.local persistence issues
 * In a production environment, these would be stored in environment variables
 */

export const supabaseConfig = {
  url: "https://vxghhiswchuhhdivwzyk.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4Z2hoaXN3Y2h1aGhkaXZ3enlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk5NzY1OTYsImV4cCI6MjA0NTU1MjU5Nn0.kJoY7Qn_8Kh8sZQMxYvX_x0LvzVF4xQ4YKmF6Jz0pQo"
} as const;
