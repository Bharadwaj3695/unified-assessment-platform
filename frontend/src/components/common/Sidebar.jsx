import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  ChevronDown,
  LogOut,
} from 'lucide-react';
import {
  getNavigationForRole,
  isNavigationItemActive,
  isSectionActive,
} from '../../config/navigationConfig';

const Sidebar = ({ className = '', onItemClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, logout } = useAuth();

  const navConfig = getNavigationForRole(role);
  const sections = navConfig?.sections || [];

  // Track collapsed sections; default is all sections expanded
  const [collapsedSections, setCollapsedSections] = useState({});

  // Ensure any section containing an active route stays expanded
  useEffect(() => {
    sections.forEach((section) => {
      if (isSectionActive(section, location.pathname)) {
        setCollapsedSections((prev) => {
          if (prev[section.id]) {
            const next = { ...prev };
            delete next[section.id];
            return next;
          }
          return prev;
        });
      }
    });
  }, [location.pathname, sections]);

  const toggleSection = (sectionId) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleProfileClick = () => {
    if (user?.role === 'admin') {
      navigate('/admin/settings');
    } else if (user?.role) {
      navigate(`/${user.role}/profile`);
    }
    if (onItemClick) {
      onItemClick();
    }
  };

  const widthClass = className.includes('w-') ? '' : 'w-64';

  return (
    <aside
      className={`flex flex-col justify-between ${widthClass} h-full flex-shrink-0 border-r border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-4 overflow-y-auto z-10 ${className}`}
      aria-label={`${role ? `${role} Workspace` : 'Main'} Navigation`}
    >
      <div>
        {/* Workspace Role Header */}
        <div className="px-3.5 py-1.5 mb-3 flex items-center justify-between border-b border-surface-light-border/60 dark:border-surface-dark-border/60 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {role ? `${role} Workspace` : 'Navigation'}
          </p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-primary-light/60 dark:bg-[#341C16] text-[#E05D38] dark:text-[#F4A261]">
            v1.0
          </span>
        </div>

        {/* Structured Navigation Groups */}
        <nav
          aria-label={`${role || 'Platform'} Navigation Sections`}
          className="space-y-4"
        >
          {sections.map((section) => {
            const isCollapsed = !!collapsedSections[section.id];
            const isOpen = !isCollapsed;
            const sectionHasActiveChild = isSectionActive(section, location.pathname);

            return (
              <div key={section.id} className="space-y-1">
                {/* Section Header */}
                {section.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={`section-${section.id}`}
                    id={`section-btn-${section.id}`}
                    className="w-full flex items-center justify-between px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer group"
                  >
                    <span className="flex items-center space-x-1.5">
                      <span>{section.title}</span>
                      {sectionHasActiveChild && isCollapsed && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-terracotta animate-pulse" />
                      )}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-200 ${
                        isOpen ? 'transform rotate-0' : 'transform -rotate-90'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <div className="px-3.5 py-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {section.title}
                    </p>
                  </div>
                )}

                {/* Section Items */}
                {isOpen && (
                  <ul
                    id={`section-${section.id}`}
                    role="list"
                    className="space-y-1"
                  >
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const linkActive = isNavigationItemActive(item, location.pathname);

                      return (
                        <li key={item.id || item.path}>
                          <Link
                            to={item.path}
                            onClick={onItemClick}
                            aria-current={linkActive ? 'page' : undefined}
                            title={item.description || item.name}
                            className={`group flex items-center justify-between px-3.5 py-2.5 text-sm font-semibold rounded-2xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 ${
                              linkActive
                                ? 'bg-brand-primary-light bg-[#FDECE2] text-[#E05D38] dark:bg-[#341C16] dark:text-[#F4A261] shadow-warm-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-[#FFF4EB]/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                            }`}
                          >
                            <div className="flex items-center min-w-0">
                              <Icon
                                className={`w-4 h-4 mr-3 flex-shrink-0 transition-colors ${
                                  linkActive
                                    ? 'text-[#E05D38] dark:text-[#F4A261] stroke-[2.25]'
                                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 stroke-[1.75]'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="truncate">{item.name}</span>
                            </div>
                            {item.badge && (
                              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:text-[#F4A261]">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile Box & Logout */}
      <div className="pt-4 mt-4 border-t border-surface-light-border dark:border-surface-dark-border space-y-2">
        {user && (
          <div
            className="px-3 py-2.5 rounded-2xl bg-[#FFF9F2] dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border cursor-pointer hover:border-brand-terracotta/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            onClick={handleProfileClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleProfileClick();
              }
            }}
            title="View Academic Profile"
            aria-label="View Academic Profile"
          >
            <div className="flex items-center space-x-2.5">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || 'User avatar'}
                  className="w-8 h-8 rounded-xl object-cover border border-brand-peach/40 shadow-warm-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-peach/20 to-brand-terracotta/20 text-brand-terracotta font-bold text-xs flex items-center justify-center border border-brand-peach/40 shadow-warm-xs">
                  {user.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                  {user.name || user.email}
                </p>
                <div className="flex items-center space-x-1 mt-0.5">
                  {user.studentId && (
                    <span className="text-[10px] font-mono text-amber-800 dark:text-amber-300 font-semibold truncate">
                      {user.studentId} 🔒
                    </span>
                  )}
                  {user.facultyId && (
                    <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 font-semibold truncate">
                      {user.facultyId} 🔒
                    </span>
                  )}
                  {user.adminId && (
                    <span className="text-[10px] font-mono text-indigo-800 dark:text-indigo-300 font-semibold truncate">
                      {user.adminId} 🔒
                    </span>
                  )}
                  {!user.studentId && !user.facultyId && !user.adminId && (
                    <span className="text-[10px] text-slate-400 capitalize">
                      {user.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/auth/login');
            if (onItemClick) onItemClick();
          }}
          className="w-full flex items-center px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="Sign out of platform"
        >
          <LogOut className="w-4 h-4 mr-3" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
