import React from 'react';
import Spinner from './Spinner';

const variantClasses = {
  primary:
    'bg-brand-primary text-white hover:bg-brand-primary-hover focus:ring-brand-primary/30 shadow-warm-xs hover:shadow-warm-sm active:scale-[0.98]',
  terracotta:
    'bg-brand-terracotta text-white hover:bg-brand-terracotta-hover focus:ring-brand-terracotta/30 shadow-warm-xs hover:shadow-warm-sm active:scale-[0.98]',
  peach:
    'bg-brand-peach text-white hover:bg-brand-peach-hover focus:ring-brand-peach/30 shadow-warm-xs active:scale-[0.98]',
  secondary:
    'bg-[#EBF3FC] text-[#2563EB] hover:bg-[#DDEBFA] dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/70 focus:ring-blue-400/20 active:scale-[0.98]',
  sage:
    'bg-brand-sage text-white hover:bg-brand-sage-hover focus:ring-brand-sage/30 shadow-warm-xs active:scale-[0.98]',
  outline:
    'border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-200 hover:bg-[#FAF4EC] dark:hover:bg-slate-800/60 focus:ring-brand-primary/20 active:scale-[0.98]',
  ghost:
    'text-slate-600 dark:text-slate-300 hover:bg-[#FDF1EC]/70 dark:hover:bg-slate-800 hover:text-brand-primary focus:ring-slate-400/20',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/30 active:scale-[0.98]',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/30 active:scale-[0.98]',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs rounded-lg font-semibold',
  md: 'px-4 py-2 text-sm rounded-xl font-semibold',
  lg: 'px-5 py-2.5 text-base rounded-2xl font-semibold',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  type = 'button',
  icon: Icon = null,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  onClick,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer';

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${
        sizeClasses[size] || sizeClasses.md
      } ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Spinner size="sm" color="currentColor" className="mr-2" />
      ) : Icon && iconPosition === 'left' ? (
        <Icon className="w-4 h-4 mr-2" />
      ) : null}

      <span>{children}</span>

      {!isLoading && Icon && iconPosition === 'right' && (
        <Icon className="w-4 h-4 ml-2" />
      )}
    </button>
  );
};

export default Button;
