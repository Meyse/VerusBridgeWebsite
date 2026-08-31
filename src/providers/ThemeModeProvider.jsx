import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

const STORAGE_KEY = 'verus-bridge-theme-mode';
const DEFAULT_THEME_MODE = 'system';
const DEFAULT_RESOLVED_THEME_MODE = 'dark';

const noop = () => {};

const ThemeModeContext = createContext({
  mode: DEFAULT_THEME_MODE,
  resolvedMode: DEFAULT_RESOLVED_THEME_MODE,
  isDarkMode: true,
  setMode: noop,
  toggleMode: noop
});

const normalizeThemeMode = (value) => (
  value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME_MODE
);

const getSystemThemeMode = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_RESOLVED_THEME_MODE;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveThemeMode = (mode, systemMode) => (mode === 'system' ? systemMode : mode);

const getStoredThemeMode = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_MODE;
  }

  try {
    const storedThemeMode = window.localStorage.getItem(STORAGE_KEY);
    return normalizeThemeMode(storedThemeMode || DEFAULT_THEME_MODE);
  } catch (error) {
    return DEFAULT_THEME_MODE;
  }
};

const ThemeModeProvider = ({ children }) => {
  const [mode, setModeState] = useState(getStoredThemeMode);
  const [systemMode, setSystemMode] = useState(getSystemThemeMode);
  const resolvedMode = resolveThemeMode(mode, systemMode);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      setSystemMode(mediaQuery.matches ? 'dark' : 'light');
    };

    handleMediaChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange);

      return () => {
        mediaQuery.removeEventListener('change', handleMediaChange);
      };
    }

    mediaQuery.addListener(handleMediaChange);

    return () => {
      mediaQuery.removeListener(handleMediaChange);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;

    root.dataset.theme = resolvedMode;
    root.style.setProperty('color-scheme', resolvedMode);

    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      // Ignore storage failures and keep the in-memory theme.
    }

    return () => {
      root.style.removeProperty('color-scheme');
    };
  }, [mode, resolvedMode]);

  const setMode = useCallback((nextMode) => {
    setModeState((currentMode) => {
      const resolvedMode = typeof nextMode === 'function' ? nextMode(currentMode) : nextMode;
      return normalizeThemeMode(resolvedMode);
    });
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((currentMode) => (
      resolveThemeMode(currentMode, getSystemThemeMode()) === 'dark' ? 'light' : 'dark'
    ));
  }, []);

  const value = useMemo(() => ({
    mode,
    resolvedMode,
    isDarkMode: resolvedMode === 'dark',
    setMode,
    toggleMode
  }), [mode, resolvedMode, setMode, toggleMode]);

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
};

const useThemeMode = () => useContext(ThemeModeContext);

export {
  DEFAULT_THEME_MODE,
  STORAGE_KEY as THEME_MODE_STORAGE_KEY,
  ThemeModeProvider,
  useThemeMode
};
