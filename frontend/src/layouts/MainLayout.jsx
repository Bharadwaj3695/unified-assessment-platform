import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import MobileDrawer from '../components/common/MobileDrawer';
import Footer from '../components/common/Footer';

const MainLayout = ({ showSidebar = true }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

        <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
          <div className="flex-1 p-3.5 sm:p-5 lg:p-6 xl:p-8">
            <div className="max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
