import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Send,
  RotateCcw,
  X,
  User,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { faqApi, ChatMessage } from '../../lib/faqApi';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { VoicePoweredOrb } from './VoicePoweredOrb';

function TypingIndicator({ isDark }: { isDark: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md px-4 py-3 backdrop-blur-sm',
        isDark
          ? 'border border-white/10 bg-zinc-800/90 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3)]'
          : 'border border-zinc-200 bg-white shadow-sm'
      )}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={cn('h-2 w-2 rounded-full', isDark ? 'bg-white/60' : 'bg-zinc-600')}
          animate={{ opacity: [0.4, 1, 0.4], y: [0, -4, 0] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </motion.div>
  );
}

// Icon is OPPOSITE of the toggle: in dark mode dialog, icon is light; in light mode dialog, icon is dark
function AssistantAvatar({ isIconDark }: { isIconDark: boolean }) {
  return (
    <div
      className={cn(
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden shadow-sm border transition-colors',
        isIconDark ? 'border-indigo-400/30 bg-zinc-950' : 'border-zinc-200 bg-white shadow-xs'
      )}
    >
      <VoicePoweredOrb className="w-8 h-8" hue={isIconDark ? 250 : 280} enableVoiceControl={false} />
    </div>
  );
}

function MessageBubble({
  message,
  isDark,
  isIconDark,
}: {
  message: ChatMessage;
  isDark: boolean;
  isIconDark: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('flex items-end gap-2.5 max-w-[85%]', isUser && 'flex-row-reverse')}>
        {!isUser ? (
          <AssistantAvatar isIconDark={isIconDark} />
        ) : (
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm transition-colors',
              isIconDark
                ? 'bg-zinc-900 border border-zinc-800 text-white'
                : 'bg-white border border-zinc-200 text-zinc-900'
            )}
          >
            <User className="size-4" />
          </div>
        )}

        <div className="flex flex-col">
          <motion.div
            layout
            whileHover={{ scale: 1.01, y: -1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              isUser
                ? 'rounded-tr-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_8px_24px_-4px_rgba(99,102,241,0.4)]'
                : message.isError
                ? isDark
                  ? 'rounded-tl-md border border-red-500/30 bg-red-950/40 text-red-200 backdrop-blur-sm'
                  : 'rounded-tl-md border border-red-200 bg-red-50 text-red-700'
                : isDark
                ? 'rounded-tl-md border border-white/10 bg-zinc-800/90 text-zinc-100 backdrop-blur-sm shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3)]'
                : 'rounded-tl-md border border-zinc-200 bg-white text-zinc-800 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)]'
            )}
          >
            <div className="whitespace-pre-wrap">{message.content}</div>

            {message.isDirectMatch && (
              <div
                className={cn(
                  'mt-2 flex items-center gap-1 border-t pt-1.5 text-[11px] font-medium',
                  isDark ? 'border-white/10 text-indigo-400' : 'border-zinc-200 text-indigo-600'
                )}
              >
                <CheckCircle2 className="size-3" />
                <span>Instant FAQ</span>
              </div>
            )}
          </motion.div>

          {message.timestamp && (
            <span
              className={cn(
                'mt-1 text-[10px] px-1',
                isDark ? 'text-white/40' : 'text-zinc-400',
                isUser ? 'text-right' : 'text-left'
              )}
            >
              {message.timestamp}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const FaqChatbot: React.FC = () => {
  const { isDark } = useTheme();

  // The dialog box follows the toggle directly
  // The icon is OPPOSITE of the toggle (light when dark mode, dark when light mode)
  const isIconDark = !isDark;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([
    'What is PhoneMail and how does it work?',
    'How do I sign up or log in to my account?',
    'Are my emails secure and private?',
    'Can I sign up via phone call or SMS?',
  ]);
  const [greeting, setGreeting] = useState(
    'Hello! I am your Sandesh Bot. How can I help you today?'
  );
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load initial suggestions and greeting from backend
  useEffect(() => {
    let isMounted = true;
    faqApi
      .getSuggestions()
      .then((data) => {
        if (isMounted) {
          if (data.greeting) setGreeting(data.greeting);
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestions(data.suggestions);
          }
        }
      })
      .catch(() => {
        // Fallback already handled inside faqApi
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    setInputValue('');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const historyContext = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await faqApi.sendMessage(query, historyContext);

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isDirectMatch: res.isDirectMatch,
      };

      setMessages([...newMessages, botMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          err.message ||
          'Something went wrong while connecting to the FAQ assistant. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resetChat = () => {
    setMessages([]);
    setIsLoading(false);
  };

  return (
    <>
      {/* Floating Action Button: OPPOSITE of the toggle (light when dark mode, dark when light mode) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex items-center"
          >
            <motion.button
              type="button"
              onClick={() => setIsOpen(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className={cn(
                'relative flex h-14 w-14 items-center justify-center rounded-full transition-all cursor-pointer overflow-hidden border',
                isIconDark
                  ? 'bg-zinc-950 text-white border-zinc-800 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5)]'
                  : 'bg-white text-zinc-950 border-white/80 shadow-[0_12px_32px_-4px_rgba(255,255,255,0.35)]'
              )}
              aria-label="Open Sandesh Bot"
              title="Ask Sandesh Bot"
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <VoicePoweredOrb
                  className="w-14 h-14"
                  hue={isIconDark ? 250 : 280}
                  enableVoiceControl={false}
                />
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Chat Modal: color AS PER THE TOGGLE (dark when dark mode, light when light mode) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col overflow-hidden',
              'w-[calc(100vw-2rem)] sm:w-[420px] h-[600px] max-h-[85vh]',
              'rounded-3xl border transition-colors duration-200',
              isDark
                ? 'border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white shadow-[0_24px_64px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl'
                : 'border-zinc-200 bg-gradient-to-b from-white to-zinc-50 text-zinc-900 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.15)] backdrop-blur-xl'
            )}
          >
            {/* Header */}
            <div
              className={cn(
                'flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm flex-shrink-0 transition-colors duration-200',
                isDark ? 'border-white/10 bg-zinc-900/80 text-white' : 'border-zinc-200 bg-white/90 text-zinc-900'
              )}
            >
              <div className="flex items-center gap-2.5">
                <AssistantAvatar isIconDark={isIconDark} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold">Sandesh Bot</h3>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        isDark ? 'bg-white/10 text-white/70' : 'bg-zinc-100 text-zinc-600'
                      )}
                    >
                      FAQ
                    </span>
                  </div>
                  <p className={cn('text-xs', isDark ? 'text-white/50' : 'text-zinc-500')}>
                    Online
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Reset Conversation */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={resetChat}
                  aria-label="Reset conversation"
                  title="Reset conversation"
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                    isDark
                      ? 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                  )}
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset</span>
                </motion.button>

                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat"
                  title="Close chat"
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer',
                    isDark
                      ? 'text-white/50 hover:bg-white/10 hover:text-white'
                      : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800'
                  )}
                >
                  <X className="size-4" />
                </motion.button>
              </div>
            </div>

            {/* Messages Body */}
            <div
              ref={scrollRef}
              role="log"
              aria-label="Chat messages"
              aria-live="polite"
              className={cn(
                'flex-1 space-y-3.5 overflow-y-auto p-4 scrollbar-thin transition-colors duration-200',
                isDark
                  ? 'scrollbar-thumb-white/10 scrollbar-track-transparent'
                  : 'scrollbar-thumb-zinc-300 scrollbar-track-transparent'
              )}
            >
              {/* Initial Greeting Bubble */}
              <div className="flex items-end gap-2.5 max-w-[85%]">
                <AssistantAvatar isIconDark={isIconDark} />
                <div className="flex flex-col">
                  <div
                    className={cn(
                      'rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-relaxed backdrop-blur-sm',
                      isDark
                        ? 'border border-white/10 bg-zinc-800/90 text-zinc-100 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3)]'
                        : 'border border-zinc-200 bg-white text-zinc-800 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)]'
                    )}
                  >
                    <p>{greeting}</p>
                    <p className={cn('mt-1 text-xs', isDark ? 'text-white/50' : 'text-zinc-500')}>
                      Select a suggested question below or type your own:
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggested Questions (when conversation hasn't started) */}
              {messages.length === 0 && (
                <div className="space-y-2 pt-1 pl-10">
                  <p
                    className={cn(
                      'text-[11px] font-semibold tracking-wider uppercase',
                      isDark ? 'text-white/40' : 'text-zinc-400'
                    )}
                  >
                    Suggested Questions
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map((suggestion, index) => (
                      <motion.button
                        key={index}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleSendMessage(suggestion)}
                        whileHover={{ scale: 1.01, x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'text-left px-3.5 py-2.5 text-xs font-medium rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-between group border',
                          isDark
                            ? 'bg-zinc-800/60 hover:bg-zinc-800/90 text-zinc-300 hover:text-white border-white/10 hover:border-indigo-500/40'
                            : 'bg-white hover:bg-indigo-50/70 text-zinc-700 hover:text-indigo-950 border-zinc-200 hover:border-indigo-300'
                        )}
                      >
                        <span className="line-clamp-2">{suggestion}</span>
                        <ArrowRight
                          className={cn(
                            'size-3.5 ml-2 shrink-0 transition-colors',
                            isDark
                              ? 'text-zinc-500 group-hover:text-indigo-400'
                              : 'text-zinc-400 group-hover:text-indigo-600'
                          )}
                        />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message History */}
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isDark={isDark}
                  isIconDark={isIconDark}
                />
              ))}

              {/* Typing Indicator */}
              <AnimatePresence>
                {isLoading && (
                  <div className="flex items-end gap-2.5">
                    <AssistantAvatar isIconDark={isIconDark} />
                    <TypingIndicator isDark={isDark} />
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Input Footer */}
            <div
              className={cn(
                'border-t p-3 backdrop-blur-sm flex-shrink-0 transition-colors duration-200',
                isDark ? 'border-white/10 bg-zinc-900/60' : 'border-zinc-200 bg-white/90'
              )}
            >
              <div
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3.5 py-2 backdrop-blur-sm transition-colors',
                  isDark
                    ? 'border-white/10 bg-zinc-800/50 focus-within:border-indigo-500/50 focus-within:bg-zinc-800/80'
                    : 'border-zinc-200 bg-zinc-100/80 focus-within:border-indigo-500/60 focus-within:bg-white'
                )}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.slice(0, 300))}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  placeholder="Ask Sandesh Bot..."
                  aria-label="Type your message"
                  className={cn(
                    'flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed',
                    isDark
                      ? 'text-white placeholder:text-white/30'
                      : 'text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputValue.trim()}
                  aria-label="Send message"
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer',
                    !isLoading && inputValue.trim()
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm'
                      : isDark
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  )}
                >
                  <Send className="size-4" />
                </motion.button>
              </div>

              {/* Minimalist character counter only */}
              <div className="flex justify-end mt-1.5 px-1">
                <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-zinc-400')}>
                  {inputValue.length}/300
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FaqChatbot;
