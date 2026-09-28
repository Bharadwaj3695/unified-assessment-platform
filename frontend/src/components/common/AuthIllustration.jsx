import React from 'react';
import { AuthHeroIllustration } from '../illustrations';

const AuthIllustration = ({ role = 'student', className = '' }) => {
  return (
    <div className={`relative w-full max-w-[180px] sm:max-w-[220px] lg:max-w-[240px] mx-auto flex items-center justify-center py-1 ${className}`}>
      <AuthHeroIllustration className="w-full h-auto max-h-20 sm:max-h-24 lg:max-h-24 object-contain" />
    </div>
  );
};

export default AuthIllustration;
