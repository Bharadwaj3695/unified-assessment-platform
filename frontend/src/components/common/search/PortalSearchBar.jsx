import React from 'react';
import StudentSearchBar from './StudentSearchBar';
import AdminSearchBar from './AdminSearchBar';
import InstructorSearchBar from './InstructorSearchBar';

/**
 * PortalSearchBar
 * Central RBAC search bar entry point for top navigation.
 * Renders the strictly role-scoped compact search component for:
 * - student: StudentSearchBar (Placeholder: 'Search assessments...')
 * - admin: AdminSearchBar (Placeholder: 'Search users, assessments...')
 * - instructor: InstructorSearchBar (Placeholder: 'Search students, questions...')
 */
const PortalSearchBar = ({ role }) => {
  if (!role) return null;

  switch (role) {
    case 'student':
      return <StudentSearchBar />;
    case 'admin':
      return <AdminSearchBar />;
    case 'instructor':
      return <InstructorSearchBar />;
    default:
      return null;
  }
};

export default PortalSearchBar;
