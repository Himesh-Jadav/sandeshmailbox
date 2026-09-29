import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    try {
      const root = document.documentElement;
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff';
      localStorage.setItem('sandesh_theme', 'light');
    } catch {
      // Ignore in environments without window / localStorage
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme, setTheme };
}
