import { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { THEMES } from '@/types/theme';
import type { ThemeId } from '@/types/theme';

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const theme = useSettingsStore((s) => s.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: ThemeId) => {
    updateSettings({ theme: id });
    setOpen(false);
  };

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-700 hover:bg-surface-600 transition-colors text-sm"
        title="切换主题"
      >
        <span className="flex gap-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/20"
            style={{ backgroundColor: current.preview.bg }}
          />
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/20"
            style={{ backgroundColor: current.preview.accent }}
          />
        </span>
        <span className="text-text-secondary text-xs hidden sm:inline">{current.name}</span>
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
          className="absolute right-0 top-full mt-2 w-56 rounded-lg shadow-2xl z-50 py-1 animate-fade-in"
          style={{ backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {THEMES.map((t) => {
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: isActive ? '#ffffff' : '#a0a0b8',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div className="flex gap-1 shrink-0">
                  <span
                    className="w-4 h-4 rounded-full border border-white/10"
                    style={{ backgroundColor: t.preview.bg }}
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-white/10"
                    style={{ backgroundColor: t.preview.accent }}
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-white/10"
                    style={{ backgroundColor: t.preview.text }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs truncate" style={{ color: '#666680' }}>{t.description}</div>
                </div>
                {isActive && (
                  <svg className="w-4 h-4 shrink-0 ml-auto" style={{ color: '#f59e0b' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
