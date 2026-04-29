import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { applyTheme, getStoredTheme, subscribeSystemTheme, type ThemeMode } from '@/lib/theme';
import { setAppLanguage } from '@/i18n';

export function ThemeLangToolbar() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    if (theme !== 'system') return;
    return subscribeSystemTheme(() => applyTheme('system'));
  }, [theme]);

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Select
        value={i18n.language.startsWith('zh') ? 'zh' : 'en'}
        onValueChange={(v) => void setAppLanguage(v)}
      >
        <SelectTrigger className="h-8 w-[100px] text-xs" aria-label={t('toolbar.language')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="zh">中文</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={theme}
        onValueChange={(v) => {
          const m = v as ThemeMode;
          setTheme(m);
          applyTheme(m);
        }}
      >
        <SelectTrigger className="h-8 w-[118px] text-xs" aria-label={t('toolbar.theme')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">{t('toolbar.themeLight')}</SelectItem>
          <SelectItem value="dark">{t('toolbar.themeDark')}</SelectItem>
          <SelectItem value="system">{t('toolbar.themeSystem')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
