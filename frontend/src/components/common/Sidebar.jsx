// Import React core library and hooks for local state and effect lifecycles
import { useState, useEffect } from 'react';
// Import routing components and hooks from react-router-dom for navigation links and location tracking
import { Link, useLocation, useNavigate } from 'react-router-dom';
// Import custom useAuth hook to access active user profile and logout action
import { useAuth } from '../../hooks/useAuth';
// Import icons from lucide-react for section expansion toggles, hamburger toggle, and sign-out controls
import {
  ChevronDown,
  LogOut,
  Menu,
} from 'lucide-react';
// Import navigation configuration resolvers and path matching helper utilities
import {
  getNavigationForRole,
  isNavigationItemActive,
  isSectionActive,
} from '../../config/navigationConfig';
import { getInitials } from '../../utils/formatters';
import { storage } from '../../utils/storage';

// Primary desktop and drawer navigation sidebar rendering role-tailored links and academic profile card
const Sidebar = ({ className = '', onItemClick, collapsible }) => {
  // Programmatic navigation hook
  const navigate = useNavigate();
  // Current router URL location hook
  const location = useLocation();
  // Destructure user profile, role string, and logout function from authentication context
  const { user, role, logout } = useAuth();

  // Retrieve navigation sections configuration matching caller's active role
  const navConfig = getNavigationForRole(role);
  // Extract sections array with fallback to empty list
  const sections = navConfig?.sections || [];

  // Determine whether sidebar is allowed to be collapsible
  // Enabled for all authenticated workspaces on desktop by default, or if explicitly configured via prop
  const isCollapsible = collapsible !== undefined ? collapsible : (!onItemClick && Boolean(role));

  // Sidebar collapse state; initialized from localStorage persistence if collapsible
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return storage.getSidebarCollapsed(role);
  });

  // Keep collapse state synced if role resolves asynchronously
  useEffect(() => {
    if (role) {
      setIsCollapsed(storage.getSidebarCollapsed(role));
    }
  }, [role]);

  // Effective collapsed flag (strictly true only when collapse capability is permitted)
  const effectiveCollapsed = isCollapsible && isCollapsed;

  // Toggle handler for collapse/expand
  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      storage.setSidebarCollapsed(role, next);
      return next;
    });
  };

  // Track collapsed sections; default is all sections expanded
  // State map recording collapsed state boolean per section ID
  const [collapsedSections, setCollapsedSections] = useState({});

  // Ensure any section containing an active route stays expanded
  // Effect automatically expanding any collapsible section whose child route matches the current URL
  useEffect(() => {
    // Iterate across defined navigation sections
    sections.forEach((section) => {
      // Check if current URL pathname matches any item within this section
      if (isSectionActive(section, location.pathname)) {
        // Expand section by removing its ID from collapsed state map
        setCollapsedSections((prev) => {
          // If section was currently collapsed
          if (prev[section.id]) {
            // Clone state map and remove collapsed entry
            const next = { ...prev };
            // Delete collapsed section key
            delete next[section.id];
            // Return updated map
            return next;
          }
          // Return unmodified map if already open
          return prev;
        });
      }
    });
  // Re-run effect when pathname or navigation sections change
  }, [location.pathname, sections]);

  // Toggle handler flipping a section between expanded and collapsed states
  const toggleSection = (sectionId) => {
    // Invert collapsed boolean flag for clicked section ID
    setCollapsedSections((prev) => ({
      // Preserve other section states
      ...prev,
      // Invert current section state
      [sectionId]: !prev[sectionId],
    }));
  };

  // Navigates user to their role-specific settings or profile page when profile box is clicked
  const handleProfileClick = () => {
    // Administrators navigate to global settings
    if (user?.role === 'admin') {
      // Navigate to admin settings
      navigate('/admin/settings');
    // Instructors and students navigate to their respective profile studio
    } else if (user?.role) {
      // Navigate to role profile route
      navigate(`/${user.role}/profile`);
    }
    // If optional onItemClick callback provided (e.g. mobile drawer close), invoke it
    if (onItemClick) {
      // Call item click handler
      onItemClick();
    }
  };

  // Determine width CSS class
  // When collapsed, width is w-20 (80px), otherwise defaults to w-64
  const widthClass = className.includes('w-')
    ? ''
    : effectiveCollapsed
      ? 'w-20'
      : 'w-64';

  // Render sidebar layout markup
  return (
    <aside
      className={`flex flex-col justify-between ${widthClass} ${
        effectiveCollapsed ? 'px-2.5 py-4' : 'p-4'
      } h-full flex-shrink-0 border-r border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark overflow-y-auto overflow-x-hidden z-10 transition-[width,padding] duration-300 ease-in-out motion-reduce:transition-none ${className}`}
      aria-label={`${role ? `${role} Workspace` : 'Main'} Navigation`}
    >
      <div>
        {/* Top Hamburger Collapse Control */}
        {isCollapsible && (
          <div
            className={`flex items-center mb-3 ${
              effectiveCollapsed ? 'justify-center py-1' : 'justify-between px-1 py-1'
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-[#FFF4EB]/80 dark:hover:bg-slate-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer flex-shrink-0"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>
              {!effectiveCollapsed && (
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                  Unified Assessment
                </span>
              )}
            </div>
          </div>
        )}

        {/* Workspace Role Header (hidden when collapsed) */}
        {!effectiveCollapsed && (
          <div className="px-3.5 py-1.5 mb-3 border-b border-surface-light-border/60 dark:border-surface-dark-border/60 pb-2">
            {/* Active workspace title label */}
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {role ? `${role} Workspace` : 'Navigation'}
            </p>
          </div>
        )}

        {/* Structured Navigation Groups */}
        {effectiveCollapsed ? (
          /* Collapsed Icon-Only Navigation View */
          <nav
            aria-label={`${role || 'Platform'} Navigation Sections`}
            className="space-y-2"
          >
            {sections.map((section, sIndex) => {
              return (
                <div key={section.id} className="space-y-1">
                  {/* Subtle separator line between navigation groups */}
                  {sIndex > 0 && (
                    <div
                      className="my-2 border-t border-surface-light-border/60 dark:border-surface-dark-border/60"
                      role="separator"
                    />
                  )}
                  <ul role="list" className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const linkActive = isNavigationItemActive(item, location.pathname);

                      return (
                        <li key={item.id || item.path}>
                          <Link
                            to={item.path}
                            onClick={onItemClick}
                            aria-current={linkActive ? 'page' : undefined}
                            aria-label={item.name}
                            title={item.name}
                            className={`group relative flex items-center justify-center p-2.5 rounded-2xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 ${
                              linkActive
                                ? 'bg-brand-primary-light bg-[#FDECE2] text-[#E05D38] dark:bg-[#341C16] dark:text-[#F4A261] shadow-warm-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-[#FFF4EB]/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                            }`}
                          >
                            <Icon
                              className={`w-5 h-5 flex-shrink-0 transition-colors ${
                                linkActive
                                  ? 'text-[#E05D38] dark:text-[#F4A261] stroke-[2.25]'
                                  : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 stroke-[1.75]'
                              }`}
                              aria-hidden="true"
                            />
                            {/* Hover tooltip */}
                            <span
                              role="tooltip"
                              className="pointer-events-none fixed ml-12 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900/95 dark:bg-slate-800/95 rounded-lg shadow-warm-md whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none hidden md:block"
                            >
                              {item.name}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        ) : (
          /* Expanded Full-Width Navigation View */
          <nav
            aria-label={`${role || 'Platform'} Navigation Sections`}
            className="space-y-4"
          >
            {/* Map through navigation sections */}
            {sections.map((section) => {
              // Check if section is marked collapsed
              const isCollapsedSection = !!collapsedSections[section.id];
              // Open state is inverse of collapsed state
              const isOpen = !isCollapsedSection;
              // Determine if section contains currently active page URL
              const sectionHasActiveChild = isSectionActive(section, location.pathname);

              return (
                <div key={section.id} className="space-y-1">
                  {/* Section Header */}
                  {section.collapsible ? (
                    // Interactive accordion toggle button for collapsible sections
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={isOpen}
                      aria-controls={`section-${section.id}`}
                      id={`section-btn-${section.id}`}
                      className="w-full flex items-center justify-between px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer group"
                    >
                      <span className="flex items-center space-x-1.5">
                        {/* Section title */}
                        <span>{section.title}</span>
                        {/* Animated indicator pulse dot if section is collapsed while containing active page */}
                        {sectionHasActiveChild && isCollapsedSection && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-terracotta animate-pulse" />
                        )}
                      </span>
                      {/* Rotating chevron icon indicating open/closed state */}
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-200 ${
                          isOpen ? 'transform rotate-0' : 'transform -rotate-90'
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  ) : (
                    // Static header label for non-collapsible sections
                    <div className="px-3.5 py-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {section.title}
                      </p>
                    </div>
                  )}

                  {/* Section Items */}
                  {isOpen && (
                    // Unordered list of navigation links
                    <ul
                      id={`section-${section.id}`}
                      role="list"
                      className="space-y-1"
                    >
                      {/* Map through items in section */}
                      {section.items.map((item) => {
                        // Resolve item icon component
                        const Icon = item.icon;
                        // Determine if item matches active URL
                        const linkActive = isNavigationItemActive(item, location.pathname);

                        return (
                          <li key={item.id || item.path}>
                            {/* Navigation link element */}
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
                                {/* Route icon */}
                                <Icon
                                  className={`w-4 h-4 mr-3 flex-shrink-0 transition-colors ${
                                    linkActive
                                      ? 'text-[#E05D38] dark:text-[#F4A261] stroke-[2.25]'
                                      : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 stroke-[1.75]'
                                  }`}
                                  aria-hidden="true"
                                />
                                {/* Route label text */}
                                <span className="truncate">{item.name}</span>
                              </div>
                              {/* Optional badge chip (e.g. 'New', 'Proctor') */}
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
        )}
      </div>

      {/* Footer Profile Box & Logout */}
      <div className={`pt-4 mt-4 border-t border-surface-light-border dark:border-surface-dark-border space-y-2`}>
        {/* Render profile badge card when user is authenticated */}
        {user && (
          effectiveCollapsed ? (
            <div
              className="p-1.5 rounded-2xl bg-[#FFF9F2] dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border cursor-pointer hover:border-brand-terracotta/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary flex items-center justify-center relative group"
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
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || 'User avatar'}
                  className="w-8 h-8 rounded-xl object-cover border border-brand-peach/40 shadow-warm-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-peach/20 to-brand-terracotta/20 text-brand-terracotta font-bold text-xs flex items-center justify-center border border-brand-peach/40 shadow-warm-xs">
                  {getInitials(user.name, user.role?.charAt(0)?.toUpperCase() || 'U')}
                </div>
              )}
              <span
                role="tooltip"
                className="pointer-events-none fixed ml-12 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900/95 dark:bg-slate-800/95 rounded-lg shadow-warm-md whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none hidden md:block"
              >
                {user.name || 'View Academic Profile'}
              </span>
            </div>
          ) : (
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
                {/* User avatar image or fallback initials circle */}
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User avatar'}
                    className="w-8 h-8 rounded-xl object-cover border border-brand-peach/40 shadow-warm-xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-peach/20 to-brand-terracotta/20 text-brand-terracotta font-bold text-xs flex items-center justify-center border border-brand-peach/40 shadow-warm-xs">
                    {getInitials(user.name, user.role?.charAt(0)?.toUpperCase() || 'U')}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {/* User full name or email */}
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                    {user.name || user.email}
                  </p>
                  {/* Immutable academic identification badges */}
                  <div className="flex items-center space-x-1 mt-0.5">
                    {/* Permanent Student ID badge */}
                    {user.studentId && (
                      <span className="text-[10px] font-mono text-amber-800 dark:text-amber-300 font-semibold truncate">
                        {user.studentId} 🔒
                      </span>
                    )}
                    {/* Permanent Faculty ID badge */}
                    {user.facultyId && (
                      <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 font-semibold truncate">
                        {user.facultyId} 🔒
                      </span>
                    )}
                    {/* Permanent Admin ID badge */}
                    {user.adminId && (
                      <span className="text-[10px] font-mono text-indigo-800 dark:text-indigo-300 font-semibold truncate">
                        {user.adminId} 🔒
                      </span>
                    )}
                    {/* Fallback role label if no institutional ID assigned */}
                    {!user.studentId && !user.facultyId && !user.adminId && (
                      <span className="text-[10px] text-slate-400 capitalize">
                        {user.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* Global logout button purging local session and redirecting to sign-in */}
        <button
          type="button"
          onClick={async () => {
            // Clear session tokens
            await logout();
            // Redirect to login page
            navigate('/auth/login', { replace: true });
            // If mobile drawer open, close it
            if (onItemClick) onItemClick();
          }}
          className={`flex items-center text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 relative group ${
            effectiveCollapsed
              ? 'w-full justify-center p-2.5'
              : 'w-full px-3.5 py-2.5'
          }`}
          title="Sign Out"
          aria-label="Sign out of platform"
        >
          {/* Sign out logout icon */}
          <LogOut className={`w-4 h-4 ${effectiveCollapsed ? '' : 'mr-3'}`} aria-hidden="true" />
          {!effectiveCollapsed && <span>Sign Out</span>}
          {effectiveCollapsed && (
            <span
              role="tooltip"
              className="pointer-events-none fixed ml-12 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900/95 dark:bg-slate-800/95 rounded-lg shadow-warm-md whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none hidden md:block"
            >
              Sign Out
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

// Export Sidebar navigation component
export default Sidebar;

