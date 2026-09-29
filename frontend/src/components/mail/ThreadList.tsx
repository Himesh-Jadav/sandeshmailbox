import React, { useState } from 'react';
import { MailThread } from '../../lib/mailApi';
import { getUserOrContactName } from '../../lib/formatters';

interface ThreadListProps {
  threads: MailThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onOpenNewChat: () => void;
  isLoading: boolean;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  threads,
  activeThreadId,
  onSelectThread,
  onOpenNewChat,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Format relative timestamp like WhatsApp
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMin / 60);

      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m`;
      if (diffHours < 24 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Avatar initials helper
  const getInitials = (name?: string, phone?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length > 1) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (phone) {
      return phone.slice(-2);
    }
    return 'PM';
  };

  const filteredThreads = threads.filter((thread) => {
    const q = searchQuery.toLowerCase();
    const contactName = thread.contact?.displayName?.toLowerCase() || '';
    const contactPhone = thread.contact?.phone?.toLowerCase() || '';
    const subject = thread.subject?.toLowerCase() || '';
    const lastText = thread.lastMessage?.text?.toLowerCase() || '';
    return (
      contactName.includes(q) ||
      contactPhone.includes(q) ||
      subject.includes(q) ||
      lastText.includes(q)
    );
  });

  return (
    <div className="w-full md:w-80 lg:w-96 border-r border-slate-800/80 bg-slate-900/40 flex flex-col h-full select-none">
      {/* Search & New Chat Header */}
      <div className="p-3.5 border-b border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-white tracking-wide">Chats & Mails</span>
            <span className="text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">
              {threads.length}
            </span>
          </div>

          <button
            onClick={onOpenNewChat}
            title="Compose New Mail (Chat)"
            className="p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <svg
            className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations by phone, name..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Conversation Thread List (WhatsApp style) */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {isLoading && threads.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center space-y-2">
            <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading conversations...</span>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs space-y-2">
            <p>No conversations found.</p>
            <button
              onClick={onOpenNewChat}
              className="text-indigo-400 hover:text-indigo-300 font-medium underline cursor-pointer"
            >
              Start your first conversation
            </button>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            const contact = thread.contact;
            const initials = getInitials(contact?.displayName, contact?.phone);

            return (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`p-3.5 rounded-2xl flex items-start space-x-3 cursor-pointer transition relative group ${
                  isActive
                    ? 'bg-indigo-600/20 ring-1 ring-indigo-500/50 text-white shadow-sm'
                    : 'hover:bg-slate-800/40 text-slate-300'
                }`}
              >
                {/* Contact Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-indigo-600/20 relative overflow-hidden select-none">
                    <span>{initials}</span>
                    {contact?.profilePictureUrl && (
                      <img
                        src={contact.profilePictureUrl}
                        alt={getUserOrContactName(contact)}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                </div>

                {/* Content details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white truncate max-w-[170px]">
                      {getUserOrContactName(contact)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatTime(thread.lastMessageAt)}
                    </span>
                  </div>

                  <div className="text-[11px] font-medium text-indigo-300 truncate mb-0.5">
                    {thread.subject || 'Conversation'}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-400 truncate max-w-[190px]">
                      {thread.lastMessage?.hasAttachments && (
                        <svg className="w-3 h-3 text-cyan-400 inline mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                      {thread.lastMessage?.text || 'No messages yet'}
                    </p>

                    {thread.unreadCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] min-w-[18px] text-center shadow-sm">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
