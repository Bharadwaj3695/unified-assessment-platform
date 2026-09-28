import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t border-surface-light-border dark:border-surface-dark-border bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xs transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7 lg:py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-8 mb-6 lg:mb-8">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-extrabold text-sm shadow-warm-xs">
                U
              </div>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">
                Unified Assessment Platform
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
              An integrated academic evaluation suite uniting question banking, proctored examinations, 
              rubric-based grading, and student performance analytics into a single cohesive platform.
            </p>
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Evaluation Services Operational</span>
            </div>
          </div>

          {/* Platform Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3">
              Platform
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>
                <a href="/#features" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
                  Question Bank
                </a>
              </li>
              <li>
                <a href="/#features" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
                  Intelligent Question Import
                </a>
              </li>
              <li>
                <a href="/#platform" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
                  Assessment Lifecycle
                </a>
              </li>
              <li>
                <a href="/#features" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
                  Rubric Evaluation
                </a>
              </li>
            </ul>
          </div>

          {/* Workspaces Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3">
              Workspaces
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>
                <a href="/#roles" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
                  Student Portal
                </a>
              </li>
              <li>
                <a href="/#roles" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
                  Instructor Studio
                </a>
              </li>
              <li>
                <a href="/#roles" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
                  Admin Governance
                </a>
              </li>
              <li>
                <a href="/#security" className="hover:text-brand-terracotta dark:hover:text-brand-peach transition-colors">
                  Security & Proctoring
                </a>
              </li>
            </ul>
          </div>

          {/* Institutional Trust Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 mb-3">
              Institutional Trust
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-sage flex-shrink-0" />
                <span>Role-Based Access</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-sage flex-shrink-0" />
                <span>Autosave Resilience</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-sage flex-shrink-0" />
                <span>Immutable Audit Logs</span>
              </li>
              <li className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                Support: <span className="font-mono text-slate-600 dark:text-slate-400">support@uap.edu</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-surface-light-border dark:border-surface-dark-border pt-4 sm:pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p>
            © {new Date().getFullYear()} Unified Assessment Platform (UAP). All rights reserved.
          </p>
          <p className="flex items-center space-x-2">
            <span>Academic & Technical Evaluation Suite</span>
            <span>·</span>
            <span className="font-medium text-brand-terracotta dark:text-brand-peach">Production Grade</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
