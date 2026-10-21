import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, Download, Sparkles, Loader2, AlertCircle,
  Crop, Captions, Type, Palette, Move, RefreshCw, Film, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/lib/youtube';
import type { Clip, RenderSettings, ClipFormat, ScoreBreakdown } from '@/types/database';
import { ScoreBreakdownView, ScoreBadge } from '@/components/ClipComponents';

const formatOptions: ClipFormat[] = ['9:16', '1:1', '16:9'];
const fontOptions = ['Inter', 'Arial', 'Impact', 'Montserrat', 'Roboto', 'Comic Sans MS'];
const colorOptions = ['#ffffff', '#f97316', '#22c55e', '#06b6d4', '#ef4444', '#eab308', '#ec4899'];
const positionOptions: { value: 'top' | 'center' | 'bottom'; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
];
const animationOptions: { value: 'fade' | 'slide' | 'pop' | 'none'; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide up' },
  { value: 'pop', label: 'Pop' },
  { value: 'none', label: 'None' },
];
const cropFocusOptions: { value: 'center' | 'top' | 'bottom' | 'face' | 'left' | 'right'; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'face', label: 'Face tracking' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

export function ClipEditorPage() {
  const { clipId } = useParams<{ clipId: string }>();
  const navigate = useNavigate();

  const [clip, setClip] = useState<Clip | null>(null);
  const [renderSettings, setRenderSettings] = useState<RenderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startPercent, setStartPercent] = useState(0);
  const [endPercent, setEndPercent] = useState(100);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [rerendering, setRerendering] = useState(false);
  const [rerenderError, setRerenderError] = useState<string | null>(null);
  const [rerenderSuccess, setRerenderSuccess] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadClip() {
      if (!clipId) return;
      setLoading(true);
      const { data: clipData, error: clipErr } = await supabase
        .from('clips')
        .select('*')
        .eq('id', clipId)
        .maybeSingle();
      if (clipErr || !clipData) {
        setError('Clip not found or you do not have access to it.');
        setLoading(false);
        return;
      }
      const c = clipData as Clip;
      setClip(c);

      const { data: rsData } = await supabase
        .from('render_settings')
        .select('*')
        .eq('clip_id', clipId)
        .maybeSingle();

      if (rsData) {
        const rs = rsData as RenderSettings;
        setRenderSettings(rs);
        if (rs.custom_start !== null) setStartPercent((rs.custom_start / c.duration) * 100);
        if (rs.custom_end !== null) setEndPercent((rs.custom_end / c.duration) * 100);
      } else {
        const newRs: Partial<RenderSettings> = {
          clip_id: clipId,
          format: c.format,
          caption_style: 'bold_auto',
          caption_font: 'Inter',
          caption_color: '#ffffff',
          caption_position: 'bottom',
          caption_animation: 'fade',
          caption_background: true,
          crop_focus: 'center',
        };
        const { data: created } = await supabase
          .from('render_settings')
          .insert(newRs)
          .select()
          .maybeSingle();
        if (created) setRenderSettings(created as RenderSettings);
      }
      setLoading(false);
    }
    loadClip();
  }, [clipId]);

  const handleMouseEvent = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    if (dragging === 'start') {
      setStartPercent(Math.min(percent, endPercent - 5));
    } else {
      setEndPercent(Math.max(percent, startPercent + 5));
    }
  }, [dragging, endPercent, startPercent]);

  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(null);
    window.addEventListener('mousemove', handleMouseEvent);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', handleMouseEvent);
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', handleMouseEvent);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', handleMouseEvent);
      window.removeEventListener('touchend', stop);
    };
  }, [dragging, handleMouseEvent]);

  async function updateRenderSettings(patch: Partial<RenderSettings>) {
    if (!renderSettings || !clipId) return;
    const updated = { ...renderSettings, ...patch };
    setRenderSettings(updated);
    await supabase
      .from('render_settings')
      .update(patch)
      .eq('clip_id', clipId);
  }

  async function handleRerender() {
    if (!clip || !renderSettings) return;
    setRerendering(true);
    setRerenderError(null);
    setRerenderSuccess(false);

    const customStart = (startPercent / 100) * clip.duration;
    const customEnd = (endPercent / 100) * clip.duration;

    try {
      await supabase
        .from('render_settings')
        .update({
          custom_start: customStart,
          custom_end: customEnd,
          format: renderSettings.format,
          caption_style: renderSettings.caption_style,
          caption_font: renderSettings.caption_font,
          caption_color: renderSettings.caption_color,
          caption_position: renderSettings.caption_position,
          caption_animation: renderSettings.caption_animation,
          caption_background: renderSettings.caption_background,
          crop_focus: renderSettings.crop_focus,
        })
        .eq('clip_id', clip.id);

      await supabase
        .from('clips')
        .update({ status: 'rendering' })
        .eq('id', clip.id);

      setRerenderSuccess(true);
      setClip({ ...clip, status: 'rendering' });
    } catch {
      setRerenderError('Failed to start re-render. Please try again.');
    } finally {
      setRerendering(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (error || !clip || !renderSettings) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--error)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error || 'Clip not found'}</p>
          <button onClick={() => navigate('/app')} className="btn-secondary mt-4">Back to dashboard</button>
        </div>
      </div>
    );
  }

  const breakdown = clip.score_breakdown as unknown as ScoreBreakdown;
  const currentStart = (startPercent / 100) * clip.duration;
  const currentEnd = (endPercent / 100) * clip.duration;
  const currentDuration = currentEnd - currentStart;

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate(-1)} className="btn-ghost text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Preview + Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-0 overflow-hidden">
            <div className="relative aspect-video flex items-center justify-center" style={{ background: '#000' }}>
              {clip.thumbnail_url ? (
                <img src={clip.thumbnail_url} alt={clip.title ?? 'Clip'} className="w-full h-full object-contain" />
              ) : (
                <Film className="w-12 h-12" style={{ color: 'var(--text-dim)' }} />
              )}
              <button
                onClick={() => setPreviewPlaying(!previewPlaying)}
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all group-hover:scale-110" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  {previewPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-0.5" />}
                </div>
              </button>
              {clip.status === 'rendering' && (
                <div className="absolute top-3 right-3 badge" style={{ background: 'rgba(249,115,22,0.2)', color: 'var(--primary)' }}>
                  <Loader2 className="w-3 h-3 animate-spin" /> Rendering...
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Clip timeline</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {formatTime(currentStart)} - {formatTime(currentEnd)} ({currentDuration.toFixed(1)}s)
                </span>
              </div>
              <div
                ref={timelineRef}
                className="relative h-12 rounded-lg cursor-pointer select-none"
                style={{ background: 'var(--bg)' }}
              >
                {/* Selection */}
                <div
                  className="absolute h-full rounded-lg"
                  style={{
                    left: `${startPercent}%`,
                    width: `${endPercent - startPercent}%`,
                    background: 'rgba(249,115,22,0.2)',
                    border: '2px solid var(--primary)',
                  }}
                />
                {/* Start handle */}
                <div
                  onMouseDown={() => setDragging('start')}
                  onTouchStart={() => setDragging('start')}
                  className="absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-ew-resize flex items-center justify-center"
                  style={{ left: `${startPercent}%` }}
                >
                  <div className="w-1 h-full rounded" style={{ background: 'var(--primary)' }} />
                </div>
                {/* End handle */}
                <div
                  onMouseDown={() => setDragging('end')}
                  onTouchStart={() => setDragging('end')}
                  className="absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-ew-resize flex items-center justify-center"
                  style={{ left: `${endPercent}%` }}
                >
                  <div className="w-1 h-full rounded" style={{ background: 'var(--primary)' }} />
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
                Drag the handles to adjust start and end time
              </p>
            </div>
          </div>

          {/* Clip info */}
          <div className="card">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{clip.title}</h2>
                {clip.hook_line && (
                  <p className="text-sm italic mt-1" style={{ color: 'var(--text-muted)' }}>"{clip.hook_line}"</p>
                )}
              </div>
              <ScoreBadge score={clip.score} />
            </div>

            {clip.reason && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                <span className="font-medium" style={{ color: 'var(--text)' }}>Why selected: </span>
                {clip.reason}
              </div>
            )}

            {clip.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {clip.hashtags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="section-title mb-3">Score breakdown</p>
              <ScoreBreakdownView breakdown={breakdown} />
            </div>
          </div>
        </div>

        {/* Right: Render settings */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Crop className="w-4 h-4" style={{ color: 'var(--primary)' }} /> Crop & Format
            </h3>

            <label className="text-sm font-medium block mb-2">Output format</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {formatOptions.map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => updateRenderSettings({ format: fmt })}
                  className={`py-2 rounded-lg text-sm font-medium transition-all ${renderSettings.format === fmt ? 'text-white' : ''}`}
                  style={renderSettings.format === fmt
                    ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
                    : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <label className="text-sm font-medium block mb-2">Crop focus</label>
            <div className="grid grid-cols-3 gap-2">
              {cropFocusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateRenderSettings({ crop_focus: opt.value })}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${renderSettings.crop_focus === opt.value ? 'text-white' : ''}`}
                  style={renderSettings.crop_focus === opt.value
                    ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
                    : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Captions className="w-4 h-4" style={{ color: 'var(--primary)' }} /> Captions
            </h3>

            <label className="text-sm font-medium block mb-2">Style</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {(['bold_auto', 'burned_in', 'no_captions'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => updateRenderSettings({ caption_style: style })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${renderSettings.caption_style === style ? 'text-white' : ''}`}
                  style={renderSettings.caption_style === style
                    ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
                    : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  {style === 'bold_auto' ? 'Bold auto' : style === 'burned_in' ? 'Burned-in' : 'None'}
                </button>
              ))}
            </div>

            {renderSettings.caption_style !== 'no_captions' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Type className="w-3.5 h-3.5" /> Font
                  </label>
                  <select
                    value={renderSettings.caption_font}
                    onChange={(e) => updateRenderSettings({ caption_font: e.target.value })}
                    className="input-field text-sm py-2"
                  >
                    {fontOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Palette className="w-3.5 h-3.5" /> Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateRenderSettings({ caption_color: color })}
                        className={`w-8 h-8 rounded-lg transition-all ${renderSettings.caption_color === color ? 'ring-2 ring-offset-2 ring-offset-zinc-900' : ''}`}
                        style={{ background: color, '--tw-ring-color': color } as React.CSSProperties}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Move className="w-3.5 h-3.5" /> Position
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {positionOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateRenderSettings({ caption_position: opt.value })}
                        className={`py-2 rounded-lg text-xs font-medium transition-all ${renderSettings.caption_position === opt.value ? 'text-white' : ''}`}
                        style={renderSettings.caption_position === opt.value
                          ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
                          : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Animation</label>
                  <div className="grid grid-cols-4 gap-2">
                    {animationOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateRenderSettings({ caption_animation: opt.value })}
                        className={`py-2 rounded-lg text-xs font-medium transition-all ${renderSettings.caption_animation === opt.value ? 'text-white' : ''}`}
                        style={renderSettings.caption_animation === opt.value
                          ? { background: 'var(--primary)', border: '1px solid var(--primary)' }
                          : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={renderSettings.caption_background}
                    onChange={(e) => updateRenderSettings({ caption_background: e.target.checked })}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm">Background behind text</span>
                </label>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="card space-y-3">
            {rerenderError && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--error)' }}>
                <AlertCircle className="w-4 h-4" /> {rerenderError}
              </div>
            )}
            {rerenderSuccess && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--success)' }}>
                <Check className="w-4 h-4" /> Re-render queued. Check history for status.
              </div>
            )}
            <button onClick={handleRerender} disabled={rerendering} className="btn-primary w-full">
              {rerendering ? <><Loader2 className="w-4 h-4 animate-spin" /> Re-rendering...</> : <><RefreshCw className="w-4 h-4" /> Re-render clip</>}
            </button>
            {clip.video_url && (
              <a href={clip.video_url} download className="btn-secondary w-full">
                <Download className="w-4 h-4" /> Download MP4
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
