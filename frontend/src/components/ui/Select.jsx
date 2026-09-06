import React from 'react';
import { ChevronDown } from 'lucide-react';

const Select = ({
  label,
  id,
  name,
  value,
  onChange,
  onBlur,
  options = [],
  placeholder = 'Select an option',
  error,
  helperText,
  disabled = false,
  required = false,
  className = '',
  ...props
}) => {
  const selectId = id || name;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label}
          {required && <span className="text-brand-primary ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          className={`w-full appearance-none rounded-xl border bg-white dark:bg-surface-dark px-3.5 py-2.5 pr-9 text-sm text-slate-900 dark:text-slate-100 transition-all duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-surface-light-border dark:border-surface-dark-border focus:border-brand-primary focus:ring-brand-primary/20'
          }`}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {error ? (
        <p id={`${selectId}-error`} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${selectId}-helper`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

export default Select;
