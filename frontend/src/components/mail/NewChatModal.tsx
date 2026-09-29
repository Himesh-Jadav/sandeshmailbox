import React, { useState, useEffect } from 'react';
import { mailApi, MailContact } from '../../lib/mailApi';
import { getUserOrContactName, formatPhoneNumber, cleanEmailDisplay } from '../../lib/formatters';
import { useAuth } from '../../context/AuthContext';
import { encryptMessage } from '../../lib/crypto';

interface NewChatModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onChatCreated: (threadId: string) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  token,
  onClose,
  onChatCreated,
}) => {
  const { userSecretKey, userPublicKey } = useAuth();
  const [recipientInput, setRecipientInput] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<MailContact | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Live recipient verification with debounce
  useEffect(() => {
    if (!recipientInput.trim() || recipientInput.trim().length < 4) {
      setVerifiedUser(null);
      setVerifyError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsVerifying(true);
      setVerifyError(null);
      try {
        const result = await mailApi.verifyRecipient(recipientInput.trim(), token);
        if (result.exists && result.user) {
          setVerifiedUser(result.user);
          setVerifyError(null);
        } else {
          setVerifiedUser(null);
          setVerifyError('Recipient not found on PhoneMail. Only registered users can receive mail.');
        }
      } catch (err: any) {
        setVerifiedUser(null);
        setVerifyError(err.message || 'Verification error');
      } finally {
        setIsVerifying(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [recipientInput, token]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientInput.trim()) return;
    if (!message.trim() && files.length === 0) return;

    setIsSending(true);
    setSendError(null);

    try {
      let outgoingText = message.trim();
      let recipientPubKey = verifiedUser?.publicKey;
      if (!recipientPubKey && recipientInput.trim()) {
        try {
          const res = await mailApi.getRecipientKey(recipientInput.trim(), token);
          recipientPubKey = res.publicKey;
        } catch {}
      }

      if (recipientPubKey && userSecretKey) {
        outgoingText = encryptMessage(outgoingText, recipientPubKey, userSecretKey, userPublicKey || undefined);
      }

      const res = await mailApi.sendMail(
        {
          to: recipientInput.trim(),
          subject: subject.trim() || 'Conversation',
          text: outgoingText,
          files,
        },
        token
      );

      onChatCreated(res.threadId);
      onClose();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send message via local SMTP server');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">New Mail Conversation</h3>
              <p className="text-xs text-slate-400">Send an email via local SMTP with WhatsApp-style convenience</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {sendError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{sendError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient Input with Live Verification */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              To (Phone Number or Email)
            </label>
            <div className="relative">
              <input
                type="text"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                placeholder="9876543211 or recipient@example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                required
              />
              {isVerifying && (
                <div className="absolute right-3 top-2.5">
                  <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Verification Status Feedback */}
            {verifiedUser && (
              <div className="mt-1.5 flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  Verified: <strong className="font-semibold">{getUserOrContactName(verifiedUser)}</strong>
                  {(cleanEmailDisplay(verifiedUser.email) || formatPhoneNumber(verifiedUser.phone)) && (
                    <span className="opacity-80 ml-1">
                      ({cleanEmailDisplay(verifiedUser.email) || formatPhoneNumber(verifiedUser.phone)})
                    </span>
                  )}
                </span>
              </div>
            )}
            {verifyError && !isVerifying && (
              <div className="mt-1.5 flex items-center space-x-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{verifyError}</span>
              </div>
            )}
          </div>

          {/* Subject (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Subject <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Project Discussion or Quick Note"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Message Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Message</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message... (press Enter to send or attach files below)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none transition"
              required
            />
          </div>

          {/* Attachments Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Attachments</label>
              <label className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span>Add files</span>
                <input type="file" multiple onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {/* Attached file chips */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-1.5 bg-slate-800 text-slate-200 px-2.5 py-1 rounded-lg text-[11px] border border-slate-700"
                  >
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <span className="text-slate-400 font-mono">({Math.round(file.size / 1024)} KB)</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-400 hover:text-rose-400 ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending || (recipientInput.length > 3 && verifyError !== null)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition flex items-center space-x-2"
            >
              {isSending ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending via SMTP...</span>
                </>
              ) : (
                <>
                  <span>Send & Start Chat</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
