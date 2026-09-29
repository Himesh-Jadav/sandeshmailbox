import React, { useState, useEffect, useRef } from 'react';
import { mailApi } from '../../lib/mailApi';

interface SandeshAiDraftModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onApplyDraft: (draft: { subject: string; body: string }) => void;
  initialPrompt?: string;
  currentSubject?: string;
  recipientContext?: string;
}

const QUICK_TOPIC_EXAMPLES = [
  'Sick leave notification for today due to fever',
  'Follow-up regarding the proposal sent this week',
  'Request a 30-minute sync to review progress',
  'Weekly project milestone and deliverables update',
];

export const SandeshAiDraftModal: React.FC<SandeshAiDraftModalProps> = ({
  isOpen,
  token,
  onClose,
  onApplyDraft,
  initialPrompt = '',
  currentSubject = '',
  recipientContext = '',
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt);
      setError(null);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 60);
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  const handleGenerate = async (customPrompt?: string) => {
    const textToUse = (customPrompt ?? prompt).trim();
    if (!textToUse) {
      setError('Please describe your topic or what you would like to say.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate a medium-length professional email
      const response = await mailApi.generateAiDraft(token, {
        prompt: textToUse,
        tone: 'professional',
        length: 'medium',
        recipientContext,
        currentSubject,
      });

      // Directly apply the generated draft to the compose message and close
      onApplyDraft({
        subject: response.subject || currentSubject || 'Discussion Update',
        body: response.body,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to generate email. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/60 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Write with AI
              </h3>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                Describe your topic to generate an email draft
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Describe your topic
            </label>
            <textarea
              ref={textareaRef}
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="e.g., Ask client for confirmation on tomorrow's kickoff call and attach agenda items..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white dark:focus:bg-slate-800 transition leading-relaxed resize-none"
            />
          </div>

          {/* Minimal Suggestions */}
          <div>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block mb-1.5">
              Suggested topics
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TOPIC_EXAMPLES.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(item);
                    handleGenerate(item);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 dark:hover:bg-sky-950/50 dark:hover:text-sky-300 border border-slate-200/60 dark:border-slate-700/60 transition cursor-pointer text-left"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isGenerating || !prompt.trim()}
            onClick={() => handleGenerate()}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition cursor-pointer"
          >
            {isGenerating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating email...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Generate Email</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
