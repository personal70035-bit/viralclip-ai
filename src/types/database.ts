export type JobStatus = 'queued' | 'fetching' | 'analyzing' | 'clipping' | 'rendering' | 'completed' | 'failed';
export type ClipStatus = 'pending' | 'ready' | 'rendering' | 'ready_to_download' | 'failed';
export type ClipFormat = '9:16' | '1:1' | '16:9';
export type CaptionStyle = 'bold_auto' | 'no_captions' | 'burned_in';
export type ContentGoal = 'educational' | 'motivational' | 'podcast' | 'interview' | 'tutorial' | 'news' | 'gaming' | 'general';
export type ClipFilter = 'highest_score' | 'shortest' | 'longest' | 'most_emotional' | 'most_educational';

export interface ScoreBreakdown {
  hook_strength: number;
  speech_clarity: number;
  emotional_language: number;
  question_contrast: number;
  actionable_advice: number;
  topic_coherence: number;
  natural_boundaries: number;
  filler_penalty: number;
  total: number;
  reasoning: string[];
}

export interface JobSettings {
  numClips: number;
  clipDuration: number | 'custom';
  customStart?: number;
  customEnd?: number;
  format: ClipFormat;
  captionStyle: CaptionStyle;
  contentGoal: ContentGoal;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: string;
  clips_remaining: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  youtube_url: string;
  video_id: string;
  video_title: string | null;
  video_channel: string | null;
  video_duration: number | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  project_id: string;
  user_id: string;
  status: JobStatus;
  progress: number;
  settings: JobSettings;
  worker_job_id: string | null;
  error_message: string | null;
  error_code: string | null;
  clips_count: number;
  created_at: string;
  updated_at: string;
}

export interface Clip {
  id: string;
  job_id: string;
  user_id: string;
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  score_breakdown: ScoreBreakdown;
  title: string | null;
  hook_line: string | null;
  caption_text: string | null;
  hashtags: string[];
  reason: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  format: ClipFormat;
  status: ClipStatus;
  created_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  id: string;
  project_id: string;
  user_id: string;
  language: string;
  source: string;
  available: boolean;
  segments: TranscriptSegment[];
  created_at: string;
}

export interface RenderSettings {
  id: string;
  clip_id: string;
  user_id: string;
  format: ClipFormat;
  caption_style: CaptionStyle;
  caption_font: string;
  caption_color: string;
  caption_position: 'top' | 'center' | 'bottom';
  caption_animation: 'fade' | 'slide' | 'pop' | 'none';
  caption_background: boolean;
  crop_focus: 'center' | 'top' | 'bottom' | 'face' | 'left' | 'right';
  custom_start: number | null;
  custom_end: number | null;
  created_at: string;
  updated_at: string;
}

export interface ErrorLog {
  id: string;
  user_id: string;
  job_id: string | null;
  error_type: string;
  error_code: string | null;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}
