import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  BookOpen,
  FileCheck2,
  User,
  PlusCircle,
  Users,
  ShieldCheck,
  Activity,
  LogOut,
} from 'lucide-react';

const studentLinks = [
  { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
  { name: 'Assessments', path: '/student/catalog', icon: BookOpen },
  { name: 'Submissions', path: '/student/submissions', icon: FileCheck2 },
  { name: 'Profile', path: '/student/profile', icon: User },
];

const instructorLinks = [
  { name: 'Dashboard', path: '/instructor/dashboard', icon: LayoutDashboard },
  { name: 'My Assessments', path: '/instructor/assessments', icon: BookOpen },
  { name: 'Create Assessment', path: '/instructor/create', icon: PlusCircle },
  { name: 'Submissions & Grading', path: '/instructor/submissions', icon: FileCheck2 },
  { name: 'Students', path: '/instructor/students', icon: Users },
  { name: 'Profile', path: '/instructor/profile', icon: User },
];

const adminLinks = [
  { name: 'System Overview', path: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'User Management', path: '/admin/users', icon: Users },
  { name: 'All Assessments', path: '/admin/assessments', icon: BookOpen },
  { name: 'Audit Logs', path: '/admin/logs', icon: Activity },
  { name: 'Settings', path: '/admin/settings', icon: ShieldCheck },
];

const Sidebar = ({ className = '', onItemClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, logout } = useAuth();

  const links =
    role === 'instructor'
      ? instructorLinks
      : role === 'admin'
      ? adminLinks
      : studentLinks;

  const isLinkActive = (itemPath) => {
    const currentPath = location.pathname;

    // Exact match
    if (currentPath === itemPath) return true;

    // Subpath matching: e.g. /admin/users/123 matches /admin/users
    if (currentPath.startsWith(`${itemPath}/`)) return true;

    // Related sub-route matching for nested/dynamic flows
    if (itemPath === '/instructor/assessments' && currentPath.startsWith('/instructor/edit')) {
      return true;
    }
    if (itemPath === '/instructor/submissions' && currentPath.startsWith('/instructor/evaluate')) {
      return true;
    }
    if (itemPath === '/student/catalog' && currentPath.startsWith('/student/attempt')) {
      return true;
    }

    // Role index redirects: e.g. /student or /instructor matching /.../dashboard
    if (itemPath.endsWith('/dashboard')) {
      const rolePrefix = itemPath.replace('/dashboard', '');
      if (currentPath === rolePrefix || currentPath === `${rolePrefix}/`) {
        return true;
      }
    }

    return false;
  };

  const widthClass = className.includes('w-') ? '' : 'w-64';

  return (
    <aside
      className={`flex flex-col justify-between ${widthClass} h-full flex-shrink-0 border-r border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-4 overflow-y-auto z-10 ${className}`}
    >
      <div>
        <div className="px-3.5 py-2 mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {role ? `${role} Workspace` : 'Navigation'}
          </p>
        </div>

        <nav className="space-y-1.5">
          {links.map((item) => {
            const Icon = item.icon;
            const linkActive = isLinkActive(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onItemClick}
                aria-current={linkActive ? 'page' : undefined}
                className={({ isActive: routerActive }) => {
                  const active = linkActive || routerActive;
                  return `group flex items-center px-3.5 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-150 ${
                    active
                      ? 'bg-[#FDECE2] text-[#E05D38] dark:bg-[#341C16] dark:text-[#F4A261] shadow-warm-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-[#FFF4EB]/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`;
                }}
              >
                {({ isActive: routerActive }) => {
                  const active = linkActive || routerActive;
                  return (
                    <>
                      <Icon
                        className={`w-4 h-4 mr-3 flex-shrink-0 transition-colors ${
                          active
                            ? 'text-[#E05D38] dark:text-[#F4A261] stroke-[2.25]'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 stroke-[1.75]'
                        }`}
                      />
                      <span>{item.name}</span>
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-surface-light-border dark:border-surface-dark-border space-y-2">
        {user && (
          <div className="px-3.5 py-2.5 rounded-2xl bg-[#FFF9F2] dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Authenticated
            </p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
              {user.name || user.email}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
              {user.email}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/auth/login');
          }}
          className="w-full flex items-center px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-3" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
