import React, { useState } from 'react';
import { MailContact } from '../../lib/mailApi';
import { getPublicKeyFingerprint } from '../../lib/crypto';
import { getUserOrContactName, formatPhoneNumber } from '../../lib/formatters';

interface E2eeVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  myPublicKey?: string | null;
  myPhone?: string;
  contact?: MailContact | null;
}

export const E2eeVerificationModal: React.FC<E2eeVerificationModalProps> = ({
  isOpen,
  onClose,
  myPublicKey,
  myPhone,
  contact,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  if (!isOpen) return null;

  const myFingerprint = getPublicKeyFingerprint(myPublicKey);
  const contactFingerprint = getPublicKeyFingerprint(contact?.publicKey);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_24px_60px_rgba(0,0,0,0.35)] p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  End-to-End Encryption Security
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Curve25519 (X25519) + XSalsa20-Poly1305 Cryptographic Verification
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info Explainer */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl p-3 mb-4 text-xs text-emerald-900 dark:text-emerald-200 flex items-start space-x-2.5">
          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div className="leading-relaxed">
            <strong className="font-semibold text-emerald-950 dark:text-emerald-100">Zero-Knowledge Guarantee: </strong>
            Messages and attachments are encrypted and decrypted strictly on your device. Neither PhoneMail servers, database administrators, nor third-party wiretaps can read your communications.
          </div>
        </div>

        {/* Safety Numbers / Fingerprints */}
        <div className="space-y-3.5 mb-5">
          {/* My Fingerprint */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Your Safety Number ({formatPhoneNumber(myPhone) || 'You'})
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(myFingerprint, 'my')}
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <span>{copiedKey === 'my' ? 'Copied' : 'Copy Number'}</span>
              </button>
            </div>
            <p className="font-mono text-xs text-slate-600 dark:text-slate-300 tracking-wider bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-750 select-all">
              {myFingerprint}
            </p>
          </div>

          {/* Contact's Fingerprint */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Recipient Safety Number ({getUserOrContactName(contact)})
              </span>
              {contact?.publicKey && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(contactFingerprint, 'contact')}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>{copiedKey === 'contact' ? 'Copied' : 'Copy Number'}</span>
                </button>
              )}
            </div>
            {contact?.publicKey ? (
              <p className="font-mono text-xs text-slate-600 dark:text-slate-300 tracking-wider bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-750 select-all">
                {contactFingerprint}
              </p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-200/60 dark:border-amber-900">
                Recipient has not registered an E2EE public key yet. Standard TLS transport encryption active.
              </p>
            )}
          </div>
        </div>

        {/* Cryptographic Specifications */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mb-5 text-[11px] text-slate-500 dark:text-slate-400 grid grid-cols-2 gap-2">
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Key Exchange:</span> Curve25519 (256-bit)
          </div>
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Cipher:</span> XSalsa20 Stream Cipher
          </div>
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Integrity:</span> Poly1305 MAC (128-bit)
          </div>
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Storage:</span> Device Sandbox Only
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {contact?.publicKey && (
            <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isVerified}
                onChange={(e) => setIsVerified(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <span>Mark contact safety number as verified</span>
            </label>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
