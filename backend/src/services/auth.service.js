import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { dispatchOtp, verifyOtpCode, sendTelnyxSms } from './telnyx.service.js';
import {
  createSetupToken,
  verifySetupToken,
  createResetToken,
  verifyResetToken,
  createSessionToken,
} from './token.service.js';
import { formatUserResponse } from '../utils/user.js';
import { toEmailAddress, normalizePhone } from '../utils/phone.js';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Checks whether a user exists for the given phone number and whether they have set a password.
 * @param {string} phone Normalized E.164 phone number
 * @returns {Promise<{ exists: boolean, hasSetPassword: boolean }>}
 */
export async function checkUser(phone) {
  const user = await User.findOne({ phone });
  return {
    exists: Boolean(user),
    hasSetPassword: user ? Boolean(user.hasSetPassword) : false,
  };
}

/**
 * Issues a setupToken directly for account creation / setup without OTP.
 * @param {string} phone Normalized E.164 phone number
 * @returns {Promise<{ setupToken: string, phone: string, email: string, isExistingUser: boolean }>}
 */
export async function requestSetupToken(phone) {
  const user = await User.findOne({ phone });
  if (user && user.hasSetPassword) {
    throw new BadRequestError('An account with this phone number already exists. Please sign in.');
  }

  const setupToken = createSetupToken(phone);
  return {
    setupToken,
    phone,
    email: toEmailAddress(phone),
    isExistingUser: Boolean(user),
  };
}

/**
 * Initiates OTP verification via Telnyx (SMS or Voice Call).
 * @param {string} phone Normalized E.164 phone number
 * @param {'signup' | 'forgot_password' | 'login' | 'generic'} purpose
 * @param {'sms' | 'call'} channel
 * @returns {Promise<{ success: boolean, channel: string, message: string }>}
 */
export async function startOtp(phone, purpose = 'signup', channel = 'sms') {
  const user = await User.findOne({ phone });

  if (purpose === 'signup' && user && user.hasSetPassword) {
    throw new BadRequestError('An account with this phone number already exists. Please log in.');
  }

  if (purpose === 'forgot_password' && !user) {
    throw new BadRequestError('No account found for this phone number. Please sign up.');
  }

  return await dispatchOtp(phone, purpose, channel);
}

/**
 * Verifies the OTP code and returns either a setupToken (for signup) or resetToken (for forgot-password).
 * @param {string} phone Normalized E.164 phone number
 * @param {string} code OTP verification code
 * @param {'signup' | 'forgot_password' | 'login' | 'generic'} purpose
 * @returns {Promise<{ setupToken?: string, resetToken?: string, phone: string }>}
 */
export async function verifyOtp(phone, code, purpose = 'signup') {
  await verifyOtpCode(phone, code, purpose);

  if (purpose === 'forgot_password') {
    const resetToken = createResetToken(phone);
    return { resetToken, phone };
  }

  const setupToken = createSetupToken(phone);
  return { setupToken, phone };
}

/**
 * Resets user password using a valid resetToken issued after OTP verification.
 * @param {string} resetToken JWT issued by verifyOtp with scope 'reset-password'
 * @param {string} newPassword New password string
 * @returns {Promise<{ token: string, user: object }>}
 */
export async function resetPassword(resetToken, newPassword) {
  const decoded = verifyResetToken(resetToken);
  const phone = decoded.phone;

  const user = await User.findOne({ phone });
  if (!user) {
    throw new BadRequestError('User account not found');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  user.passwordHash = passwordHash;
  user.hasSetPassword = true;
  await user.save();

  const token = createSessionToken(user);
  return {
    token,
    user: formatUserResponse(user),
  };
}

/**
 * Sets the user's password using a valid setupToken and returns a session JWT + user.
 * Rejects expired or wrong-scope tokens with a 401.
 * @param {string} setupToken JWT issued by verifyOtp
 * @param {string} password New password
 * @param {string|null} publicKey Optional E2EE public key
 * @returns {Promise<{ token: string, user: object }>}
 */
export async function setPassword(setupToken, password, publicKey = null) {
  const decoded = verifySetupToken(setupToken);
  const phone = decoded.phone;

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  let user = await User.findOne({ phone });

  if (user) {
    user.email = toEmailAddress(phone);
    user.passwordHash = passwordHash;
    user.hasSetPassword = true;
    if (publicKey) user.publicKey = publicKey;
    await user.save();
  } else {
    user = await User.create({
      phone,
      email: toEmailAddress(phone),
      passwordHash,
      hasSetPassword: true,
      createdVia: 'web',
      aliasIds: [],
      publicKey: publicKey || null,
    });
  }

  const token = createSessionToken(user);
  return {
    token,
    user: formatUserResponse(user),
  };
}

/**
 * Authenticates an existing user using phone and password.
 * @param {string} phone Normalized E.164 phone number
 * @param {string} password Plain text password
 * @returns {Promise<{ token: string, user: object }>}
 */
export async function login(phone, password) {
  const user = await User.findOne({ phone });

  if (!user || !user.hasSetPassword || !user.passwordHash) {
    throw new UnauthorizedError('Invalid phone or password');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid phone or password');
  }

  const token = createSessionToken(user);
  return {
    token,
    user: formatUserResponse(user),
  };
}

/**
 * Fetches user by ID from the database.
 * @param {string} userId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function getUserById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  return user;
}

/**
 * Creates or resets an account via inbound Voice IVR and sends login credentials via SMS.
 * @param {string} rawPhone Caller's phone number
 * @returns {Promise<{ user: object, email: string, tempPassword: string, isNewUser: boolean }>}
 */
export async function createOrResetIvrAccount(rawPhone) {
  const phone = normalizePhone(rawPhone) || rawPhone;
  if (!phone) {
    throw new BadRequestError('Invalid caller phone number');
  }

  // Generate a clean, human-friendly temporary password
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const tempPassword = `Sandesh@${randomSuffix}`;
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_SALT_ROUNDS);

  let user = await User.findOne({ phone });
  let isNewUser = false;

  if (user) {
    user.email = toEmailAddress(phone);
    user.passwordHash = passwordHash;
    user.hasSetPassword = true;
    await user.save();
  } else {
    isNewUser = true;
    user = await User.create({
      phone,
      email: toEmailAddress(phone),
      passwordHash,
      hasSetPassword: true,
      createdVia: 'ivr',
      displayName: 'Sandesh User',
      aliasIds: [],
    });
  }

  const assignedEmail = toEmailAddress(phone);
  const publicBaseUrl = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim() || 'https://sameergoyal.taila324b5.ts.net';

  // Format user-friendly SMS with credentials
  const smsBody = `Welcome to Sandesh PhoneMail! Your account is ready.\n\nEmail: ${assignedEmail}\nPassword: ${tempPassword}\n\nLogin: ${publicBaseUrl}\nPlease update your password after logging in.`;

  console.log(`\n========================================`);
  console.log(`[SANDESH IVR] Account Registered via Inbound Call!`);
  console.log(`Caller Phone: ${phone}`);
  console.log(`Assigned Email: ${assignedEmail}`);
  console.log(`Generated Password: ${tempPassword}`);
  console.log(`========================================\n`);

  let smsSent = false;
  try {
    await sendTelnyxSms(phone, smsBody);
    smsSent = true;
    console.log(`[SANDESH IVR] Credentials SMS sent successfully to ${phone}`);
  } catch (smsErr) {
    console.error(`[SANDESH IVR] SMS dispatch error for ${phone}: ${smsErr.message}`);
  }

  return {
    user: formatUserResponse(user),
    email: assignedEmail,
    tempPassword,
    isNewUser,
    smsSent,
  };
}

