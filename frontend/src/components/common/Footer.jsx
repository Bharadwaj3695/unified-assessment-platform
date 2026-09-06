import React from 'react';

const Footer = () => {
  return (
    <footer className="border-t border-surface-light-border dark:border-surface-dark-border py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-surface-light/50 dark:bg-surface-dark/50">
      <p>© {new Date().getFullYear()} Unified Assessment Platform · Academic & Technical Evaluation Suite</p>
    </footer>
  );
};

export default Footer;
