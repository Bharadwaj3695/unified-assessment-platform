import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import MobileDrawer from '../components/common/MobileDrawer';
import Footer from '../components/common/Footer';
import AppFooter from '../components/common/AppFooter';

const MainLayout = ({ showSidebar = true, footerVariant = 'compact', footer }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef(null);

  // Deterministically reset main content scroll container and window to top on route pathname change
  useEffect(() => {
    if (mainRef.current) {
      if (typeof mainRef.current.scrollTo === 'function') {
        mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
      mainRef.current.scrollTop = 0;
      mainRef.current.scrollLeft = 0;
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-screen h-[100dvh] overflow-hidden bg-bg-light dark:bg-bg-dark text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <Header onMobileMenuToggle={() => setMobileMenuOpen(true)} />

      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {showSidebar && (
          <Sidebar className="hidden lg:flex flex-shrink-0" />
        )}

        <MobileDrawer
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {footerVariant === 'marketing' ? (
          <main ref={mainRef} className="flex-1 flex flex-col overflow-y-auto min-w-0">
            <div className="flex-1 p-3.5 sm:p-5 lg:p-6 xl:p-8">
              <div className="max-w-7xl mx-auto w-full">
                <Outlet />
              </div>
            </div>
            {footer ? footer : <Footer />}
          </main>
        ) : (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
            <main ref={mainRef} tabIndex={-1} className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 focus:outline-none">
              <div className="p-3.5 sm:p-5 lg:p-6 xl:p-8">
                <div className="max-w-7xl mx-auto w-full">
                  <Outlet />
                </div>
              </div>
            </main>
            {footer ? footer : <AppFooter className="flex-shrink-0 z-20" />}
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout;

