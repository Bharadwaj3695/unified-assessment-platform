// Import React core library and state/effect hooks for context management
import { createContext, useState, useEffect } from 'react';
// Import browser storage helper for persisting theme preference
import { storage } from '../utils/storage';

// React Context providing global dark/light theme state and toggle handler
export const ThemeContext = createContext(null);

// Context Provider component applying theme CSS classes to the HTML document root
export const ThemeProvider = ({ children }) => {
  // Initialize theme state lazily from browser storage, defaulting to 'light'
  const [theme, setTheme] = useState(() => storage.getTheme());

  // Effect synchronizing theme changes with HTML document element class list and storage
  useEffect(() => {
    // Select root document HTML element
    const root = document.documentElement;
    // If dark mode is selected, add 'dark' class for Tailwind CSS styling
    if (theme === 'dark') {
      // Add 'dark' class
      root.classList.add('dark');
    // Otherwise remove 'dark' class to revert to light mode
    } else {
      // Remove 'dark' class
      root.classList.remove('dark');
    }
    // Persist active theme choice in browser storage
    storage.setTheme(theme);
  // Re-run effect whenever theme state changes
  }, [theme]);

  // Toggle handler flipping between light and dark modes
  const toggleTheme = () => {
    // Switch light to dark or dark to light
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Provide theme context value to child components
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};
