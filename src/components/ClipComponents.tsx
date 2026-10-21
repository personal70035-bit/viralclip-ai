import { Film, Scissors, Sparkles, Zap, Captions, Download } from 'lucide-react';
import type { Clip, ClipFilter, ScoreBreakdown } from '@/types/database';
import { formatDuration } from '@/lib/youtube';

const filterLabels: Record<ClipFilter, string> = {
  highest_score: 'Highest score',
  shortest: 'Shortest',
  longest: 'Longest',
  most_emotional: 'Most emotional',
  most_educational: 'Most educational',
};

export function ClipCard({ clip, onOpen }: { clip: Clip; onOpen: () => void }) {
  const breakdown = clip.score_breakdown as unknown as ScoreBreakdown;

  return (
    <div className="card p-0 overflow-hidden hover:border-zinc-600 transition-all duration-200 cursor-pointer group animate-slide-up" onClick={onOpen}>
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden" style={{ background: 'var(--bg)' }}>
        {clip.thumbnail_url ? (
          <img src={clip.thumbnail_url} alt={clip.title ?? 'Clip'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-dim)' }}>
            <Film className="w-10 h-10" />
          </div>
        )}
        <div className="absolute top-2 right-2 badge" style={{ background: 'rgba(0,0,0,0.7)', color: clip.score >= 75 ? 'var(--success)' : clip.score >= 50 ? 'var(--warning)' : 'var(--text-muted)' }}>
          <Sparkles className="w-3 h-3" />
          {clip.score}
        </div>
        <div className="absolute bottom-2 left-2 badge" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
          {formatDuration(clip.duration)}
        </div>
        <div className="absolute bottom-2 right-2 badge" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
          {clip.format}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-sm leading-snug mb-1.5 line-clamp-2">{clip.title ?? 'Untitled clip'}</h3>
        {clip.hook_line && (
          <p className="text-xs italic mb-3 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
            "{clip.hook_line}"
          </p>
        )}

        {clip.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {clip.hashtags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }} className="btn-secondary text-xs px-3 py-1.5 flex-1">
            <Scissors className="w-3 h-3" />
            Edit
          </button>
          {clip.video_url && (
            <a href={clip.video_url} download onClick={(e) => e.stopPropagation()} className="btn-primary text-xs px-3 py-1.5 flex-1">
              <Download className="w-3 h-3" />
              Download
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function ClipFilters({ active, onChange }: { active: ClipFilter; onChange: (f: ClipFilter) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(filterLabels) as ClipFilter[]).map((key) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${active === key ? 'text-white' : ''}`}
          style={active === key
            ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
            : { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          {filterLabels[key]}
        </button>
      ))}
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--text-muted)';
  return (
    <span className="badge" style={{ background: `${color}20`, color }}>
      <Sparkles className="w-3 h-3" />
      {score}/100
    </span>
  );
}

export function ScoreBreakdownView({ breakdown }: { breakdown: ScoreBreakdown }) {
  const items = [
    { label: 'Hook strength (first 3s)', value: breakdown.hook_strength },
    { label: 'Speech clarity & pace', value: breakdown.speech_clarity },
    { label: 'Emotional language', value: breakdown.emotional_language },
    { label: 'Questions & contrasts', value: breakdown.question_contrast },
    { label: 'Actionable advice', value: breakdown.actionable_advice },
    { label: 'Topic coherence', value: breakdown.topic_coherence },
    { label: 'Natural sentence boundaries', value: breakdown.natural_boundaries },
    { label: 'Filler / silence penalty', value: breakdown.filler_penalty },
  ];
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
            <span className="font-medium">{item.value}/100</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, item.value))}%`, background: item.value >= 70 ? 'var(--success)' : item.value >= 40 ? 'var(--warning)' : 'var(--error)' }} />
          </div>
        </div>
      ))}
      {breakdown.reasoning && breakdown.reasoning.length > 0 && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>Why this clip scored highly</p>
          <ul className="space-y-1.5">
            {breakdown.reasoning.map((r, i) => (
              <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--text-muted)' }}>
                <Sparkles className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--primary)' }} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export { filterLabels };
