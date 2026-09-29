import mongoose from 'mongoose';
import Groq from 'groq-sdk';
import pino from 'pino';
import FaqItem from '../models/FaqItem.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

let groqClient = null;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!groqClient) {
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

const PHONEMAIL_SYSTEM_PROMPT = `You are Sandesh Bot, the official FAQ Assistant for PhoneMail (also known as Sandesh).
PhoneMail is an innovative webmail platform that converts phone numbers into email addresses.

Core PhoneMail Knowledge:
1. Email Identity: Every user gets an email formatted as <phone_number>@sandesh.in (e.g., +14126846774@sandesh.in).
2. Three Signup Doors:
   - Web door: Enter phone number and verify via instant SMS OTP.
   - Call door: Dial the PhoneMail phone number and listen to the automated Voice IVR.
   - Text door: Send SMS with text "SIGNUP" to the PhoneMail number.
   All three create an account, after which the user sets a secure password on the web.
3. Security & Encryption:
   - Client-side End-to-End Encryption (E2EE) powered by TweetNaCl.
   - Email message bodies are encrypted directly in the user's browser before being sent over the network.
   - The server never sees plaintext message contents.
4. Mail & Infrastructure:
   - Built on a self-hosted, custom SMTP server for closed-loop mail between Sandesh (@sandesh.in) users.
   - Gmail-style webmail interface with threads, replies, compose, attachments, and light/dark theme support.
5. Login: Users log in using their phone number and password, with OTP fallback for account recovery.

Strict Operational Guidelines:
- Answer ONLY questions related to PhoneMail features, registration, security, and usage.
- Keep responses concise, friendly, and under 150 words to conserve tokens.
- Format responses cleanly with brief bullet points or paragraphs.
- If asked unrelated questions (like general knowledge, coding, politics, or other services), politely state:
  "I am Sandesh Bot, PhoneMail's FAQ assistant. I can only assist with questions regarding the PhoneMail application, authentication, encryption, and email features."
`;

/**
 * Searches local database for exact or high-confidence FAQ matches to save Groq API tokens.
 * @param {string} userQuery
 * @returns {Promise<{ found: boolean, question?: string, answer?: string }>}
 */
export async function findCachedFaqMatch(userQuery) {
  try {
    if (mongoose.connection?.readyState !== 1) {
      return { found: false };
    }
    const cleanQuery = userQuery.trim().toLowerCase();

    // 1. Direct case-insensitive match on question text
    const exactMatch = await FaqItem.findOne({
      question: { $regex: new RegExp(`^${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (exactMatch) {
      return { found: true, question: exactMatch.question, answer: exactMatch.answer };
    }

    // 2. Keyword check for popular suggestions
    const allFaqs = await FaqItem.find().limit(20);
    for (const faq of allFaqs) {
      const qLower = faq.question.toLowerCase();
      // If user query is substantially contained in the question or vice versa
      if (qLower.includes(cleanQuery) || (cleanQuery.length > 8 && cleanQuery.includes(qLower))) {
        return { found: true, question: faq.question, answer: faq.answer };
      }
    }

    return { found: false };
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed during FAQ cache search');
    return { found: false };
  }
}

/**
 * Answers a user FAQ query using Groq or falls back to DB knowledge base.
 * @param {string} message
 * @param {Array<{ role: string, content: string }>} conversationHistory
 * @returns {Promise<{ reply: string, isDirectMatch: boolean }>}
 */
export async function answerFaqQuestion(message, conversationHistory = []) {
  // Check local cache first to consume 0 Groq tokens
  const cached = await findCachedFaqMatch(message);
  if (cached.found) {
    return {
      reply: cached.answer,
      isDirectMatch: true,
    };
  }

  const client = getGroqClient();
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

  // Fallback if Groq API key is not configured yet
  if (!client) {
    logger.warn('GROQ_API_KEY is not configured. Falling back to local FAQ matching.');
    if (mongoose.connection?.readyState === 1) {
      const fallbackFaq = await FaqItem.findOne({
        $text: { $search: message },
      });

      if (fallbackFaq) {
        return {
          reply: fallbackFaq.answer,
          isDirectMatch: true,
        };
      }
    }

    return {
      reply: "PhoneMail is an innovative phone-number-as-email webmail client with client-side TweetNaCl encryption, instant SMS/Call/Web signups, and a self-hosted SMTP server. Please explore our suggested FAQ questions above or check back shortly!",
      isDirectMatch: false,
    };
  }

  // Construct Groq chat completion request
  const sanitizedHistory = (conversationHistory || [])
    .slice(-4) // Keep only last 2 exchanges (4 messages) to strictly limit tokens
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg.content).slice(0, 300),
    }));

  const messages = [
    { role: 'system', content: PHONEMAIL_SYSTEM_PROMPT },
    ...sanitizedHistory,
    { role: 'user', content: message.slice(0, 300) },
  ];

  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 300,
      top_p: 0.9,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || 
      "I'm sorry, I couldn't process your question right now. Please try one of our suggested FAQs.";

    return {
      reply,
      isDirectMatch: false,
    };
  } catch (error) {
    logger.error({ err: error.message }, 'Error calling Groq API');

    // If Groq fails (rate limit / invalid key), graceful recovery from DB
    if (mongoose.connection?.readyState === 1) {
      const fallback = await FaqItem.findOne({
        $text: { $search: message },
      });

      if (fallback) {
        return {
          reply: fallback.answer,
          isDirectMatch: true,
        };
      }
    }

    return {
      reply: "PhoneMail lets you use your phone number as your email address with end-to-end encryption. I am temporarily experiencing high demand, but you can select any of the suggested topics above for instant answers!",
      isDirectMatch: false,
    };
  }
}
