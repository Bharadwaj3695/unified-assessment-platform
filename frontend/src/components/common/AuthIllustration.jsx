import React from 'react';
import { AuthHeroIllustration } from '../illustrations';

const AuthIllustration = ({ role = 'student' }) => {
  return (
    <div className="relative w-full max-w-lg mx-auto flex items-center justify-center p-4">
      <AuthHeroIllustration />
    </div>
  );
};

export default AuthIllustration;
