import { useSettingsStore } from '@/stores/settingsStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function Settings() {
  const {
    gamepadDeadzone,
    gamepadSensitivity,
    gamepadInvertY,
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-gaming text-text-primary">Settings</h1>
        <Button variant="ghost" size="sm" onClick={resetToDefaults}>
          Reset to Defaults
        </Button>
      </div>

      <div className="space-y-6">
        {/* 手柄设置 */}
        <Card>
          <CardHeader>
            <CardTitle>Gamepad Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Deadzone: {gamepadDeadzone.toFixed(2)}
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
                Sensitivity: {gamepadSensitivity.toFixed(1)}
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
                Invert Y Axis
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 鼠标设置 */}
        <Card>
          <CardHeader>
            <CardTitle>Mouse Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Sensitivity: {mouseSensitivity.toFixed(1)}
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
                Invert Y Axis
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 准星设置 */}
        <Card>
          <CardHeader>
            <CardTitle>Crosshair Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">Style</label>
              <div className="flex gap-2">
                {(['dot', 'cross', 'circle'] as const).map((style) => (
                  <button
                    key={style}
                    className={`px-4 py-2 rounded capitalize ${
                      crosshairStyle === style
                        ? 'bg-accent text-surface-900'
                        : 'bg-surface-700 text-text-secondary hover:text-text-primary'
                    }`}
                    onClick={() => updateSettings({ crosshairStyle: style })}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Color</label>
              <input
                type="color"
                value={crosshairColor}
                onChange={(e) => updateSettings({ crosshairColor: e.target.value })}
                className="w-12 h-8 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Size: {crosshairSize}px
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
            <CardTitle>Display Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">Quality</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
                  <button
                    key={q}
                    className={`px-4 py-2 rounded capitalize ${
                      quality === q
                        ? 'bg-accent text-surface-900'
                        : 'bg-surface-700 text-text-secondary hover:text-text-primary'
                    }`}
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
            <CardTitle>Sound Settings</CardTitle>
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
                Enable Sound
              </label>
            </div>
            {soundEnabled && (
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Volume: {Math.round(soundVolume * 100)}%
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
