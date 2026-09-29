import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import pino from 'pino';
import OtpVerification from '../models/OtpVerification.js';
import { BadRequestError } from '../utils/errors.js';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const TELNYX_API_URL = 'https://api.telnyx.com/v2';

function getTelnyxApiKey() {
  return process.env.TELNYX_API_KEY?.trim() || null;
}

function getTelnyxNumber() {
  return process.env.TELNYX_PHONE_NUMBER?.trim() || null;
}

function getTelnyxConnectionId() {
  return process.env.TELNYX_CONNECTION_ID?.trim() || null;
}

/**
 * Creates SHA-256 hash of OTP code.
 * @param {string} code 
 * @returns {string}
 */
export function hashOtpCode(code) {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

/**
 * Generates a secure 6-digit numeric OTP.
 * @returns {string}
 */
export function generateNumericOtp() {
  return Math.floor(100000 + crypto.randomInt(900000)).toString();
}

/**
 * Sends SMS via Telnyx REST API.
 * @param {string} to E.164 phone number
 * @param {string} text Message body
 * @returns {Promise<object>}
 */
export async function sendTelnyxSms(to, text) {
  const apiKey = getTelnyxApiKey();
  const fromNumber = getTelnyxNumber();

  if (!apiKey || !fromNumber) {
    logger.warn(
      { to, text, apiKeyConfigured: Boolean(apiKey), fromNumberConfigured: Boolean(fromNumber) },
      '[Telnyx SMS Simulation] Telnyx credentials not fully configured. Code logged for development/testing.'
    );
    return { simulated: true, to, text };
  }

  const payload = {
    from: fromNumber,
    to,
    text,
  };

  const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID?.trim();
  // Valid UUID format for Telnyx messaging profiles
  if (profileId && /^[0-9a-fA-F-]{36}$/.test(profileId)) {
    payload.messaging_profile_id = profileId;
  }

  try {
    const res = await fetch(`${TELNYX_API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      logger.error({ status: res.status, data, to }, 'Failed to send Telnyx SMS');
      throw new BadRequestError(
        data?.errors?.[0]?.detail || 'Failed to dispatch SMS via Telnyx.'
      );
    }

    logger.info({ messageId: data?.data?.id, to }, 'Telnyx SMS sent successfully');
    return data;
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    logger.error({ err: err.message, to }, 'Telnyx SMS network error');
    throw new BadRequestError(`Telnyx SMS service error: ${err.message}`);
  }
}

/**
 * Initiates an outbound IVR call to speak an OTP code.
 * @param {string} to E.164 phone number
 * @param {string} code OTP code to speak
 * @returns {Promise<object>}
 */
export async function sendTelnyxVoiceCall(to, code) {
  const apiKey = getTelnyxApiKey();
  const fromNumber = getTelnyxNumber();
  const connectionId = getTelnyxConnectionId();

  if (!apiKey || !fromNumber || !connectionId) {
    logger.warn(
      {
        to,
        code,
        apiKeyConfigured: Boolean(apiKey),
        fromNumberConfigured: Boolean(fromNumber),
        connectionIdConfigured: Boolean(connectionId),
      },
      '[Telnyx Call Simulation] Telnyx Call Control not fully configured. Code logged for development/testing.'
    );
    return { simulated: true, to, code };
  }

  const clientState = Buffer.from(
    JSON.stringify({ code, action: 'otp_call', to })
  ).toString('base64');

  const publicBaseUrl = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
  const callBody = {
    to,
    from: fromNumber,
    connection_id: connectionId,
    client_state: clientState,
  };

  if (publicBaseUrl) {
    callBody.webhook_url = `${publicBaseUrl.replace(/\/$/, '')}/api/webhooks/telnyx/voice`;
    callBody.webhook_url_method = 'POST';
  }

  try {
    const res = await fetch(`${TELNYX_API_URL}/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(callBody),
    });

    const data = await res.json();
    if (!res.ok) {
      logger.error({ status: res.status, data }, 'Failed to initiate Telnyx voice call');
      throw new BadRequestError(
        data?.errors?.[0]?.detail || 'Failed to initiate Telnyx voice call.'
      );
    }

    logger.info({ callControlId: data?.data?.call_control_id, to }, 'Telnyx voice call initiated');
    return data;
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    logger.error({ err: err.message, to }, 'Telnyx voice call network error');
    throw new BadRequestError(`Telnyx Call error: ${err.message}`);
  }
}

/**
 * Sends a Call Control command (e.g. speak, answer, hangup, gather_using_speak).
 * Logs non-2xx responses and returns { ok, status, data, error }.
 * @param {string} callControlId
 * @param {string} action
 * @param {object} payload
 * @returns {Promise<{ ok: boolean, status?: number, data?: object, error?: string, simulated?: boolean }>}
 */
export async function callControlAction(callControlId, action, payload = {}) {
  const apiKey = getTelnyxApiKey();
  if (!apiKey) {
    logger.warn({ callControlId, action }, 'No Telnyx API key; skipping Call Control action');
    return { ok: true, simulated: true };
  }

  const url = `${TELNYX_API_URL}/calls/${callControlId}/actions/${action}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data?.errors?.[0]?.detail || `Action ${action} returned status ${res.status}`;
      logger.error(
        { status: res.status, action, callControlId, payload, errors: data?.errors },
        `[Telnyx Call Control] Action '${action}' failed: ${errorMsg}`
      );
      return { ok: false, status: res.status, data, error: errorMsg };
    }

    logger.info({ action, callControlId }, `[Telnyx Call Control] Action '${action}' succeeded`);
    return { ok: true, status: res.status, data };
  } catch (err) {
    logger.error({ err: err.message, callControlId, action }, 'Call control action network error');
    return { ok: false, error: err.message };
  }
}

/**
 * Executes a speech or gather_using_speak command with automatic voice fallback.
 * First tries high-quality Neural TTS (AWS.Polly.Danielle-Neural), and falls back
 * to basic service level with female voice if premium/neural is unavailable.
 * @param {string} callControlId
 * @param {'speak' | 'gather_using_speak'} action
 * @param {object} options Additional options (payload, client_state, valid_digits, etc.)
 * @returns {Promise<object>}
 */
export async function robustSpeakOrGather(callControlId, action, options = {}) {
  // Primary attempt: AWS Polly Neural voice (en-US)
  const primaryPayload = {
    payload_type: 'text',
    voice: 'AWS.Polly.Danielle-Neural',
    language: 'en-US',
    ...options,
  };

  const res1 = await callControlAction(callControlId, action, primaryPayload);
  if (res1.ok || res1.simulated) {
    return res1;
  }

  logger.warn(
    { callControlId, action, error: res1.error },
    '[Telnyx Voice] Primary neural TTS failed; retrying with basic TTS profile'
  );

  // Fallback: Basic service level with female voice
  const fallbackPayload = {
    payload_type: 'text',
    service_level: 'basic',
    voice: 'female',
    language: 'en-US',
    ...options,
  };

  const res2 = await callControlAction(callControlId, action, fallbackPayload);
  return res2;
}

/**
 * Creates and dispatches an OTP via SMS or Voice Call.
 * @param {string} phone Normalized E.164 phone number
 * @param {'signup' | 'forgot_password' | 'login' | 'generic'} purpose
 * @param {'sms' | 'call'} channel
 * @returns {Promise<{ success: boolean, channel: string, message: string }>}
 */
export async function dispatchOtp(phone, purpose = 'signup', channel = 'sms') {
  // Rate-limiting check: 1 OTP request every 30 seconds per phone & purpose
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  const recentOtp = await OtpVerification.findOne({
    phone,
    purpose,
    createdAt: { $gte: thirtySecondsAgo },
  });

  if (recentOtp) {
    throw new BadRequestError('Please wait 30 seconds before requesting another code.');
  }

  // Invalidate any older pending unverified OTPs for this phone + purpose
  await OtpVerification.deleteMany({ phone, purpose, verified: false });

  const code = generateNumericOtp();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

  await OtpVerification.create({
    phone,
    codeHash,
    purpose,
    channel,
    attempts: 0,
    maxAttempts: 5,
    verified: false,
    expiresAt,
  });

  // Always log code to backend console for developer visibility
  console.log(`\n========================================`);
  console.log(`[SANDESH OTP] Channel: ${channel.toUpperCase()} | Purpose: ${purpose}`);
  console.log(`Target Phone: ${phone}`);
  console.log(`Verification Code: >> ${code} << (Valid for 5 mins)`);
  console.log(`========================================\n`);

  if (channel === 'call') {
    await sendTelnyxVoiceCall(phone, code);
    return {
      success: true,
      channel: 'call',
      message: 'Calling your phone number with the verification code.',
    };
  }

  const messageText = `Your Sandesh PhoneMail verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;
  await sendTelnyxSms(phone, messageText);

  return {
    success: true,
    channel: 'sms',
    message: 'Verification code sent via SMS.',
  };
}

/**
 * Verifies an OTP code against stored record.
 * @param {string} phone E.164 phone
 * @param {string} code Entered 6-digit code
 * @param {'signup' | 'forgot_password' | 'login' | 'generic'} purpose
 * @returns {Promise<boolean>}
 */
export async function verifyOtpCode(phone, code, purpose = 'signup') {
  const otpRecord = await OtpVerification.findOne({
    phone,
    purpose,
    verified: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new BadRequestError('Verification code expired or not found. Please request a new one.');
  }

  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    await OtpVerification.deleteOne({ _id: otpRecord._id });
    throw new BadRequestError('Too many incorrect attempts. Please request a new verification code.');
  }

  const inputHash = hashOtpCode(code);
  if (inputHash !== otpRecord.codeHash) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    const remaining = otpRecord.maxAttempts - otpRecord.attempts;
    throw new BadRequestError(`Incorrect verification code. ${remaining} attempt(s) remaining.`);
  }

  otpRecord.verified = true;
  await otpRecord.save();
  return true;
}
