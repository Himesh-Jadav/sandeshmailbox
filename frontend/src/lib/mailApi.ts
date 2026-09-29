export interface MailContact {
  id: string;
  phone: string;
  email: string;
  displayName: string;
  profilePictureUrl?: string | null;
  publicKey?: string | null;
}

export interface MailAttachment {
  id: string;
  filename: string;
  gridFsId: string;
  contentType: string;
  size: number;
}

export interface MailMessage {
  id: string;
  threadId: string;
  from: {
    id: string;
    phone: string;
    displayName: string;
    email: string;
    profilePictureUrl?: string | null;
    publicKey?: string | null;
  };
  fromEmail: string;
  toEmails: string[];
  ccEmails?: string[];
  bccEmails?: string[];
  subject: string;
  text: string;
  html?: string;
  attachments: MailAttachment[];
  isMine: boolean;
  read: boolean;
  folder?: string;
  isSpam?: boolean;
  spamScore?: number;
  spamReason?: string;
  createdAt: string;
}

export interface MailThread {
  id: string;
  subject: string;
  lastMessage?: {
    text: string;
    from: string;
    createdAt: string;
    hasAttachments?: boolean;
  };
  lastMessageAt: string;
  unreadCount: number;
  contact: MailContact | null;
}

export interface RecipientVerifyResult {
  exists: boolean;
  user?: MailContact;
  error?: string;
}

export interface Draft {
  id: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  _id: string;
  title: string;
  category: 'workplace' | 'meeting' | 'followup' | 'business' | 'personal' | 'urgent' | 'general' | string;
  subject: string;
  body: string;
  tags: string[];
  isSystem: boolean;
  userId?: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiGenerateDraftRequest {
  prompt: string;
  tone?: 'professional' | 'casual' | 'direct' | 'persuasive' | 'urgent';
  length?: 'short' | 'medium' | 'detailed';
  recipientContext?: string;
  currentSubject?: string;
}

export interface AiGenerateDraftResponse {
  subject: string;
  body: string;
  source: 'groq' | 'fallback';
}

const API_BASE = '/api/mail';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return data as T;
}

export const mailApi = {
  /**
   * Fetch threads for a specific folder.
   * folder: 'inbox' | 'sent' | 'trash' | 'archive' | 'starred'
   */
  async getThreads(token: string, folder = 'inbox'): Promise<MailThread[]> {
    const res = await fetch(`${API_BASE}/threads?folder=${encodeURIComponent(folder)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await handleResponse<{ threads: MailThread[] }>(res);
    return data.threads || [];
  },

  async getThreadMessages(
    threadId: string,
    token: string
  ): Promise<{ thread: MailThread; messages: MailMessage[] }> {
    const res = await fetch(`${API_BASE}/threads/${threadId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{ thread: MailThread; messages: MailMessage[] }>(res);
  },

  /**
   * Mark a conversation thread as read immediately.
   */
  async markThreadRead(threadId: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE}/threads/${threadId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    await handleResponse<{ success: boolean }>(res);
  },

  /**
   * Send a mail message.
   * If threadId is provided it's a reply to that thread.
   * If threadId is absent a brand-new thread is created (new compose).
   */
  async sendMail(
    payload: {
      to: string | string[];
      cc?: string | string[];
      bcc?: string | string[];
      subject?: string;
      text: string;
      files?: File[];
      threadId?: string;
    },
    token: string
  ): Promise<{ success: boolean; threadId: string; messageId: string }> {
    const formData = new FormData();
    const toValue = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
    formData.append('to', toValue);

    if (payload.cc) {
      const ccValue = Array.isArray(payload.cc) ? payload.cc.join(', ') : payload.cc;
      if (ccValue.trim()) formData.append('cc', ccValue.trim());
    }

    if (payload.bcc) {
      const bccValue = Array.isArray(payload.bcc) ? payload.bcc.join(', ') : payload.bcc;
      if (bccValue.trim()) formData.append('bcc', bccValue.trim());
    }

    if (payload.subject) formData.append('subject', payload.subject);
    formData.append('text', payload.text || '');

    if (payload.threadId) formData.append('threadId', payload.threadId);

    if (payload.files && payload.files.length > 0) {
      payload.files.forEach((file) => {
        formData.append('attachments', file);
      });
    }

    const res = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    return handleResponse<{ success: boolean; threadId: string; messageId: string }>(res);
  },

  /**
   * Move a single message to a folder (trash / archive / inbox / spam).
   * This only affects the requesting user's view.
   */
  async moveMessage(
    messageId: string,
    folder: 'trash' | 'archive' | 'inbox' | 'spam',
    token: string
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/messages/${messageId}/move`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folder }),
    });
    await handleResponse<{ success: boolean }>(res);
  },

  /**
   * Empty all spam messages.
   */
  async emptySpam(token: string): Promise<{ success: boolean; count: number }> {
    const res = await fetch(`${API_BASE}/spam/empty`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{ success: boolean; count: number }>(res);
  },

  /**
   * Permanently delete a message. It must already be in Trash for this user.
   */
  async deleteMessage(messageId: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await handleResponse<{ success: boolean }>(res);
  },

  // ── Draft API ──────────────────────────────────────────────────────────────

  async getDrafts(token: string): Promise<Draft[]> {
    const res = await fetch(`${API_BASE}/drafts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await handleResponse<{ drafts: Draft[] }>(res);
    return data.drafts || [];
  },

  async saveDraft(
    payload: { to?: string; cc?: string; bcc?: string; subject?: string; text?: string },
    token: string
  ): Promise<Draft> {
    const formData = new FormData();
    if (payload.to) formData.append('to', payload.to);
    if (payload.cc) formData.append('cc', payload.cc);
    if (payload.bcc) formData.append('bcc', payload.bcc);
    if (payload.subject) formData.append('subject', payload.subject);
    if (payload.text) formData.append('text', payload.text);

    const res = await fetch(`${API_BASE}/drafts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await handleResponse<{ draft: Draft }>(res);
    return data.draft;
  },

  async updateDraft(
    draftId: string,
    payload: { to?: string; cc?: string; bcc?: string; subject?: string; text?: string },
    token: string
  ): Promise<Draft> {
    const formData = new FormData();
    if (payload.to !== undefined) formData.append('to', payload.to);
    if (payload.cc !== undefined) formData.append('cc', payload.cc);
    if (payload.bcc !== undefined) formData.append('bcc', payload.bcc);
    if (payload.subject !== undefined) formData.append('subject', payload.subject);
    if (payload.text !== undefined) formData.append('text', payload.text);

    const res = await fetch(`${API_BASE}/drafts/${draftId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await handleResponse<{ draft: Draft }>(res);
    return data.draft;
  },

  async deleteDraft(draftId: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE}/drafts/${draftId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await handleResponse<{ success: boolean }>(res);
  },

  async sendDraft(
    draftId: string,
    token: string
  ): Promise<{ success: boolean; threadId: string }> {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{ success: boolean; threadId: string }>(res);
  },

  // ── Recipient Verification ─────────────────────────────────────────────────

  async verifyRecipient(query: string, token: string): Promise<RecipientVerifyResult> {
    const res = await fetch(`${API_BASE}/verify-recipient?query=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<RecipientVerifyResult>(res);
  },

  async getRecipientKey(
    query: string,
    token: string
  ): Promise<{ publicKey: string | null; user?: MailContact }> {
    const res = await fetch(`${API_BASE}/recipient-key?query=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{ publicKey: string | null; user?: MailContact }>(res);
  },

  getAttachmentUrl(gridFsId: string): string {
    return `${API_BASE}/attachments/${gridFsId}`;
  },

  // ── Predefined & Custom Templates ──────────────────────────────────────────

  async getTemplates(token: string, category?: string, search?: string): Promise<EmailTemplate[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search && search.trim()) params.set('search', search.trim());
    const res = await fetch(`${API_BASE}/templates?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await handleResponse<{ templates: EmailTemplate[] }>(res);
    return data.templates || [];
  },

  async createTemplate(
    token: string,
    payload: { title: string; subject: string; body: string; category?: string; tags?: string[] }
  ): Promise<EmailTemplate> {
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await handleResponse<{ template: EmailTemplate }>(res);
    return data.template;
  },

  async deleteTemplate(templateId: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE}/templates/${templateId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await handleResponse<{ success: boolean }>(res);
  },

  // ── Groq AI Email Generation ───────────────────────────────────────────────

  async generateAiDraft(
    token: string,
    payload: AiGenerateDraftRequest
  ): Promise<AiGenerateDraftResponse> {
    const res = await fetch(`${API_BASE}/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<AiGenerateDraftResponse>(res);
  },
};
