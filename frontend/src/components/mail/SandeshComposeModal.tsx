import React, { useState, useEffect, useRef } from 'react';
import { mailApi, MailContact, Draft } from '../../lib/mailApi';
import { getUserOrContactName } from '../../lib/formatters';
import { SandeshAiDraftModal } from './SandeshAiDraftModal';
import { encryptMessage } from '../../lib/crypto';
import { useAuth } from '../../context/AuthContext';

interface SandeshComposeModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onChatCreated: (threadId: string) => void;
  // Edit-draft mode
  draft?: Draft | null;
  onDraftSaved?: () => void;
  onDraftDiscarded?: () => void;
  // Reply mode — when set this sends to the existing thread
  replyToThreadId?: string;
  replyToAddress?: string;
  replySubject?: string;
  // Forward or prefilled mode
  initialTo?: string;
  initialSubject?: string;
  initialMessage?: string;
}

type RecipientStatus = 'idle' | 'verifying' | 'verified' | 'error';

interface RecipientState {
  value: string;
  status: RecipientStatus;
  verifiedUser: MailContact | null;
  error: string | null;
}

function useRecipientVerify(token: string) {
  const [state, setState] = useState<RecipientState>({
    value: '',
    status: 'idle',
    verifiedUser: null,
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValue = (val: string) => {
    setState((prev) => ({ ...prev, value: val, status: 'idle', verifiedUser: null, error: null }));

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!val.trim() || val.trim().length < 4) return;

    timerRef.current = setTimeout(async () => {
      setState((prev) => ({ ...prev, status: 'verifying' }));
      try {
        const result = await mailApi.verifyRecipient(val.trim(), token);
        if (result.exists && result.user) {
          setState((prev) => ({ ...prev, status: 'verified', verifiedUser: result.user!, error: null }));
        } else {
          setState((prev) => ({ ...prev, status: 'error', verifiedUser: null, error: 'Recipient not found on Sandesh.' }));
        }
      } catch (err: any) {
        setState((prev) => ({ ...prev, status: 'error', verifiedUser: null, error: err.message || 'Verification error' }));
      }
    }, 400);
  };

  return { state, setValue };
}

export const SandeshComposeModal: React.FC<SandeshComposeModalProps> = ({
  isOpen,
  token,
  onClose,
  onChatCreated,
  draft = null,
  onDraftSaved,
  onDraftDiscarded,
  replyToThreadId,
  replyToAddress,
  replySubject,
  initialTo,
  initialSubject,
  initialMessage,
}) => {
  const isEditingDraft = Boolean(draft);
  const isReply = Boolean(replyToThreadId);

  const { userSecretKey, userPublicKey } = useAuth();
  const [isE2eeEnabled, setIsE2eeEnabled] = useState(true);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draftSavedToast, setDraftSavedToast] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // AI generation modal state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [undoState, setUndoState] = useState<{ subject: string; message: string } | null>(null);

  const QUICK_SUGGESTIONS = [
    {
      label: 'Sick Leave',
      subject: 'Sick Leave Notification - [Your Name]',
      body: `Dear [Manager/Supervisor Name],\n\nI am writing to inform you that I am unwell today due to [brief illness] and will not be able to attend work on [Date(s)].\n\nI will keep you updated regarding my recovery and expected return date. For any urgent questions during my absence, please reach out via phone or email.\n\nThank you for your understanding.\n\nBest regards,\n[Your Name]`,
    },
    {
      label: 'Meeting Request',
      subject: 'Meeting Request: Discussion on [Topic]',
      body: `Hi [Name],\n\nI hope you are doing well.\n\nI would like to set up a brief [15/30-minute] meeting with you to discuss [Topic/Objective]. Would any of the following time slots work for you?\n\n- [Option 1: Date & Time]\n- [Option 2: Date & Time]\n\nIf neither works, please feel free to propose an alternate time that suits you best.\n\nLooking forward to speaking,\n[Your Name]`,
    },
    {
      label: 'Follow-up',
      subject: 'Following up on: [Topic]',
      body: `Hi [Name],\n\nI hope this email finds you well.\n\nI wanted to gently follow up to check if you had a chance to review my previous message regarding [Topic].\n\nPlease let me know if you need any additional details or clarification from my side.\n\nThanks,\n[Your Name]`,
    },
    {
      label: 'Status Update',
      subject: 'Project Status Update: [Project Name]',
      body: `Hi [Stakeholder/Manager Name],\n\nHere is a quick progress update on [Project Name]:\n\nKey Highlights:\n- [Completed Milestone 1]\n- [Completed Milestone 2]\n\nNext Steps:\n- [Current priority 1]\n\nPlease let me know if you have any questions or feedback.\n\nBest regards,\n[Your Name]`,
    },
  ];

  const applyTemplateOrAi = (draftData: { subject: string; body: string }) => {
    if (subject.trim() || message.trim()) {
      setUndoState({ subject, message });
    }
    setSubject(draftData.subject);
    setMessage(draftData.body);
  };

  const handleUndoTemplate = () => {
    if (undoState) {
      setSubject(undoState.subject);
      setMessage(undoState.message);
      setUndoState(null);
    }
  };

  const to = useRecipientVerify(token);
  const cc = useRecipientVerify(token);
  const bcc = useRecipientVerify(token);

  // Populate fields from draft or reply or initial forward on open
  useEffect(() => {
    if (!isOpen) return;
    if (draft) {
      to.setValue(draft.to || '');
      cc.setValue(draft.cc || '');
      bcc.setValue(draft.bcc || '');
      setSubject(draft.subject || '');
      setMessage(draft.text || '');
      if (draft.cc) setShowCc(true);
      if (draft.bcc) setShowBcc(true);
    } else if (isReply) {
      to.setValue(replyToAddress || '');
      setSubject(replySubject ? `Re: ${replySubject}` : '');
    } else {
      // Fresh compose or Forward
      to.setValue(initialTo || '');
      cc.setValue('');
      bcc.setValue('');
      setSubject(initialSubject || '');
      setMessage(initialMessage || '');
      setFiles([]);
      setShowCc(false);
      setShowBcc(false);
    }
    setSendError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, draft?.id, replyToThreadId, initialSubject, initialMessage, initialTo]);

  if (!isOpen) return null;

  const hasContent = to.state.value.trim() || subject.trim() || message.trim() || files.length > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const showToast = () => {
    setDraftSavedToast(true);
    setTimeout(() => setDraftSavedToast(false), 2500);
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const payload = {
        to: to.state.value.trim(),
        cc: cc.state.value.trim(),
        bcc: bcc.state.value.trim(),
        subject: subject.trim(),
        text: message.trim(),
      };

      if (draft?.id) {
        await mailApi.updateDraft(draft.id, payload, token);
      } else {
        await mailApi.saveDraft(payload, token);
      }

      showToast();
      onDraftSaved?.();
      onClose();
    } catch (err: any) {
      setSendError(err.message || 'Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleDiscard = async () => {
    if (draft?.id) {
      try {
        await mailApi.deleteDraft(draft.id, token);
        onDraftDiscarded?.();
      } catch {}
    }
    onClose();
    setShowDiscardConfirm(false);
  };

  const handleClose = () => {
    if (hasContent && !isReply && !isEditingDraft) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);

    const resolveRecipientKey = async (recipientVal: string) => {
      let key = to.state.verifiedUser?.publicKey;
      if (!key && recipientVal) {
        try {
          const res = await mailApi.getRecipientKey(recipientVal, token);
          key = res.publicKey;
        } catch {}
      }
      return key;
    };

    // Send draft via drafts/:id/send endpoint
    if (isEditingDraft && draft?.id) {
      // Update draft first then send
      setIsSending(true);
      try {
        let textToSend = message.trim();
        const recipientPubKey = await resolveRecipientKey(to.state.value.trim());
        if (recipientPubKey && userSecretKey && isE2eeEnabled) {
          textToSend = encryptMessage(textToSend, recipientPubKey, userSecretKey, userPublicKey || undefined);
        }

        await mailApi.updateDraft(draft.id, {
          to: to.state.value.trim(),
          cc: cc.state.value.trim(),
          bcc: bcc.state.value.trim(),
          subject: subject.trim(),
          text: textToSend,
        }, token);
        const res = await mailApi.sendDraft(draft.id, token);
        onChatCreated(res.threadId);
        onDraftSaved?.();
        onClose();
      } catch (err: any) {
        setSendError(err.message || 'Failed to send draft');
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (!to.state.value.trim()) return;
    if (!message.trim() && files.length === 0) return;

    setIsSending(true);
    try {
      let textToSend = message.trim();
      const recipientPubKey = await resolveRecipientKey(to.state.value.trim());
      if (recipientPubKey && userSecretKey && isE2eeEnabled) {
        textToSend = encryptMessage(textToSend, recipientPubKey, userSecretKey, userPublicKey || undefined);
      }

      const res = await mailApi.sendMail(
        {
          to: to.state.value.trim(),
          cc: cc.state.value.trim() || undefined,
          bcc: bcc.state.value.trim() || undefined,
          subject: subject.trim() || 'Conversation',
          text: textToSend,
          files,
          threadId: replyToThreadId || undefined,
        },
        token
      );

      onChatCreated(res.threadId);
      onClose();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send Sandesh message');
    } finally {
      setIsSending(false);
    }
  };

  const canSend =
    to.state.value.trim().length > 0 &&
    (to.state.status !== 'error') &&
    (message.trim().length > 0 || files.length > 0 || isEditingDraft);

  const recipientStatusIndicator = (recipState: RecipientState) => {
    if (recipState.status === 'verifying') {
      return <div className="absolute right-3 top-2.5 h-4 w-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />;
    }
    if (recipState.status === 'verified' && recipState.verifiedUser) {
      return (
        <div className="mt-1.5 flex items-center space-x-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg animate-fade-in">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span>Verified: <strong>{getUserOrContactName(recipState.verifiedUser)}</strong></span>
        </div>
      );
    }
    if (recipState.status === 'error' && recipState.error) {
      return (
        <div className="mt-1.5 flex items-center space-x-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-lg">
          <svg className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{recipState.error}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-[3px] animate-fade-in">
        <div className="relative w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_24px_60px_rgba(0,0,0,0.3)] overflow-hidden animate-scale-in max-h-[95vh] flex flex-col">

          {/* Draft saved toast */}
          {draftSavedToast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-lg animate-fade-in flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              Draft saved
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#d7ebfc] to-[#bfdbfe] dark:from-sky-950 dark:to-sky-900 text-[#0369a1] dark:text-sky-300 flex items-center justify-center shadow-sm">
                {isEditingDraft ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                ) : isReply ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {isEditingDraft ? 'Edit Draft' : isReply ? 'Reply' : (initialSubject?.startsWith('Fwd:') ? 'Forward Sandesh' : 'Compose Sandesh')}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isReply && (
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-95 text-white text-[11.5px] font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  title="Write email with Groq AI"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Write with AI</span>
                </button>
              )}
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Error banner */}
          {sendError && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 shrink-0">
              <svg className="w-4 h-4 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{sendError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
            <div className="px-6 py-4 space-y-3.5">

              {/* TO */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    To <span className="text-slate-400 font-normal">(Phone Number)</span>
                  </label>
                  <div className="flex gap-2">
                    {!showCc && (
                      <button type="button" onClick={() => setShowCc(true)}
                        className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer">
                        + CC
                      </button>
                    )}
                    {!showBcc && (
                      <button type="button" onClick={() => setShowBcc(true)}
                        className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer">
                        + BCC
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={to.state.value}
                    onChange={(e) => to.setValue(e.target.value)}
                    placeholder="Enter phone number..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2.5 text-[12.5px] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-sky-400 focus:ring-3 focus:ring-sky-100/80 dark:focus:ring-sky-950/60 transition-all duration-150 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
                    required={!isEditingDraft}
                    disabled={isReply}
                  />
                  {to.state.status === 'verifying' && (
                    <div className="absolute right-3 top-2.5 h-4 w-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                {recipientStatusIndicator(to.state)}
              </div>

              {/* CC */}
              {showCc && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">CC</label>
                    <button type="button" onClick={() => { setShowCc(false); cc.setValue(''); }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                      Remove
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={cc.state.value}
                      onChange={(e) => cc.setValue(e.target.value)}
                      placeholder="CC recipients..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2.5 text-[12.5px] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-sky-400 focus:ring-3 focus:ring-sky-100/80 dark:focus:ring-sky-950/60 transition-all duration-150 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
                    />
                    {cc.state.status === 'verifying' && (
                      <div className="absolute right-3 top-2.5 h-4 w-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  {recipientStatusIndicator(cc.state)}
                  <p className="mt-1 text-[10.5px] text-slate-400 dark:text-slate-500">CC recipients can see each other and the full conversation.</p>
                </div>
              )}

              {/* BCC */}
              {showBcc && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      BCC <span className="text-slate-400 font-normal">(Hidden)</span>
                    </label>
                    <button type="button" onClick={() => { setShowBcc(false); bcc.setValue(''); }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                      Remove
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={bcc.state.value}
                      onChange={(e) => bcc.setValue(e.target.value)}
                      placeholder="BCC recipients (hidden from others)..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2.5 text-[12.5px] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-sky-400 focus:ring-3 focus:ring-sky-100/80 dark:focus:ring-sky-950/60 transition-all duration-150 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
                    />
                    {bcc.state.status === 'verifying' && (
                      <div className="absolute right-3 top-2.5 h-4 w-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  {recipientStatusIndicator(bcc.state)}
                  <p className="mt-1 text-[10.5px] text-slate-400 dark:text-slate-500">BCC recipients receive the mail but are invisible to other recipients.</p>
                </div>
              )}

              {/* Suggested Topics Bar */}
              {!isReply && (
                <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Suggested topics
                    </span>
                    {undoState && (
                      <button
                        type="button"
                        onClick={handleUndoTemplate}
                        className="text-[10.5px] text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer"
                      >
                        Undo change
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {QUICK_SUGGESTIONS.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyTemplateOrAi({ subject: sug.subject, body: sug.body })}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-700 dark:hover:text-sky-300 hover:border-sky-200 dark:hover:border-sky-800 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer shadow-2xs"
                      >
                        {sug.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsAiModalOpen(true)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200/80 dark:border-sky-800 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <svg className="w-3 h-3 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Describe with AI</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2.5 text-[12.5px] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-sky-400 focus:ring-3 focus:ring-sky-100/80 dark:focus:ring-sky-950/60 transition-all duration-150 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Message</label>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message…"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2.5 text-[12.5px] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-sky-400 focus:ring-3 focus:ring-sky-100/80 dark:focus:ring-sky-950/60 resize-none transition-all duration-150 leading-relaxed shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
                  required={!isEditingDraft}
                />
              </div>

              {/* Attachments */}
              {!isEditingDraft && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Attachments</label>
                    <label className="cursor-pointer text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium flex items-center space-x-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span>Add files</span>
                      <input type="file" multiple onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center space-x-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-lg text-[11px] border border-slate-200 dark:border-slate-700 shadow-2xs">
                          <span className="truncate max-w-[150px]">{file.name}</span>
                          <span className="text-slate-400 font-mono">({Math.round(file.size / 1024)} KB)</span>
                          <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-rose-500 font-bold ml-1 cursor-pointer">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {!isReply && (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft || isSending}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSavingDraft ? (
                      <div className="h-3 w-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                    )}
                    Save Draft
                  </button>
                )}
                {isEditingDraft && (
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    Discard
                  </button>
                )}
              </div>

              {/* End-to-End Encryption Security Indicator */}
              <div className="hidden sm:flex items-center">
                {to.state.verifiedUser?.publicKey ? (
                  <div
                    title="Curve25519 authenticated end-to-end encryption. Message is encrypted on your device and only readable by the recipient."
                    className="flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="font-semibold">{isE2eeEnabled ? 'End-to-End Encrypted' : 'E2EE Disabled'}</span>
                    <button
                      type="button"
                      onClick={() => setIsE2eeEnabled(!isE2eeEnabled)}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors cursor-pointer ${
                        isE2eeEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      title={isE2eeEnabled ? 'Disable E2EE for this message' : 'Enable E2EE'}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          isE2eeEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ) : to.state.status === 'verified' ? (
                  <div
                    title="Recipient has not registered an E2EE public key. Message is protected via standard TLS transport encryption."
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-750"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Standard TLS</span>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending || isSavingDraft || !canSend}
                  className="px-6 py-2.5 rounded-full bg-[#0f172a] hover:bg-black disabled:opacity-50 text-white font-semibold text-xs shadow-md transition flex items-center space-x-2 cursor-pointer active:scale-95"
                >
                  {isSending ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>{isReply ? 'Send Reply' : 'Send Sandesh'}</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Discard confirm */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 animate-scale-in">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">Save this draft?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">You have unsaved content. Would you like to save it as a draft or discard it?</p>
            <div className="flex gap-2">
              <button onClick={() => { onClose(); setShowDiscardConfirm(false); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition cursor-pointer">
                Discard
              </button>
              <button onClick={() => { setShowDiscardConfirm(false); handleSaveDraft(); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0f172a] hover:bg-black transition cursor-pointer">
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Write with AI Modal */}
      <SandeshAiDraftModal
        isOpen={isAiModalOpen}
        token={token}
        onClose={() => setIsAiModalOpen(false)}
        onApplyDraft={(draftResult) => applyTemplateOrAi(draftResult)}
        recipientContext={to.state.value}
        currentSubject={subject}
      />
    </>
  );
};
