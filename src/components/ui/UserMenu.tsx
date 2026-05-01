import { useState, useRef, useEffect } from 'react';
import type { User } from '@/types/auth';
import { useLocale } from '@/hooks/useTheme';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-700 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
          {user.username[0].toUpperCase()}
        </span>
        <span className="text-sm text-text-primary hidden sm:inline">{user.username}</span>
        <svg
          className={`w-3 h-3 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-2xl z-50 py-1 animate-fade-in"
          style={{ backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="text-sm font-medium" style={{ color: '#ffffff' }}>{user.username}</div>
            <div className="text-xs truncate" style={{ color: '#666680' }}>{user.email}</div>
          </div>
          <button
            onClick={() => { onLogout(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
            style={{ color: '#a0a0b8' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {locale['auth.logout']}
          </button>
        </div>
      )}
    </div>
  );
}
