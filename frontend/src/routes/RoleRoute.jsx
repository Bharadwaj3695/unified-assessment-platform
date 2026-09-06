import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';

const RoleRoute = ({ allowedRoles = [] }) => {
  const { user, role } = useAuth();

  if (!user || !allowedRoles.includes(role)) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <Alert
          type="error"
          title="Access Denied"
          className="mb-4"
        >
          Your current role (<strong className="capitalize">{role || 'guest'}</strong>) does not have permission to access this area. Requires one of: {allowedRoles.join(', ')}.
        </Alert>
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return <Outlet />;
};

export default RoleRoute;
