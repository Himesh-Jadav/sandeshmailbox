import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { z } from 'zod';

/**
 * Normalizes any valid phone number to full E.164 format.
 * Defaults to country code 'IN' if national number without '+' is provided.
 * @param {string} phone
 * @returns {string|null} Full E.164 formatted number or null if invalid
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const parsed = parsePhoneNumberFromString(phone.trim(), 'IN');
  if (parsed && parsed.isValid()) {
    return parsed.format('E.164');
  }
  return null;
}

/**
 * Strips the country code to get the display/local-part of the email address.
 * Never duplicate this string-slicing logic elsewhere.
 * @param {string} phone
 * @returns {string}
 */
export function toLocalPart(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const parsed = parsePhoneNumberFromString(phone.trim(), 'IN');
  if (parsed && parsed.nationalNumber) {
    return parsed.nationalNumber;
  }
  return phone.replace(/^\+\d{1,3}/, '');
}

/**
 * Formats phone into display email address
 * @param {string} phone
 * @returns {string}
 */
export function toEmailAddress(phone) {
  const localPart = toLocalPart(phone);
  const domain = process.env.MAIL_DOMAIN || 'sandesh.in';
  return `${localPart}@${domain}`;
}

/**
 * Extracts and normalizes phone number from phone or email input string
 * (e.g. "9876543210@sandesh.in", "+919876543210", "9876543210")
 * @param {string} input
 * @returns {string|null} E.164 normalized phone or null
 */
export function parseRecipientPhone(input) {
  if (!input || typeof input !== 'string') return null;
  let raw = input.trim();
  if (raw.includes('@')) {
    raw = raw.split('@')[0];
  }
  return normalizePhone(raw);
}

/**
 * Zod schema to validate and normalize phone input to E.164.
 * Supports raw phone numbers as well as email addresses (e.g. 9876543210@sandesh.in or 9876543210).
 */
export const phoneSchema = z.string().trim().min(1, 'Phone number or email is required').transform((val, ctx) => {
  const normalized = parseRecipientPhone(val) || normalizePhone(val);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid phone or email format. Enter your 10-digit mobile number or Sandesh address (e.g. 9876543210 or 9876543210@sandesh.in)',
    });
    return z.NEVER;
  }
  return normalized;
});
