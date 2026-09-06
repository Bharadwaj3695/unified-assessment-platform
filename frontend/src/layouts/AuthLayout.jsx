import React from 'react';
import { Outlet } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

const AuthLayout = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF9F2] dark:bg-[#12161F] text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <header className="flex justify-between items-center px-6 py-4 border-b border-surface-light-border dark:border-surface-dark-border bg-white/80 dark:bg-surface-dark/80 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-extrabold text-base shadow-warm-xs">
            U
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-100 block leading-tight">
              Unified Assessment
            </span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
              EdTech Academic Suite
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
