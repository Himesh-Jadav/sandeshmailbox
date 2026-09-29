import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center space-x-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Login</span>
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <img
              src="/sandesh-wordmark.png"
              alt="संदेश"
              className="h-7 w-auto object-contain select-none dark:brightness-110"
            />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Document Header */}
        <div className="mb-10 text-center sm:text-left border-b border-slate-200 dark:border-slate-800 pb-8">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 mb-3">
            Zero-Knowledge Cryptographic Privacy
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-['Outfit']">
            End-to-End Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Last Updated: September 2026 • Built on Fundamental Client-Side Encryption
          </p>
        </div>

        {/* Legal Sections */}
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300">
          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="4" y="11" width="16" height="11" rx="2" strokeWidth="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2" />
              </svg>
              <span>1. The Zero-Knowledge Core Commitment</span>
            </h2>
            <p>
              Sandesh was founded on the belief that personal correspondence is private by fundamental right.
              Unlike legacy webmail providers who scan text for behavioral advertising, Sandesh operates a{' '}
              <strong>Zero-Knowledge system</strong>: all emails, attachments, and confidential payloads are encrypted client-side using
              AES-256-GCM and Curve25519 before being transferred over the wire.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">2. Information We Collect</h2>
            <p className="mb-3">We collect only the bare minimum technical data necessary to deliver your mail:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>
                <strong>Verified Mobile Phone Number:</strong> Used as your unique mailbox identifier and for two-factor account verification.
              </li>
              <li>
                <strong>Public Cryptographic Keys:</strong> Used by other Sandesh senders to encrypt messages intended for your mailbox.
              </li>
              <li>
                <strong>Transient Transport Metadata:</strong> Timestamp and encrypted payload size required by routing protocols to route incoming mail to your device.
              </li>
            </ul>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400 mb-2">3. Information We CANNOT and DO NOT Collect</h2>
            <p className="mb-3">Because of client-side encryption algorithms:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>We cannot read the plaintext content or subject lines of your emails.</li>
              <li>We cannot view photos, PDFs, or media attachments stored via GridFS.</li>
              <li>We do not record private encryption keys on our servers.</li>
              <li>We never track your browser location, cookies for advertising, or device fingerprints.</li>
            </ul>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">4. Zero Advertising & No Third-Party Trackers</h2>
            <p>
              Sandesh contains <strong>zero marketing trackers, zero ad-network analytics, and zero tracking pixels</strong>.
              We do not sell, rent, monetize, or disclose your telephone number or communication graph to any commercial entity.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">5. Data Retention & Permanent Deletion</h2>
            <p>
              When you delete an email or purge an attachment from your Sandesh inbox, the cryptographic ciphertext is immediately removed
              from our database and file storage buckets. Once deleted, the data is unrecoverable.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">6. Inquiries & Data Rights</h2>
            <p>
              Under applicable global privacy regulations (including GDPR, CCPA, and DPDP), you retain full rights to request
              account purge or export of your public credentials. Contact our Data Protection Officer at{' '}
              <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">privacy@sandesh.in</span>.
            </p>
          </section>
        </div>

        {/* Footer actions */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &copy; 2026 Sandesh Webmail. Privacy by design, verified by mathematics.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-all cursor-pointer"
          >
            Return to Login
          </button>
        </div>
      </main>
    </div>
  );
};
