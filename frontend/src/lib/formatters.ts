/**
 * Strip country code (+91 or 91) from phone numbers for clean display
 */
export const formatPhoneNumber = (phone?: string | null): string => {
  if (!phone) return '';
  let p = phone.trim();
  // Strip +91, 91 with optional spaces or dashes
  if (/^\+91[\s-]?/.test(p)) {
    p = p.replace(/^\+91[\s-]*/, '').trim();
  } else if (/^91[\s-]?/.test(p) && p.replace(/\D/g, '').length > 10) {
    p = p.replace(/^91[\s-]*/, '').trim();
  } else if (p.startsWith('+')) {
    p = p.slice(1).trim();
  }
  return p;
};

/**
 * Show clean username/displayName instead of phone number
 */
export const getUserOrContactName = (contact?: {
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
} | null): string => {
  if (!contact) return 'User';

  const isNumericOnly = (str: string) => /^\+?[\d\s-]+$/.test(str.trim());

  // 1. If displayName exists, is NOT a phone number and not generic 'User'
  if (
    contact.displayName &&
    !isNumericOnly(contact.displayName) &&
    contact.displayName.trim().toLowerCase() !== 'user'
  ) {
    return contact.displayName.trim();
  }

  // 2. If email exists and username part is NOT a phone number
  if (contact.email) {
    const username = contact.email.split('@')[0];
    if (
      username &&
      !isNumericOnly(username) &&
      !username.toLowerCase().includes('phonemail') &&
      !username.toLowerCase().includes('sandesh')
    ) {
      return username;
    }
  }

  // 3. Fallback: if displayName exists and is not numeric
  if (contact.displayName && !isNumericOnly(contact.displayName)) {
    return contact.displayName.trim();
  }

  // 4. Fallback: Hide the phone number completely and show a clean username (e.g., user_1234)
  const rawNum = contact.phone || contact.displayName || '';
  const digits = rawNum.replace(/\D/g, '');
  if (digits) {
    const last4 = digits.slice(-4);
    return `user_${last4}`;
  }

  return 'User';
};

/**
 * Filter out @sandesh.in and legacy pseudo-domain emails and numeric phone-emails so they are not shown in chat
 */
export const cleanEmailDisplay = (email?: string | null): string => {
  if (!email) return '';
  const trimmed = email.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.endsWith('@sandesh.in') ||
    lower.endsWith('@phonemail.com') ||
    lower.endsWith('@niti.com') ||
    lower.endsWith('@sandesh.im') ||
    lower.endsWith('@sandesh.com') ||
    lower.includes('phonemail')
  ) {
    return '';
  }
  // If the email username prefix is a phone number (e.g. 9876543210@...), hide it
  const prefix = trimmed.split('@')[0];
  if (/^\+?\d{7,15}$/.test(prefix)) {
    return '';
  }
  return trimmed;
};

/**
 * Format DOB for human display with age calculation
 */
export const formatDobDisplay = (dobStr?: string | null): { formatted: string; age: number | null } | null => {
  if (!dobStr) return null;
  try {
    const parts = dobStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const formatted = d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const today = new Date();
        let age = today.getFullYear() - year;
        const m = today.getMonth() - month;
        if (m < 0 || (m === 0 && today.getDate() < day)) {
          age--;
        }
        return { formatted, age: age >= 0 ? age : null };
      }
    }
    const d = new Date(dobStr);
    if (!isNaN(d.getTime())) {
      return {
        formatted: d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        age: null,
      };
    }
  } catch (_) {}
  return { formatted: dobStr, age: null };
};

/**
 * Format gender key into clean presentation label
 */
export const formatGenderDisplay = (gender?: string | null): string | null => {
  if (!gender) return null;
  const g = gender.trim().toLowerCase();
  switch (g) {
    case 'male':
      return 'Male';
    case 'female':
      return 'Female';
    case 'other':
      return 'Other';
    case 'prefer_not_to_say':
      return 'Prefer not to say';
    default:
      return gender.charAt(0).toUpperCase() + gender.slice(1);
  }
};
