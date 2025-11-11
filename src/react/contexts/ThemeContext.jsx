import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Theme modes: 'light', 'dark', 'system'
  const [themeMode, setThemeMode] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('light');

  // Load theme preference from electron store
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await window.electronAPI?.store?.get('themeMode');
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeMode(savedTheme);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      }
    };

    loadTheme();
  }, []);

  // Resolve actual theme (light/dark) based on mode
  useEffect(() => {
    const applyTheme = () => {
      let theme = themeMode;

      // If system mode, detect system preference
      if (themeMode === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = isDark ? 'dark' : 'light';
      }

      setResolvedTheme(theme);

      // Apply dark class to document element
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen for system theme changes when in system mode
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();

      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
      // Fallback for older browsers
      else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, [themeMode]);

  // Change theme mode
  const setTheme = async (mode) => {
    if (!['light', 'dark', 'system'].includes(mode)) {
      console.error('Invalid theme mode:', mode);
      return;
    }

    setThemeMode(mode);

    // Persist to electron store
    try {
      await window.electronAPI?.store?.set('themeMode', mode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const value = {
    themeMode,        // 'light', 'dark', or 'system'
    resolvedTheme,    // 'light' or 'dark' (actual theme being used)
    setTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
