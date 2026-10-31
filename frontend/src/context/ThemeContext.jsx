import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('airship_theme');
      if (savedTheme !== null) {
        return savedTheme === 'dark';
      }
      return false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-theme');
        localStorage.setItem('airship_theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('dark-theme');
        localStorage.setItem('airship_theme', 'light');
      }
    } catch (e) {
      console.error(e);
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDarkMode, setIsDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      isDarkMode: typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark',
      setIsDarkMode: () => {},
      toggleTheme: () => {}
    };
  }
  return context;
};

export default ThemeContext;
