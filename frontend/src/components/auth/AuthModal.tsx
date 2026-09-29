import React from 'react';
import { SandeshAuthCard } from './SandeshAuthCard';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'register';
  initialPhone?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
      {/* Modal Dialog Content */}
      <div className="relative w-full max-w-[440px] my-auto">
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-2 sm:-top-4 sm:-right-4 z-50 h-9 w-9 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-transform hover:scale-105"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* The Login/Register Card */}
        <SandeshAuthCard
          initialMode={initialMode}
          onSuccess={onClose}
          isModal={true}
        />
      </div>
    </div>
  );
};
