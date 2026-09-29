import React, { useState, useEffect, useRef } from 'react';
import { MailThread, MailMessage, MailAttachment } from '../../lib/mailApi';
import { getUserOrContactName, cleanEmailDisplay } from '../../lib/formatters';

interface ChatStreamProps {
  thread: MailThread;
  messages: MailMessage[];
  isLoading: boolean;
}

export const ChatStream: React.FC<ChatStreamProps> = ({
  thread,
  messages,
  isLoading,
}) => {
  const [showHeaders, setShowHeaders] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const contact = thread.contact;
  const contactName = getUserOrContactName(contact);
  const contactAddress = cleanEmailDisplay(contact?.email);
  const initials = contactName.slice(0, 2).toUpperCase();

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isImageFile = (att: MailAttachment) => {
    return att.contentType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(att.filename);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Thread Header (Spike Mail Style) */}
      <div className="h-16 px-4 sm:px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-indigo-600/20 relative overflow-hidden select-none">
              <span>{initials}</span>
              {contact?.profilePictureUrl && (
                <img
                  src={contact.profilePictureUrl}
                  alt={contactName}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </div>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white truncate">
                {contactName}
              </h2>
            </div>
            {contactAddress && (
              <div className="text-[11px] text-slate-400 font-mono truncate">
                {contactAddress}
              </div>
            )}
          </div>
        </div>

        {/* Subject & RFC Email Headers Toggle */}
        <div className="flex items-center space-x-2">
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
            <span className="text-slate-400">Subject:</span>
            <span className="font-semibold text-indigo-300 truncate max-w-[200px]">
              {thread.subject || 'Conversation'}
            </span>
          </div>

          <button
            onClick={() => setShowHeaders(!showHeaders)}
            className={`p-2 rounded-xl text-xs font-medium border transition flex items-center justify-center cursor-pointer ${
              showHeaders
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Inspect RFC Email Headers"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable RFC Email Details Banner */}
      {showHeaders && (
        <div className="bg-slate-900 border-b border-indigo-500/30 px-6 py-3 text-xs text-slate-300 space-y-1 animate-fade-in font-mono">
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-semibold text-indigo-400 uppercase tracking-wider">
              RFC-822 MIME Headers & SMTP Route
            </span>
            <span className="text-slate-500">Transport: Self-Hosted SMTP (port 2525)</span>
          </div>
          <div><strong className="text-slate-400">To:</strong> {contactAddress}</div>
          <div><strong className="text-slate-400">Thread Subject:</strong> {thread.subject}</div>
        </div>
      )}

      {/* Conversational Message Stream (WhatsApp Bubbles) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
        {isLoading && messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            <div className="flex flex-col items-center space-y-2">
              <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading messages...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p>No messages yet. Send a message below to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.isMine;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                {/* Bubble Container */}
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 shadow-md relative group transition ${
                    isMine
                      ? 'bg-gradient-to-tr from-indigo-600 to-cyan-600 text-white rounded-br-xs'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {/* Sender attribution if incoming */}
                  {!isMine && (
                    <div className="text-[11px] font-bold text-indigo-400 mb-1 flex items-center space-x-1.5">
                      <span>{getUserOrContactName(msg.from)}</span>
                      {cleanEmailDisplay(msg.fromEmail) && (
                        <span className="text-[10px] text-slate-500 font-normal font-mono">
                          &lt;{cleanEmailDisplay(msg.fromEmail)}&gt;
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Text */}
                  {msg.text && (
                    <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap select-text break-words">
                      {msg.text}
                    </p>
                  )}

                  {/* Render Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      {msg.attachments.map((att) => {
                        const isImg = isImageFile(att);
                        const downloadUrl = `/api/mail/attachments/${att.gridFsId}`;

                        return isImg ? (
                          <div key={att.id} className="rounded-2xl overflow-hidden border border-white/10 group/img relative cursor-pointer">
                            <a href={downloadUrl} target="_blank" rel="noreferrer" className="cursor-pointer block">
                              <img
                                src={downloadUrl}
                                alt={att.filename}
                                className="max-h-60 w-full object-cover hover:scale-[1.02] transition-transform duration-300 rounded-2xl"
                              />
                            </a>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-6 text-[10px] text-slate-200 flex items-end justify-between pointer-events-none">
                              <span className="truncate max-w-[180px] drop-shadow-sm font-medium">{att.filename}</span>
                              <a
                                href={downloadUrl}
                                download={att.filename}
                                title={`Download ${att.filename}`}
                                className="h-7 w-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition shadow-sm pointer-events-auto cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        ) : (
                          <a
                            key={att.id}
                            href={downloadUrl}
                            download={att.filename}
                            className={`flex items-center space-x-2.5 p-2 rounded-xl border transition ${
                              isMine
                                ? 'bg-black/20 hover:bg-black/30 border-white/20 text-white'
                                : 'bg-slate-950/70 hover:bg-slate-950 border-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{att.filename}</div>
                              <div className="text-[10px] opacity-75 font-mono">
                                {Math.round(att.size / 1024)} KB
                              </div>
                            </div>
                            <div className="text-xs opacity-75 hover:opacity-100 flex-shrink-0 p-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Message Timestamp */}
                  <div
                    className={`mt-1.5 flex items-center justify-end space-x-1 text-[10px] ${
                      isMine ? 'text-indigo-100/80' : 'text-slate-500'
                    }`}
                  >
                    <span className="font-mono">{formatMessageTime(msg.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
