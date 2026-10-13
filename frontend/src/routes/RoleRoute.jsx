// Import Outlet component from react-router-dom to render nested child route components
import {Outlet } from 'react-router-dom';
// Import custom useAuth hook to inspect the authenticated user's role
import { useAuth } from '../hooks/useAuth';
// Import reusable Alert component for displaying authorization failure notices
import Alert from '../components/ui/Alert';
// Import reusable Button component for navigation fallback
import Button from '../components/ui/Button';

// Role-Based Access Control route guard restricting child routes to specified user roles
const RoleRoute = ({ allowedRoles = [] }) => {
  // Destructure authenticated user profile and active role from authentication context
  const { user, role } = useAuth();

  // If user is absent or their active role is not in the allowed roles list, display Access Denied banner
  if (!user || !allowedRoles.includes(role)) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        {/* Render error banner explaining required role permissions */}
        <Alert
          type="error"
          title="Access Denied"
          className="mb-4"
        >
          Your current role (<strong className="capitalize">{role || 'guest'}</strong>) does not have permission to access this area. Requires one of: {allowedRoles.join(', ')}.
        </Alert>
        {/* Provide return navigation button allowing user to step back in browser history */}
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  // User has requisite role authorization; render child route hierarchy
  return <Outlet />;
};

// Export RoleRoute component for route definition in AppRoutes
export default RoleRoute;
