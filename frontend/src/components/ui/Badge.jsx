import React from 'react';

const variantMap = {
  primary: 'bg-[#FDF1EC] text-[#E05D38] dark:bg-[#341C16] dark:text-[#F4A261] border-[#F8D8CC] dark:border-[#52291E]',
  terracotta: 'bg-[#FDF1EC] text-[#E05D38] dark:bg-[#341C16] dark:text-[#F4A261] border-[#F8D8CC] dark:border-[#52291E]',
  peach: 'bg-[#FEF5ED] text-[#D97724] dark:bg-[#3C2413] dark:text-[#F4A261] border-[#FCE2CE] dark:border-[#5C361D]',
  secondary: 'bg-[#F0F6FC] text-[#2563EB] dark:bg-[#152336] dark:text-[#60A5FA] border-[#D6E4F8] dark:border-[#1E3A5F]',
  sage: 'bg-[#EEF6F4] text-[#2F6E5F] dark:bg-[#132B25] dark:text-[#56BBA4] border-[#D1E8E2] dark:border-[#1E473D]',
  success: 'bg-[#EEF6F4] text-[#2F6E5F] dark:bg-[#132B25] dark:text-[#56BBA4] border-[#D1E8E2] dark:border-[#1E473D]',
  warning: 'bg-[#FFF8EC] text-[#B45309] dark:bg-[#36220B] dark:text-[#FBBF24] border-[#FDE6B8] dark:border-[#573712]',
  error: 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#381414] dark:text-[#F87171] border-[#FCA5A5]/40 dark:border-[#5C1E1E]',
  danger: 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#381414] dark:text-[#F87171] border-[#FCA5A5]/40 dark:border-[#5C1E1E]',
  info: 'bg-[#F0F6FC] text-[#0284C7] dark:bg-[#132638] dark:text-[#38BDF8] border-[#BAE6FD] dark:border-[#1E4461]',
  neutral: 'bg-[#F8F5F0] text-[#475569] dark:bg-slate-800 dark:text-slate-300 border-[#E8E1D7] dark:border-slate-700',
};

const Badge = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${
        variantMap[variant] || variantMap.neutral
      } ${className}`}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
