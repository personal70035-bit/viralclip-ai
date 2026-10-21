/*
# ViralClip AI — Full Database Schema

## Overview
Creates the complete schema for ViralClip AI, a multi-user app that turns long
YouTube videos into high-retention short clips. Each user can only access their
own projects, jobs, clips, transcripts, render settings, and error logs.

## New Tables
1. `users` — public profile mirror of auth.users (full name, avatar, plan, clip quota).
2. `projects` — a YouTube video the user wants to clip. One project per URL+user.
3. `jobs` — a processing job for a project. Tracks status, progress, settings.
4. `clips` — individual generated clips belonging to a job.
5. `transcripts` — transcript/subtitle data for a project.
6. `render_settings` — per-clip render settings (format, captions, crop, font).
7. `error_logs` — structured error log entries for diagnostics.

## Status Enums
- job_status: queued, fetching, analyzing, clipping, rendering, completed, failed
- clip_status: pending, ready, rendering, ready_to_download, failed

## Security
- RLS enabled on every table.
- All policies scoped TO authenticated with auth.uid() ownership checks.
- Owner columns default to auth.uid() so inserts omitting user_id still pass WITH CHECK.
- Child tables (jobs, clips, transcripts, render_settings) carry their own user_id
  column (defaulted) AND reference their parent with ON DELETE CASCADE.
*/

-- ===== Extensions =====
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== Enums =====
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('queued', 'fetching', 'analyzing', 'clipping', 'rendering', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE clip_status AS ENUM ('pending', 'ready', 'rendering', 'ready_to_download', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== users (profile) =====
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  plan text NOT NULL DEFAULT 'free',
  clips_remaining int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON users;
CREATE POLICY "select_own_profile" ON users FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON users;
CREATE POLICY "insert_own_profile" ON users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON users;
CREATE POLICY "update_own_profile" ON users FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ===== projects =====
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  youtube_url text NOT NULL,
  video_id text NOT NULL,
  video_title text,
  video_channel text,
  video_duration int,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_video_id ON projects(video_id);

DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects" ON projects FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===== jobs =====
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status job_status NOT NULL DEFAULT 'queued',
  progress int NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  worker_job_id text,
  error_message text,
  error_code text,
  clips_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

DROP POLICY IF EXISTS "select_own_jobs" ON jobs;
CREATE POLICY "select_own_jobs" ON jobs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_jobs" ON jobs;
CREATE POLICY "insert_own_jobs" ON jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_jobs" ON jobs;
CREATE POLICY "update_own_jobs" ON jobs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_jobs" ON jobs;
CREATE POLICY "delete_own_jobs" ON jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===== clips =====
CREATE TABLE IF NOT EXISTS clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time numeric NOT NULL,
  end_time numeric NOT NULL,
  duration numeric NOT NULL,
  score int NOT NULL DEFAULT 0,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  title text,
  hook_line text,
  caption_text text,
  hashtags text[] NOT NULL DEFAULT '{}',
  reason text,
  thumbnail_url text,
  video_url text,
  format text NOT NULL DEFAULT '9:16',
  status clip_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_clips_job_id ON clips(job_id);
CREATE INDEX IF NOT EXISTS idx_clips_user_id ON clips(user_id);
CREATE INDEX IF NOT EXISTS idx_clips_score ON clips(score DESC);

DROP POLICY IF EXISTS "select_own_clips" ON clips;
CREATE POLICY "select_own_clips" ON clips FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_clips" ON clips;
CREATE POLICY "insert_own_clips" ON clips FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_clips" ON clips;
CREATE POLICY "update_own_clips" ON clips FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_clips" ON clips;
CREATE POLICY "delete_own_clips" ON clips FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===== transcripts =====
CREATE TABLE IF NOT EXISTS transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en',
  source text NOT NULL DEFAULT 'youtube',
  available boolean NOT NULL DEFAULT true,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_transcripts_project_id ON transcripts(project_id);

DROP POLICY IF EXISTS "select_own_transcripts" ON transcripts;
CREATE POLICY "select_own_transcripts" ON transcripts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_transcripts" ON transcripts;
CREATE POLICY "insert_own_transcripts" ON transcripts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_transcripts" ON transcripts;
CREATE POLICY "update_own_transcripts" ON transcripts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_transcripts" ON transcripts;
CREATE POLICY "delete_own_transcripts" ON transcripts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===== render_settings =====
CREATE TABLE IF NOT EXISTS render_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT '9:16',
  caption_style text NOT NULL DEFAULT 'bold_auto',
  caption_font text NOT NULL DEFAULT 'Inter',
  caption_color text NOT NULL DEFAULT '#ffffff',
  caption_position text NOT NULL DEFAULT 'bottom',
  caption_animation text NOT NULL DEFAULT 'fade',
  caption_background boolean NOT NULL DEFAULT true,
  crop_focus text NOT NULL DEFAULT 'center',
  custom_start numeric,
  custom_end numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE render_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_render_settings_clip_id ON render_settings(clip_id);

DROP POLICY IF EXISTS "select_own_render_settings" ON render_settings;
CREATE POLICY "select_own_render_settings" ON render_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_render_settings" ON render_settings;
CREATE POLICY "insert_own_render_settings" ON render_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_render_settings" ON render_settings;
CREATE POLICY "update_own_render_settings" ON render_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_render_settings" ON render_settings;
CREATE POLICY "delete_own_render_settings" ON render_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===== error_logs =====
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  error_type text NOT NULL,
  error_code text,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);

DROP POLICY IF EXISTS "select_own_error_logs" ON error_logs;
CREATE POLICY "select_own_error_logs" ON error_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_error_logs" ON error_logs;
CREATE POLICY "insert_own_error_logs" ON error_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_error_logs" ON error_logs;
CREATE POLICY "update_own_error_logs" ON error_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_error_logs" ON error_logs;
CREATE POLICY "delete_own_error_logs" ON error_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===== updated_at trigger helper =====
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_render_settings_updated_at ON render_settings;
CREATE TRIGGER trg_render_settings_updated_at BEFORE UPDATE ON render_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== Auto-create profile on signup =====
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
