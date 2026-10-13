// Import useContext hook from React for consuming context values
import { useContext } from 'react';
// Import ThemeContext definition containing theme state and toggle method
import { ThemeContext } from '../context/ThemeContext';

// Custom hook providing convenient access to theme context
export const useTheme = () => {
  // Consume ThemeContext instance
  const context = useContext(ThemeContext);
  // Verify that hook is called within an enclosing ThemeProvider tree
  if (!context) {
    // Throw error if invoked outside ThemeProvider hierarchy
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  // Return theme context object
  return context;
};
