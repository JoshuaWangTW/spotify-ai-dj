import { NextRequest } from 'next/server';

export const SPOTIFY_SESSION_COOKIE = 'spotify_ai_dj_session';

export async function hasValidSessionCookie(request: NextRequest): Promise<boolean> {
  const cookieValue = request.cookies.get(SPOTIFY_SESSION_COOKIE)?.value;
  if (!cookieValue) return false;

  const lastDot = cookieValue.lastIndexOf('.');
  if (lastDot === -1) return false;

  const encodedPayload = cookieValue.slice(0, lastDot);
  const signatureB64 = cookieValue.slice(lastDot + 1);

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signatureBytes = base64urlToBytes(signatureB64);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(encodedPayload),
    );

    return valid;
  } catch {
    return false;
  }
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
