import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { Sun, Moon, Menu, LogOut, User as UserIcon } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import NotificationPopover from './NotificationPopover';

const Header = ({ onMobileMenuToggle }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();

  const roleVariant = {
    student: 'secondary',
    instructor: 'sage',
    admin: 'primary',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-surface-light-border dark:border-surface-dark-border bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md px-4 sm:px-6 shadow-warm-xs">
      <div className="flex items-center space-x-3">
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-cream dark:hover:bg-slate-800 focus:outline-none cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-extrabold text-base shadow-warm-xs">
            U
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-100 block leading-tight">
              Unified Assessment
            </span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase hidden sm:block">
              EdTech Academic Suite
            </span>
          </div>
        </div>
      </div>

      {/* Public Navigation Links (when unauthenticated) */}
      {!isAuthenticated && (
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="/#features" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            Features
          </a>
          <a href="/#platform" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            Platform
          </a>
          <a href="/#roles" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            Roles
          </a>
          <a href="/#security" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            Security
          </a>
          <a href="/#about" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            About
          </a>
        </nav>
      )}

      <div className="flex items-center space-x-3">
        {/* Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {/* Notifications Popover */}
        {isAuthenticated && <NotificationPopover />}

        {isAuthenticated && user ? (
          <div className="flex items-center space-x-3 pl-2 border-l border-surface-light-border dark:border-surface-dark-border">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center">
                {user.name}
              </span>
              <div className="flex items-center space-x-1 mt-0.5">
                {user.studentId && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    {user.studentId} 🔒
                  </span>
                )}
                {user.facultyId && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    {user.facultyId} 🔒
                  </span>
                )}
                {user.adminId && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    {user.adminId} 🔒
                  </span>
                )}
                <Badge variant={roleVariant[user.role] || 'neutral'} size="sm" className="uppercase tracking-wider text-[9px] py-0 px-1.5">
                  {user.role}
                </Badge>
              </div>
            </div>

            {/* Profile Picture / Avatar Icon */}
            <div
              className="cursor-pointer"
              onClick={() => navigate(`/${user.role}/profile`)}
              title="View Profile"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-xl object-cover border border-brand-terracotta/30 shadow-warm-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-peach/20 to-brand-terracotta/20 text-brand-terracotta font-bold text-xs flex items-center justify-center border border-brand-peach/40 shadow-warm-xs">
                  {user.name?.charAt(0) || 'U'}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/auth/login');
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 focus:outline-none"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              type="button"
              onClick={() => navigate('/auth/login')}
              className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/auth/signup')}
            >
              Get Started
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
