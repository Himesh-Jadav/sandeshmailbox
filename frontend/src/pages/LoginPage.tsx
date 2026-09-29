import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SandeshAuthCard } from '../components/auth/SandeshAuthCard';
import { Waves } from '../components/ui/Waves';
import { FeatureSlideshow } from '../components/showcase/FeatureSlideshow';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface LoginPageProps {
  initialMode?: 'signin' | 'register';
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialMode }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toggleTheme, isDark } = useTheme();

  const modeParam = searchParams.get('mode');
  const activeMode = (modeParam === 'register' ? 'register' : initialMode || 'signin') as 'signin' | 'register';

  // If already logged in, redirect straight to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  return (
    <div className="h-screen h-[100dvh] max-h-screen w-full bg-[#f4f5f9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row justify-between selection:bg-blue-500/20 selection:text-blue-700 dark:selection:bg-blue-400/30 dark:selection:text-blue-300 transition-colors duration-200 overflow-hidden">
      {/* Left Column: Focused Authentication Container (Clean, zero top text) */}
      <div className="w-full lg:w-[460px] xl:w-[500px] 2xl:w-[520px] h-full max-h-screen flex flex-col justify-between px-4 sm:px-6 lg:px-8 xl:px-10 py-3 sm:py-4 lg:py-5 z-10 bg-[#f4f5f9] dark:bg-slate-950 overflow-y-auto transition-colors duration-200">
        {/* Top spacer with subtle mobile-only theme toggle */}
        <div className="w-full max-w-[400px] mx-auto flex justify-end lg:hidden py-0.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all cursor-pointer"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>

        {/* Main Login Card with IVR Onboarding Banner */}
        <main className="w-full max-w-[400px] mx-auto my-auto py-1 flex-shrink-0">
          <SandeshAuthCard initialMode={activeMode} />
        </main>

        {/* Footer copyright */}
        <footer className="w-full max-w-[400px] mx-auto pt-2 pb-1 text-xs text-slate-400 dark:text-slate-500 text-center lg:text-left px-1 flex-shrink-0">
          &copy; 2026 Sandesh. All rights reserved.
        </footer>
      </div>

      {/* Right Column: Interactive Waves Background Showcase (Desktop Only, automatically removed on Mobile) */}
      <div className="hidden lg:flex flex-1 h-full max-h-screen flex-col justify-between p-6 xl:p-8 relative overflow-hidden select-none transition-colors duration-300">
        {/* Interactive Waves Component with Theme Awareness */}
        <Waves
          strokeColor={isDark ? 'rgba(96, 165, 250, 0.45)' : 'rgba(37, 99, 235, 0.35)'}
          backgroundColor={isDark ? '#080d19' : '#ebf3fd'}
          pointerSize={0.6}
        />

        {/* Subtle Ambient Atmosphere Glows for Visual Depth */}
        <div
          className={`absolute -bottom-16 left-[12%] w-[480px] h-[480px] rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
            isDark ? 'bg-blue-600/20' : 'bg-blue-400/30'
          }`}
        />
        <div
          className={`absolute top-[8%] right-[8%] w-[420px] h-[420px] rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
            isDark ? 'bg-indigo-600/15' : 'bg-sky-200/50'
          }`}
        />

        {/* Header on Top: Centered Sandesh Logo & Discreet Theme Switcher */}
        <header className="relative z-20 w-full flex items-center justify-center pt-2">
          <img
            src="/sandesh-wordmark.png"
            alt="संदेश"
            className={`h-16 sm:h-20 md:h-22 w-auto sandesh-logo select-none pointer-events-none drop-shadow-sm transition-transform duration-300`}
          />

          {/* Discreet Top Right Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="absolute top-1 right-1 sm:top-2 sm:right-2 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm backdrop-blur-md text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
            aria-label="Toggle light and dark mode"
          >
            {isDark ? (
              <>
                <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                <span>Light</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                <span>Dark</span>
              </>
            )}
          </button>
        </header>

        {/* Center: Minimal, Readable Slideshow */}
        <div className="relative z-20 my-auto py-2">
          <FeatureSlideshow />
        </div>
      </div>
    </div>
  );
};
