import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export const TermsPage: React.FC = () => {
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
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 mb-3">
            Legal & Compliance
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-['Outfit']">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Last Updated: September 2026 • Effective Immediately for All Sandesh Webmail Users
          </p>
        </div>

        {/* Legal Sections */}
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300">
          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">1. Agreement to Terms</h2>
            <p>
              By accessing, browsing, registering for, or using <strong>Sandesh Webmail</strong> (&quot;the Service&quot;, &quot;Sandesh&quot;, &quot;we&quot;, &quot;our&quot;),
              you agree to be bound by these Terms of Service (&quot;Terms&quot;) and our Privacy Policy. If you do not agree with any of these terms,
              you must cease use of the Service immediately.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">2. Phone-Number Identity & Account Security</h2>
            <p className="mb-3">
              Sandesh operates a decentralized, phone-number-based authentication identity architecture.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
              <li>You represent that you are the lawful owner or authorized subscriber of the mobile phone number used to create and access your account.</li>
              <li>You are strictly responsible for maintaining the confidentiality of your credentials, password, and recovery tokens.</li>
              <li>Sandesh cannot recover data if you lose both your verified phone number access and your cryptographic password keys.</li>
            </ul>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">3. End-to-End Cryptography & User Responsibility</h2>
            <p>
              Sandesh employs zero-knowledge client-side encryption. Messages and attachments uploaded via GridFS are encrypted before leaving your browser.
              Because encryption keys are generated on your client device, <strong>Sandesh engineers and automated systems possess zero mechanical means of recovering lost decryption passphrases</strong>.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">4. Acceptable Use Policy & Anti-Spam Zero Tolerance</h2>
            <p className="mb-3">
              To safeguard the network reputation of Sandesh email addresses, you agree not to use the service for:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
              <li>Sending unsolicited mass email, promotional blasts, or phishing campaigns (&quot;Spam&quot;).</li>
              <li>Distributing malicious code, trojans, ransomware, or infringing copyrighted intellectual property.</li>
              <li>Attempting to probe, scan, or reverse-engineer the authentication and key-derivation infrastructure.</li>
            </ul>
            <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 font-semibold">
              Violation of the Anti-Spam policy results in immediate, permanent revocation of the phone-linked mailbox.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">5. Service Availability & Storage Limits</h2>
            <p>
              We strive for 99.9% uptime, but Sandesh is provided &quot;as is&quot; without warranties of uninterrupted uptime.
              Individual mailbox storage limits, maximum attachment sizes (up to 100MB per file), and rate limits are enforced to guarantee fair access for all users.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Sandesh and its contributors shall not be liable for any indirect, incidental, consequential,
              or punitive damages arising out of your inability to access your encrypted communications or data loss caused by lost passkeys.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">7. Contact & Inquiries</h2>
            <p>
              For legal inquiries, copyright claims, or terms clarification, please contact our security team at{' '}
              <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">security@sandesh.in</span>.
            </p>
          </section>
        </div>

        {/* Footer actions */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &copy; 2026 Sandesh Webmail. Protected under end-to-end cryptographic standards.
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
