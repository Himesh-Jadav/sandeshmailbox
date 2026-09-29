import { Router } from 'express';
import pino from 'pino';
import {
  callControlAction,
  robustSpeakOrGather,
  dispatchOtp,
} from '../services/telnyx.service.js';
import {
  createOrResetIvrAccount,
  resetPasswordViaIvr,
  getAccountDetailsViaIvr,
} from '../services/auth.service.js';

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

router.get('/messaging', (_req, res) => res.json({ status: 'ok', service: 'telnyx-messaging-webhook' }));
router.get('/voice', (_req, res) => res.json({ status: 'ok', service: 'telnyx-voice-webhook' }));

/**
 * POST /api/webhooks/telnyx/voice
 * Handles Telnyx Call Control webhook events for outbound OTP and inbound IVR.
 */
router.post('/voice', async (req, res) => {
  const event = req.body?.data;
  const eventType = event?.event_type;
  const payload = event?.payload;
  const callControlId = payload?.call_control_id;

  console.log(`[Telnyx Voice Incoming Webhook] Event: ${eventType} | CallControlID: ${callControlId} | From: ${payload?.from} | Direction: ${payload?.direction}`);

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

          const greeting =
            'Welcome to Sandesh PhoneMail. ' +
            'Press 1 to create your Sandesh account. ' +
            'Press 2 to reset or change your password. ' +
            'Press 3 to check your account details. ' +
            'Press 4 for our security features. ' +
            'Press 5 to repeat all of these options.';

          await robustSpeakOrGather(callControlId, 'gather_using_speak', {
            payload: greeting,
            valid_digits: '12345',
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

            const subMenuState = Buffer.from(JSON.stringify({ action: 'inbound_ivr', step: 'sub_menu', callerPhone })).toString('base64');
            const celebrationSpeech =
              'Congratulations! Your Sandesh PhoneMail account is ready. ' +
              'We have sent a text message to your mobile phone with your assigned email address and password. ' +
              'To revisit the menu options, press 5. Or you may hang up now.';

            await robustSpeakOrGather(callControlId, 'gather_using_speak', {
              payload: celebrationSpeech,
              valid_digits: '12345',
              minimum_digits: 1,
              maximum_digits: 1,
              timeout_millis: 10000,
              client_state: subMenuState,
            });
          } catch (regErr) {
            logger.error({ err: regErr.message, callerPhone }, '[Telnyx IVR] Failed to create account via IVR');
            const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
            await robustSpeakOrGather(callControlId, 'speak', {
              payload: 'We encountered an error setting up your account. Please visit our website to sign up. Goodbye.',
              client_state: endState,
            });
          }
        }
        // Option 2: Forgot or Change Password
        else if (digits === '2') {
          if (!callerPhone) {
            logger.warn({ callControlId }, '[Telnyx IVR] Missing caller phone for password reset');
            const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
            await robustSpeakOrGather(callControlId, 'speak', {
              payload: 'We were unable to detect your phone number to reset your password. Goodbye.',
              client_state: endState,
            });
            break;
          }

          try {
            logger.info({ callerPhone }, '[Telnyx IVR] Resetting password via voice IVR');
            const resetResult = await resetPasswordViaIvr(callerPhone);
            logger.info({ email: resetResult.email, phone: callerPhone }, '[Telnyx IVR] Password reset successfully');

            const subMenuState = Buffer.from(JSON.stringify({ action: 'inbound_ivr', step: 'sub_menu', callerPhone })).toString('base64');
            const resetSpeech =
              'Your Sandesh account password has been successfully reset. ' +
              'We have sent a text message with your new temporary password and login link to your mobile number. ' +
              'Please check your SMS to sign in and update your password. ' +
              'To hear the menu options again, press 5. Or you may hang up now.';

            await robustSpeakOrGather(callControlId, 'gather_using_speak', {
              payload: resetSpeech,
              valid_digits: '12345',
              minimum_digits: 1,
              maximum_digits: 1,
              timeout_millis: 12000,
              client_state: subMenuState,
            });
          } catch (err) {
            logger.error({ err: err.message, callerPhone }, '[Telnyx IVR] Failed to reset password via IVR');
            const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
            await robustSpeakOrGather(callControlId, 'speak', {
              payload: 'We encountered an issue resetting your password. Please try again or visit our website. Goodbye.',
              client_state: endState,
            });
          }
        }
        // Option 3: Check Account Details
        else if (digits === '3') {
          if (!callerPhone) {
            logger.warn({ callControlId }, '[Telnyx IVR] Missing caller phone for account details');
            const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
            await robustSpeakOrGather(callControlId, 'speak', {
              payload: 'We were unable to detect your phone number to check account details. Goodbye.',
              client_state: endState,
            });
            break;
          }

          try {
            logger.info({ callerPhone }, '[Telnyx IVR] Checking account details via voice IVR');
            const details = await getAccountDetailsViaIvr(callerPhone);
            const subMenuState = Buffer.from(JSON.stringify({ action: 'inbound_ivr', step: 'sub_menu', callerPhone })).toString('base64');

            if (details.exists) {
              const emailSpoken = details.email.replace('@', ' at ');
              const msgWord = details.inboxCount === 1 ? 'message' : 'messages';
              const detailsSpeech =
                `Here are your account details. Your registered phone number is ${callerPhone}. ` +
                `Your Sandesh email address is ${emailSpoken}. ` +
                `Your account status is active, and you currently have ${details.inboxCount} ${msgWord} in your inbox. ` +
                `We have also sent a complete summary to your phone via SMS. ` +
                `To return to the main menu, press 5. Or you may hang up now.`;

              await robustSpeakOrGather(callControlId, 'gather_using_speak', {
                payload: detailsSpeech,
                valid_digits: '12345',
                minimum_digits: 1,
                maximum_digits: 1,
                timeout_millis: 12000,
                client_state: subMenuState,
              });
            } else {
              const noAccountSpeech =
                'No Sandesh account was found for your phone number. ' +
                'To create your account now, press 1. ' +
                'To hear all menu options again, press 5. ' +
                'Or you may hang up.';

              await robustSpeakOrGather(callControlId, 'gather_using_speak', {
                payload: noAccountSpeech,
                valid_digits: '12345',
                minimum_digits: 1,
                maximum_digits: 1,
                timeout_millis: 12000,
                client_state: subMenuState,
              });
            }
          } catch (err) {
            logger.error({ err: err.message, callerPhone }, '[Telnyx IVR] Failed to check account details');
            const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
            await robustSpeakOrGather(callControlId, 'speak', {
              payload: 'Unable to retrieve account details at this time. Goodbye.',
              client_state: endState,
            });
          }
        }
        // Option 4: Security Features
        else if (digits === '4') {
          logger.info({ callControlId, callerPhone }, '[Telnyx IVR] Playing security features overview');
          const subMenuState = Buffer.from(JSON.stringify({ action: 'inbound_ivr', step: 'sub_menu', callerPhone })).toString('base64');
          const securitySpeech =
            'Sandesh PhoneMail is built with zero-trust phone-native security. ' +
            'Every account is cryptographically anchored to your verified mobile number, eliminating weak credentials and phishing. ' +
            'Core security features include end-to-end encrypted messaging, automated AI spam protection, ' +
            'and two-factor authentication via voice and SMS. ' +
            'Your data is private and never tracked. ' +
            'To hear all menu options again, press 5. Or press 1 to create an account.';

          await robustSpeakOrGather(callControlId, 'gather_using_speak', {
            payload: securitySpeech,
            valid_digits: '12345',
            minimum_digits: 1,
            maximum_digits: 1,
            timeout_millis: 14000,
            client_state: subMenuState,
          });
        }
        // Option 5: Revisiting All Options
        else if (digits === '5') {
          logger.info({ callControlId, callerPhone }, '[Telnyx IVR] Revisiting main menu options');
          const menuState = Buffer.from(
            JSON.stringify({ action: 'inbound_ivr', step: 'main_menu', callerPhone })
          ).toString('base64');

          const repeatGreeting =
            'Main Menu: ' +
            'Press 1 to create your Sandesh account. ' +
            'Press 2 to reset or change your password. ' +
            'Press 3 to check your account details. ' +
            'Press 4 for our security features. ' +
            'Press 5 to repeat all of these options.';

          await robustSpeakOrGather(callControlId, 'gather_using_speak', {
            payload: repeatGreeting,
            valid_digits: '12345',
            minimum_digits: 1,
            maximum_digits: 1,
            timeout_millis: 14000,
            client_state: menuState,
          });
        }
        // Other input or timeout: Graceful exit
        else {
          logger.info({ callControlId, digits }, '[Telnyx IVR] No valid option selected, ending call');
          const endState = Buffer.from(JSON.stringify({ action: 'hangup_after_speak' })).toString('base64');
          await robustSpeakOrGather(callControlId, 'speak', {
            payload: 'Thank you for calling Sandesh PhoneMail. Have a wonderful day. Goodbye.',
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
