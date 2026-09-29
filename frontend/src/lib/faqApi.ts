const API_BASE = '/api';

export interface FaqSuggestionsResponse {
  greeting: string;
  suggestions: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isDirectMatch?: boolean;
  isError?: boolean;
}

export interface FaqChatResponse {
  reply: string;
  isDirectMatch?: boolean;
  timestamp: string;
  error?: string;
}

export const faqApi = {
  /**
   * Fetches initial chatbot greeting and suggested question chips
   */
  async getSuggestions(): Promise<FaqSuggestionsResponse> {
    try {
      const res = await fetch(`${API_BASE}/faq/suggestions`);
      if (!res.ok) {
        throw new Error(`Failed to fetch suggestions (${res.status})`);
      }
      return await res.json();
    } catch {
      // Offline / network fallback
      return {
        greeting: 'Hi there! I am your Sandesh Bot. How can I help you today?',
        suggestions: [
          'What is PhoneMail and how does it work?',
          'How do I sign up or log in to my account?',
          'Are my emails secure and private?',
          'Can I sign up via phone call or SMS?',
        ],
      };
    }
  },

  /**
   * Sends user query to the backend secured Groq chatbot endpoint
   */
  async sendMessage(
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ): Promise<FaqChatResponse> {
    const res = await fetch(`${API_BASE}/faq/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message.trim(),
        history,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error || `Request failed (${res.status})`;
      throw new Error(errMsg);
    }

    return data as FaqChatResponse;
  },
};
