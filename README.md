# ViralClip AI

Turn long YouTube videos into viral-ready short clips. ViralClip AI analyzes transcripts, audio loudness, speech density, and scene changes to find the most high-retention moments — then crops, captions, and exports them automatically. No paid API keys required.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  React Frontend │────▶│  Supabase Edge   │────▶│  External Worker    │
│  (this repo)    │     │  Function Proxy  │     │  (yt-dlp + ffmpeg)  │
│                 │◀────│                  │◀────│                     │
└────────┬────────┘     └──────────────────┘     └─────────────────────┘
         │
         ▼
┌─────────────────┐
│   Supabase DB   │
│  (jobs, clips,  │
│   projects...)  │
└─────────────────┘
```

**The frontend never downloads YouTube videos directly.** All downloading and clipping is done by an external Node.js worker using `yt-dlp` and `ffmpeg`. The frontend collects user input and displays results.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Edge Functions, RLS)
- **Worker:** Node.js + yt-dlp + ffmpeg (external, separate deployment)
- **Icons:** lucide-react

## Database Schema

Seven tables with Row Level Security (each user sees only their own data):

| Table | Purpose |
|-------|---------|
| `users` | User profiles (mirrors auth.users) |
| `projects` | YouTube video projects (one per URL+user) |
| `jobs` | Processing jobs with status tracking |
| `clips` | Generated clips with scores and metadata |
| `transcripts` | Transcript/subtitle segments per project |
| `render_settings` | Per-clip render configuration |
| `error_logs` | Structured error diagnostics |

### Job Status Flow

```
queued → fetching → analyzing → clipping → rendering → completed
                    ↓                                ↓
                  failed ←───────────────────────── failed
```

## Local Setup

### 1. Frontend

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### 2. Environment Variables

The following are pre-populated by Bolt. For local development, create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Worker secrets** (set via Supabase dashboard → Edge Functions → Secrets):
```
WORKER_URL=https://your-worker.example.com
WORKER_API_KEY=your_shared_secret_key
```

### 3. Edge Function Deployment

The `worker-proxy` edge function is in `supabase/functions/worker-proxy/`. Deploy it via the Supabase MCP tools or Supabase dashboard.

## External Worker Setup

The worker is a separate Node.js application that does the heavy lifting. See [`worker/README.md`](./worker/README.md) for full setup instructions.

### Worker API

The worker must expose these endpoints:

#### `POST /api/jobs`
Creates a processing job.
```json
{
  "job_id": "uuid",
  "project_id": "uuid",
  "youtube_url": "https://youtube.com/watch?v=...",
  "settings": {
    "numClips": 5,
    "clipDuration": 30,
    "format": "9:16",
    "captionStyle": "bold_auto",
    "contentGoal": "general"
  },
  "supabase_url": "...",
  "supabase_key": "...",
  "user_id": "uuid"
}
```

#### `GET /api/jobs/:id`
Returns job status and clip results.
```json
{
  "status": "completed",
  "progress": 100,
  "clips": [...]
}
```

#### `POST /api/jobs/:id/retry`
Retries a failed job.

#### `GET /api/clips/:id/download`
Returns the rendered MP4 file as a binary stream.

### Authentication

All worker requests include `Authorization: Bearer <WORKER_API_KEY>`. The worker must validate this header on every request.

## High-Retention Scoring Engine

The scoring system uses no paid APIs. It analyzes:

1. **Hook strength** (first 3 seconds) — questions, bold statements, curiosity triggers
2. **Speech clarity & pace** — words per minute, absence of filler words
3. **Emotional language** — emotionally charged words and phrases
4. **Questions & contrasts** — rhetorical questions, "but" / "however" contrasts
5. **Actionable advice** — imperative verbs, "you should", "here's how"
6. **Topic coherence** — keyword consistency across the clip duration
7. **Natural sentence boundaries** — clips don't cut mid-sentence
8. **Filler/silence penalty** — deducts for "um", "uh", long pauses, intros, sponsor segments

Each factor is scored 0–100 and combined into a total retention score. The breakdown is shown to users so they understand why a clip was selected.

## Features

- YouTube URL validation and video ID extraction
- Configurable clip count (1–20), duration (15–60s or custom), format (9:16, 1:1, 16:9)
- Caption styles: bold auto-captions, burned-in captions, or none
- Content goals: educational, motivational, podcast, interview, tutorial, news, gaming, general
- Real-time job progress tracking with status steps
- Clip grid with filters (highest score, shortest, longest, most emotional, most educational)
- Clip editor with draggable start/end handles, crop focus, and caption customization
- Caption options: font, color, position, animation, background toggle
- Job history page with expandable job details
- Empty states, loading skeletons, validation messages, and error recovery
- Fully responsive for mobile and desktop
- Row Level Security on all tables

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid YouTube URL | Friendly validation message on input |
| Private/deleted/age-restricted video | Clear error explanation with retry option |
| No subtitles available | Continues with audio/scene analysis, warns about lower accuracy |
| Download blocked by YouTube | Retry option with note about updating yt-dlp or cookies |
| Rendering failure | Job retained, one-click retry |
| Worker timeout/unreachable | Job marked failed with explanatory message |

## Project Structure

```
src/
├── components/
│   ├── AppLayout.tsx         # Sidebar + mobile nav
│   └── ClipComponents.tsx    # ClipCard, filters, score breakdown
├── context/
│   └── AuthContext.tsx       # Supabase auth provider
├── lib/
│   ├── supabase.ts           # Supabase client singleton
│   └── youtube.ts            # URL validation, time formatting
├── pages/
│   ├── LandingPage.tsx       # Marketing landing page
│   ├── AuthPage.tsx          # Sign in / sign up
│   ├── DashboardPage.tsx     # URL input, settings, progress, results
│   ├── ClipEditorPage.tsx    # Drag handles, crop, caption settings
│   └── HistoryPage.tsx       # Job history with expandable clips
├── types/
│   └── database.ts           # TypeScript types for all tables
├── App.tsx                   # Router + auth provider
└── index.css                 # Theme + component classes

supabase/
├── config.toml               # Edge function config
└── functions/
    └── worker-proxy/
        └── index.ts          # Worker API proxy edge function
```

## Build

```bash
npm run build
```

## License

MIT
