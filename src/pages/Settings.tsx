import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/hooks/useTheme';
import { THEMES } from '@/types/theme';
import type { ThemeId } from '@/types/theme';

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

export function Settings() {
  const {
    theme,
    gamepadDeadzone,
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
    syncStatus,
    lastSyncedAt,
    updateSettings,
    resetToDefaults,
    syncToServer,
    loadFromServer,
  } = useSettingsStore();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const locale = useLocale();

  const [showFireButtonPopup, setShowFireButtonPopup] = useState(false);

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

  const syncStatusText = {
    idle: '',
    saving: locale['settings.syncing'],
    saved: locale['settings.synced'],
    error: locale['settings.syncError'],
  }[syncStatus];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-gaming text-text-primary">{locale['settings.title']}</h1>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={resetToDefaults}>
            {locale['settings.resetDefaults']}
          </Button>
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={loadFromServer}>
                {locale['settings.loadFromCloud']}
              </Button>
              <Button variant="secondary" size="sm" onClick={syncToServer} disabled={syncStatus === 'saving'}>
                {locale['settings.saveToCloud']}
              </Button>
              {syncStatus !== 'idle' && (
                <span className={`text-xs ${
                  syncStatus === 'saved' ? 'text-green-400' :
                  syncStatus === 'error' ? 'text-red-400' :
                  'text-text-muted'
                }`}>
                  {syncStatusText}
                </span>
              )}
              {lastSyncedAt && syncStatus === 'saved' && (
                <span className="text-xs text-text-muted">
                  {new Date(lastSyncedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
        </div>
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
        {/* 主题设置 */}
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
                      {t.name}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {t.nameEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 手柄设置 */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['settings.gamepad']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                {locale['settings.gamepad.deadzone']}: {gamepadDeadzone.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={gamepadDeadzone}
                onChange={(e) => updateSettings({ gamepadDeadzone: parseFloat(e.target.value) })}
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

        {/* 鼠标设置 */}
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

        {/* 准星设置 */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['settings.crosshair']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">{locale['settings.crosshair.style']}</label>
              <div className="flex gap-2">
                {(['dot', 'cross', 'circle'] as const).map((style) => (
                  <button
                    key={style}
                    style={crosshairStyle === style
                      ? { border: '2px solid #2563EB', borderRadius: '12px', padding: '8px 16px', background: 'rgba(37, 99, 235, 0.15)', color: 'var(--tw-text-primary)', fontWeight: 700 }
                      : { border: '2px solid var(--tw-surface-600)', borderRadius: '12px', padding: '8px 16px', background: 'var(--tw-surface-800)', color: 'var(--tw-text-secondary)' }
                    }
                    onClick={() => updateSettings({ crosshairStyle: style })}
                  >
                    {style}
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

        {/* 显示设置 */}
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
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 音效设置 */}
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
      </div>
    </div>
  );
}
