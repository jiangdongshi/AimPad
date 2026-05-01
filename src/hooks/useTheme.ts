import { useEffect, useMemo } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { LOCALES } from '@/types/locale';

export function useTheme() {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return theme;
}

export function useLocale() {
  const locale = useSettingsStore((s) => s.locale);
  return useMemo(() => LOCALES[locale] ?? LOCALES.en, [locale]);
}
