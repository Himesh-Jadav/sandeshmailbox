import { Router } from 'express';
import pino from 'pino';
import {
  callControlAction,
  robustSpeakOrGather,
  dispatchOtp,
} from '../services/telnyx.service.js';
import { createOrResetIvrAccount } from '../services/auth.service.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const router = Router();

/**
 * POST /api/webhooks/telnyx/messaging
 * Handles inbound SMS and SMS delivery receipts from Telnyx.
 */
router.post('/messaging', async (req, res) => {
  const event = req.body?.data;
  const eventType = event?.event_type;

  logger.info({ eventType, id: event?.id }, '[Telnyx Webhook] Messaging event received');

  if (eventType === 'message.received') {
    const payload = event.payload;
    const from = payload?.from?.phone_number;
    const to = payload?.to?.[0]?.phone_number;
    const text = payload?.text?.trim();

    logger.info({ from, to, text }, '[Telnyx Webhook] Inbound SMS received');

    // Auto-reply or process command if needed
    if (text && /^(otp|code|login)/i.test(text)) {
      try {
        await dispatchOtp(from, 'login', 'sms');
      } catch (err) {
        logger.error({ err: err.message }, 'Failed to dispatch requested SMS OTP');
      }
    }
  }

  // Telnyx expects a 200 OK fast
  res.status(200).json({ received: true });
});

/**
 * POST /api/webhooks/telnyx/voice
 * Handles Telnyx Call Control webhook events for outbound OTP and inbound IVR.
 */
router.post('/voice', async (req, res) => {
  const event = req.body?.data;
  const eventType = event?.event_type;
  const payload = event?.payload;
  const callControlId = payload?.call_control_id;

  // Immediately respond 200 to Telnyx to acknowledge receipt
  res.status(200).json({ received: true });

  if (!callControlId) return;

  let clientState = {};
  if (payload?.client_state) {
    try {
      clientState = JSON.parse(Buffer.from(payload.client_state, 'base64').toString('utf8'));
    } catch (_) {}
  }

  logger.info({ eventType, callControlId, clientState, direction: payload?.direction }, '[Telnyx Webhook] Voice Call Control event');

  try {
    switch (eventType) {
      case 'call.initiated': {
        const isIncoming = payload?.direction === 'incoming' || payload?.direction === 'inbound';
        if (isIncoming) {
          const callerPhone = payload?.from || '';
          logger.info({ callControlId, callerPhone }, '[Telnyx IVR] Answering incoming call with state');
          const answerState = Buffer.from(
            JSON.stringify({ action: 'inbound_ivr', step: 'answered', callerPhone })
          ).toString('base64');
          await callControlAction(callControlId, 'answer', { client_state: answerState });
        }
        break;
      }

      case 'call.answered': {
        const callerPhone = clientState?.callerPhone || payload?.from || payload?.to;

        // Case A: Outbound OTP call
        if (clientState.action === 'otp_call' && clientState.code) {
          const codeDigits = clientState.code.split('').join(' ');
          const speech = `Hello. Your Sandesh verification code is: ${codeDigits}. I repeat, ${codeDigits}. This code expires in 5 minutes. Goodbye.`;
          
          logger.info({ callControlId, to: payload?.to }, '[Telnyx Voice] Speaking OTP code to answered call');
          await robustSpeakOrGather(callControlId, 'speak', {
            payload: speech,
            client_state: payload?.client_state,
          });
        }
        // Case B: Inbound call -> Start IVR prompt with gather
        else if (payload?.direction === 'incoming' || payload?.direction === 'inbound' || clientState?.action === 'inbound_ivr') {
          logger.info({ callControlId, callerPhone }, '[Telnyx IVR] Starting IVR main menu gather prompt');
          const menuState = Buffer.from(
            JSON.stringify({ action: 'inbound_ivr', step: 'main_menu', callerPhone })
          ).toString('base64');

          const greeting = 'Welcome to Sandesh PhoneMail, the next generation voice and phone-native messaging platform. With Sandesh, your mobile phone number is your secure inbox. To create your Sandesh account right now and receive your login credentials via text message, press 1. To hear about Sandesh features and security, press 2.';

          await robustSpeakOrGather(callControlId, 'gather_using_speak', {
            payload: greeting,
            valid_digits: '12',
            minimum_digits: 1,
            maximum_digits: 1,
            timeout_millis: 14000,
            client_state: menuState,
          });
        }
        break;
      }

      case 'call.gather.ended': {
        const digits = payload?.digits;
        const callerPhone = clientState?.callerPhone || payload?.from;
        logger.info({ callControlId, digits, callerPhone, clientState }, '[Telnyx IVR] Gather ended with digit selection');

        // Option 1: Create Account & Send SMS Credentials
        if (digits === '1') {
          if (!callerPhone) {
            logger.warn({ callControlId }, '[Telnyx IVR] Missing caller phone for account registration');
            const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
            await robustSpeakOrGather(callControlId, 'speak', {
              payload: 'We were unable to detect your caller ID number. Please call from an active mobile number to register. Goodbye.',
              client_state: endState,
            });
            break;
          }

          try {
            logger.info({ callerPhone }, '[Telnyx IVR] Initiating automated account creation via voice IVR');
            const ivrAccount = await createOrResetIvrAccount(callerPhone);
            logger.info({ email: ivrAccount.email, phone: callerPhone }, '[Telnyx IVR] Account created/updated successfully');

            const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
            const celebrationSpeech = 'Congratulations! Your Sandesh PhoneMail account has been created successfully. We have sent an SMS to your mobile number with your assigned email address and password. You can now log into your inbox. Thank you for calling Sandesh. Have a wonderful day!';
            
            await robustSpeakOrGather(callControlId, 'speak', {
              payload: celebrationSpeech,
              client_state: endState,
            });
          } catch (regErr) {
            logger.error({ err: regErr.message, callerPhone }, '[Telnyx IVR] Failed to create account via IVR');
            const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
            await robustSpeakOrGather(callControlId, 'speak', {
              payload: 'We encountered an error setting up your account. Please visit our website to sign up. Thank you for calling Sandesh. Goodbye.',
              client_state: endState,
            });
          }
        }
        // Option 2: Feature & FAQ Overview
        else if (digits === '2') {
          logger.info({ callControlId, callerPhone }, '[Telnyx IVR] Playing Sandesh overview and re-prompting gather');
          const infoState = Buffer.from(
            JSON.stringify({ action: 'inbound_ivr', step: 'info_menu', callerPhone })
          ).toString('base64');

          await robustSpeakOrGather(callControlId, 'gather_using_speak', {
            payload: 'Sandesh PhoneMail bridges phone numbers and email seamlessly. Every mobile number gets an instant, spam-free inbox with voice verification and complete privacy. To create your account now and receive your password by SMS, press 1. Or hang up to exit.',
            valid_digits: '1',
            minimum_digits: 1,
            maximum_digits: 1,
            timeout_millis: 14000,
            client_state: infoState,
          });
        }
        // Other input or timeout: Graceful exit
        else {
          logger.info({ callControlId, digits }, '[Telnyx IVR] No valid option selected, ending call');
          const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
          await robustSpeakOrGather(callControlId, 'speak', {
            payload: 'Thank you for calling Sandesh PhoneMail. Visit our website at any time to sign up or log in. Goodbye.',
            client_state: endState,
          });
        }
        break;
      }

      case 'call.speak.ended': {
        // If this was an OTP call or an IVR completion speech, hang up gracefully
        if (clientState.action === 'otp_call' || clientState.action === 'hangup_after_speak') {
          logger.info({ callControlId, action: clientState.action }, '[Telnyx IVR] Speak ended, hanging up call gracefully');
          await callControlAction(callControlId, 'hangup');
        }
        break;
      }

      case 'call.hangup': {
        logger.info({ callControlId, hangupSource: payload?.hangup_source }, '[Telnyx IVR] Call hung up');
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.error({ err: err.message, eventType }, 'Error handling Telnyx voice webhook event');
  }
});

export default router;
