export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'nerve-hub-theme';

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

function resolveClass(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply theme to <html> and persist. Call on startup and when user changes preference. */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolveClass(mode));
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Run before React paint: read localStorage and set html class. */
export function applyThemeFromStorage() {
  applyTheme(getStoredTheme());
}

export function subscribeSystemTheme(listener: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}
