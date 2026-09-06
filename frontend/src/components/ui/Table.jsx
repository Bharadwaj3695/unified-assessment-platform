import React from 'react';

export const Table = ({ children, className = '' }) => (
  <div className="w-full overflow-x-auto rounded-2xl border border-surface-light-border dark:border-surface-dark-border">
    <table className={`w-full text-left text-sm text-slate-700 dark:text-slate-200 divide-y divide-surface-light-border dark:divide-surface-dark-border ${className}`}>
      {children}
    </table>
  </div>
);

export const TableHead = ({ children, className = '' }) => (
  <thead className={`bg-[#FAF5EE] dark:bg-surface-dark-muted text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider ${className}`}>
    {children}
  </thead>
);

export const TableBody = ({ children, className = '' }) => (
  <tbody className={`divide-y divide-surface-light-border dark:divide-surface-dark-border bg-white dark:bg-surface-dark ${className}`}>
    {children}
  </tbody>
);

export const TableRow = ({ children, className = '', onClick = null }) => (
  <tr
    onClick={onClick}
    className={`transition-colors ${
      onClick ? 'cursor-pointer hover:bg-[#FFF9F2] dark:hover:bg-slate-800/50' : 'hover:bg-[#FFFBF7] dark:hover:bg-slate-800/30'
    } ${className}`}
  >
    {children}
  </tr>
);

export const TableHeader = ({ children, className = '' }) => (
  <th scope="col" className={`px-5 py-3.5 ${className}`}>
    {children}
  </th>
);

export const TableCell = ({ children, className = '' }) => (
  <td className={`px-5 py-4 whitespace-nowrap text-sm ${className}`}>
    {children}
  </td>
);
