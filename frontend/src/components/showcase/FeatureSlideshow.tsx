import React, { useState, useEffect } from 'react';

interface SlidePage {
  id: string;
  tabLabel: string;
  title: string;
  description: string;
  tag: string;
  icon: React.ReactNode;
}

export const FeatureSlideshow: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const pages: SlidePage[] = [
    {
      id: 'page-mailbox',
      tabLabel: 'Mailbox',
      title: 'Your number is your mailbox',
      description: 'Instant sign-in with your mobile number. No passwords or usernames needed.',
      tag: '9328920645@sandesh.in',
      icon: (
        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'page-privacy',
      tabLabel: 'Privacy',
      title: 'Zero-knowledge encryption',
      description: 'End-to-end encrypted client-side. Only you and your recipient hold the keys.',
      tag: 'Client-Side Encrypted',
      icon: (
        <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="4" y="11" width="16" height="11" rx="2" strokeWidth="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'page-speed',
      tabLabel: 'Speed',
      title: 'Lightning-fast delivery',
      description: 'Sub-second real-time sync with seamless file sharing across devices.',
      tag: 'Sub-15ms Live Sync',
      icon: (
        <svg className="w-6 h-6 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: 'page-security',
      tabLabel: 'Security',
      title: 'Zero spam, zero trackers',
      description: 'Cryptographically verified senders with no ad trackers or promotional bots.',
      tag: '100% Spam Defense',
      icon: (
        <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  // Auto-play slideshow at medium speed (every 3.5s)
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % pages.length);
    }, 3500);

    return () => clearInterval(timer);
  }, [isPaused, pages.length]);

  const active = pages[currentPage];

  return (
    <div
      className="relative z-10 w-full max-w-[460px] mx-auto select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Page Card Frame — tighter, gap-free balanced layout */}
      <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl rounded-[28px] border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08),0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-300">
        
        {/* Top: Page Tabs / Switcher */}
        <div className="flex items-center justify-between gap-1 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 mb-3.5">
          {pages.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setCurrentPage(idx)}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center ${
                idx === currentPage
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {p.tabLabel}
            </button>
          ))}
        </div>

        {/* Page Content Body — animated and nicely filling vertical space */}
        <div
          key={active.id}
          className="text-center py-1 flex flex-col items-center justify-center transition-all duration-300 animate-in fade-in zoom-in-95"
        >
          {/* Centered Page Icon */}
          <div className="w-11 h-11 rounded-2xl bg-blue-50/80 dark:bg-slate-800 flex items-center justify-center mb-2.5 shadow-inner border border-blue-100/50 dark:border-slate-700/50">
            {active.icon}
          </div>

          {/* Page Title */}
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-1.5 font-['Outfit']">
            {active.title}
          </h2>

          {/* Short, Concise Description */}
          <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto mb-3 font-normal">
            {active.description}
          </p>

          {/* Minimalist Feature Tag with SVG Check */}
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs">
            <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 font-mono">
              {active.tag}
            </span>
          </div>
        </div>

        {/* Tactile Page Navigation Controls with Dots Indicator */}
        <div className="flex items-center justify-between pt-3.5 mt-3 border-t border-slate-100 dark:border-slate-800/80">
          {/* Previous Page Button */}
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => (prev - 1 + pages.length) % pages.length)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer active:scale-95"
            aria-label="Previous page"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Previous</span>
          </button>

          {/* Page Dots Indicator — interactive pills/dots instead of numbers */}
          <div className="flex items-center space-x-1.5 py-1" role="tablist" aria-label="Slideshow indicators">
            {pages.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCurrentPage(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentPage
                    ? 'w-6 bg-blue-600 dark:bg-blue-500 shadow-xs shadow-blue-500/30'
                    : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
                aria-label={`Slide ${idx + 1}: ${p.tabLabel}`}
              />
            ))}
          </div>

          {/* Next Page Button */}
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => (prev + 1) % pages.length)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all cursor-pointer active:scale-95"
            aria-label="Next page"
          >
            <span>Next</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
};
