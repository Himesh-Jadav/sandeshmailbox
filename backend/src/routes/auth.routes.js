import { Router } from 'express';
import { z } from 'zod';
import { phoneSchema } from '../utils/phone.js';
import {
  checkUser,
  requestSetupToken,
  startOtp,
  verifyOtp,
  setPassword,
  resetPassword,
  login,
} from '../services/auth.service.js';

const router = Router();

const checkSchema = z.object({
  phone: phoneSchema,
});

const otpStartSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['signup', 'forgot_password', 'login', 'update_password', 'generic']).default('signup'),
  channel: z.enum(['sms', 'call']).default('sms'),
});

const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().min(4, 'Code must be at least 4 characters').max(10),
  purpose: z.enum(['signup', 'forgot_password', 'login', 'update_password', 'generic']).default('signup'),
});

const setPasswordSchema = z.object({
  setupToken: z.string().trim().min(1, 'setupToken is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  publicKey: z.string().nullable().optional(),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().trim().min(1, 'resetToken is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Phone number or PhoneMail is required').optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => Boolean(data.identifier || data.phone || data.email), {
    message: 'Phone number or PhoneMail is required',
    path: ['identifier'],
  });

/**
 * POST /api/auth/check
 * Returns { exists, hasSetPassword }
 */
router.post('/check', async (req, res, next) => {
  try {
    const { phone } = checkSchema.parse(req.body);
    const result = await checkUser(phone);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/setup-token
 * Direct setupToken generation (for instant development or OTP bypass if needed)
 */
router.post('/setup-token', async (req, res, next) => {
  try {
    const { phone } = checkSchema.parse(req.body);
    const result = await requestSetupToken(phone);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/otp/start
 * Initiates OTP via Telnyx (SMS or Voice Call)
 */
router.post('/otp/start', async (req, res, next) => {
  try {
    const { phone, purpose, channel } = otpStartSchema.parse(req.body);
    const result = await startOtp(phone, purpose, channel);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/otp/verify
 * Verifies OTP code; returns setupToken (signup) or resetToken (forgot_password)
 */
router.post('/otp/verify', async (req, res, next) => {
  try {
    const { phone, code, purpose } = otpVerifySchema.parse(req.body);
    const result = await verifyOtp(phone, code, purpose);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/set-password
 * Complete signup / password setup using setupToken
 */
router.post('/set-password', async (req, res, next) => {
  try {
    const { setupToken, password, publicKey } = setPasswordSchema.parse(req.body);
    const result = await setPassword(setupToken, password, publicKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/forgot-password/reset
 * Resets user password using resetToken
 */
router.post('/forgot-password/reset', async (req, res, next) => {
  try {
    const { resetToken, newPassword } = resetPasswordSchema.parse(req.body);
    const result = await resetPassword(resetToken, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Returns { token, user }
 */
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const identifier = (data.identifier || data.phone || data.email || '').trim();
    const result = await login(identifier, data.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
