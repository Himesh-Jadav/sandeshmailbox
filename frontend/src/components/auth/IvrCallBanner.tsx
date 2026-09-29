import React, { useState } from 'react';

interface IvrCallBannerProps {
  className?: string;
}

export const IvrCallBanner: React.FC<IvrCallBannerProps> = ({ className = '' }) => {
  const [copied, setCopied] = useState(false);
  const phoneNumber = '+14126846774';
  const displayPhone = '+1 (412) 684-6774';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phoneNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-white dark:from-slate-900/90 dark:via-blue-950/30 dark:to-slate-900/80 p-3 sm:p-3.5 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.12)] dark:shadow-[0_4px_25px_-5px_rgba(30,58,138,0.3)] backdrop-blur-md transition-all hover:shadow-[0_6px_24px_-4px_rgba(59,130,246,0.2)] ${className}`}
    >
      {/* Decorative ambient gradient */}
      <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-blue-500/10 dark:bg-blue-400/10 blur-xl pointer-events-none" />

      {/* Header Row: Live indicator + instruction + Actions */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center space-x-1.5 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 tracking-tight truncate">
            Press 1 on Call to Sign Up
          </span>
        </div>

        {/* Action Buttons: Call & Copy */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy phone number"
            className="px-2 py-1 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-2xs transition-all cursor-pointer text-xs flex items-center space-x-1 active:scale-95"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-[11px] font-medium">Copy</span>
              </>
            )}
          </button>

          <a
            href={`tel:${phoneNumber}`}
            className="px-2.5 py-1 rounded-lg sm:rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all flex items-center space-x-1 active:scale-95"
          >
            <span>Call</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>

      {/* Main Content: Phone Number (Full visibility across all views without truncation) */}
      <div className="flex items-center space-x-2.5 pt-0.5">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-blue-500/30">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        </div>
        <a
          href={`tel:${phoneNumber}`}
          className="text-sm sm:text-base font-bold font-mono text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors tracking-tight whitespace-nowrap"
        >
          {displayPhone}
        </a>
      </div>
    </div>
  );
};
