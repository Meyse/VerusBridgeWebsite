import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

const STORAGE_KEY = 'verus-bridge-theme-mode';
const DEFAULT_THEME_MODE = 'dark';

const noop = () => {};

const ThemeModeContext = createContext({
  mode: DEFAULT_THEME_MODE,
  isDarkMode: true,
  setMode: noop,
  toggleMode: noop
});

const normalizeThemeMode = (value) => (value === 'light' ? 'light' : 'dark');

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

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;

    root.dataset.theme = mode;
    root.style.setProperty('color-scheme', mode);

    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      // Ignore storage failures and keep the in-memory theme.
    }

    return () => {
      root.style.removeProperty('color-scheme');
    };
  }, [mode]);

  const setMode = useCallback((nextMode) => {
    setModeState((currentMode) => {
      const resolvedMode = typeof nextMode === 'function' ? nextMode(currentMode) : nextMode;
      return normalizeThemeMode(resolvedMode);
    });
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((currentMode) => (currentMode === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({
    mode,
    isDarkMode: mode === 'dark',
    setMode,
    toggleMode
  }), [mode, setMode, toggleMode]);

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
