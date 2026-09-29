import Groq from 'groq-sdk';
import pino from 'pino';

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

const AI_EMAIL_SYSTEM_PROMPT = `You are an expert AI email drafting assistant for PhoneMail (Sandesh).
Your goal is to write articulate, natural, well-formatted emails based on the user's prompt/topic, tone, and length.

You MUST respond strictly in valid JSON format with exactly this structure:
{
  "subject": "Clear, concise, and professional subject line",
  "body": "Complete email body including appropriate salutation, cohesive paragraphs, call-to-action, and sign-off."
}

Guidelines:
1. Tone adaptation:
   - "professional": Courteous, articulate, business-standard.
   - "casual": Warm, conversational, friendly.
   - "direct": Concise, straight to the point, minimal fluff.
   - "persuasive": Compelling, benefit-oriented, engaging.
   - "urgent": Action-oriented, highlighting timely importance politely.
2. Length adaptation:
   - "short": 2 to 4 concise sentences.
   - "medium": 2 to 3 well-structured paragraphs.
   - "detailed": Thorough, structured with bullet points where appropriate.
3. Formatting:
   - Use standard newlines (\\n\\n) between paragraphs and greeting/sign-off.
   - Use clean placeholders like [Recipient Name], [Date], [Project Name], [Your Name] for specifics not provided in the prompt.
4. Output STRICT JSON only. Do not add conversational chit-chat before or after the JSON.`;

/**
 * Generates email subject and body using Groq AI with resilience and fallback.
 * @param {Object} options
 * @param {string} options.prompt - What the user wants to say or topic
 * @param {string} [options.tone='professional'] - Tone of the email
 * @param {string} [options.length='medium'] - Desired length
 * @param {string} [options.recipientContext] - Optional recipient info
 * @param {string} [options.currentSubject] - Existing subject if refining
 * @returns {Promise<{ subject: string, body: string, source: 'groq' | 'fallback' }>}
 */
export async function generateEmailWithAi({
  prompt,
  tone = 'professional',
  length = 'medium',
  recipientContext = '',
  currentSubject = '',
}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('A prompt or email topic is required');
  }

  const client = getGroqClient();
  const configuredModel = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

  if (!client) {
    logger.warn('GROQ_API_KEY is not configured. Falling back to local template synthesizer.');
    return generateFallbackTemplate(prompt, tone, length);
  }

  const userInstruction = [
    `Topic / Description: ${prompt.trim()}`,
    `Desired Tone: ${tone}`,
    `Desired Length: ${length}`,
    recipientContext ? `Recipient Context: ${recipientContext}` : null,
    currentSubject ? `Current/Original Subject: ${currentSubject}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Candidate models supported on Groq
  const modelsToTry = [
    configuredModel,
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
  ];
  // Deduplicate
  const uniqueModels = [...new Set(modelsToTry)];

  for (const model of uniqueModels) {
    try {
      logger.info({ model, promptLength: prompt.length }, 'Requesting email generation from Groq');

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: AI_EMAIL_SYSTEM_PROMPT },
          { role: 'user', content: userInstruction },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      const rawContent = response.choices[0]?.message?.content?.trim();
      if (!rawContent) continue;

      const parsed = parseEmailJsonResponse(rawContent);
      if (parsed.subject && parsed.body) {
        return {
          subject: parsed.subject,
          body: parsed.body,
          source: 'groq',
        };
      }
    } catch (err) {
      console.log('[GROQ_ERR]', { model, error: err.message, status: err.status });
      logger.warn({ model, err: err.message }, 'Groq attempt failed, checking next model or fallback');
      // If error is authentication or rate limit, break or proceed
      if (err.status === 401) {
        logger.error('Invalid Groq API key.');
        break;
      }
    }
  }

  // If all Groq attempts fail or are rate-limited, safely fall back
  logger.warn('All Groq models failed. Employing fallback email synthesizer.');
  return generateFallbackTemplate(prompt, tone, length);
}

/**
 * Safely parses LLM JSON response or cleans markdown codeblocks.
 */
function parseEmailJsonResponse(raw) {
  try {
    let clean = raw.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const data = JSON.parse(clean);
    return {
      subject: String(data.subject || '').trim(),
      body: String(data.body || '').trim(),
    };
  } catch (_e) {
    // Regex extract if imperfect JSON
    const subjectMatch = raw.match(/"subject"\s*:\s*"([^"]+)"/);
    const bodyMatch = raw.match(/"body"\s*:\s*"([\s\S]*?)"\s*}/);

    return {
      subject: subjectMatch ? subjectMatch[1] : 'Subject: Generated Mail',
      body: bodyMatch ? bodyMatch[1].replace(/\\n/g, '\n') : raw,
    };
  }
}

/**
 * High-quality fallback rule-based template synthesizer when Groq is unreachable.
 */
function generateFallbackTemplate(prompt, tone, length) {
  const pLower = prompt.toLowerCase();
  let subject = '';
  let body = '';

  const isCasual = tone === 'casual';
  const isDirect = tone === 'direct';
  const isUrgent = tone === 'urgent';
  const salutation = isCasual ? 'Hi [Name],' : 'Dear [Name],';
  const signoff = isCasual ? 'Cheers,\n[Your Name]' : isDirect ? 'Thanks,\n[Your Name]' : 'Best regards,\n[Your Name]';

  if (pLower.includes('sick') || pLower.includes('fever') || pLower.includes('leave') || pLower.includes('doctor')) {
    subject = isUrgent ? 'Urgent: Sick Leave Notification - [Your Name]' : 'Leave Notification - [Your Name]';
    body = `${salutation}\n\nI am writing to notify you that I will be taking leave starting from [Date] due to [reason/illness].\n\nI will keep you posted on my recovery and return. In the meantime, please reach me on mobile for any urgent matters.\n\n${signoff}`;
  } else if (pLower.includes('meet') || pLower.includes('schedule') || pLower.includes('call') || pLower.includes('sync')) {
    subject = `Request to Schedule Discussion: ${prompt.slice(0, 45)}`;
    body = `${salutation}\n\nI would like to propose a short sync regarding ${prompt}.\n\nPlease let me know if you have availability later this week or suggest a time that suits you.\n\n${signoff}`;
  } else if (pLower.includes('follow') || pLower.includes('bump') || pLower.includes('status') || pLower.includes('update')) {
    subject = `Follow-up: ${prompt.slice(0, 45)}`;
    body = `${salutation}\n\nI wanted to gently follow up on our discussion regarding ${prompt}.\n\nPlease let me know if you have any updates or if there is anything needed from my end to assist.\n\n${signoff}`;
  } else {
    subject = prompt.length > 50 ? `${prompt.slice(0, 47)}...` : prompt;
    body = `${salutation}\n\nI am writing to reach out regarding: ${prompt}.\n\nPlease review this at your convenience and let me know your thoughts.\n\n${signoff}`;
  }

  return {
    subject,
    body,
    source: 'fallback',
  };
}
