import React from 'react';

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-3',
  xl: 'w-14 h-14 border-4',
};

const Spinner = ({ size = 'md', className = '', color = 'border-brand-primary' }) => {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-solid border-t-transparent ${
        sizeMap[size] || sizeMap.md
      } ${color} ${className}`}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;
