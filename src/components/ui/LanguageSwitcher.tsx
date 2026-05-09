import { useSettingsStore } from '@/stores/settingsStore';

export function LanguageSwitcher() {
  const locale = useSettingsStore((s) => s.locale);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const isZh = locale === 'zh';

  return (
    <button
      onClick={() => updateSettings({ locale: isZh ? 'en' : 'zh' })}
      className="flex items-center justify-center w-9 h-9 rounded-md bg-surface-700 hover:bg-surface-600 transition-colors text-sm font-medium text-text-secondary hover:text-text-primary"
      title={isZh ? '切换到英文' : 'Switch to Chinese'}
    >
      {isZh ? 'EN' : '中'}
    </button>
  );
}
