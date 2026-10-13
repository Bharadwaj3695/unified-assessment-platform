// Import useNavigate hook from react-router-dom for programmatic route transitions
import { useNavigate } from 'react-router-dom';
// Import useTheme custom hook to toggle between dark and light appearance modes
import { useTheme } from '../../hooks/useTheme';
// Import useAuth custom hook to access the current authenticated user session and logout action
import { useAuth } from '../../hooks/useAuth';
// Import icons from lucide-react representing theme toggles, mobile drawer triggers, logout, and user identities
import { Sun, Moon, Menu, LogOut } from 'lucide-react';
// Import reusable Badge component for rendering color-coded role tags
import Badge from '../ui/Badge';
// Import reusable Button component for interactive controls
import Button from '../ui/Button';
// Import NotificationPopover component for displaying in-app alerts and notifications dropdown
import NotificationPopover from './NotificationPopover';
import { getInitials } from '../../utils/formatters';

// Header component rendering the top navigation bar with brand, theme toggle, notifications, and user session controls
const Header = ({ onMobileMenuToggle }) => {
  // Initialize navigate function for routing to different views
  const navigate = useNavigate();
  // Extract theme state and toggle function from theme context
  const { theme, toggleTheme } = useTheme();
  // Extract user profile, authentication flag, and logout handler from auth context
  const { user, isAuthenticated, logout } = useAuth();

  // Mapping object defining Badge color variants corresponding to each user role
  const roleVariant = {
    // Student role mapped to secondary badge style
    student: 'secondary',
    // Instructor role mapped to sage green badge style
    instructor: 'sage',
    // Admin role mapped to primary brand badge style
    admin: 'primary',
  };

  // Render header layout JSX
  return (
    // Top-level sticky header element with translucent background and bottom border
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-surface-light-border dark:border-surface-dark-border bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md px-4 sm:px-6 shadow-warm-xs">
      {/* Left container enclosing mobile drawer hamburger button and brand logo */}
      <div className="flex items-center space-x-3">
        {/* Render hamburger toggle button on small viewports when toggle handler is provided */}
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-cream dark:hover:bg-slate-800 focus:outline-none cursor-pointer"
            aria-label="Open navigation menu"
          >
            {/* Lucide Menu hamburger icon */}
            <Menu className="w-5 h-5" />
          {/* Close hamburger button */}
          </button>
        )}

        {/* Brand logo and platform title container with click handler navigating to home */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          {/* Terracotta-peach gradient logo icon container */}
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-extrabold text-base shadow-warm-xs">
            {/* Brand monogram character */}
            U
          {/* Close monogram container */}
          </div>
          {/* Platform brand text and subtitle container */}
          <div>
            {/* Primary platform name heading */}
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-100 block leading-tight">
              Unified Assessment
            {/* Close platform name */}
            </span>
            {/* Academic suite category label */}
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase hidden sm:block">
              EdTech Academic Suite
            {/* Close category label */}
            </span>
          {/* Close brand text container */}
          </div>
        {/* Close brand logo wrapper */}
        </div>
      {/* Close left header container */}
      </div>

      {/* Public Navigation Links displayed only when user is unauthenticated */}
      {!isAuthenticated && (
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          {/* Link to public features anchor */}
          <a href="/#features" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            Features
          </a>
          {/* Link to platform architecture anchor */}
          <a href="/#platform" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            Platform
          </a>
          {/* Link to roles breakdown anchor */}
          <a href="/#roles" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            Roles
          </a>
          {/* Link to security and integrity anchor */}
          <a href="/#security" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            Security
          </a>
          {/* Link to about section anchor */}
          <a href="/#about" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
            About
          </a>
        {/* Close public navigation bar */}
        </nav>
      )}

      {/* Right controls container for theme toggle, notifications, and user profile or sign-in buttons */}
      <div className="flex items-center space-x-3">
        {/* Theme switcher button toggling dark and light mode */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {/* Conditionally render Sun icon in dark mode and Moon icon in light mode */}
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        {/* Close theme toggle button */}
        </button>

        {/* Notifications Popover rendered when user is authenticated */}
        {isAuthenticated && <NotificationPopover />}

        {/* User profile controls rendered when authenticated, else sign-in / get started buttons */}
        {isAuthenticated && user ? (
          <div className="flex items-center space-x-3 pl-2 border-l border-surface-light-border dark:border-surface-dark-border">
            {/* User name and identifier badges displayed on medium and larger viewports */}
            <div className="hidden sm:flex flex-col items-end">
              {/* User display name */}
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center">
                {user.name}
              </span>
              {/* Academic ID badge row */}
              <div className="flex items-center space-x-1 mt-0.5">
                {/* Render locked student identifier badge if present */}
                {user.studentId && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    {user.studentId} 🔒
                  </span>
                )}
                {/* Render locked faculty identifier badge if present */}
                {user.facultyId && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    {user.facultyId} 🔒
                  </span>
                )}
                {/* Render locked admin identifier badge if present */}
                {user.adminId && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    {user.adminId} 🔒
                  </span>
                )}
                {/* Role badge with uppercase tracking */}
                <Badge variant={roleVariant[user.role] || 'neutral'} size="sm" className="uppercase tracking-wider text-[9px] py-0 px-1.5">
                  {user.role}
                </Badge>
              {/* Close badge row */}
              </div>
            {/* Close user info column */}
            </div>

            {/* Profile Picture / Avatar Icon container with click handler opening profile */}
            <div
              className="cursor-pointer"
              onClick={() => navigate(`/${user.role}/profile`)}
              title="View Profile"
            >
              {/* Conditionally render user avatar image or monogram fallback */}
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-xl object-cover border border-brand-terracotta/30 shadow-warm-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-peach/20 to-brand-terracotta/20 text-brand-terracotta font-bold text-xs flex items-center justify-center border border-brand-peach/40 shadow-warm-xs">
                  {getInitials(user.name, user.role?.charAt(0)?.toUpperCase() || 'U')}
                </div>
              )}
            {/* Close avatar container */}
            </div>

            {/* Sign out button clearing session and redirecting to login */}
            <button
              type="button"
              onClick={async () => {
                // Clear authentication tokens and local user session
                await logout();
                // Redirect user to login screen
                navigate('/auth/login', { replace: true });
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 focus:outline-none cursor-pointer"
              title="Sign Out"
              aria-label="Sign out"
            >
              {/* LogOut door exit icon */}
              <LogOut className="w-4 h-4" />
            {/* Close sign out button */}
            </button>
          {/* Close authenticated user session container */}
          </div>
        ) : (
          /* Render public Sign In and Get Started buttons when unauthenticated */
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Sign In navigation button */}
            <button
              type="button"
              onClick={() => navigate('/auth/login')}
              className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors cursor-pointer"
            >
              Sign In
            </button>
            {/* Get Started registration button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/auth/signup')}
            >
              Get Started
            </Button>
          {/* Close unauthenticated buttons container */}
          </div>
        )}
      {/* Close right controls container */}
      </div>
    {/* Close header element */}
    </header>
  );
};

// Export Header component as default export
export default Header;
