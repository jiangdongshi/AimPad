import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useProfileStore } from '@/stores/profileStore';
import { useLocale } from '@/hooks/useTheme';
import { exportAllData, importData } from '@/utils/dataExport';
import type { ImportResult } from '@/types/profile';

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const { displayName, avatarSeed } = useProfileStore();
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

  const handleExport = useCallback(async () => {
    setOpen(false);
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `AimPad_backup_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(async () => {
    setOpen(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const result = await importData(text);
      setImportResult(result);
      setTimeout(() => setImportResult(null), 5000);
    };
    input.click();
  }, []);

  const avatarColor = `hsl(${avatarSeed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360}, 60%, 55%)`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-700 transition-colors"
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: avatarColor }}
        >
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="text-sm text-text-primary hidden sm:inline">{displayName}</span>
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
          {/* Profile info */}
          <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="text-sm font-medium" style={{ color: '#ffffff' }}>{displayName}</div>
            <div className="text-xs truncate" style={{ color: '#666680' }}>{locale['profile.localProfile']}</div>
          </div>

          {/* Edit Profile */}
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
            style={{ color: '#a0a0b8' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {locale['profile.editProfile']}
          </Link>

          {/* Export */}
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
            style={{ color: '#a0a0b8' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {locale['profile.quickExport']}
          </button>

          {/* Import */}
          <button
            onClick={handleImport}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
            style={{ color: '#a0a0b8' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {locale['profile.quickImport']}
          </button>

          {/* Import result toast */}
          {importResult && (
            <div
              className="mx-3 mt-1 p-2 rounded text-xs"
              style={{
                backgroundColor: importResult.imported ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: importResult.imported ? '#4ade80' : '#f87171',
              }}
            >
              {importResult.imported
                ? locale['profile.importSuccess'].replace('{records}', String(importResult.recordCount)).replace('{tasks}', String(importResult.taskCount))
                : locale['profile.importFailed'].replace('{error}', importResult.error || 'Unknown error')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
