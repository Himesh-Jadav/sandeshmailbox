import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MailThread, MailMessage } from '../../lib/mailApi';
import { useAuth } from '../../context/AuthContext';
import { printChat } from '../../lib/printChat';
import { isEncryptedMessage, decryptMessage } from '../../lib/crypto';
import { getUserOrContactName, cleanEmailDisplay } from '../../lib/formatters';
import { SandeshAiDraftModal } from './SandeshAiDraftModal';
import { E2eeVerificationModal } from './E2eeVerificationModal';

interface SandeshEmailViewProps {
  activeThreadData?: { thread: MailThread; messages: MailMessage[] } | null;
  onSendMessage: (payload: { text: string; files: File[]; subject?: string; to?: string; cc?: string; bcc?: string }) => Promise<void>;
  isSending?: boolean;
  onClose?: () => void;
  onBackToList?: () => void;
  activeTab?: string;
  isPinned?: boolean;
  isTrashed?: boolean;
  isArchived?: boolean;
  isSpam?: boolean;
  onTogglePin?: () => void;
  // Per-message operations
  onTrashMessage?: () => void;
  onArchiveMessage?: () => void;
  onRestoreMessage?: () => void;
  onPermanentDelete?: () => void;
  onSpamMessage?: () => void;
  onForward?: (forwardData: { subject: string; text: string }) => void;
  // Legacy compat aliases
  onToggleTrash?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  isDetailExpanded?: boolean;
  onToggleExpandDetail?: () => void;
}

interface AttachmentPreviewData {
  url: string;
  name: string;
  contentType?: string;
  size?: number;
  type: 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'file';
}

export const SandeshEmailView: React.FC<SandeshEmailViewProps> = ({
  activeThreadData,
  onSendMessage,
  isSending = false,
  onClose,
  onBackToList,
  activeTab: _activeTab = 'inbox',
  isPinned = false,
  isTrashed = false,
  isArchived = false,
  isSpam = false,
  onTogglePin,
  onTrashMessage,
  onArchiveMessage,
  onRestoreMessage,
  onPermanentDelete,
  onSpamMessage,
  onForward,
  // Legacy aliases for any still-wired callers
  onToggleTrash,
  onDelete,
  onRestore,
  isDetailExpanded = false,
  onToggleExpandDetail,
}) => {
  const { user, userSecretKey, userPublicKey, token } = useAuth();
  const [isE2eeModalOpen, setIsE2eeModalOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [isAiReplyModalOpen, setIsAiReplyModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentPreviewData | null>(null);
  const [starredMessages, setStarredMessages] = useState<Record<string, boolean>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showDetailsMap, setShowDetailsMap] = useState<Record<string, boolean>>({});
  const [isReplying, setIsReplying] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [ccValue, setCcValue] = useState('');
  const [bccValue, setBccValue] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const rawMessages = activeThreadData?.messages || [];
  const thread = activeThreadData?.thread;

  // Client-side zero-knowledge decryption of all messages in thread
  const messages = useMemo(() => {
    return rawMessages.map((msg) => {
      if (isEncryptedMessage(msg.text)) {
        const peerKey = msg.isMine
          ? thread?.contact?.publicKey
          : msg.from?.publicKey || thread?.contact?.publicKey;
        const res = decryptMessage(msg.text, userSecretKey || '', peerKey || undefined);
        return {
          ...msg,
          isEncrypted: true,
          decryptedText: res.text,
          decryptSuccess: res.success,
          decryptError: res.error,
          verifiedSenderKey: res.senderPubKey || msg.from?.publicKey,
        };
      }
      return {
        ...msg,
        isEncrypted: false,
        decryptedText: msg.text,
        decryptSuccess: true,
        decryptError: undefined,
        verifiedSenderKey: undefined,
      };
    });
  }, [rawMessages, thread?.contact?.publicKey, userSecretKey]);

  // Expand latest message by default if not set
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      setExpandedMessages((prev) => ({
        ...prev,
        [lastMsg.id]: true,
      }));
    }
  }, [messages.length]);

  // Close preview modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewAttachment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Shortcut Ctrl+P or Cmd+P to print active thread
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        if (thread) {
          e.preventDefault();
          printChat({
            thread,
            messages,
            user,
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [thread, messages, user]);

  const contactName = getUserOrContactName(thread?.contact);
  const contactEmail = cleanEmailDisplay(thread?.contact?.email);
  const cleanSubject = thread?.subject
    ? thread.subject.replace(/(\+?91[\s-]?)?\b(\d{10})\b/g, (_m, _p, num) => `user_${num.slice(-4)}`)
    : 'Conversation';

  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-blue-600 to-indigo-600',
      'from-emerald-600 to-teal-700',
      'from-violet-600 to-purple-700',
      'from-amber-600 to-orange-600',
      'from-rose-600 to-pink-600',
      'from-cyan-600 to-blue-700',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getFileTypeInfo = (filename: string, contentType?: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (contentType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
      return { type: 'image' as const, label: ext.toUpperCase() || 'IMG', color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800' };
    }
    if (contentType === 'application/pdf' || ext === 'pdf') {
      return { type: 'pdf' as const, label: 'PDF', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800' };
    }
    if (contentType?.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv'].includes(ext)) {
      return { type: 'video' as const, label: ext.toUpperCase() || 'VIDEO', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800' };
    }
    if (contentType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
      return { type: 'audio' as const, label: ext.toUpperCase() || 'AUDIO', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800' };
    }
    if (contentType?.startsWith('text/') || ['txt', 'md', 'json', 'csv', 'log', 'xml', 'js', 'ts'].includes(ext)) {
      return { type: 'text' as const, label: ext.toUpperCase() || 'DOC', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800' };
    }
    return { type: 'file' as const, label: ext.toUpperCase() || 'FILE', color: 'text-slate-600 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatEmailDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hr ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setReplyFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() && replyFiles.length === 0) return;

    const targetAddress = thread?.contact?.phone || thread?.contact?.email || contactEmail;
    await onSendMessage({
      text: replyText.trim(),
      files: replyFiles,
      subject: thread?.subject ? `Re: ${thread.subject}` : 'Conversation',
      to: targetAddress,
      cc: ccValue.trim() || undefined,
      bcc: bccValue.trim() || undefined,
    });

    setReplyText('');
    setReplyFiles([]);
    setIsReplying(false);
  };

  const handlePrintThread = () => {
    if (!thread) return;
    printChat({
      thread,
      messages,
      user,
    });
  };

  const handlePrintSingleMessage = (messageId: string) => {
    if (!thread) return;
    printChat({
      thread,
      messages,
      user,
      singleMessageId: messageId,
    });
  };

  const toggleStar = (msgId: string) => {
    setStarredMessages((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleDetails = (msgId: string) => {
    setShowDetailsMap((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleMessageExpand = (msgId: string) => {
    setExpandedMessages((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleOpenReplyBox = () => {
    setIsReplying(true);
    setTimeout(() => {
      replyTextareaRef.current?.focus();
      replyTextareaRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleForwardMessage = (msg: MailMessage & { decryptedText?: string }) => {
    if (!onForward) return;
    const senderName = getUserOrContactName(msg.from) || msg.fromEmail || 'Unknown';
    const dateStr = formatEmailDate(msg.createdAt);
    const originalSubject = msg.subject || thread?.subject || 'Conversation';
    const fwdSubject = originalSubject.startsWith('Fwd:') ? originalSubject : `Fwd: ${originalSubject}`;
    const toRecipients = (msg.toEmails && msg.toEmails.length > 0) ? msg.toEmails.join(', ') : contactEmail;
    const bodyText = msg.decryptedText || msg.text || '';

    const forwardHeader = `\n\n---------- Forwarded message ---------\nFrom: ${senderName} <${msg.fromEmail || ''}>\nDate: ${dateStr}\nSubject: ${originalSubject}\nTo: ${toRecipients}\n\n${bodyText}`;

    onForward({
      subject: fwdSubject,
      text: forwardHeader,
    });
  };

  // If no conversation selected
  if (!activeThreadData || !activeThreadData.thread || !thread) {
    return (
      <div className="flex-1 bg-[#f6f8fc] dark:bg-slate-950 flex flex-col items-center justify-center p-8 text-center select-none relative transition-colors duration-200">
        <div className="animate-fade-in flex flex-col items-center max-w-sm">
          <div className="h-16 w-16 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">Select an email</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Choose an email conversation from your inbox to view full correspondence.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#f6f8fc] dark:bg-slate-950 p-0 md:p-3 md:px-4 flex flex-col h-full overflow-hidden select-text relative font-sans transition-colors duration-200 w-full">
      {/* Gmail Signature Paper Card Container */}
      <div className="bg-white dark:bg-[#1e1f20] rounded-none md:rounded-2xl shadow-none md:shadow-[0_1px_3px_rgba(0,0,0,0.08)] border-0 md:border border-slate-200/80 dark:border-slate-800/80 flex-1 flex flex-col overflow-hidden w-full h-full">
        
        {/* 1. Gmail Top Action Bar (Exact Google Mail Toolbar) */}
        <div className="h-12 px-3 sm:px-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#1e1f20] flex-shrink-0 z-10 select-none">
          <div className="flex items-center space-x-1 sm:space-x-1.5 text-slate-600 dark:text-slate-300">
            {/* Back to Inbox circular button */}
            {(onBackToList || onClose) && (
              <button
                type="button"
                onClick={onBackToList || onClose}
                title="Back to Inbox"
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer text-slate-700 dark:text-slate-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}

            {/* If in Spam: show Not Spam + Delete Permanently */}
            {isSpam ? (
              <>
                <button
                  type="button"
                  onClick={onRestoreMessage || onRestore || onToggleTrash}
                  title="Report not spam (Move to Inbox)"
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer text-emerald-600 dark:text-emerald-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onPermanentDelete || onDelete}
                  title="Delete permanently"
                  className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition cursor-pointer text-rose-600 dark:text-rose-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            ) : (isTrashed || isArchived) ? (
              <>
                <button
                  type="button"
                  onClick={onRestoreMessage || onRestore || onToggleTrash}
                  title="Restore to Inbox"
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer text-emerald-600 dark:text-emerald-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                {isTrashed && (
                  <button
                    type="button"
                    onClick={onPermanentDelete || onDelete}
                    title="Delete permanently"
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition cursor-pointer text-rose-600 dark:text-rose-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Archive button */}
                <button
                  type="button"
                  onClick={onArchiveMessage || onToggleTrash}
                  title="Archive"
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer text-slate-600 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </button>

                {/* Report Spam */}
                {onSpamMessage && (
                  <button
                    type="button"
                    onClick={onSpamMessage}
                    title="Report Spam"
                    className="p-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-full transition cursor-pointer text-slate-600 dark:text-slate-300 hover:text-amber-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </button>
                )}

                {/* Delete / Move to Trash */}
                <button
                  type="button"
                  onClick={onTrashMessage || onDelete || onToggleTrash}
                  title="Move to Trash"
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer text-slate-600 dark:text-slate-300 hover:text-rose-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />


            {/* Star Thread */}
            {onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                title={isPinned ? 'Unstar' : 'Add star'}
                className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer ${
                  isPinned ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <svg className="w-4 h-4" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            )}
          </div>

          {/* Right Action Icons: Print All, Fullscreen, Close */}
          <div className="flex items-center space-x-1 text-slate-600 dark:text-slate-300">
            <span className="text-xs text-slate-400 font-mono mr-2 hidden md:inline">
              {messages.length} of {messages.length}
            </span>

            <button
              type="button"
              onClick={handlePrintThread}
              title="Download / Print Chat (PDF)"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>

            {onToggleExpandDetail && (
              <button
                type="button"
                onClick={onToggleExpandDetail}
                title={isDetailExpanded ? 'Exit full screen' : 'In new window'}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer hidden md:inline-flex"
              >
                {isDetailExpanded ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M10 4H4m0 0v6m0-6l7 7m7-7h6m0 0v6m0-6l-7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 2. Gmail Subject Header (Spacious, Clean) */}
        <div className="px-6 sm:px-14 pt-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#1e1f20] shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <h1 className="text-[20px] sm:text-[23px] font-normal text-slate-850 dark:text-slate-100 tracking-tight leading-snug truncate">
              {cleanSubject}
            </h1>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded shrink-0 ${
              isSpam
                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                : isTrashed
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300'
                : isArchived
                ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300'
                : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800'
            }`}>
              {isSpam ? 'Spam' : isTrashed ? 'Trash' : isArchived ? 'Archive' : 'Inbox'}
            </span>
          </div>

          <div className="text-xs text-slate-400 font-normal shrink-0 ml-4 hidden sm:block">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </div>
        </div>

        {/* Spam Warning Banner */}
        {isSpam && (
          <div className="mx-4 sm:mx-14 mt-4 p-4 bg-amber-50/95 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs shrink-0">
            <div className="flex items-start space-x-3">
              <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-amber-950 dark:text-amber-100 text-[13px]">Why is this message in Spam?</p>
                <p className="text-amber-900/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                  {messages[messages.length - 1]?.spamReason || 'It was identified as potential spam or phishing by automated security analysis.'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-auto">
              {(onRestoreMessage || onRestore) && (
                <button
                  type="button"
                  onClick={onRestoreMessage || onRestore}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-semibold rounded-lg transition shadow-xs cursor-pointer text-xs"
                >
                  Report not spam
                </button>
              )}
              {(onPermanentDelete || onDelete) && (
                <button
                  type="button"
                  onClick={onPermanentDelete || onDelete}
                  className="px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-semibold rounded-lg transition shadow-xs cursor-pointer text-xs"
                >
                  Delete forever
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. Gmail Thread Messages Container */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-14 py-6 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, index) => {
              const isMine = msg.isMine;
              const isStarred = Boolean(starredMessages[msg.id]);
              const isExpanded = Boolean(expandedMessages[msg.id]);
              const senderLabel = isMine
                ? (getUserOrContactName(user) || 'Me')
                : (getUserOrContactName(msg.from) || contactName);
              const senderEmail = isMine
                ? cleanEmailDisplay(user?.email || user?.phone)
                : cleanEmailDisplay(msg.from?.email || msg.from?.phone || thread?.contact?.email || thread?.contact?.phone);
              const senderInitials = getInitials(senderLabel);
              const avatarGradient = getAvatarGradient(senderLabel);
              const senderAvatar = isMine
                ? (user?.profilePictureUrl || msg.from?.profilePictureUrl || null)
                : (msg.from?.profilePictureUrl || thread?.contact?.profilePictureUrl || null);
              const isDetailsOpen = Boolean(showDetailsMap[msg.id]);

              // If collapsed message row (Gmail style for older messages)
              if (!isExpanded && index < messages.length - 1) {
                return (
                  <div
                    key={msg.id}
                    onClick={() => toggleMessageExpand(msg.id)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-800/60 cursor-pointer transition select-none"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${avatarGradient} text-white font-bold text-[10px] flex items-center justify-center shrink-0 relative overflow-hidden select-none`}>
                        <span>{senderInitials}</span>
                        {senderAvatar && (
                          <img
                            src={senderAvatar}
                            alt={senderLabel}
                            className="absolute inset-0 w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate w-36">
                        {senderLabel}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {msg.decryptedText?.slice(0, 80) || msg.text?.slice(0, 80)}...
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 text-slate-400">
                      <span className="text-[11px] font-mono">{formatRelativeTime(msg.createdAt)}</span>
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                );
              }

              // Full Expanded Email Message View
              return (
                <div
                  key={msg.id}
                  className="border-b border-slate-100 dark:border-slate-800/80 pb-8 last:border-b-0"
                >
                  {/* Sender Header Row */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start space-x-3.5 min-w-0">
                      {/* Avatar photo or letter circle */}
                      <div
                        className={`h-10 w-10 rounded-full bg-gradient-to-br ${avatarGradient} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs select-none relative overflow-hidden`}
                      >
                        <span>{senderInitials}</span>
                        {senderAvatar && (
                          <img
                            src={senderAvatar}
                            alt={senderLabel}
                            className="absolute inset-0 w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        {/* Sender Name and Address */}
                        <div className="flex items-baseline flex-wrap gap-x-2">
                          <span className="font-bold text-[14px] text-slate-900 dark:text-slate-100 truncate">
                            {senderLabel}
                          </span>
                          {senderEmail && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                              &lt;{senderEmail}&gt;
                            </span>
                          )}
                          {msg.isEncrypted && !msg.decryptSuccess && (
                            <button
                              type="button"
                              onClick={() => setIsE2eeModalOpen(true)}
                              title="Encrypted message could not be decrypted. Secret key missing or mismatch."
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 hover:bg-amber-100"
                            >
                              <span>Decrypt Failed</span>
                            </button>
                          )}
                        </div>

                        {/* Recipient dropdown: 'to me ▾' */}
                        <div className="relative mt-0.5">
                          <button
                            type="button"
                            onClick={() => toggleDetails(msg.id)}
                            className="text-[12px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <span>to {isMine ? (contactEmail || contactName) : 'me'}</span>
                            <svg className={`w-3 h-3 text-slate-400 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Gmail Details Dropdown Box */}
                          {isDetailsOpen && (
                            <div className="absolute top-full left-0 mt-2 z-30 w-72 sm:w-80 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-[12px] space-y-1.5 animate-fade-in select-text">
                              <div className="flex"><span className="w-16 text-slate-400 font-medium shrink-0">From:</span><span className="font-mono text-slate-700 dark:text-slate-200 truncate">{senderLabel}{senderEmail ? ` <${senderEmail}>` : ''}</span></div>
                              <div className="flex"><span className="w-16 text-slate-400 font-medium shrink-0">To:</span><span className="font-mono text-slate-700 dark:text-slate-200 truncate">{isMine ? contactEmail : (cleanEmailDisplay(user?.email || user?.phone) || 'me')}</span></div>
                              <div className="flex"><span className="w-16 text-slate-400 font-medium shrink-0">Date:</span><span className="text-slate-700 dark:text-slate-200">{formatEmailDate(msg.createdAt)}</span></div>
                              <div className="flex"><span className="w-16 text-slate-400 font-medium shrink-0">Subject:</span><span className="text-slate-700 dark:text-slate-200 truncate">{cleanSubject}</span></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Header Toolbar: Timestamp, Star, Reply, Print, More */}
                    <div className="flex items-center space-x-1 shrink-0 text-slate-400 dark:text-slate-500">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-normal hidden sm:inline mr-2">
                        {formatEmailDate(msg.createdAt)} ({formatRelativeTime(msg.createdAt)})
                      </span>

                      {/* Star Button */}
                      <button
                        type="button"
                        onClick={() => toggleStar(msg.id)}
                        title={isStarred ? 'Starred' : 'Not starred'}
                        className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer ${
                          isStarred ? 'text-amber-500' : 'text-slate-400'
                        }`}
                      >
                        <svg className="w-4 h-4" fill={isStarred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>

                      {/* Reply Button */}
                      <button
                        type="button"
                        onClick={handleOpenReplyBox}
                        title="Reply"
                        className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>

                      {/* Forward Button */}
                      {onForward && (
                        <button
                          type="button"
                          onClick={() => handleForwardMessage(msg)}
                          title="Forward this message"
                          className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                          </svg>
                        </button>
                      )}

                      {/* Print Message */}
                      <button
                        type="button"
                        onClick={() => handlePrintSingleMessage(msg.id)}
                        title="Download / Print Message (PDF)"
                        className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </button>

                      {/* Copy message text */}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.decryptedText || msg.text || '');
                          setCopiedMessageId(msg.id);
                          setTimeout(() => setCopiedMessageId(null), 1500);
                        }}
                        title="Copy email text"
                        className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                      >
                        {copiedMessageId === msg.id ? (
                          <span className="text-[10px] text-emerald-500 font-bold">Copied!</span>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Email Body Canvas (Gmail Typography & Spacing) */}
                  <div className="pl-0 sm:pl-14 text-[14.5px] text-slate-850 dark:text-slate-200 leading-[1.65] font-sans whitespace-pre-wrap select-text py-3">
                    {msg.decryptedText || msg.text || 'No message content'}

                    {/* Email Signature Section */}
                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-400 font-sans space-y-0.5 select-none">
                      <p>--</p>
                      <p className="font-semibold text-slate-600 dark:text-slate-400">Sandesh Webmail</p>
                    </div>
                  </div>

                  {/* Gmail Attachments Section */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="pl-0 sm:pl-14 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span>{msg.attachments.length} {msg.attachments.length === 1 ? 'Attachment' : 'Attachments'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {msg.attachments.map((att) => {
                          const fileInfo = getFileTypeInfo(att.filename, att.contentType);
                          const isImg = fileInfo.type === 'image';
                          const downloadUrl = `/api/mail/attachments/${att.gridFsId}`;

                          return (
                            <div
                              key={att.id}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center space-x-3 group/att hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs transition"
                            >
                              <div
                                onClick={() => setPreviewAttachment({
                                  url: downloadUrl,
                                  name: att.filename,
                                  contentType: att.contentType,
                                  size: att.size,
                                  type: fileInfo.type,
                                })}
                                className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden border border-slate-200/80 dark:border-slate-700"
                              >
                                {isImg ? (
                                  <img src={downloadUrl} alt={att.filename} className="w-full h-full object-cover" />
                                ) : (
                                  <span className={`text-[10px] font-bold ${fileInfo.color.split(' ')[0]}`}>
                                    {fileInfo.label}
                                  </span>
                                )}
                              </div>

                              <div
                                onClick={() => setPreviewAttachment({
                                  url: downloadUrl,
                                  name: att.filename,
                                  contentType: att.contentType,
                                  size: att.size,
                                  type: fileInfo.type,
                                })}
                                className="min-w-0 flex-1 cursor-pointer"
                              >
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover/att:text-blue-600 dark:group-hover/att:text-blue-400 transition-colors">
                                  {att.filename}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {formatFileSize(att.size)}
                                </p>
                              </div>

                              <a
                                href={downloadUrl}
                                download={att.filename}
                                title="Download"
                                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 4. Bottom of Email: Gmail-Style [Reply] [Forward] Buttons OR Active Inline Composer */}
            {!isReplying ? (
              <div className="flex items-center space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleOpenReplyBox}
                  className="px-6 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-2 transition cursor-pointer"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <span>Reply</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const latestMsg = messages[messages.length - 1];
                    if (latestMsg) {
                      handleForwardMessage(latestMsg);
                    } else if (onForward) {
                      onForward({
                        subject: thread?.subject ? (thread.subject.startsWith('Fwd:') ? thread.subject : `Fwd: ${thread.subject}`) : 'Fwd: Conversation',
                        text: `\n\n---------- Forwarded message ---------\nSubject: ${thread?.subject || ''}\n`,
                      });
                    }
                  }}
                  className="px-6 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-2 transition cursor-pointer"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                  <span>Forward</span>
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden mt-6 animate-fade-in">
                {/* Gmail-Style Reply Header with Recipient & Cc/Bcc */}
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40 text-xs">
                  <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">Reply</span>
                    <span className="text-slate-400">to</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{contactName}</span>
                    <span className="text-slate-400 font-mono text-[11px]">&lt;{contactEmail}&gt;</span>
                  </div>

                  <div className="flex items-center space-x-2 text-slate-500">
                    {!showCc && (
                      <button
                        type="button"
                        onClick={() => setShowCc(true)}
                        className="text-xs hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
                      >
                        Cc
                      </button>
                    )}
                    {!showBcc && (
                      <button
                        type="button"
                        onClick={() => setShowBcc(true)}
                        className="text-xs hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
                      >
                        Bcc
                      </button>
                    )}
                  </div>
                </div>

                {/* Optional Cc input */}
                {showCc && (
                  <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center text-xs">
                    <span className="w-12 text-slate-400 font-medium">Cc:</span>
                    <input
                      type="text"
                      value={ccValue}
                      onChange={(e) => setCcValue(e.target.value)}
                      placeholder="Add Cc recipients"
                      className="flex-1 bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <button type="button" onClick={() => { setShowCc(false); setCcValue(''); }} className="text-slate-400 hover:text-slate-600 ml-2">×</button>
                  </div>
                )}

                {/* Optional Bcc input */}
                {showBcc && (
                  <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center text-xs">
                    <span className="w-12 text-slate-400 font-medium">Bcc:</span>
                    <input
                      type="text"
                      value={bccValue}
                      onChange={(e) => setBccValue(e.target.value)}
                      placeholder="Add Bcc recipients"
                      className="flex-1 bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <button type="button" onClick={() => { setShowBcc(false); setBccValue(''); }} className="text-slate-400 hover:text-slate-600 ml-2">×</button>
                  </div>
                )}

                {/* Attachment chips */}
                {replyFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-5 pt-3">
                    {replyFiles.map((f, i) => (
                      <span
                        key={i}
                        className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full text-slate-700 dark:text-slate-200 flex items-center space-x-1.5 font-mono shadow-2xs"
                      >
                        <span className="truncate max-w-[150px]">{f.name}</span>
                        <span className="text-slate-400 text-[10px]">({Math.round(f.size / 1024)} KB)</span>
                        <button
                          type="button"
                          onClick={() => setReplyFiles((p) => p.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Quick Reply Suggestions & AI Button */}
                <div className="px-5 pt-2.5 pb-1 flex flex-wrap items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                  <span className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 mr-1">
                    Quick Reply:
                  </span>
                  {[
                    'Thanks for the update. I have reviewed and agree.',
                    'Received. Looking into this and will follow up shortly.',
                    'Could you please share a few additional details?',
                    'Sounds great! Let’s proceed as discussed.',
                  ].map((text, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReplyText((prev) => (prev ? `${prev}\n\n${text}` : text))}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/60 hover:text-sky-700 dark:hover:text-sky-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer truncate max-w-[200px]"
                      title={text}
                    >
                      {text}
                    </button>
                  ))}
                  {token && (
                    <button
                      type="button"
                      onClick={() => setIsAiReplyModalOpen(true)}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/60 dark:to-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:from-sky-100 hover:to-indigo-100 dark:hover:from-sky-900/60 dark:hover:to-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/80 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>✨</span>
                      <span>AI Reply</span>
                    </button>
                  )}
                </div>

                {/* Compose Textarea */}
                <form onSubmit={handleSendReply}>
                  <textarea
                    ref={replyTextareaRef}
                    rows={6}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSendReply(e);
                      }
                    }}
                    placeholder="Write your email reply..."
                    className="w-full px-5 py-4 bg-transparent resize-y text-[14px] text-slate-850 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none leading-relaxed font-sans min-h-[140px]"
                  />

                  {/* Gmail Bottom Action Toolbar */}
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        type="submit"
                        disabled={isSending || (!replyText.trim() && replyFiles.length === 0)}
                        className="px-6 py-2.5 bg-[#0b57d0] hover:bg-[#0842a0] active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white rounded-full text-xs font-semibold shadow-xs flex items-center space-x-2 transition cursor-pointer"
                      >
                        {isSending ? (
                          <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Send</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </>
                        )}
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach files"
                        className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>

                      {token && (
                        <button
                          type="button"
                          onClick={() => setIsAiReplyModalOpen(true)}
                          title="Write reply with Groq AI"
                          className="px-2.5 py-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-full transition cursor-pointer flex items-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-[11px] font-semibold hidden md:inline">AI Draft</span>
                        </button>
                      )}

                      <span className="text-[11px] text-slate-400 hidden sm:inline ml-2">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono">Ctrl+Enter</kbd> to send
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReplyText('');
                        setReplyFiles([]);
                        setIsReplying(false);
                      }}
                      title="Discard draft"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Full-Featured Attachment Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-between p-4 sm:p-6 animate-fade-in"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="w-full max-w-4xl flex items-center justify-between bg-slate-900/95 text-white px-5 py-3 rounded-2xl border border-slate-800 shadow-xl mb-3 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 min-w-0 pr-4">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-sky-400 border border-slate-700">
                {previewAttachment.type.toUpperCase()}
              </span>
              <span className="font-medium text-sm truncate text-slate-200">
                {previewAttachment.name}
              </span>
              {previewAttachment.size ? (
                <span className="text-xs text-slate-400 hidden sm:inline">
                  ({formatFileSize(previewAttachment.size)})
                </span>
              ) : null}
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <a
                href={previewAttachment.url}
                download={previewAttachment.name}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition"
                title="Download file"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Download</span>
              </a>

              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Close preview (Esc)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div
            className="flex-1 w-full max-w-4xl flex items-center justify-center overflow-auto p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {previewAttachment.type === 'image' && (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.name}
                className="max-h-[78vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
              />
            )}

            {previewAttachment.type === 'pdf' && (
              <iframe
                src={previewAttachment.url}
                title={previewAttachment.name}
                className="w-full h-[78vh] rounded-xl bg-white shadow-2xl border border-slate-700/50"
              />
            )}

            {previewAttachment.type === 'video' && (
              <video
                controls
                autoPlay
                src={previewAttachment.url}
                className="max-h-[78vh] w-auto max-w-full rounded-xl shadow-2xl bg-black"
              />
            )}

            {previewAttachment.type === 'audio' && (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col items-center justify-center space-y-4 max-w-md w-full shadow-2xl text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-white font-medium text-sm truncate">{previewAttachment.name}</p>
                  {previewAttachment.size ? (
                    <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(previewAttachment.size)}</p>
                  ) : null}
                </div>
                <audio controls src={previewAttachment.url} className="w-full mt-2" autoPlay />
              </div>
            )}

            {(previewAttachment.type === 'text' || previewAttachment.type === 'file') && (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col items-center justify-center space-y-4 max-w-md w-full shadow-2xl text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-300 flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-white font-semibold text-sm truncate">{previewAttachment.name}</p>
                  {previewAttachment.size ? (
                    <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(previewAttachment.size)}</p>
                  ) : null}
                </div>
                <p className="text-xs text-slate-400">
                  Direct preview is not supported for this file type. You can download and view it locally.
                </p>
                <a
                  href={previewAttachment.url}
                  download={previewAttachment.name}
                  className="inline-flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download File</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Reply Modal */}
      {token && (
        <SandeshAiDraftModal
          isOpen={isAiReplyModalOpen}
          token={token}
          onClose={() => setIsAiReplyModalOpen(false)}
          onApplyDraft={(draft) => {
            setReplyText((prev) => (prev ? `${prev}\n\n${draft.body}` : draft.body));
          }}
          currentSubject={activeThreadData?.thread?.subject}
          recipientContext={activeThreadData?.thread?.contact?.email || activeThreadData?.thread?.contact?.phone}
        />
      )}

      {/* E2EE Security & Safety Number Verification Modal */}
      <E2eeVerificationModal
        isOpen={isE2eeModalOpen}
        onClose={() => setIsE2eeModalOpen(false)}
        myPublicKey={userPublicKey}
        myPhone={user?.phone}
        contact={thread?.contact}
      />
    </div>
  );
};
