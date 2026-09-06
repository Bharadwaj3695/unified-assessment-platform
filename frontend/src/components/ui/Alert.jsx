import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const alertTypeMap = {
  info: {
    icon: Info,
    container: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900 text-sky-800 dark:text-sky-300',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
  success: {
    icon: CheckCircle2,
    container: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    container: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  error: {
    icon: AlertCircle,
    container: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300',
    iconColor: 'text-red-600 dark:text-red-400',
  },
};

const Alert = ({ type = 'info', title, children, className = '' }) => {
  const config = alertTypeMap[type] || alertTypeMap.info;
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={`flex items-start p-4 rounded-xl border ${config.container} ${className}`}
    >
      <Icon className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
      <div className="text-sm">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Alert;
