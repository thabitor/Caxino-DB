# Supabase Database Setup Instructions

## Step 1: Run the SQL Migration

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **ccd972dd-2033-400a-bfb4-4562f0419650**
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the contents of `supabase/migrations/001_create_players_and_tasks.sql`
6. Paste into the SQL Editor
7. Click **Run** or press `Ctrl+Enter`

## Step 2: Verify Tables Created

1. Click on **Table Editor** in the left sidebar
2. You should see two new tables:
   - `players` (with 17 columns)
   - `tasks` (with 8 columns)

## Step 3: Update Supabase API Key

Your current API key appears to be invalid. Update it:

1. In Supabase Dashboard, go to **Project Settings** (gear icon)
2. Click **API** in the left menu
3. Copy the **anon/public** key
4. In Softgen, click the **Settings** icon (top right)
5. Go to **Environment** tab
6. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the copied key
7. Save changes

## Step 4: Test Connection

After completing the above steps, I'll update the code to use Supabase instead of localStorage.

## Database Schema Overview

### Players Table
- `id` (UUID, Primary Key)
- `user_id` (Text, Unique) - Custom player ID
- `username` (Text, Unique)
- `firstname` (Text)
- `lastname` (Text)
- `dob` (Date)
- `gender` (Text)
- `email` (Text, Unique)
- `phone` (Text)
- `casino` (Text)
- `vip_level` (Integer, 1-5)
- `total_deposits` (Decimal)
- `last_email_sent` (Timestamp)
- `preferences` (Text)
- `notes` (Text)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Tasks Table
- `id` (UUID, Primary Key)
- `player_id` (UUID, Foreign Key to players)
- `title` (Text)
- `description` (Text)
- `priority` (Text: low/medium/high/urgent)
- `status` (Text: pending/completed)
- `due_date` (Timestamp)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

## Security Features

- **Row Level Security (RLS)** enabled on both tables
- Authenticated users have full access
- Public read access enabled (you can adjust policies as needed)
- Automatic `updated_at` timestamp updates
- Indexes for optimal query performance
