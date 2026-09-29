import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import mongoose from 'mongoose';
import pino from 'pino';
import User from '../models/User.js';
import Thread from '../models/Thread.js';
import Message from '../models/Message.js';
import { parseRecipientPhone, toEmailAddress } from '../utils/phone.js';
import { uploadToGridFS } from '../utils/gridfs.js';
import { detectSpam } from './spam.service.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

let smtpServerInstance = null;

/**
 * Initializes and starts the local self-hosted SMTP server
 * @param {number} port Default 2525
 * @returns {SMTPServer}
 */
export function startSmtpServer(port = 2525) {
  if (smtpServerInstance) {
    return smtpServerInstance;
  }

  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH'], // local internal relay
    size: 25 * 1024 * 1024, // 25 MB max message size

    // Validate recipient existence on RCPT TO
    async onRcptTo(address, session, cb) {
      try {
        const rcptAddress = address.address;
        const phone = parseRecipientPhone(rcptAddress);

        if (!phone) {
          logger.warn({ rcptAddress }, 'SMTP Rejected: Invalid recipient format');
          return cb(new Error('550 5.1.3 Invalid recipient address format'));
        }

        const user = await User.findOne({ phone });
        if (!user) {
          logger.warn({ rcptAddress, phone }, 'SMTP Rejected: Recipient does not exist in PhoneMail DB');
          return cb(new Error(`550 5.1.1 Recipient <${rcptAddress}> does not exist on PhoneMail`));
        }

        // Cache resolved user in session
        if (!session.resolvedRecipients) {
          session.resolvedRecipients = [];
        }
        session.resolvedRecipients.push(user);

        logger.info({ rcptAddress, phone: user.phone }, 'SMTP Accepted recipient');
        return cb();
      } catch (err) {
        logger.error({ err }, 'Error in onRcptTo');
        return cb(new Error('451 4.3.0 Internal mail server error'));
      }
    },

    // Process incoming message stream on DATA
    async onData(stream, session, cb) {
      try {
        const parsed = await simpleParser(stream);

        // 1. Resolve Sender
        const mailFrom = session.envelope?.mailFrom?.address || parsed.from?.value?.[0]?.address || '';
        const senderPhone = parseRecipientPhone(mailFrom);
        let senderUser = senderPhone ? await User.findOne({ phone: senderPhone }) : null;

        if (!senderUser) {
          // If sender not in DB, fallback to system or first user
          senderUser = await User.findOne();
        }

        // 2. Resolve Recipients (Categorized into TO, CC, and BCC)
        const toUsers = [];
        const ccUsers = [];
        const bccUsers = [];

        // 2a. Parse 'To' addresses from parsed MIME
        if (parsed.to?.value?.length) {
          for (const toItem of parsed.to.value) {
            const rPhone = parseRecipientPhone(toItem.address);
            if (rPhone) {
              const u = await User.findOne({ phone: rPhone });
              if (u && !toUsers.some((x) => x._id.toString() === u._id.toString())) {
                toUsers.push(u);
              }
            }
          }
        }

        // 2b. Parse 'Cc' addresses from parsed MIME
        if (parsed.cc?.value?.length) {
          for (const ccItem of parsed.cc.value) {
            const rPhone = parseRecipientPhone(ccItem.address);
            if (rPhone) {
              const u = await User.findOne({ phone: rPhone });
              if (u && !ccUsers.some((x) => x._id.toString() === u._id.toString())) {
                ccUsers.push(u);
              }
            }
          }
        }

        // 2c. Identify BCC from session envelope rcptTo (all delivered addresses)
        const knownIds = new Set([
          ...toUsers.map((u) => u._id.toString()),
          ...ccUsers.map((u) => u._id.toString()),
        ]);

        const resolved = session.resolvedRecipients || [];
        for (const u of resolved) {
          if (!knownIds.has(u._id.toString())) {
            bccUsers.push(u);
            knownIds.add(u._id.toString());
          }
        }

        // Fallback: if no To/Cc could be parsed from headers, fall back to resolved recipients as 'To'
        if (!toUsers.length && !ccUsers.length && resolved.length) {
          toUsers.push(...resolved);
        }

        const allRecipients = [...toUsers, ...ccUsers, ...bccUsers];
        if (!allRecipients.length) {
          logger.warn('SMTP Rejected: No valid recipients found in parsed data');
          return cb(new Error('550 No valid recipients found'));
        }

        // 3. Process & Upload Attachments to GridFS
        const savedAttachments = [];
        if (parsed.attachments && parsed.attachments.length > 0) {
          for (const att of parsed.attachments) {
            try {
              const gridFsId = await uploadToGridFS(
                att.filename || 'attachment.dat',
                att.content,
                att.contentType || 'application/octet-stream'
              );

              savedAttachments.push({
                filename: att.filename || 'attachment.dat',
                gridFsId,
                contentType: att.contentType || 'application/octet-stream',
                size: att.size || att.content?.length || 0,
              });
              logger.info({ filename: att.filename, gridFsId }, 'Stored attachment in GridFS');
            } catch (attErr) {
              logger.error({ attErr, filename: att.filename }, 'Failed to upload attachment to GridFS');
            }
          }
        }

        // 4. Find or Create Conversational Thread
        // Visible participants are sender + To recipients + CC recipients
        const visibleParticipantMap = new Map();
        visibleParticipantMap.set(senderUser._id.toString(), senderUser);
        toUsers.forEach((u) => visibleParticipantMap.set(u._id.toString(), u));
        ccUsers.forEach((u) => visibleParticipantMap.set(u._id.toString(), u));

        const visibleParticipantIds = Array.from(visibleParticipantMap.keys());
        const visibleParticipantEmails = Array.from(visibleParticipantMap.values()).map((u) =>
          toEmailAddress(u.phone)
        );
        const bccParticipantIds = bccUsers.map((u) => u._id);

        let thread;
        // Priority 1: Explicit X-Thread-ID header (from webmail compose/reply/forward)
        const threadIdHeader = parsed.headers?.get('x-thread-id') || parsed.headers?.get('x-sandesh-thread-id');
        if (threadIdHeader && mongoose.Types.ObjectId.isValid(threadIdHeader)) {
          thread = await Thread.findById(threadIdHeader);
        }

        // Priority 2: In-Reply-To header referencing a parent message
        if (!thread && parsed.inReplyTo) {
          const parentMsg = await Message.findOne({ messageId: parsed.inReplyTo });
          if (parentMsg?.threadId) {
            thread = await Thread.findById(parentMsg.threadId);
          }
        }

        // Priority 3: References header referencing previous message in thread
        if (!thread && parsed.references) {
          const refList = Array.isArray(parsed.references) ? parsed.references : [parsed.references];
          const parentMsg = await Message.findOne({ messageId: { $in: refList } });
          if (parentMsg?.threadId) {
            thread = await Thread.findById(parentMsg.threadId);
          }
        }

        const subject = parsed.subject || 'Conversation';

        // 4. Run Automated Spam & Phishing Detection
        let spamAnalysis = { isSpam: false, spamScore: 0, spamReason: '', spamDetails: null };
        try {
          spamAnalysis = await detectSpam({
            subject,
            text: parsed.text || '',
            fromEmail: mailFrom,
          });
        } catch (spamErr) {
          logger.warn({ spamErr: spamErr.message }, 'Spam analysis error, continuing with default');
        }

        const isSpam = spamAnalysis.isSpam;

        const rawMsgText = parsed.text || '';
        const isE2ee = rawMsgText.trim().startsWith('-----BEGIN SANDESH E2EE MESSAGE-----');
        const lastMsgSnippet = isE2ee
          ? rawMsgText.trim().slice(0, 4000)
          : (rawMsgText.slice(0, 150) || (savedAttachments.length ? 'Attachment' : ''));

        if (!thread) {
          const initialUnread = new Map();
          for (const u of allRecipients) {
            if (u._id.toString() !== senderUser._id.toString()) {
              // Only count as unread in regular inbox if NOT spam
              initialUnread.set(u._id.toString(), isSpam ? 0 : 1);
            }
          }

          thread = await Thread.create({
            participants: visibleParticipantIds,
            participantEmails: visibleParticipantEmails,
            bccParticipants: bccParticipantIds,
            subject,
            lastMessage: {
              text: lastMsgSnippet,
              from: senderUser._id,
              createdAt: new Date(),
              hasAttachments: savedAttachments.length > 0,
            },
            lastMessageAt: new Date(),
            unreadCounts: initialUnread,
          });
        } else {
          // Update thread metadata & increment unread counts only for non-spam
          thread.unreadCounts = thread.unreadCounts || new Map();
          for (const u of allRecipients) {
            if (u._id.toString() !== senderUser._id.toString()) {
              const currentUnread = (thread.unreadCounts.get(u._id.toString()) || 0);
              thread.unreadCounts.set(u._id.toString(), isSpam ? currentUnread : currentUnread + 1);
            }
          }

          // Add any new BCC participants to thread.bccParticipants
          if (bccParticipantIds.length) {
            thread.bccParticipants = thread.bccParticipants || [];
            for (const bId of bccParticipantIds) {
              if (!thread.bccParticipants.some((p) => p.toString() === bId.toString())) {
                thread.bccParticipants.push(bId);
              }
            }
          }

          thread.lastMessage = {
            text: lastMsgSnippet,
            from: senderUser._id,
            createdAt: new Date(),
            hasAttachments: savedAttachments.length > 0,
          };
          thread.lastMessageAt = new Date();
          if (parsed.subject && thread.subject === 'Conversation') {
            thread.subject = parsed.subject;
          }
          await thread.save();
        }

        // Build per-user folder statuses
        const userStatuses = [];
        userStatuses.push({
          userId: senderUser._id,
          folder: 'sent',
        });
        for (const recipient of allRecipients) {
          if (recipient._id.toString() !== senderUser._id.toString()) {
            userStatuses.push({
              userId: recipient._id,
              folder: isSpam ? 'spam' : 'inbox',
              spammedAt: isSpam ? new Date() : null,
            });
          }
        }

        // 5. Create Message Record with To, CC, BCC, and Spam metadata
        const message = await Message.create({
          threadId: thread._id,
          messageId: parsed.messageId || undefined,
          inReplyTo: parsed.inReplyTo || undefined,
          from: senderUser._id,
          fromEmail: toEmailAddress(senderUser.phone),
          to: toUsers.map((u) => u._id),
          toEmails: toUsers.map((u) => toEmailAddress(u.phone)),
          cc: ccUsers.map((u) => u._id),
          ccEmails: ccUsers.map((u) => toEmailAddress(u.phone)),
          bcc: bccUsers.map((u) => u._id),
          bccEmails: bccUsers.map((u) => toEmailAddress(u.phone)),
          subject,
          text: parsed.text || '',
          html: parsed.html || '',
          attachments: savedAttachments,
          readBy: [senderUser._id],
          userStatuses,
          isSpam,
          spamScore: spamAnalysis.spamScore,
          spamReason: spamAnalysis.spamReason,
          spamDetails: spamAnalysis.spamDetails,
          createdAt: new Date(),
        });

        logger.info(
          {
            messageId: message._id,
            threadId: thread._id,
            from: senderUser.phone,
            isSpam,
            spamScore: spamAnalysis.spamScore,
            toCount: toUsers.length,
          },
          'SMTP Message successfully parsed and stored in PhoneMail DB'
        );

        return cb(null, '250 OK: Message delivered to PhoneMail user');
      } catch (dataErr) {
        logger.error({ dataErr }, 'Error processing SMTP message data');
        return cb(new Error('451 Failed to process message data'));
      }
    },
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'PhoneMail Local SMTP Server running');
  });

  server.on('error', (err) => {
    logger.error({ err }, 'SMTP Server error');
  });

  smtpServerInstance = server;
  return server;
}

export function getSmtpServer() {
  return smtpServerInstance;
}
