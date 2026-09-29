import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

const { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } = naclUtil;

export interface KeyPairBase64 {
  publicKey: string;
  secretKey: string;
}

export interface E2eeEnvelope {
  alg: 'x25519-xsalsa20-poly1305';
  v: 1;
  nonce: string;
  cipher: string;
  senderPubKey: string;
  recipientPubKey?: string;
}

const E2EE_ARMOR_HEADER = '-----BEGIN SANDESH E2EE MESSAGE-----';
const E2EE_ARMOR_FOOTER = '-----END SANDESH E2EE MESSAGE-----';

const STORAGE_PREFIX = 'sandesh_e2ee_sk_';

/**
 * Generates a new Curve25519 (X25519) keypair for zero-knowledge end-to-end encryption.
 */
export function generateKeyPair(): KeyPairBase64 {
  const pair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(pair.publicKey),
    secretKey: encodeBase64(pair.secretKey),
  };
}

/**
 * Retrieves the local user's secret key from browser storage.
 * Note: The private key NEVER leaves this device and is never transmitted to any server.
 */
export function getLocalSecretKey(userId: string): string | null {
  if (!userId) return null;
  return localStorage.getItem(`${STORAGE_PREFIX}${userId}`) || null;
}

/**
 * Stores the private key securely in local device storage.
 */
export function saveLocalSecretKey(userId: string, secretKey: string): void {
  if (!userId || !secretKey) return;
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, secretKey);
}

/**
 * Clears local key on account wipe/logout if needed.
 */
export function clearLocalSecretKey(userId: string): void {
  if (!userId) return;
  localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
}

/**
 * Ensures a valid keypair exists for the current user.
 * If none exists, generates one, saves the secret key locally, and provides the public key
 * to be registered on the server.
 */
export function ensureUserKeyPair(
  userId: string,
  existingPublicKey?: string | null
): { publicKey: string; secretKey: string; needsUpload: boolean } {
  let secretKey = getLocalSecretKey(userId);

  if (secretKey) {
    try {
      const skBytes = decodeBase64(secretKey);
      if (skBytes.length === nacl.box.secretKeyLength) {
        // Derive public key from existing secret key
        const pair = nacl.box.keyPair.fromSecretKey(skBytes);
        const derivedPubKey = encodeBase64(pair.publicKey);
        const needsUpload = !existingPublicKey || existingPublicKey !== derivedPubKey;
        return {
          publicKey: derivedPubKey,
          secretKey,
          needsUpload,
        };
      }
    } catch (e) {
      console.warn('Failed to parse existing local secret key, regenerating...', e);
    }
  }

  // Generate fresh keypair
  const newPair = generateKeyPair();
  saveLocalSecretKey(userId, newPair.secretKey);

  return {
    publicKey: newPair.publicKey,
    secretKey: newPair.secretKey,
    needsUpload: true,
  };
}

/**
 * Computes a human-readable cryptographic fingerprint for public key verification.
 * Similar to Signal safety numbers. Format: XXXX-XXXX-XXXX-XXXX
 */
export function getPublicKeyFingerprint(publicKeyBase64?: string | null): string {
  if (!publicKeyBase64) return 'UNREGISTERED';
  try {
    const bytes = decodeBase64(publicKeyBase64);
    if (!bytes || bytes.length !== 32) return 'INITIALIZING KEY';
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0').toUpperCase();
    }
    // Group in chunks of 4 characters (up to 32 characters / 8 chunks)
    return hex.slice(0, 32).match(/.{1,4}/g)?.join(' ') || hex;
  } catch {
    return 'INVALID KEY';
  }
}

/**
 * Checks if a given text payload represents a Sandesh End-to-End Encrypted message.
 */
export function isEncryptedMessage(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return (
    trimmed.startsWith(E2EE_ARMOR_HEADER) &&
    trimmed.endsWith(E2EE_ARMOR_FOOTER)
  );
}

/**
 * Encrypts a plaintext message using Curve25519 key agreement + XSalsa20-Poly1305 authenticated encryption.
 * The resulting payload can only be decrypted by the holder of the recipient's private key
 * (or the sender's private key for viewing sent history).
 */
export function encryptMessage(
  plainText: string,
  recipientPublicKeyBase64: string,
  senderSecretKeyBase64: string,
  senderPublicKeyBase64?: string
): string {
  if (!recipientPublicKeyBase64) {
    throw new Error('Recipient has no public encryption key registered.');
  }
  if (!senderSecretKeyBase64) {
    throw new Error('Sender private encryption key not found on this device.');
  }

  const recipientPubKey = decodeBase64(recipientPublicKeyBase64);
  const senderSecKey = decodeBase64(senderSecretKeyBase64);

  if (recipientPubKey.length !== nacl.box.publicKeyLength) {
    throw new Error(`Invalid recipient public key length (${recipientPubKey.length}). Expected 32 bytes.`);
  }
  if (senderSecKey.length !== nacl.box.secretKeyLength) {
    throw new Error(`Invalid sender secret key length (${senderSecKey.length}). Expected 32 bytes.`);
  }

  // Derive sender public key if not explicitly supplied
  let senderPubKey = senderPublicKeyBase64;
  if (!senderPubKey) {
    const senderPair = nacl.box.keyPair.fromSecretKey(senderSecKey);
    senderPubKey = encodeBase64(senderPair.publicKey);
  }

  const messageBytes = decodeUTF8(plainText);

  // 24-byte cryptographically secure random nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Encrypt using authenticated NaCl box
  const cipherBytes = nacl.box(messageBytes, nonce, recipientPubKey, senderSecKey);

  const envelope: E2eeEnvelope = {
    alg: 'x25519-xsalsa20-poly1305',
    v: 1,
    nonce: encodeBase64(nonce),
    cipher: encodeBase64(cipherBytes),
    senderPubKey: senderPubKey,
    recipientPubKey: recipientPublicKeyBase64,
  };

  const jsonString = JSON.stringify(envelope);
  const base64Envelope = encodeBase64(decodeUTF8(jsonString));

  return `${E2EE_ARMOR_HEADER}\n${base64Envelope}\n${E2EE_ARMOR_FOOTER}`;
}

/**
 * Decrypts an end-to-end encrypted message envelope.
 * Works seamlessly whether the viewer is the recipient or the sender (sent history),
 * utilizing Curve25519 Diffie-Hellman symmetry.
 */
export function decryptMessage(
  armoredText: string,
  userSecretKeyBase64: string,
  peerPublicKeyBase64?: string
): { success: boolean; text: string; error?: string; senderPubKey?: string } {
  if (!isEncryptedMessage(armoredText)) {
    return { success: true, text: armoredText };
  }

  if (!userSecretKeyBase64) {
    return {
      success: false,
      text: '[End-to-End Encrypted Message. Private key not present on this device.]',
      error: 'Private key missing on this device.',
    };
  }

  try {
    const rawBody = armoredText
      .replace(E2EE_ARMOR_HEADER, '')
      .replace(E2EE_ARMOR_FOOTER, '')
      .trim();

    const jsonString = encodeUTF8(decodeBase64(rawBody));
    const envelope: E2eeEnvelope = JSON.parse(jsonString);

    if (envelope.alg !== 'x25519-xsalsa20-poly1305') {
      return {
        success: false,
        text: '[Unsupported encryption algorithm]',
        error: 'Unsupported algorithm',
      };
    }

    const nonceBytes = decodeBase64(envelope.nonce);
    const cipherBytes = decodeBase64(envelope.cipher);
    const mySecKeyBytes = decodeBase64(userSecretKeyBase64);

    // Derive my public key to determine whether I am the sender or recipient
    const myPair = nacl.box.keyPair.fromSecretKey(mySecKeyBytes);
    const myPubKeyBase64 = encodeBase64(myPair.publicKey);

    // Determine the peer's public key
    let otherPeerPubKeyBase64 = '';

    if (envelope.senderPubKey && envelope.recipientPubKey) {
      if (myPubKeyBase64 === envelope.senderPubKey) {
        // I sent this message -> peer is recipient
        otherPeerPubKeyBase64 = envelope.recipientPubKey;
      } else {
        // I received this message -> peer is sender
        otherPeerPubKeyBase64 = envelope.senderPubKey;
      }
    } else if (envelope.senderPubKey) {
      if (myPubKeyBase64 === envelope.senderPubKey && peerPublicKeyBase64) {
        otherPeerPubKeyBase64 = peerPublicKeyBase64;
      } else {
        otherPeerPubKeyBase64 = envelope.senderPubKey;
      }
    } else if (peerPublicKeyBase64) {
      otherPeerPubKeyBase64 = peerPublicKeyBase64;
    }

    if (!otherPeerPubKeyBase64) {
      return {
        success: false,
        text: '[End-to-End Encrypted Message. Peer public key unavailable for verification.]',
        error: 'Missing peer public key',
      };
    }

    const otherPeerPubKeyBytes = decodeBase64(otherPeerPubKeyBase64);

    // Attempt decryption
    let decryptedBytes = nacl.box.open(cipherBytes, nonceBytes, otherPeerPubKeyBytes, mySecKeyBytes);

    // If initial attempt failed and an alternate peer public key is provided, try fallback
    if (!decryptedBytes && peerPublicKeyBase64 && peerPublicKeyBase64 !== otherPeerPubKeyBase64) {
      try {
        const fallbackBytes = decodeBase64(peerPublicKeyBase64);
        decryptedBytes = nacl.box.open(cipherBytes, nonceBytes, fallbackBytes, mySecKeyBytes);
      } catch {}
    }

    if (!decryptedBytes) {
      return {
        success: false,
        text: '[End-to-End Encrypted Message. Cryptographic signature check or key mismatch.]',
        error: 'Authentication failed / invalid key',
      };
    }

    const decryptedText = encodeUTF8(decryptedBytes);
    return {
      success: true,
      text: decryptedText,
      senderPubKey: envelope.senderPubKey || otherPeerPubKeyBase64,
    };
  } catch (err: any) {
    return {
      success: false,
      text: '[Encrypted message payload could not be decoded.]',
      error: err.message || 'Decryption error',
    };
  }
}
