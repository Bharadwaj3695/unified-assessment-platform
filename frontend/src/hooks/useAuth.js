// Import useContext hook from React for consuming context values
import { useContext } from 'react';
// Import AuthContext definition containing authentication state and methods
import { AuthContext } from '../context/AuthContext';

// Custom hook providing convenient, type-safe access to authentication context
export const useAuth = () => {
  // Consume AuthContext instance
  const context = useContext(AuthContext);
  // Verify that hook is called within an enclosing AuthProvider tree
  if (!context) {
    // Throw error if invoked outside AuthProvider hierarchy
    throw new Error('useAuth must be used within an AuthProvider');
  }
  // Return authentication context object
  return context;
};
