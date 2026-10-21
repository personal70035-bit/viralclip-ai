import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Youtube, Sparkles, Loader2, AlertCircle, Film, Clock, Captions, Target, Monitor, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isValidYouTubeUrl, extractVideoId, getThumbnailUrl, formatDuration } from '@/lib/youtube';
import type { Job, JobSettings, ClipFormat, CaptionStyle, ContentGoal, Clip } from '@/types/database';
import { ClipCard, ClipFilters } from '@/components/ClipComponents';

type View = 'form' | 'processing' | 'results';

const formatOptions: { value: ClipFormat; label: string; desc: string }[] = [
  { value: '9:16', label: 'Vertical', desc: 'TikTok, Reels, Shorts' },
  { value: '1:1', label: 'Square', desc: 'Instagram feed' },
  { value: '16:9', label: 'Horizontal', desc: 'YouTube, Twitter' },
];

const captionOptions: { value: CaptionStyle; label: string }[] = [
  { value: 'bold_auto', label: 'Bold auto-captions' },
  { value: 'burned_in', label: 'Burned-in captions' },
  { value: 'no_captions', label: 'No captions' },
];

const goalOptions: ContentGoal[] = ['educational', 'motivational', 'podcast', 'interview', 'tutorial', 'news', 'gaming', 'general'];

const durationOptions = [15, 30, 45, 60];

const statusLabels: Record<string, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'var(--text-muted)' },
  fetching: { label: 'Fetching video', color: 'var(--accent)' },
  analyzing: { label: 'Analyzing content', color: 'var(--accent)' },
  clipping: { label: 'Cutting clips', color: 'var(--warning)' },
  rendering: { label: 'Rendering', color: 'var(--primary)' },
  completed: { label: 'Completed', color: 'var(--success)' },
  failed: { label: 'Failed', color: 'var(--error)' },
};

export function DashboardPage() {
  const [view, setView] = useState<View>('form');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [settings, setSettings] = useState<JobSettings>({
    numClips: 5,
    clipDuration: 30,
    format: '9:16',
    captionStyle: 'bold_auto',
    contentGoal: 'general',
  });
  const [job, setJob] = useState<Job | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [filter, setFilter] = useState<'highest_score' | 'shortest' | 'longest' | 'most_emotional' | 'most_educational'>('highest_score');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateUrl(value: string) {
    if (!value.trim()) {
      setUrlError(null);
      setVideoId(null);
      return;
    }
    const id = extractVideoId(value);
    if (id) {
      setUrlError(null);
      setVideoId(id);
    } else {
      setUrlError('Please enter a valid YouTube URL (youtube.com/watch, youtu.be, or shorts)');
      setVideoId(null);
    }
  }

  const pollJob = useCallback(async (jobId: string) => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    if (error || !data) return;
    const currentJob = data as Job;
    setJob(currentJob);
    if (currentJob.status === 'completed') {
      const { data: clipData } = await supabase
        .from('clips')
        .select('*')
        .eq('job_id', jobId)
        .order('score', { ascending: false });
      if (clipData) setClips(clipData as Clip[]);
      setView('results');
    } else if (currentJob.status === 'failed') {
      setView('results');
    }
  }, []);

  useEffect(() => {
    if (view !== 'processing' || !job) return;
    const interval = setInterval(() => pollJob(job.id), 3000);
    return () => clearInterval(interval);
  }, [view, job, pollJob]);

  async function handleSubmit() {
    if (!videoId) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          youtube_url: url,
          video_id: videoId,
          thumbnail_url: getThumbnailUrl(videoId, 'hq'),
        })
        .select()
        .single();

      if (projectError || !project) throw new Error('Failed to create project');
      const projectId = (project as { id: string }).id;

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          project_id: projectId,
          status: 'queued',
          progress: 0,
          settings: settings,
        })
        .select()
        .single();

      if (jobError || !jobData) throw new Error('Failed to create job');
      setJob(jobData as Job);
      setView('processing');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetry() {
    if (!job) return;
    await supabase
      .from('jobs')
      .update({ status: 'queued', progress: 0, error_message: null, error_code: null })
      .eq('id', job.id);
    setJob({ ...job, status: 'queued', progress: 0, error_message: null, error_code: null });
    setView('processing');
  }

  function handleNewClips() {
    setView('form');
    setUrl('');
    setVideoId(null);
    setJob(null);
    setClips([]);
  }

  const sortedClips = [...clips].sort((a, b) => {
    switch (filter) {
      case 'highest_score': return b.score - a.score;
      case 'shortest': return a.duration - b.duration;
      case 'longest': return b.duration - a.duration;
      case 'most_emotional': return (b.score_breakdown.emotional_language) - (a.score_breakdown.emotional_language);
      case 'most_educational': return (b.score_breakdown.actionable_advice) - (a.score_breakdown.actionable_advice);
      default: return b.score - a.score;
    }
  });

  if (view === 'processing') {
    return <ProcessingView job={job} onRetry={handleRetry} />;
  }

  if (view === 'results' && job) {
    return (
      <ResultsView
        job={job}
        clips={sortedClips}
        filter={filter}
        onFilterChange={setFilter}
        onNewClips={handleNewClips}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Create viral clips</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Paste a YouTube URL and configure your clip settings below.
        </p>
      </div>

      {/* URL Input */}
      <div className="card mb-6">
        <label className="block text-sm font-medium mb-2">YouTube video URL</label>
        <div className="relative">
          <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-dim)' }} />
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); validateUrl(e.target.value); }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input-field pl-11"
          />
        </div>
        {urlError && (
          <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: 'var(--error)' }}>
            <AlertCircle className="w-4 h-4" />
            {urlError}
          </div>
        )}
        {videoId && (
          <div className="mt-4 flex items-center gap-4 animate-fade-in">
            <img src={getThumbnailUrl(videoId, 'mq')} alt="Thumbnail" className="w-24 h-14 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Video detected</p>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>ID: {videoId}</p>
            </div>
            <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}>
              <Sparkles className="w-3 h-3" />
              Ready
            </span>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Clip settings</h2>
        <div className="space-y-6">
          {/* Number of clips */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <label className="text-sm font-medium">Number of clips</label>
              <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{settings.numClips}</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={settings.numClips}
              onChange={(e) => setSettings({ ...settings, numClips: parseInt(e.target.value) })}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          {/* Duration */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <label className="text-sm font-medium">Clip duration</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {durationOptions.map((d) => (
                <button
                  key={d}
                  onClick={() => setSettings({ ...settings, clipDuration: d })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${settings.clipDuration === d ? 'text-white' : ''}`}
                  style={settings.clipDuration === d
                    ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
                    : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <label className="text-sm font-medium">Output format</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSettings({ ...settings, format: opt.value })}
                  className={`p-3 rounded-lg text-center transition-all ${settings.format === opt.value ? 'text-white' : ''}`}
                  style={settings.format === opt.value
                    ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
                    : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xs mt-0.5 opacity-80">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Captions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Captions className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <label className="text-sm font-medium">Caption style</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {captionOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSettings({ ...settings, captionStyle: opt.value })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${settings.captionStyle === opt.value ? 'text-white' : ''}`}
                  style={settings.captionStyle === opt.value
                    ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
                    : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content goal */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <label className="text-sm font-medium">Content goal</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {goalOptions.map((goal) => (
                <button
                  key={goal}
                  onClick={() => setSettings({ ...settings, contentGoal: goal })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${settings.contentGoal === goal ? 'text-white' : ''}`}
                  style={settings.contentGoal === goal
                    ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
                    : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      {submitError && (
        <div className="card mb-4 flex items-start gap-3" style={{ borderColor: 'var(--error)' }}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--error)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>Failed to start job</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{submitError}</p>
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!videoId || submitting}
        className="btn-primary w-full text-base py-3.5"
      >
        {submitting ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Creating job...</>
        ) : (
          <><Sparkles className="w-5 h-5" /> Generate High-Retention Clips</>
        )}
      </button>

      {!videoId && (
        <p className="text-center text-sm mt-3" style={{ color: 'var(--text-dim)' }}>
          Paste a valid YouTube URL to continue
        </p>
      )}
    </div>
  );
}

function ProcessingView({ job, onRetry }: { job: Job | null; onRetry: () => void }) {
  const status = job?.status ?? 'queued';
  const statusInfo = statusLabels[status];
  const progress = job?.progress ?? 0;

  const steps = ['queued', 'fetching', 'analyzing', 'clipping', 'rendering', 'completed'];
  const currentStepIndex = steps.indexOf(status);

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 animate-pulse-slow" style={{ background: 'rgba(249,115,22,0.1)' }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
        <h1 className="text-2xl font-bold">{statusInfo.label}...</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          This usually takes 2–5 minutes. You can leave this page and check back later.
        </p>
      </div>

      <div className="card mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{progress}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--primary)' }} />
        </div>
      </div>

      {/* Steps */}
      <div className="card">
        <div className="space-y-3">
          {steps.slice(0, -1).map((step, i) => {
            const done = i < currentStepIndex;
            const active = i === currentStepIndex;
            const info = statusLabels[step];
            return (
              <div key={step} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{
                  background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--bg)',
                  color: done || active ? 'white' : 'var(--text-dim)',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <span className="text-sm" style={{ color: done || active ? 'var(--text)' : 'var(--text-dim)' }}>
                  {info.label}
                </span>
                {active && <Loader2 className="w-4 h-4 animate-spin ml-auto" style={{ color: 'var(--primary)' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {status === 'failed' && (
        <div className="card mt-6" style={{ borderColor: 'var(--error)' }}>
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--error)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>Processing failed</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {job?.error_message || 'An unexpected error occurred. You can retry the job.'}
              </p>
            </div>
          </div>
          <button onClick={onRetry} className="btn-primary w-full">
            <Sparkles className="w-4 h-4" /> Retry job
          </button>
        </div>
      )}

      <div className="text-center mt-6">
        <Link to="/app/history" className="btn-ghost text-sm">View job history</Link>
      </div>
    </div>
  );
}

function ResultsView({
  job, clips, filter, onFilterChange, onNewClips, onRetry,
}: {
  job: Job;
  clips: Clip[];
  filter: 'highest_score' | 'shortest' | 'longest' | 'most_emotional' | 'most_educational';
  onFilterChange: (f: 'highest_score' | 'shortest' | 'longest' | 'most_emotional' | 'most_educational') => void;
  onNewClips: () => void;
  onRetry: () => void;
}) {
  if (job.status === 'failed') {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--error)' }} />
          <h2 className="text-xl font-bold mb-2">Job failed</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {job.error_message || 'Something went wrong during processing.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={onRetry} className="btn-primary">
              <Sparkles className="w-4 h-4" /> Retry
            </button>
            <button onClick={onNewClips} className="btn-secondary">
              Start new
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="card text-center py-12">
          <Film className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-dim)' }} />
          <h2 className="text-xl font-bold mb-2">No clips generated</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            The worker completed but didn't produce any clips. This can happen if the video is too short or has no usable audio.
          </p>
          <button onClick={onNewClips} className="btn-primary">Try another video</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your clips</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {clips.length} clips generated. Click any clip to edit.
          </p>
        </div>
        <button onClick={onNewClips} className="btn-secondary text-sm">
          <Sparkles className="w-4 h-4" /> New clips
        </button>
      </div>

      <div className="mb-6">
        <ClipFilters active={filter} onChange={onFilterChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} onOpen={() => {
            window.location.hash = `#clip-${clip.id}`;
          }} />
        ))}
      </div>
    </div>
  );
}
