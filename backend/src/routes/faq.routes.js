import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import FaqItem from '../models/FaqItem.js';
import { answerFaqQuestion } from '../services/groq.service.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Rate limiter: Max 20 queries per 10 minutes per IP to guard token budget
const faqRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'You have reached the question limit. Please wait a few minutes before asking more questions.',
});

const defaultSuggestions = [
  'What is PhoneMail and how does it work?',
  'How do I sign up or log in to my account?',
  'Are my emails secure and private?',
  'Can I sign up via phone call or SMS?',
];

/**
 * GET /api/faq/suggestions
 * Fetches the initial greeting and suggested FAQ prompts
 */
router.get('/suggestions', async (_req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const suggestedFaqs = await FaqItem.find({ isSuggested: true })
        .sort({ order: 1 })
        .select('question category')
        .limit(6)
        .lean();

      if (suggestedFaqs.length > 0) {
        return res.json({
          greeting: 'Hi there! I am your Sandesh Bot. How can I help you today?',
          suggestions: suggestedFaqs.map((f) => f.question),
        });
      }
    }

    return res.json({
      greeting: 'Hi there! I am your Sandesh Bot. How can I help you today?',
      suggestions: defaultSuggestions,
    });
  } catch (err) {
    // If DB is offline, return fallback suggestions gracefully
    return res.json({
      greeting: 'Hi there! I am your Sandesh Bot. How can I help you today?',
      suggestions: defaultSuggestions,
    });
  }
});

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(300, 'Message cannot exceed 300 characters').trim(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(400),
      })
    )
    .max(10)
    .optional(),
});

/**
 * POST /api/faq/chat
 * Submits a question to the FAQ chatbot
 */
router.post('/chat', faqRateLimiter, async (req, res, next) => {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid input data',
      });
    }

    const { message, history } = parsed.data;
    const result = await answerFaqQuestion(message, history || []);

    return res.json({
      reply: result.reply,
      isDirectMatch: result.isDirectMatch,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
