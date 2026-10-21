import { useNavigate } from 'react-router-dom';
import { Film, Scissors, Sparkles, Zap, Download, BarChart3, Captions, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(10,10,11,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary)' }}>
              <Film className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold">ViralClip AI</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <button onClick={() => navigate('/app')} className="btn-primary text-sm">Go to dashboard</button>
            ) : (
              <>
                <button onClick={() => navigate('/auth')} className="btn-ghost text-sm">Sign in</button>
                <button onClick={() => navigate('/auth')} className="btn-primary text-sm">Get started</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(249,115,22,0.3) 0%, transparent 50%)' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 relative">
          <div className="text-center max-w-4xl mx-auto animate-slide-up">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              No API keys required. yt-dlp + ffmpeg powered.
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight tracking-tight">
              Turn long YouTube videos into{' '}
              <span className="gradient-text">viral-ready clips.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-muted)' }}>
              ViralClip AI analyzes transcripts, audio, and scene changes to find your most
              high-retention moments — then crops, captions, and exports them automatically.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => navigate('/auth')} className="btn-primary text-base px-7 py-3">
                <Zap className="w-5 h-5" />
                Start clipping free
              </button>
              <button onClick={() => navigate('/auth')} className="btn-secondary text-base px-7 py-3">
                See how it works
              </button>
            </div>
            <p className="mt-4 text-sm" style={{ color: 'var(--text-dim)' }}>
              No credit card. 10 free clips to start.
            </p>
          </div>

          {/* Hero visual */}
          <div className="mt-16 max-w-5xl mx-auto animate-fade-in">
            <div className="rounded-2xl overflow-hidden glow" style={{ border: '1px solid var(--border)' }}>
              <img
                src="https://images.pexels.com/photos/39694504/pexels-photo-39694504.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
                alt="Video editing workspace"
                className="w-full h-auto"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold">Everything you need to go viral</h2>
          <p className="mt-3 text-lg" style={{ color: 'var(--text-muted)' }}>
            From URL to finished clip in minutes. No manual editing required.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Sparkles, title: 'High-retention scoring', desc: 'Our engine scores every 15–60s window using hook strength, speech clarity, emotional language, and more — no paid APIs.' },
            { icon: Captions, title: 'Burned-in captions', desc: 'Auto-generate bold captions from transcripts. Choose font, color, position, and animation. Optimized for mobile.' },
            { icon: Scissors, title: 'Clip editor', desc: 'Drag start/end handles, preview, change crop focus, and re-render only the clip you changed.' },
            { icon: BarChart3, title: 'Score breakdown', desc: 'See exactly why each clip scored highly with a transparent hook-quality breakdown.' },
            { icon: Download, title: 'Multiple formats', desc: 'Export in 9:16 vertical, 1:1 square, or 16:9 horizontal. Perfect for every platform.' },
            { icon: Zap, title: 'Queue-based processing', desc: 'Submit multiple videos without blocking the UI. Real-time progress tracking.' },
          ].map((f) => (
            <div key={f.title} className="card hover:border-zinc-600 transition-all duration-200">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(249,115,22,0.1)' }}>
                <f.icon className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold">Three steps to viral clips</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { num: '01', title: 'Paste a YouTube URL', desc: 'Drop any long-form video link. We validate and extract the video ID safely.' },
            { num: '02', title: 'Pick your settings', desc: 'Choose clip count, duration, format, caption style, and content goal.' },
            { num: '03', title: 'Download viral clips', desc: 'Get scored, captioned, and cropped clips ready for TikTok, Reels, and Shorts.' },
          ].map((s) => (
            <div key={s.num} className="relative">
              <div className="text-5xl font-bold mb-3" style={{ color: 'var(--primary)', opacity: 0.3 }}>{s.num}</div>
              <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing strip */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="card text-center">
          <h2 className="text-2xl font-bold mb-2">Free to start</h2>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>Get 10 clips on us. No credit card needed.</p>
          <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto mb-6">
            {['No API keys needed', 'Unlimited projects', 'All export formats', 'Burned-in captions'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4" style={{ color: 'var(--success)' }} />
                {item}
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/auth')} className="btn-primary">
            <Zap className="w-5 h-5" />
            Start clipping now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <span className="font-semibold">ViralClip AI</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            Powered by yt-dlp + ffmpeg. No paid APIs.
          </p>
        </div>
      </footer>
    </div>
  );
}
