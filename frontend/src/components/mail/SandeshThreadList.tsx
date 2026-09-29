import React, { useState, useMemo, useEffect } from 'react';
import { MailThread, Draft } from '../../lib/mailApi';
import { getUserOrContactName } from '../../lib/formatters';
import { isEncryptedMessage, decryptMessage } from '../../lib/crypto';
import { useAuth } from '../../context/AuthContext';

interface SandeshThreadListProps {
  threads: MailThread[];
  drafts?: Draft[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onOpenDraft?: (draft: Draft) => void;
  isLoading?: boolean;
  isMailBarOpen?: boolean;
  onOpenMailBar?: () => void;
  activeTab?: string;
  listFilter?: 'all' | 'unread' | 'starred';
  onListFilterChange?: (filter: 'all' | 'unread' | 'starred') => void;
  pinnedThreadIds?: string[];
  onTogglePin?: (threadId: string) => void;
  // Message-level operations (new)
  onTrashMessage?: (messageId: string | string[]) => void;
  onArchiveMessage?: (messageId: string | string[]) => void;
  onRestoreMessage?: (messageId: string | string[]) => void;
  onPermanentDelete?: (messageId: string | string[]) => void;
  onSpamMessage?: (messageId: string | string[]) => void;
  onEmptySpam?: () => void;
}

export const SandeshThreadList: React.FC<SandeshThreadListProps> = ({
  threads,
  drafts = [],
  activeThreadId,
  onSelectThread,
  onOpenDraft,
  isLoading,
  activeTab = 'inbox',
  listFilter: externalListFilter,
  onListFilterChange,
  pinnedThreadIds = [],
  onTogglePin,
  onTrashMessage,
  onArchiveMessage,
  onRestoreMessage,
  onPermanentDelete,
  onSpamMessage,
  onEmptySpam,
}) => {
  const { userSecretKey } = useAuth();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [internalListFilter, setInternalListFilter] = useState<'all' | 'unread' | 'starred'>('all');

  const listFilter = externalListFilter !== undefined ? externalListFilter : internalListFilter;
  const setListFilter = (filter: 'all' | 'unread' | 'starred') => {
    setInternalListFilter(filter);
    onListFilterChange?.(filter);
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
      if (isToday) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const sanitizePhoneText = (text: string) => {
    if (!text) return '';
    return text.replace(/(\+?91[\s-]?)?\b(\d{10})\b/g, (_m, _p, num) => `user_${num.slice(-4)}`);
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-emerald-500 to-teal-600',
      'from-blue-500 to-indigo-600',
      'from-violet-500 to-purple-600',
      'from-rose-500 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-teal-500 to-emerald-600',
      'from-indigo-500 to-cyan-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  const getInitials = (name: string) => {
    if (!name) return 'S';
    const clean = name.replace(/^user_/i, '').trim();
    const parts = clean.split(/[\s_-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase() || 'S';
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(filteredDisplayThreads.map((t) => t.id));
    else setSelectedIds([]);
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const isStarredSection = activeTab === 'starred' || activeTab === 'pinned';

  // In the Starred section, all items are already starred, so only show 'all' and 'unread' filters
  const filterOptions: ('all' | 'unread' | 'starred')[] = useMemo(() => {
    if (isStarredSection) {
      return ['all', 'unread'];
    }
    return ['all', 'unread', 'starred'];
  }, [isStarredSection]);

  // Reset list filter and selection when changing folders/tabs
  useEffect(() => {
    setListFilter('all');
    setSelectedIds([]);
  }, [activeTab]);

  const filteredDisplayThreads = useMemo(() => {
    if (listFilter === 'unread') return threads.filter((t) => (t.unreadCount || 0) > 0);
    if (listFilter === 'starred' && !isStarredSection) return threads.filter((t) => pinnedThreadIds.includes(t.id));
    return threads;
  }, [threads, listFilter, pinnedThreadIds, isStarredSection]);

  const unreadCount = useMemo(() => threads.filter((t) => (t.unreadCount || 0) > 0).length, [threads]);
  const starredCount = useMemo(() => threads.filter((t) => pinnedThreadIds.includes(t.id)).length, [threads, pinnedThreadIds]);

  // ── Drafts view ────────────────────────────────────────────────────────────
  if (activeTab === 'drafts') {
    return (
      <div className="flex-1 w-full bg-slate-50/50 dark:bg-slate-950 flex flex-col h-full overflow-hidden select-none font-sans">
        {/* Toolbar */}
        <div className="h-13 px-4 sm:px-6 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {drafts.length} Draft{drafts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">No drafts</p>
            <p className="text-xs text-slate-400">Your saved drafts will appear here.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                onClick={() => onOpenDraft?.(draft)}
                className="group relative px-4 sm:px-6 py-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                {/* Draft icon */}
                <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 truncate">
                      {draft.to ? `To: ${draft.to}` : 'Draft (no recipient)'}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">{formatTime(draft.updatedAt)}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {draft.subject || '(No subject)'}
                  </p>
                  <p className="text-[11.5px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {draft.text || '(No message body)'}
                  </p>
                </div>

                {/* Delete draft button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Treat draft delete as a confirm via parent — use trash action on draft.id
                    // The DashboardPage will handle confirming and calling deleteDraft
                    onTrashMessage?.(draft.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition shrink-0"
                  title="Discard draft"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Normal thread list view ───────────────────────────────────────────────

  return (
    <div className="flex-1 w-full bg-slate-50/50 dark:bg-slate-950 flex flex-col h-full overflow-hidden select-none font-sans">
      {/* Top Action & Filter Toolbar */}
      <div className="h-13 px-4 sm:px-6 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md flex-shrink-0 z-10 transition-colors">
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Select All Checkbox */}
          <label className="flex items-center space-x-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filteredDisplayThreads.length > 0 && selectedIds.length === filteredDisplayThreads.length}
              onChange={handleSelectAll}
              title="Select all"
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer transition"
            />
          </label>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            title="Refresh mail"
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Batch Action Toolbar */}
          {selectedIds.length > 0 ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800 animate-fade-in">
                {/* Restore (trash/archive tabs) or Not Spam (spam tab) */}
              {(activeTab === 'trash' || activeTab === 'archive' || activeTab === 'spam') && onRestoreMessage && (
                <button
                  type="button"
                  onClick={() => { onRestoreMessage(selectedIds); setSelectedIds([]); }}
                  title={activeTab === 'spam' ? 'Report not spam (Move to Inbox)' : 'Restore to Inbox'}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{activeTab === 'spam' ? 'Not Spam' : 'Restore'}</span>
                </button>
              )}

              {/* Archive (non-archive/trash/spam tabs) */}
              {activeTab !== 'trash' && activeTab !== 'archive' && activeTab !== 'spam' && onArchiveMessage && (
                <button
                  type="button"
                  onClick={() => { onArchiveMessage(selectedIds); setSelectedIds([]); }}
                  title="Archive selected"
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded-lg transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span>Archive</span>
                </button>
              )}

              {/* Report Spam (inbox and other non-spam tabs) */}
              {activeTab !== 'trash' && activeTab !== 'spam' && onSpamMessage && (
                <button
                  type="button"
                  onClick={() => { onSpamMessage(selectedIds); setSelectedIds([]); }}
                  title="Report selected as spam"
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-lg transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Report Spam</span>
                </button>
              )}

              {/* Delete / Delete Forever */}
              <button
                type="button"
                onClick={() => {
                  if ((activeTab === 'trash' || activeTab === 'spam') && onPermanentDelete) {
                    onPermanentDelete(selectedIds);
                  } else if (onTrashMessage) {
                    onTrashMessage(selectedIds);
                  }
                  setSelectedIds([]);
                }}
                title={activeTab === 'trash' || activeTab === 'spam' ? 'Delete permanently' : 'Move to Trash'}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>{activeTab === 'trash' || activeTab === 'spam' ? 'Delete Forever' : 'Delete'}</span>
              </button>

              <button type="button" onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer">
                Clear
              </button>
            </div>
          ) : (
            /* Quick Filter Pills */
            <div className="hidden sm:flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-medium">
              {filterOptions.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setListFilter(f)}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    listFilter === f
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {f === 'all' ? `All (${threads.length})` :
                   f === 'unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` :
                   `Starred${starredCount > 0 ? ` (${starredCount})` : ''}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: counter */}
        <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
          {isLoading && (
            <span className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">Syncing…</span>
            </span>
          )}
          <span className="hidden sm:inline">
            {filteredDisplayThreads.length > 0 ? `1–${filteredDisplayThreads.length} of ${filteredDisplayThreads.length}` : '0 messages'}
          </span>
        </div>
      </div>

      {/* Spam Header Banner */}
      {activeTab === 'spam' && (
        <div className="px-4 sm:px-6 py-2.5 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 shrink-0">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Messages in Spam are flagged by the automated security filter or marked by you.</span>
          </div>
          {threads.length > 0 && onEmptySpam && (
            <button
              type="button"
              onClick={onEmptySpam}
              className="font-semibold text-amber-950 dark:text-amber-100 hover:underline hover:text-amber-800 transition cursor-pointer"
            >
              Empty Spam now
            </button>
          )}
        </div>
      )}

      {/* Thread List */}
      {isLoading && filteredDisplayThreads.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredDisplayThreads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="h-14 w-14 rounded-3xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mb-4 text-slate-400">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {activeTab === 'trash' ? 'Trash is empty' :
             activeTab === 'archive' ? 'Archive is empty' :
             activeTab === 'starred' ? 'No starred messages' :
             activeTab === 'spam' ? 'Hooray, no spam here!' :
             'No messages'}
          </p>
          <p className="text-xs text-slate-400">
            {activeTab === 'inbox' ? 'Your inbox is clear.' :
             activeTab === 'spam' ? 'Your spam folder is clean.' :
             `Nothing in ${activeTab} yet.`}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80 dark:divide-slate-800/60 pb-24">
          {filteredDisplayThreads.map((thread) => {
            const isSelected = selectedIds.includes(thread.id);
            const isActive = thread.id === activeThreadId;
            const isPinned = pinnedThreadIds.includes(thread.id);
            const isUnread = (thread.unreadCount || 0) > 0;
            const contactName = getUserOrContactName(thread.contact) || 'Unknown';
            const sanitizedName = sanitizePhoneText(contactName);
            const initials = getInitials(sanitizedName);
            const gradient = getAvatarGradient(sanitizedName);
            const rawLastText = thread.lastMessage?.text || '';
            const isLastEncrypted = isEncryptedMessage(rawLastText);
            let previewText = '';
            if (isLastEncrypted) {
              const dec = decryptMessage(rawLastText, userSecretKey || '', thread.contact?.publicKey || undefined);
              previewText = dec.success ? dec.text : 'Encrypted message';
            } else {
              previewText = sanitizePhoneText(rawLastText);
            }
            const cleanSubject = sanitizePhoneText(thread.subject || 'Conversation');
            const timeStr = formatTime(thread.lastMessageAt || thread.lastMessage?.createdAt || '');

            return (
              <div
                key={thread.id}
                onClick={() => {
                  if (listFilter === 'unread' || (thread.unreadCount || 0) > 0) {
                    setListFilter('all');
                  }
                  onSelectThread(thread.id);
                }}
                className={`group relative flex items-start gap-2 sm:gap-3 px-3 sm:px-5 py-3 cursor-pointer transition-colors duration-100 ${
                  isActive
                    ? 'bg-blue-50/80 dark:bg-slate-800/60 border-l-2 border-blue-500'
                    : isSelected
                    ? 'bg-slate-100 dark:bg-slate-800/40'
                    : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40 hover:border-l-2 hover:border-transparent'
                }`}
              >
                {/* Checkbox */}
                <div className="mt-1 flex-shrink-0" onClick={(e) => toggleSelectOne(thread.id, e)}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer"
                  />
                </div>

                {/* Star */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onTogglePin?.(thread.id); }}
                  className={`mt-1 flex-shrink-0 transition ${isPinned ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'}`}
                  title={isPinned ? 'Unstar' : 'Star'}
                >
                  <svg className="w-3.5 h-3.5" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>

                {/* Avatar */}
                <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-[12px] sm:text-[13px] flex-shrink-0 shadow-sm`}>
                  {thread.contact?.profilePictureUrl ? (
                    <img src={thread.contact.profilePictureUrl} alt={sanitizedName} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-[13px] truncate ${isUnread ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                        {sanitizedName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[11px] ${isUnread ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                        {timeStr}
                      </span>
                    </div>
                  </div>

                  <p className={`text-[12.5px] truncate ${isUnread ? 'font-semibold text-slate-800 dark:text-slate-200' : 'font-normal text-slate-600 dark:text-slate-400'}`}>
                    {cleanSubject}
                  </p>

                  <p className="text-[11.5px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {previewText}
                  </p>
                </div>

                {/* Hover action buttons */}
                <div className="hidden group-hover:flex items-center gap-1 absolute right-3 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 px-1.5 py-1 z-10"
                  onClick={(e) => e.stopPropagation()}>

                  {/* Archive (inbox / starred / sent) */}
                  {activeTab !== 'trash' && activeTab !== 'archive' && onArchiveMessage && (
                    <button
                      type="button"
                      onClick={() => onArchiveMessage(thread.id)}
                      title="Archive"
                      className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </button>
                  )}

                  {/* Restore (trash / archive) */}
                  {(activeTab === 'trash' || activeTab === 'archive') && onRestoreMessage && (
                    <button
                      type="button"
                      onClick={() => onRestoreMessage(thread.id)}
                      title="Restore to Inbox"
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}

                  {/* Delete / Permanent delete */}
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'trash' && onPermanentDelete) onPermanentDelete(thread.id);
                      else onTrashMessage?.(thread.id);
                    }}
                    title={activeTab === 'trash' ? 'Delete permanently' : 'Move to Trash'}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Unread dot */}
                {isUnread && !isActive && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
