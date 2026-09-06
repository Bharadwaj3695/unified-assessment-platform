import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { NotFoundIllustration } from '../components/illustrations';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-5">
      <NotFoundIllustration className="w-56 h-56 object-contain drop-shadow-sm" />
      <div>
        <span className="text-xs font-bold tracking-widest uppercase text-[#E05D38] dark:text-[#F4A261] mb-1 block">
          Error 404
        </span>
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-[#1F2937] dark:text-[#F9FAFB] tracking-tight">
          Page Not Found
        </h2>
        <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto leading-relaxed">
          The assessment module, question resource, or page you were looking for could not be located or has been relocated.
        </p>
      </div>
      <div className="flex items-center space-x-3 pt-2">
        <Link to="/">
          <Button variant="primary" size="md" icon={Home}>
            Return Home
          </Button>
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2.5 rounded-xl border border-[#EBE3D8] dark:border-[#2D3748] text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] transition-colors flex items-center cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Go Back
        </button>
      </div>
    </div>
  );
};

export default NotFound;
