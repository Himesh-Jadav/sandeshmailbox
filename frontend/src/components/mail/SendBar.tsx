import React, { useState, useRef } from 'react';

interface SendBarProps {
  onSendMessage: (payload: { text: string; files: File[]; subject?: string }) => Promise<void>;
  isSending: boolean;
  defaultSubject?: string;
}

export const SendBar: React.FC<SendBarProps> = ({
  onSendMessage,
  isSending,
  defaultSubject,
}) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [subject, setSubject] = useState(defaultSubject || '');
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    if (isSending) return;

    const messageText = text.trim() || (files.length > 0 ? 'Sent attachment' : '');
    const attachedFiles = [...files];
    const customSubject = subject.trim() || undefined;

    // Reset local state immediately for snappy optimistic experience
    setText('');
    setFiles([]);

    try {
      await onSendMessage({
        text: messageText,
        files: attachedFiles,
        subject: customSubject,
      });
    } catch {
      // Restore on failure
      setText(messageText);
      setFiles(attachedFiles);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur-md">
      {/* Optional Subject Line Pill/Editor */}
      {showSubjectInput ? (
        <div className="mb-2 flex items-center space-x-2 animate-fade-in">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Edit email subject..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => setShowSubjectInput(false)}
            className="text-xs text-slate-400 hover:text-white px-2 py-1"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <button
            type="button"
            onClick={() => setShowSubjectInput(true)}
            className="hover:text-indigo-400 transition flex items-center space-x-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Subject: {subject || 'Conversation'}</span>
          </button>
          <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
        </div>
      )}

      {/* Selected Attachments Preview Strip */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 p-2 bg-slate-950/80 rounded-xl border border-slate-800 animate-fade-in">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center space-x-1.5 bg-slate-800 text-slate-200 px-2.5 py-1 rounded-lg text-[11px] border border-slate-700"
            >
              <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="truncate max-w-[140px]">{file.name}</span>
              <span className="text-slate-400 font-mono text-[10px]">
                ({Math.round(file.size / 1024)} KB)
              </span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="text-slate-400 hover:text-rose-400 ml-1 font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* WhatsApp-Style Input Container */}
      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        {/* Paperclip Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Add attachments (images, docs)"
          className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition flex-shrink-0 border border-slate-700/60"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Message Input Textarea */}
        <div className="flex-1 bg-slate-950 border border-slate-800 focus-within:border-indigo-500 rounded-2xl px-3.5 py-2 transition shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type an email message (like WhatsApp chat)..."
            className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none resize-none max-h-32"
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={isSending || (!text.trim() && files.length === 0)}
          className="p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition flex items-center justify-center space-x-1.5 flex-shrink-0 active:scale-95"
        >
          {isSending ? (
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="hidden sm:inline">Send</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
