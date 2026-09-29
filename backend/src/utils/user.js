import { toEmailAddress } from './phone.js';

/**
 * Strips sensitive fields like passwordHash and shapes the user object for API responses.
 * @param {import('mongoose').Document | object} userDoc
 * @returns {object} Safe user object
 */
export function formatUserResponse(userDoc) {
  if (!userDoc) return null;
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };

  const { passwordHash, __v, ...safeUser } = user;

  const id = (safeUser._id ? safeUser._id.toString() : safeUser.id) || '';

  return {
    id,
    _id: id,
    phone: safeUser.phone,
    email: toEmailAddress(safeUser.phone),
    displayName: safeUser.displayName ?? '',
    dob: safeUser.dob ?? null,
    gender: safeUser.gender ?? null,
    profilePictureUrl: safeUser.profilePictureUrl ?? null,
    profilePictureGridFsId: safeUser.profilePictureGridFsId ? safeUser.profilePictureGridFsId.toString() : null,
    hasSetPassword: Boolean(safeUser.hasSetPassword),
    createdVia: safeUser.createdVia ?? 'web',
    aliasIds: safeUser.aliasIds ?? [],
    publicKey: safeUser.publicKey ?? null,
    createdAt: safeUser.createdAt,
    updatedAt: safeUser.updatedAt || safeUser.createdAt,
  };
}
