import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { mailApi, Draft } from '../lib/mailApi';
import { SandeshSidebar } from '../components/mail/SandeshSidebar';
import { SandeshThreadList } from '../components/mail/SandeshThreadList';
import { SandeshEmailView } from '../components/mail/SandeshEmailView';
import { SandeshComposeModal } from '../components/mail/SandeshComposeModal';
import { ConfirmDialog } from '../components/mail/ConfirmDialog';
import { getUserOrContactName } from '../lib/formatters';
import { encryptMessage } from '../lib/crypto';

interface PendingAction {
  type: 'trash' | 'permDelete';
  messageId: string | string[];
  label?: string;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark, toggleTheme } = useTheme();
  const { user, token, isAuthenticated, isLoading: authLoading, logout, userSecretKey, userPublicKey } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [listFilter, setListFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isMailBarOpen, setIsMailBarOpen] = useState(false);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Pinned threads (client-side only, no change needed)
  const [pinnedThreadIds, setPinnedThreadIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('sandesh_pinned_threads') || '[]'); } catch { return []; }
  });

  // Compose modal state - also handles draft editing and forward
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [composeInitialData, setComposeInitialData] = useState<{
    to?: string;
    subject?: string;
    text?: string;
  } | null>(null);

  // Confirm dialog state
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  // Fetch threads for the active tab (folder-scoped from backend)
  const folderForQuery = useMemo(() => {
    if (activeTab === 'starred') return 'inbox'; // starred is client-side filter on top of inbox
    if (activeTab === 'drafts') return 'drafts'; // handled separately
    return activeTab; // inbox, sent, trash, archive
  }, [activeTab]);

  const { data: rawThreads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ['mailThreads', folderForQuery],
    queryFn: () => token ? mailApi.getThreads(token, folderForQuery) : Promise.resolve([]),
    enabled: Boolean(token) && activeTab !== 'drafts',
    refetchInterval: 4000,
  });

  const { data: drafts = [], isLoading: draftsLoading } = useQuery({
    queryKey: ['mailDrafts'],
    queryFn: () => token ? mailApi.getDrafts(token) : Promise.resolve([]),
    enabled: Boolean(token),
    refetchInterval: 10000,
  });

  const { data: activeThreadData } = useQuery({
    queryKey: ['threadMessages', activeThreadId],
    queryFn: () =>
      token && activeThreadId
        ? mailApi.getThreadMessages(activeThreadId, token)
        : Promise.resolve(null),
    enabled: Boolean(token && activeThreadId),
    refetchInterval: 4000,
  });

  // Re-sync mailThreads once thread messages load to ensure background consistency
  useEffect(() => {
    if (activeThreadData?.thread?.id) {
      queryClient.invalidateQueries({ queryKey: ['mailThreads'] });
    }
  }, [activeThreadData?.thread?.id, queryClient]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileMenuOpen(false);
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────

  const threads = rawThreads; // already folder-scoped from backend

  const pinnedThreads = useMemo(() =>
    threads.filter((t) => pinnedThreadIds.includes(t.id)),
    [threads, pinnedThreadIds]
  );

  const currentTabThreads = useMemo(() => {
    if (activeTab === 'starred') return pinnedThreads;
    if (activeTab === 'drafts') return []; // drafts rendered differently
    return threads;
  }, [activeTab, threads, pinnedThreads]);

  // Count badges from separate queries for non-active tabs
  const { data: inboxThreadsForCount = [] } = useQuery({
    queryKey: ['mailThreads', 'inbox'],
    queryFn: () => token ? mailApi.getThreads(token, 'inbox') : Promise.resolve([]),
    enabled: Boolean(token),
    refetchInterval: 10000,
  });

  const { data: trashThreadsForCount = [] } = useQuery({
    queryKey: ['mailThreads', 'trash'],
    queryFn: () => token ? mailApi.getThreads(token, 'trash') : Promise.resolve([]),
    enabled: Boolean(token),
    refetchInterval: 15000,
  });

  const { data: archiveThreadsForCount = [] } = useQuery({
    queryKey: ['mailThreads', 'archive'],
    queryFn: () => token ? mailApi.getThreads(token, 'archive') : Promise.resolve([]),
    enabled: Boolean(token),
    refetchInterval: 15000,
  });

  const { data: spamThreadsForCount = [] } = useQuery({
    queryKey: ['mailThreads', 'spam'],
    queryFn: () => token ? mailApi.getThreads(token, 'spam') : Promise.resolve([]),
    enabled: Boolean(token),
    refetchInterval: 15000,
  });

  const trashCount = trashThreadsForCount.length;
  const archiveCount = archiveThreadsForCount.length;
  const spamCount = spamThreadsForCount.length;
  const totalUnreadCount = inboxThreadsForCount.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return currentTabThreads;
    const q = searchQuery.toLowerCase();
    return currentTabThreads.filter((t) => {
      const contactName = (t.contact?.displayName || '').toLowerCase();
      const contactPhone = (t.contact?.phone || '').toLowerCase();
      const contactEmail = (t.contact?.email || '').toLowerCase();
      const subject = (t.subject || '').toLowerCase();
      const lastMsg = (t.lastMessage?.text || '').toLowerCase();
      return (
        contactName.includes(q) ||
        contactPhone.includes(q) ||
        contactEmail.includes(q) ||
        subject.includes(q) ||
        lastMsg.includes(q)

      );
    });
  }, [currentTabThreads, searchQuery]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mailThreads'] });
    queryClient.invalidateQueries({ queryKey: ['threadMessages', activeThreadId] });
  }, [queryClient, activeThreadId]);

  const handleTogglePin = (threadId: string) => {
    setPinnedThreadIds((prev) => {
      const next = prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId];
      try { localStorage.setItem('sandesh_pinned_threads', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // ── Message-level operations ───────────────────────────────────────────────

  /**
   * Move conversation(s) or draft to trash — shows confirmation first.
   * targetId: messageId or threadId (string or array)
   */
  const handleTrashMessage = useCallback((targetId: string | string[]) => {
    const isMultiple = Array.isArray(targetId) && targetId.length > 1;
    const label = activeTab === 'drafts'
      ? (isMultiple ? `Delete ${targetId.length} drafts?` : 'Delete this draft?')
      : (isMultiple ? `Move ${targetId.length} conversations to Trash?` : 'Move this conversation to Trash?');
    setPendingAction({ type: 'trash', messageId: targetId, label });
  }, [activeTab]);

  const confirmTrash = async () => {
    if (!pendingAction || !token) return;
    try {
      const ids = Array.isArray(pendingAction.messageId) ? pendingAction.messageId : [pendingAction.messageId];
      if (activeTab === 'drafts') {
        await Promise.all(ids.map((id) => mailApi.deleteDraft(id, token)));
      } else {
        await Promise.all(ids.map((id) => mailApi.moveMessage(id, 'trash', token)));
      }
      invalidateAll();
      if (activeThreadId && ids.includes(activeThreadId)) {
        setIsMailBarOpen(false);
        setActiveThreadId(null);
      } else if (!Array.isArray(pendingAction.messageId)) {
        setIsMailBarOpen(false);
        setActiveThreadId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to move to trash');
    } finally {
      setPendingAction(null);
    }
  };

  /**
   * Archive conversation(s) — no confirmation needed (reversible).
   */
  const handleArchiveMessage = useCallback(async (targetId: string | string[]) => {
    if (!token) return;
    try {
      const ids = Array.isArray(targetId) ? targetId : [targetId];
      await Promise.all(ids.map((id) => mailApi.moveMessage(id, 'archive', token)));
      invalidateAll();
      if (activeThreadId && ids.includes(activeThreadId)) {
        setIsMailBarOpen(false);
        setActiveThreadId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to archive message');
    }
  }, [token, activeThreadId, invalidateAll]);

  /**
   * Restore conversation(s) from trash, archive, or spam back to inbox.
   */
  const handleRestoreMessage = useCallback(async (targetId: string | string[]) => {
    if (!token) return;
    try {
      const ids = Array.isArray(targetId) ? targetId : [targetId];
      await Promise.all(ids.map((id) => mailApi.moveMessage(id, 'inbox', token)));
      invalidateAll();
      if (activeThreadId && ids.includes(activeThreadId)) {
        setIsMailBarOpen(false);
        setActiveThreadId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to restore message');
    }
  }, [token, activeThreadId, invalidateAll]);

  /**
   * Move conversation(s) to spam (Report Spam).
   */
  const handleSpamMessage = useCallback(async (targetId: string | string[]) => {
    if (!token) return;
    try {
      const ids = Array.isArray(targetId) ? targetId : [targetId];
      await Promise.all(ids.map((id) => mailApi.moveMessage(id, 'spam', token)));
      invalidateAll();
      if (activeThreadId && ids.includes(activeThreadId)) {
        setIsMailBarOpen(false);
        setActiveThreadId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to report as spam');
    }
  }, [token, activeThreadId, invalidateAll]);

  /**
   * Empty all spam messages.
   */
  const handleEmptySpam = useCallback(async () => {
    if (!token) return;
    try {
      await mailApi.emptySpam(token);
      invalidateAll();
      setIsMailBarOpen(false);
      setActiveThreadId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to empty spam');
    }
  }, [token, invalidateAll]);

  /**
   * Permanently delete — shows confirmation first.
   */
  const handlePermanentDelete = useCallback((targetId: string | string[]) => {
    const isMultiple = Array.isArray(targetId) && targetId.length > 1;
    setPendingAction({
      type: 'permDelete',
      messageId: targetId,
      label: isMultiple
        ? `This will permanently delete ${targetId.length} conversations. This cannot be undone.`
        : 'This will permanently delete the conversation. This cannot be undone.',
    });
  }, []);

  const confirmPermanentDelete = async () => {
    if (!pendingAction || !token) return;
    try {
      const ids = Array.isArray(pendingAction.messageId) ? pendingAction.messageId : [pendingAction.messageId];
      await Promise.all(ids.map((id) => mailApi.deleteMessage(id, token)));
      invalidateAll();
      if (activeThreadId && ids.includes(activeThreadId)) {
        setIsMailBarOpen(false);
        setActiveThreadId(null);
      } else if (!Array.isArray(pendingAction.messageId)) {
        setIsMailBarOpen(false);
        setActiveThreadId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to permanently delete message');
    } finally {
      setPendingAction(null);
    }
  };


  // ── Tab navigation ─────────────────────────────────────────────────────────


  const handleTabChange = (tab: string) => {
    if (tab === 'profile') { navigate('/profile'); return; }
    setActiveTab(tab);
    setListFilter('all');
    setIsMailBarOpen(false);
    setActiveThreadId(null);
  };

  // ── Thread / message selection ─────────────────────────────────────────────

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
    setIsMailBarOpen(true);
    // Directly go to all section so unread thread doesn't remain stranded in unread filter
    setListFilter('all');

    // Instantly optimistically update the query cache so unreadCount becomes 0 with zero delay
    queryClient.setQueriesData<any[]>({ queryKey: ['mailThreads'] }, (oldData) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.map((t) => (t.id === id ? { ...t, unreadCount: 0 } : t));
    });

    // Notify backend immediately in the background
    if (token) {
      mailApi.markThreadRead(id, token).catch(() => {});
    }
  };

  const handleCloseMailBar = () => {
    setIsMailBarOpen(false);
    setActiveThreadId(null);
  };

  // ── Send message (reply within thread) ────────────────────────────────────

  const handleSendMessage = async (payload: {
    text: string;
    files: File[];
    subject?: string;
    to?: string;
    cc?: string;
    bcc?: string;
  }) => {
    const targetRecipient = payload.to || activeThreadData?.thread?.contact?.phone;
    if (!targetRecipient) {
      alert('Cannot send message: no recipient phone or address associated with this thread.');
      return;
    }

    setIsSending(true);
    try {
      let textToSend = payload.text;
      let recipientPubKey = activeThreadData?.thread?.contact?.publicKey;
      if (!recipientPubKey && targetRecipient) {
        try {
          const keyRes = await mailApi.getRecipientKey(targetRecipient, token!);
          recipientPubKey = keyRes.publicKey;
        } catch {}
      }

      if (recipientPubKey && userSecretKey) {
        textToSend = encryptMessage(textToSend, recipientPubKey, userSecretKey, userPublicKey || undefined);
      }

      await mailApi.sendMail(
        {
          to: targetRecipient,
          cc: payload.cc,
          bcc: payload.bcc,
          subject: payload.subject || activeThreadData?.thread?.subject || 'Conversation',
          text: textToSend,
          files: payload.files,
          threadId: activeThreadId || undefined, // reply to current thread
        },
        token!
      );

      await queryClient.invalidateQueries({ queryKey: ['mailThreads'] });
      await queryClient.invalidateQueries({ queryKey: ['threadMessages', activeThreadId] });
    } catch (err: any) {
      alert(err.message || 'Failed to send Sandesh message');
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  const handleChatCreated = (newThreadId: string) => {
    setActiveThreadId(newThreadId);
    setIsMailBarOpen(true);
    queryClient.invalidateQueries({ queryKey: ['mailThreads'] });
    queryClient.invalidateQueries({ queryKey: ['threadMessages', newThreadId] });
    // Refresh draft list too
    queryClient.invalidateQueries({ queryKey: ['mailDrafts'] });
  };

  // ── Draft handlers ─────────────────────────────────────────────────────────

  const handleOpenDraft = (draft: Draft) => {
    setEditingDraft(draft);
    setComposeModalOpen(true);
  };

  const handleDraftSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['mailDrafts'] });
    setEditingDraft(null);
    setComposeModalOpen(false);
  };

  const handleDraftDiscarded = () => {
    queryClient.invalidateQueries({ queryKey: ['mailDrafts'] });
    setEditingDraft(null);
    setComposeInitialData(null);
    setComposeModalOpen(false);
  };

  const handleOpenCompose = () => {
    setEditingDraft(null);
    setComposeInitialData(null);
    setComposeModalOpen(true);
  };

  const handleCloseCompose = () => {
    setEditingDraft(null);
    setComposeInitialData(null);
    setComposeModalOpen(false);
  };

  const handleForward = (forwardData: { subject: string; text: string }) => {
    setComposeInitialData({
      to: '',
      subject: forwardData.subject,
      text: forwardData.text,
    });
    setEditingDraft(null);
    setComposeModalOpen(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // ── Pending action confirm/cancel ─────────────────────────────────────────

  const handleConfirmAction = () => {
    if (pendingAction?.type === 'trash') confirmTrash();
    else if (pendingAction?.type === 'permDelete') confirmPermanentDelete();
  };

  // ── Loading / auth guards ──────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f4f5f9] dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 animate-fade-in">
          <img src="/sandesh-wordmark.png" alt="संदेश" className="h-14 w-auto sandesh-logo" />
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-[#10b981] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 rounded-full bg-[#10b981] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 rounded-full bg-[#10b981] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-xs font-semibold text-slate-500 tracking-wide">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !token) {
    return <Navigate to="/login" replace />;
  }

  // ── Determine isTrashed / isArchived / isSpam for current thread ─────────
  // These are per-message in the new system; we check the last message of the active thread
  const activeMessages = activeThreadData?.messages || [];
  const lastActiveMsg = activeMessages[activeMessages.length - 1];
  const isTrashed = lastActiveMsg?.folder === 'trash';
  const isArchived = lastActiveMsg?.folder === 'archive';
  const isSpam = lastActiveMsg?.folder === 'spam' || activeTab === 'spam';

  return (
    <div className="h-full min-h-screen min-h-[100dvh] h-[100dvh] w-full max-w-[100vw] bg-[#f4f5f9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden font-sans transition-colors duration-200">
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={pendingAction?.type === 'permDelete' ? 'Delete Forever?' : 'Move to Trash?'}
        message={pendingAction?.label || 'Are you sure?'}
        confirmLabel={pendingAction?.type === 'permDelete' ? 'Delete Forever' : 'Move to Trash'}
        cancelLabel="Cancel"
        isDanger={true}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      {/* 1. Left Navigation Sidebar (Desktop: md+) */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <SandeshSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenCompose={handleOpenCompose}
          user={user}
          unreadCount={totalUnreadCount}
          starredCount={pinnedThreadIds.length}
          pinnedCount={pinnedThreadIds.length}
          sentCount={0}
          draftsCount={drafts.length}
          archiveCount={archiveCount}
          trashCount={trashCount}
          spamCount={spamCount}
          onLogout={handleLogout}
          onViewProfile={() => navigate('/profile')}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Mobile Slide-over Drawer (<md) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 h-full animate-slide-in">
            <SandeshSidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onOpenCompose={handleOpenCompose}
              user={user}
              unreadCount={totalUnreadCount}
              starredCount={pinnedThreadIds.length}
              pinnedCount={pinnedThreadIds.length}
              sentCount={0}
              draftsCount={drafts.length}
              archiveCount={archiveCount}
              trashCount={trashCount}
              spamCount={spamCount}
              onLogout={handleLogout}
              onViewProfile={() => navigate('/profile')}
              isMobileDrawer={true}
              onCloseMobileDrawer={() => setIsMobileSidebarOpen(false)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        </div>
      )}

      {/* 2. Main Workspace Canvas */}
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden p-0 md:p-3 lg:p-4 min-w-0">
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-none md:rounded-[24px] border-0 md:border border-slate-200/70 dark:border-slate-800 shadow-none md:shadow-[0_2px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden relative w-full h-full">

          {/* Top Bar */}
          <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0">
            <div className="flex items-center space-x-2.5 flex-1 max-w-xl sm:max-w-2xl lg:max-w-3xl min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="md:hidden p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                aria-label="Open sidebar menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleOpenCompose}
                className="sm:hidden p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-[0_4px_14px_-2px_rgba(37,99,235,0.45)] flex items-center justify-center shrink-0 active:scale-95"
                title="Compose message"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search mail, contacts..."
                  className="w-full h-9 pl-9 pr-9 py-1.5 bg-[#f1f3f6] dark:bg-slate-850 hover:bg-[#e8ebf0] dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80 focus:border-slate-300 dark:focus:border-slate-600 rounded-full text-xs sm:text-[13px] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all shadow-inner dark:shadow-none"
                />
                {searchQuery && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button type="button" onClick={() => setSearchQuery('')}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition cursor-pointer" title="Clear search">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {/* Theme switch — same style as login page */}
              <button
                type="button"
                onClick={toggleTheme}
                role="switch"
                aria-checked={isDark}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm backdrop-blur-md text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer active:scale-95"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">Light</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                    <span className="hidden sm:inline">Dark</span>
                  </>
                )}
              </button>

              {/* Profile Avatar */}
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  title={`${getUserOrContactName(user)} - Account`}
                  className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-xs hover:ring-2 hover:ring-blue-400/50 transition-all cursor-pointer border border-transparent active:scale-95"
                >
                  {user?.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} alt={getUserOrContactName(user)} className="w-full h-full object-cover" />
                  ) : (
                    <span>{getUserOrContactName(user).slice(0, 2).toUpperCase()}</span>
                  )}
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xl shadow-slate-900/10 dark:shadow-black/50 z-50 animate-fade-in select-none">
                    <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{getUserOrContactName(user)}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">{user?.phone || user?.email}</p>
                    </div>
                    <div className="flex flex-col space-y-0.5">
                      <button type="button" onClick={() => { setIsProfileMenuOpen(false); navigate('/profile'); }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Profile Settings</span>
                      </button>
                      <button type="button" onClick={() => { setIsProfileMenuOpen(false); logout(); navigate('/login'); }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 transition cursor-pointer">
                        <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Mail Area */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Thread / Draft List */}
            <div className={`${isMailBarOpen ? 'hidden' : 'flex flex-1 w-full'} h-full overflow-hidden transition-all duration-200`}>
              <SandeshThreadList
                threads={filteredThreads}
                drafts={activeTab === 'drafts' ? drafts : []}
                activeThreadId={activeThreadId}
                onSelectThread={handleSelectThread}
                onOpenDraft={handleOpenDraft}
                isLoading={threadsLoading || draftsLoading}
                isMailBarOpen={isMailBarOpen}
                onOpenMailBar={() => setIsMailBarOpen(true)}
                activeTab={activeTab}
                listFilter={listFilter}
                onListFilterChange={setListFilter}
                pinnedThreadIds={pinnedThreadIds}
                onTogglePin={handleTogglePin}
                onTrashMessage={handleTrashMessage}
                onArchiveMessage={handleArchiveMessage}
                onRestoreMessage={handleRestoreMessage}
                onPermanentDelete={handlePermanentDelete}
                onSpamMessage={handleSpamMessage}
                onEmptySpam={handleEmptySpam}
              />
            </div>

            {/* Email Reading View */}
            {isMailBarOpen && (
              <div className="flex flex-1 w-full h-full overflow-hidden min-w-0 transition-all duration-200">
                <SandeshEmailView
                  activeThreadData={activeThreadData}
                  onSendMessage={handleSendMessage}
                  isSending={isSending}
                  onClose={handleCloseMailBar}
                  onBackToList={handleCloseMailBar}
                  activeTab={activeTab}
                  isPinned={Boolean(activeThreadId && pinnedThreadIds.includes(activeThreadId))}
                  isTrashed={isTrashed}
                  isArchived={isArchived}
                  isSpam={isSpam}
                  onTogglePin={activeThreadId ? () => handleTogglePin(activeThreadId) : undefined}
                  onTrashMessage={activeThreadId ? () => handleTrashMessage(activeThreadId) : (lastActiveMsg ? () => handleTrashMessage(lastActiveMsg.id) : undefined)}
                  onArchiveMessage={activeThreadId ? () => handleArchiveMessage(activeThreadId) : (lastActiveMsg ? () => handleArchiveMessage(lastActiveMsg.id) : undefined)}
                  onRestoreMessage={activeThreadId ? () => handleRestoreMessage(activeThreadId) : (lastActiveMsg ? () => handleRestoreMessage(lastActiveMsg.id) : undefined)}
                  onSpamMessage={activeThreadId ? () => handleSpamMessage(activeThreadId) : (lastActiveMsg ? () => handleSpamMessage(lastActiveMsg.id) : undefined)}
                  onPermanentDelete={activeThreadId ? () => handlePermanentDelete(activeThreadId) : (lastActiveMsg ? () => handlePermanentDelete(lastActiveMsg.id) : undefined)}
                  isDetailExpanded={isDetailExpanded}
                  onToggleExpandDetail={() => setIsDetailExpanded((prev) => !prev)}
                  onForward={handleForward}
                />
              </div>
            )}
          </div>

          {/* Floating Compose FAB — bottom center of main canvas, truly centered with generous padding */}
          <div className="absolute bottom-7 sm:bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center justify-center">
            <button
              type="button"
              onClick={handleOpenCompose}
              className="pointer-events-auto flex items-center space-x-2.5 px-8 py-3.5 rounded-full text-white text-[13px] font-bold tracking-wide shadow-[0_10px_28px_-4px_rgba(37,99,235,0.48)] dark:shadow-[0_10px_28px_-4px_rgba(37,99,235,0.38)] hover:shadow-[0_14px_32px_-4px_rgba(37,99,235,0.65)] transition-all duration-200 active:scale-95 hover:scale-105 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-blue-400/30 cursor-pointer animate-fab-pop select-none"
              title="Compose new message"
              aria-label="Compose new message"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Compose</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      <SandeshComposeModal
        isOpen={composeModalOpen}
        token={token}
        onClose={handleCloseCompose}
        onChatCreated={handleChatCreated}
        draft={editingDraft}
        onDraftSaved={handleDraftSaved}
        onDraftDiscarded={handleDraftDiscarded}
        initialTo={composeInitialData?.to}
        initialSubject={composeInitialData?.subject}
        initialMessage={composeInitialData?.text}
      />
    </div>
  );
};
