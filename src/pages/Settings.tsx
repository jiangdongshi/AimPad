import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { exportAllData, importData, getStorageSize } from '@/utils/dataExport';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/hooks/useTheme';
import { THEMES } from '@/types/theme';
import type { ThemeId } from '@/types/theme';
import type { ImportResult } from '@/types/profile';

const FIRE_BUTTON_OPTIONS: { value: string; label: string }[] = [
  { value: 'RT', label: 'RT' },
  { value: 'RB', label: 'RB' },
  { value: 'LT', label: 'LT' },
  { value: 'LB', label: 'LB' },
  { value: 'A', label: 'A (×)' },
  { value: 'B', label: 'B (○)' },
  { value: 'X', label: 'X (□)' },
  { value: 'Y', label: 'Y (△)' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Settings() {
  const {
    theme,
    locale: localeId,
    leftDeadzone,
    rightDeadzone,
    gamepadSensitivity,
    gamepadInvertY,
    gamepadFireButton,
    mouseSensitivity,
    mouseInvertY,
    crosshairStyle,
    crosshairColor,
    crosshairSize,
    quality,
    soundEnabled,
    soundVolume,
    updateSettings,
    resetToDefaults,
  } = useSettingsStore();

  const locale = useLocale();
  const isZh = localeId === 'zh';

  const [showFireButtonPopup, setShowFireButtonPopup] = useState(false);
  const [storageSize, setStorageSize] = useState<{ indexedDB: number; localStorage: number } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-fire-button-popup]')) {
      setShowFireButtonPopup(false);
    }
  }, []);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowFireButtonPopup(false);
    }
  }, []);

  useEffect(() => {
    if (showFireButtonPopup) {
      document.addEventListener('click', handleOutsideClick, true);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showFireButtonPopup, handleOutsideClick, handleEscape]);

  const handleRefreshStorage = useCallback(async () => {
    const size = await getStorageSize();
    setStorageSize(size);
  }, []);

  const handleExport = useCallback(async () => {
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-gaming text-text-primary">{locale['settings.title']}</h1>
        <Button variant="ghost" size="sm" onClick={resetToDefaults}>
          {locale['settings.resetDefaults']}
        </Button>
      </div>

      <style>{`
        input[type='range'] {
          accent-color: #2563EB;
        }
        input[type='checkbox'] {
          accent-color: #2563EB;
        }
      `}</style>
      <div className="space-y-6">
        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['theme.switch']}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {THEMES.map((t) => {
                const selected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => updateSettings({ theme: t.id as ThemeId })}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all"
                    style={{
                      border: selected
                        ? '2px solid #2563EB'
                        : '1px solid var(--color-bg-surface-hover)',
                      backgroundColor: selected
                        ? 'rgba(37, 99, 235, 0.15)'
                        : 'var(--color-bg-surface)',
                      boxShadow: selected
                        ? '0 0 16px rgba(37, 99, 235, 0.25)'
                        : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div className="flex gap-1">
                      <span
                        className="w-5 h-5 rounded-full"
                        style={{
                          backgroundColor: t.preview.bg,
                          border: '1px solid var(--color-text-muted)',
                        }}
                      />
                      <span
                        className="w-5 h-5 rounded-full"
                        style={{
                          backgroundColor: t.preview.accent,
                          border: '1px solid var(--color-text-muted)',
                        }}
                      />
                      <span
                        className="w-5 h-5 rounded-full"
                        style={{
                          backgroundColor: t.preview.text,
                          border: '1px solid var(--color-text-muted)',
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                    {isZh ? t.name : t.nameEn}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {isZh ? t.description : t.descriptionEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Gamepad Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['settings.gamepad']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                {locale['settings.gamepad.leftDeadzone']}: {leftDeadzone.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={leftDeadzone}
                onChange={(e) => updateSettings({ leftDeadzone: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                {locale['settings.gamepad.rightDeadzone']}: {rightDeadzone.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={rightDeadzone}
                onChange={(e) => updateSettings({ rightDeadzone: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                {locale['settings.gamepad.sensitivity']}: {gamepadSensitivity.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={gamepadSensitivity}
                onChange={(e) => updateSettings({ gamepadSensitivity: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="gamepadInvertY"
                checked={gamepadInvertY}
                onChange={(e) => updateSettings({ gamepadInvertY: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="gamepadInvertY" className="text-sm text-text-secondary">
                {locale['settings.gamepad.invertY']}
              </label>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                {locale['settings.gamepad.fireButton']}
              </label>
              <div className="relative inline-block" data-fire-button-popup>
                <button
                  onClick={() => setShowFireButtonPopup(!showFireButtonPopup)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                  style={{
                    backgroundColor: 'var(--color-bg-surface-hover)',
                    color: '#2563EB',
                    border: '1px solid #2563EB',
                    fontWeight: 700,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {FIRE_BUTTON_OPTIONS.find(o => o.value === gamepadFireButton)?.label || gamepadFireButton}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showFireButtonPopup ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {showFireButtonPopup && (
                  <div
                    className="absolute top-full mt-2 left-0 rounded-xl py-2 min-w-[140px] z-10"
                    style={{
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    }}
                  >
                    {FIRE_BUTTON_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          updateSettings({ gamepadFireButton: opt.value });
                          setShowFireButtonPopup(false);
                        }}
                        className="w-full text-left px-5 py-2.5 text-sm transition-colors flex items-center justify-between"
                        style={{
                          color: gamepadFireButton === opt.value ? '#2563EB' : 'var(--color-text-secondary)',
                          backgroundColor: gamepadFireButton === opt.value ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                          fontWeight: gamepadFireButton === opt.value ? 700 : 500,
                        }}
                      >
                        {opt.label}
                        {gamepadFireButton === opt.value && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 7.5L5.5 10L11 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mouse Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['settings.mouse']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                {locale['settings.mouse.sensitivity']}: {mouseSensitivity.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={mouseSensitivity}
                onChange={(e) => updateSettings({ mouseSensitivity: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="mouseInvertY"
                checked={mouseInvertY}
                onChange={(e) => updateSettings({ mouseInvertY: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="mouseInvertY" className="text-sm text-text-secondary">
                {locale['settings.mouse.invertY']}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Crosshair Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['settings.crosshair']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">{locale['settings.crosshair.style']}</label>
              <div className="flex gap-3">
                {([
                  { id: 'dot' as const, label: locale['settings.crosshair.dot'] || 'Dot' },
                  { id: 'cross' as const, label: locale['settings.crosshair.cross'] || 'Cross' },
                  { id: 'circle' as const, label: locale['settings.crosshair.circle'] || 'Circle' },
                ]).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => updateSettings({ crosshairStyle: id })}
                    className="flex flex-col items-center gap-2 transition-all"
                    style={{
                      border: crosshairStyle === id ? '2px solid #2563EB' : '2px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '12px',
                      background: crosshairStyle === id ? 'rgba(37, 99, 235, 0.15)' : 'var(--color-bg-surface-hover)',
                    }}
                  >
                    <div className="w-8 h-8 flex items-center justify-center">
                      {id === 'dot' && (
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: crosshairColor,
                        }} />
                      )}
                      {id === 'cross' && (
                        <div className="relative w-full h-full">
                          <div className="absolute top-1/2 left-0 w-full h-[1.5px] -translate-y-1/2" style={{ backgroundColor: crosshairColor }} />
                          <div className="absolute top-0 left-1/2 w-[1.5px] h-full -translate-x-1/2" style={{ backgroundColor: crosshairColor }} />
                        </div>
                      )}
                      {id === 'circle' && (
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          border: `1.5px solid ${crosshairColor}`,
                        }} />
                      )}
                    </div>
                    <span className="text-xs" style={{ color: crosshairStyle === id ? '#2563EB' : 'var(--color-text-secondary)' }}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">{locale['settings.crosshair.color']}</label>
              <input
                type="color"
                value={crosshairColor}
                onChange={(e) => updateSettings({ crosshairColor: e.target.value })}
                className="w-12 h-8 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                {locale['settings.crosshair.size']}: {crosshairSize}px
              </label>
              <input
                type="range"
                min="2"
                max="12"
                step="1"
                value={crosshairSize}
                onChange={(e) => updateSettings({ crosshairSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['settings.display']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">{locale['settings.display.quality']}</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
                  <button
                    key={q}
                    style={quality === q
                      ? { border: '2px solid #2563EB', borderRadius: '12px', padding: '8px 16px', background: 'rgba(37, 99, 235, 0.15)', color: 'var(--tw-text-primary)', fontWeight: 700 }
                      : { border: '2px solid var(--tw-surface-600)', borderRadius: '12px', padding: '8px 16px', background: 'var(--tw-surface-800)', color: 'var(--tw-text-secondary)' }
                    }
                    onClick={() => updateSettings({ quality: q })}
                  >
                    {locale[`settings.display.quality.${q}`] || q}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sound Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['settings.sound']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="soundEnabled"
                checked={soundEnabled}
                onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="soundEnabled" className="text-sm text-text-secondary">
                {locale['settings.sound.enable']}
              </label>
            </div>
            {soundEnabled && (
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  {locale['settings.sound.volume']}: {Math.round(soundVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={(e) => updateSettings({ soundVolume: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['profile.dataManagement']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Storage Info */}
            <div>
              <Button variant="ghost" size="sm" onClick={handleRefreshStorage}>
                {storageSize ? locale['profile.refresh'] : locale['profile.showStorage']}
              </Button>
              {storageSize && (
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between max-w-xs">
                    <span className="text-text-secondary">{locale['profile.indexedDB']}:</span>
                    <span className="text-text-primary">{formatBytes(storageSize.indexedDB)}</span>
                  </div>
                  <div className="flex justify-between max-w-xs">
                    <span className="text-text-secondary">{locale['profile.localStorage']}:</span>
                    <span className="text-text-primary">{formatBytes(storageSize.localStorage)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Export/Import */}
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={handleExport}>
                {locale['profile.exportData']}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleImport}>
                {locale['profile.importData']}
              </Button>
            </div>

            {importResult && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  importResult.imported
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {importResult.imported
                  ? locale['profile.importSuccess']
                      .replace('{records}', String(importResult.recordCount))
                      .replace('{tasks}', String(importResult.taskCount))
                  : locale['profile.importFailed'].replace('{error}', importResult.error || 'Unknown error')}
              </div>
            )}

            <p className="text-xs text-text-muted">
              {locale['profile.exportHint']}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
