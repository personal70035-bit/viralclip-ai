# ViralClip AI Worker

External Node.js worker that processes YouTube videos using yt-dlp and ffmpeg. This is a separate service from the frontend.

## Prerequisites

- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and in PATH
- [ffmpeg](https://ffmpeg.org/) installed and in PATH

## Installation

```bash
npm install
cp .env.example .env
# Edit .env with your values
npm start
```

## Environment Variables

```env
# Worker server
PORT=3001
WORKER_API_KEY=your_shared_secret_key

# Supabase (for reading/writing job and clip data)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Processing
MAX_CONCURRENT_JOBS=3
DOWNLOAD_TIMEOUT=300000
RENDER_TIMEOUT=600000
```

## API Endpoints

### POST /api/jobs
Creates a processing job. The worker:
1. Downloads the YouTube video audio using `yt-dlp`
2. Fetches available subtitles/transcripts using `yt-dlp`
3. Runs the retention scoring engine on transcript + audio analysis
4. Cuts, resizes, and captions clips using `ffmpeg`
5. Updates job status and clip data in Supabase

### GET /api/jobs/:id
Returns current job status and progress.

### POST /api/jobs/:id/retry
Retries a failed job from the beginning.

### GET /api/clips/:id/download
Returns the rendered MP4 file.

## Processing Pipeline

```
1. Fetch video metadata (yt-dlp --dump-json)
2. Download audio (yt-dlp -f bestaudio)
3. Download subtitles (yt-dlp --write-sub --write-auto-sub)
4. Score all candidate windows (scoring engine)
5. Select top N clips
6. For each clip:
   a. Cut segment (ffmpeg -ss START -to END)
   b. Resize/crop to target format
   c. Burn in captions (ffmpeg subtitles filter)
   d. Export MP4
7. Update Supabase with clip data + thumbnails
```

## Retention Scoring Engine

The scoring engine (`scoring.js`) analyzes transcript segments and audio to score every possible 15–60 second window:

- **Hook strength**: First 3 seconds analyzed for questions, numbers, bold claims
- **Speech clarity**: Words per minute, filler word density
- **Emotional language**: Sentiment analysis on transcript text
- **Questions & contrasts**: Rhetorical patterns
- **Actionable advice**: Imperative phrases
- **Topic coherence**: Keyword overlap across window
- **Natural boundaries**: Sentence boundary detection prevents mid-sentence cuts
- **Filler/silence penalty**: Detects intros, outros, sponsor segments, silence

No external API keys are required. All analysis is done locally using the transcript text and audio loudness data.

## Security

- All requests must include `Authorization: Bearer <WORKER_API_KEY>`
- The worker uses the Supabase service role key to update job/clip status
- Worker API key should be rotated regularly
- Rate limiting recommended (e.g. express-rate-limit)
