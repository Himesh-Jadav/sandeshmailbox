import { MailThread, MailMessage, MailAttachment } from './mailApi';
import { getUserOrContactName, formatPhoneNumber, cleanEmailDisplay } from './formatters';

interface PrintChatOptions {
  thread: MailThread;
  messages: MailMessage[];
  user: any;
  singleMessageId?: string;
}

function escapeHtml(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPrintDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'U';
}

export function generateChatPrintHtml({
  thread,
  messages,
  user,
  singleMessageId,
}: PrintChatOptions): string {
  const contactName = getUserOrContactName(thread.contact);
  const contactEmail = cleanEmailDisplay(thread.contact?.email) || formatPhoneNumber(thread.contact?.phone);
  const userName = getUserOrContactName(user);
  const userEmail = cleanEmailDisplay(user?.email) || formatPhoneNumber(user?.phone);

  const contactInitials = getInitials(contactName);
  const userInitials = getInitials(userName);

  const messagesToPrint = singleMessageId
    ? messages.filter((m) => m.id === singleMessageId)
    : messages;

  const printedAt = new Date().toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isSingle = Boolean(singleMessageId);
  const cleanSubject = thread.subject || 'Conversation';
  const logoSrc = `${window.location.origin}/sandesh-wordmark.png`;

  const messagesHtml = messagesToPrint
    .map((msg) => {
      const isSender = msg.isMine;
      const senderTitle = isSender
        ? userName
        : getUserOrContactName(msg.from) || contactName;

      const senderEmail = isSender
        ? userEmail
        : cleanEmailDisplay(msg.from?.email) || formatPhoneNumber(msg.from?.phone) || contactEmail;

      const recipientEmail = isSender ? contactEmail : userEmail;
      const formattedDate = formatPrintDate(msg.createdAt);
      const senderInitials = isSender ? userInitials : getInitials(senderTitle);
      const senderAvatar = isSender
        ? (user?.profilePictureUrl || msg.from?.profilePictureUrl || '')
        : (msg.from?.profilePictureUrl || thread.contact?.profilePictureUrl || '');

      const attachmentsHtml =
        msg.attachments && msg.attachments.length > 0
          ? `
            <div class="attachments-container">
              <div class="attachments-title">${msg.attachments.length} ${
              msg.attachments.length === 1 ? 'Attachment' : 'Attachments'
            }</div>
              <div class="attachments-list">
                ${msg.attachments
                  .map((att: MailAttachment) => {
                    const ext = att.filename.split('.').pop()?.toUpperCase() || 'FILE';
                    return `
                      <span class="att-item">
                        <span class="att-badge">${escapeHtml(ext)}</span>
                        <span class="att-name">${escapeHtml(att.filename)}</span>
                        ${att.size ? `<span class="att-size">(${formatFileSize(att.size)})</span>` : ''}
                      </span>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          `
          : '';

      return `
        <div class="message-card">
          <div class="msg-header">
            <div class="msg-sender-info">
              <div class="avatar-badge" style="position: relative; overflow: hidden;">
                <span>${escapeHtml(senderInitials)}</span>
                ${senderAvatar ? `<img src="${escapeHtml(senderAvatar)}" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 9999px;" onerror="this.style.display='none'" />` : ''}
              </div>
              <div class="sender-text-block">
                <div>
                  <span class="msg-sender">${escapeHtml(senderTitle)}</span>
                  ${senderEmail ? `<span class="msg-email">&lt;${escapeHtml(senderEmail)}&gt;</span>` : ''}
                </div>
                ${
                  recipientEmail
                    ? `<div class="msg-to"><span class="to-label">To:</span> ${escapeHtml(recipientEmail)}</div>`
                    : ''
                }
              </div>
            </div>
            <div class="msg-date">${escapeHtml(formattedDate)}</div>
          </div>
          <div class="msg-body">${escapeHtml((msg as any).decryptedText || msg.text)}</div>
          ${attachmentsHtml}
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      background: #ffffff;
      color: #111827;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.6;
    }
    body {
      padding: 20mm 22mm;
    }

    /* Minimal Top Brand Header with Logo */
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo-img {
      height: 36px;
      width: auto;
      object-fit: contain;
      display: block;
    }
    .brand-subtext {
      display: flex;
      flex-direction: column;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.01em;
      line-height: 1.2;
    }
    .brand-tagline {
      font-size: 10px;
      font-weight: 500;
      color: #6b7280;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-top: 2px;
    }

    /* Print Meta (Right Column) */
    .print-meta {
      text-align: right;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.45;
    }
    .print-meta strong {
      color: #374151;
      font-weight: 600;
    }

    /* Thread Overview / Cover Card */
    .thread-overview-card {
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
      page-break-after: avoid;
    }
    .thread-subject-title {
      font-size: 17px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 10px 0;
      line-height: 1.35;
      letter-spacing: -0.01em;
    }
    .thread-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      font-size: 12px;
      color: #4b5563;
    }
    .participant-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pill-avatar {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #374151;
      background: #e5e7eb;
    }
    .pill-label {
      font-weight: 600;
      color: #374151;
    }

    /* Message Cards */
    .messages-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .message-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px 18px;
      page-break-inside: avoid;
      break-inside: avoid;
      background: #ffffff;
    }

    .msg-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .msg-sender-info {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .avatar-badge {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #374151;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      font-weight: 600;
      font-size: 11px;
      flex-shrink: 0;
    }
    .sender-text-block {
      line-height: 1.35;
    }
    .msg-sender {
      font-weight: 600;
      font-size: 13px;
      color: #111827;
    }
    .msg-email {
      font-size: 12px;
      color: #6b7280;
      margin-left: 4px;
    }
    .msg-to {
      font-size: 11.5px;
      color: #6b7280;
      margin-top: 2px;
    }
    .to-label {
      font-weight: 500;
      color: #4b5563;
    }
    .msg-date {
      font-size: 11px;
      color: #9ca3af;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .msg-body {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.6;
      color: #374151;
      margin: 8px 0 0 0;
    }

    /* Attachments */
    .attachments-container {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #f3f4f6;
    }
    .attachments-title {
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #6b7280;
      margin-bottom: 6px;
    }
    .attachments-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .att-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 11px;
      background: #fafafa;
    }
    .att-badge {
      font-weight: 600;
      font-size: 9px;
      color: #6b7280;
      letter-spacing: 0.02em;
    }
    .att-name {
      color: #374151;
      font-weight: 500;
    }
    .att-size {
      color: #9ca3af;
      font-size: 10px;
    }

    .empty-state {
      padding: 32px;
      text-align: center;
      color: #6b7280;
      border: 1px dashed #e5e7eb;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <!-- Brand Header with Logo -->
  <div class="print-header">
    <div class="brand-container">
      <img src="${escapeHtml(logoSrc)}" alt="Sandesh" class="brand-logo-img" />
      <div class="brand-subtext">
        <div class="brand-name">Sandesh Webmail</div>
        <div class="brand-tagline">Encrypted Messaging &bull; Local SMTP Transport</div>
      </div>
    </div>
    <div class="print-meta">
      <div><strong>Printed:</strong> ${escapeHtml(printedAt)}</div>
      <div><strong>Scope:</strong> ${isSingle ? 'Single Message' : `Full Conversation (${messagesToPrint.length})`}</div>
    </div>
  </div>

  <!-- Thread Overview / Cover Card -->
  <div class="thread-overview-card">
    <h1 class="thread-subject-title">${escapeHtml(cleanSubject)}</h1>
    <div class="thread-pills">
      <div class="participant-pill">
        <span class="pill-avatar">${escapeHtml(contactInitials)}</span>
        <span class="pill-label">Contact:</span>
        <span>${escapeHtml(contactName)} ${contactEmail ? `&lt;${escapeHtml(contactEmail)}&gt;` : ''}</span>
      </div>
      <div class="participant-pill">
        <span class="pill-avatar">${escapeHtml(userInitials)}</span>
        <span class="pill-label">User:</span>
        <span>${escapeHtml(userName)} ${userEmail ? `&lt;${escapeHtml(userEmail)}&gt;` : ''}</span>
      </div>
    </div>
  </div>

  <!-- Messages List -->
  <div class="messages-container">
    ${messagesToPrint.length === 0 ? '<div class="empty-state">No messages in this conversation.</div>' : messagesHtml}
  </div>
</body>
</html>`;
}

export function printChat(options: PrintChatOptions): void {
  const html = generateChatPrintHtml(options);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Sandesh Print View');

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Iframe print failed, falling back to window.print():', err);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  };

  const images = Array.from(doc.images);
  if (images.length === 0) {
    setTimeout(triggerPrint, 150);
  } else {
    let loadedCount = 0;
    let hasTriggered = false;

    const onImageLoaded = () => {
      loadedCount++;
      if (loadedCount >= images.length && !hasTriggered) {
        hasTriggered = true;
        setTimeout(triggerPrint, 150);
      }
    };

    images.forEach((img) => {
      if (img.complete) {
        onImageLoaded();
      } else {
        img.addEventListener('load', onImageLoaded);
        img.addEventListener('error', onImageLoaded);
      }
    });

    setTimeout(() => {
      if (!hasTriggered) {
        hasTriggered = true;
        triggerPrint();
      }
    }, 1200);
  }
}
