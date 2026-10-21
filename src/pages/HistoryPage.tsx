import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { History as HistoryIcon, Loader2, Film, Sparkles, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getThumbnailUrl, formatDuration } from '@/lib/youtube';
import type { Job, Project, Clip } from '@/types/database';

interface JobWithProject extends Job {
  projects: Project | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'var(--text-muted)' },
  fetching: { label: 'Fetching', color: 'var(--accent)' },
  analyzing: { label: 'Analyzing', color: 'var(--accent)' },
  clipping: { label: 'Clipping', color: 'var(--warning)' },
  rendering: { label: 'Rendering', color: 'var(--primary)' },
  completed: { label: 'Completed', color: 'var(--success)' },
  failed: { label: 'Failed', color: 'var(--error)' },
};

export function HistoryPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [jobClips, setJobClips] = useState<Record<string, Clip[]>>({});
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('*, projects(*)')
        .order('created_at', { ascending: false });
      if (error) {
        setError('Failed to load job history.');
        setLoading(false);
        return;
      }
      setJobs((data ?? []) as unknown as JobWithProject[]);
      setLoading(false);
    }
    loadJobs();
  }, []);

  async function toggleJobClips(jobId: string) {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobId);
    if (!jobClips[jobId]) {
      const { data } = await supabase
        .from('clips')
        .select('*')
        .eq('job_id', jobId)
        .order('score', { ascending: false });
      if (data) {
        setJobClips({ ...jobClips, [jobId]: data as Clip[] });
      }
    }
  }

  async function handleRetry(jobId: string) {
    setRetrying(jobId);
    await supabase
      .from('jobs')
      .update({ status: 'queued', progress: 0, error_message: null, error_code: null })
      .eq('id', jobId);
    setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'queued', progress: 0, error_message: null } : j));
    setRetrying(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--error)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary mt-4">Try again</button>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="card text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'var(--bg)' }}>
            <HistoryIcon className="w-8 h-8" style={{ color: 'var(--text-dim)' }} />
          </div>
          <h2 className="text-xl font-bold mb-2">No jobs yet</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Your processing history will appear here once you create your first batch of clips.
          </p>
          <button onClick={() => navigate('/app')} className="btn-primary">
            <Sparkles className="w-4 h-4" /> Create your first clips
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Job history</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} processed
        </p>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => {
          const project = job.projects;
          const status = statusLabels[job.status] ?? statusLabels.queued;
          const clips = jobClips[job.id] ?? [];
          const isExpanded = expandedJob === job.id;

          return (
            <div key={job.id} className="card p-0 overflow-hidden">
              <button
                onClick={() => toggleJobClips(job.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-zinc-800/30 transition-all"
              >
                {/* Thumbnail */}
                <div className="w-20 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: 'var(--bg)' }}>
                  {project?.thumbnail_url ? (
                    <img src={project.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : project?.video_id ? (
                    <img src={getThumbnailUrl(project.video_id, 'mq')} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-5 h-5" style={{ color: 'var(--text-dim)' }} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {project?.video_title || project?.youtube_url || 'Untitled video'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {new Date(job.created_at).toLocaleDateString()} · {job.clips_count} clips
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="badge" style={{ background: `${status.color}20`, color: status.color }}>
                    {job.status === 'rendering' || job.status === 'fetching' || job.status === 'analyzing' || job.status === 'clipping' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    {status.label}
                  </span>
                  {job.status === 'failed' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRetry(job.id); }}
                      disabled={retrying === job.id}
                      className="btn-secondary text-xs px-2 py-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                  <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} style={{ color: 'var(--text-dim)' }} />
                </div>
              </button>

              {/* Expanded clips */}
              {isExpanded && (
                <div className="border-t p-4 animate-fade-in" style={{ borderColor: 'var(--border)' }}>
                  {job.status === 'failed' && job.error_message && (
                    <div className="mb-3 p-3 rounded-lg text-sm flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)' }}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {job.error_message}
                    </div>
                  )}
                  {clips.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--text-dim)' }}>
                      No clips generated yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {clips.map((clip) => (
                        <Link
                          key={clip.id}
                          to={`/app/clip/${clip.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:border-zinc-600 transition-all"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                        >
                          <div className="w-14 h-9 rounded overflow-hidden shrink-0" style={{ background: '#000' }}>
                            {clip.thumbnail_url && <img src={clip.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{clip.title}</p>
                            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                              {formatDuration(clip.duration)} · Score {clip.score}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
