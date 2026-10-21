import { type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Film, LayoutDashboard, History, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { label: 'History', path: '/app/history', icon: History },
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r fixed h-full" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary)' }}>
              <Film className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">ViralClip AI</span>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'text-white' : ''}`}
                style={active ? { background: 'var(--bg-card)', border: '1px solid var(--border)' } : { color: 'var(--text-muted)' }}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-card)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'var(--primary)', color: 'white' }}>
              {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
                {profile?.clips_remaining ?? 10} clips left
              </p>
            </div>
          </div>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg text-sm transition-all" style={{ color: 'var(--text-muted)' }}>
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(10,10,11,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center justify-between h-14 px-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <Film className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <span className="font-bold">ViralClip AI</span>
          </button>
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`p-2 rounded-lg ${active ? 'text-white' : ''}`}
                  style={active ? { background: 'var(--bg-card)' } : { color: 'var(--text-muted)' }}
                >
                  <item.icon className="w-5 h-5" />
                </button>
              );
            })}
            <button onClick={handleSignOut} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
