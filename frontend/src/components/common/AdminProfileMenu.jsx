import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Smartphone,
  Monitor,
  LogOut,
  Shield,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminPreview } from '../../context/AdminPreviewContext';
import { getInitials } from '../../utils/formatters';
import Badge from '../ui/Badge';

const AdminProfileMenu = ({ user }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isPreviewActive, openPreview, closePreview } = useAdminPreview();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close popover when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleNavigateProfile = () => {
    setIsOpen(false);
    navigate('/admin/profile');
  };

  const handleOpenPreview = () => {
    setIsOpen(false);
    openPreview('mobile');
  };

  const handleReturnToDesktop = () => {
    setIsOpen(false);
    closePreview();
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Profile Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center space-x-1.5 p-0.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[#E05D38] cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Admin Profile and System Menu"
      >
        {/* Admin Avatar or Monogram */}
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-xl object-cover border border-indigo-400/40 shadow-warm-xs"
          />
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-200 dark:from-indigo-950 dark:to-blue-900 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-400/40 shadow-warm-xs">
            {getInitials(user.name, 'A')}
          </div>
        )}

        {/* Small subtle dropdown arrow */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-slate-600 dark:text-slate-200' : ''
          }`}
        />
      </button>

      {/* Accessible Popover Dropdown */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label="Admin Profile Menu"
          className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-full mt-1 sm:mt-2 w-auto sm:w-80 max-w-[calc(100vw-1rem)] sm:max-w-none rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 text-left"
        >
          {/* Popover Header: Admin Identity & Identifier */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start space-x-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl object-cover border border-indigo-400/40 flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-200 dark:from-indigo-950 dark:to-blue-900 text-indigo-700 dark:text-indigo-300 font-bold text-sm flex items-center justify-center border border-indigo-400/40 flex-shrink-0">
                  {getInitials(user.name, 'A')}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user.email}
                </p>

                <div className="flex items-center space-x-1.5 mt-1.5">
                  <Badge variant="primary" size="sm" className="text-[10px] uppercase font-semibold">
                    Administrator
                  </Badge>

                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    {user.adminId || 'ADM-ROOT'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Action Items */}
          <div className="p-2 space-y-1">
            {/* 1. View Profile Action */}
            <button
              type="button"
              role="menuitem"
              onClick={handleNavigateProfile}
              className="w-full flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-2.5 text-slate-500 group-hover:text-[#E05D38] transition-colors flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#E05D38] transition-colors">
                  View Profile
                </p>
                <p className="text-[11px] text-slate-400 font-normal">
                  Institutional identity, credentials &amp; security status
                </p>
              </div>
            </button>

            {/* 2. Responsive Preview Action */}
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenPreview}
              className="w-full flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center mr-2.5 text-amber-600 dark:text-amber-400 group-hover:text-[#E05D38] transition-colors flex-shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#E05D38] transition-colors">
                  Responsive Preview
                </p>
                <p className="text-[11px] text-slate-400 font-normal">
                  Simulate Mobile, Tablet &amp; Desktop viewports
                </p>
              </div>
            </button>

            {/* 3. Return to Desktop Action (SHOWN ONLY WHEN PREVIEW MODE IS ACTIVE) */}
            {isPreviewActive && (
              <button
                type="button"
                role="menuitem"
                onClick={handleReturnToDesktop}
                className="w-full flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50 transition-colors text-left group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mr-2.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-emerald-900 dark:text-emerald-200">
                    Return to Desktop
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-normal">
                    Exit device simulation and restore standard view
                  </p>
                </div>
              </button>
            )}
          </div>

          {/* Sign Out Button in Footer */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfileMenu;
