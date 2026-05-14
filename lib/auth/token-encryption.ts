import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTED_TOKEN_PREFIX = 'enc:v1';
const IV_BYTE_LENGTH = 12;

export class TokenEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenEncryptionError';
  }
}

function getEncryptionKey(): Buffer {
  return createHash('sha256')
    .update(process.env.NEXTAUTH_SECRET ?? '')
    .digest();
}

export function encryptSpotifyRefreshToken(refreshToken: string): string {
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_TOKEN_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptSpotifyRefreshToken(storedRefreshToken: string): string {
  if (!storedRefreshToken.startsWith(`${ENCRYPTED_TOKEN_PREFIX}:`)) {
    return storedRefreshToken;
  }

  const [, , iv, authTag, ciphertext] = storedRefreshToken.split(':');

  if (!iv || !authTag || !ciphertext) {
    throw new TokenEncryptionError('Encrypted Spotify refresh token is malformed.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new TokenEncryptionError('Encrypted Spotify refresh token could not be decrypted.');
  }
}
