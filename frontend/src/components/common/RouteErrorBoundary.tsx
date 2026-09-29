import React from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();

  let errorMessage = 'An unexpected error occurred while loading this page.';
  let errorStatus: number | string = 'Oops!';

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-800 dark:text-slate-100 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center flex flex-col items-center">
        <div className="h-16 w-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mb-5 ring-1 ring-rose-200 dark:ring-rose-800">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-2">
          {errorStatus}
        </div>
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 break-words max-h-36 overflow-y-auto w-full px-2">
          {errorMessage}
        </p>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-colors"
          >
            Reload Page
          </button>
          <a
            href="/dashboard"
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors inline-flex items-center justify-center"
          >
            Go to Mail
          </a>
        </div>
      </div>
    </div>
  );
};
