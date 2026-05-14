import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSpotifySession } from '../../../lib/auth/session';
import { prisma } from '../../../lib/db/prisma';
import { encryptSecret, decryptSecret } from '../../../lib/auth/token-encryption';

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  try {
    const decrypted = decryptSecret(value);
    if (decrypted.length <= 4) return '••••';
    return '•'.repeat(decrypted.length - 4) + decrypted.slice(-4);
  } catch {
    return '••••';
  }
}

export async function GET(request: NextRequest) {
  const session = getSpotifySession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { spotifyClientId: true, spotifyClientSecret: true, openaiApiKey: true },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    spotifyClientId: maskSecret(user.spotifyClientId),
    hasSpotifySecret: Boolean(user.spotifyClientSecret),
    hasOpenaiKey: Boolean(user.openaiApiKey),
  });
}

const updateSettingsSchema = z.object({
  spotifyClientId: z.string().min(1).optional(),
  spotifyClientSecret: z.string().min(1).optional(),
  openaiApiKey: z.string().min(1).optional(),
});

export async function PUT(request: NextRequest) {
  const session = getSpotifySession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const data: Record<string, string> = {};
  if (parsed.data.spotifyClientId) data.spotifyClientId = encryptSecret(parsed.data.spotifyClientId);
  if (parsed.data.spotifyClientSecret) data.spotifyClientSecret = encryptSecret(parsed.data.spotifyClientSecret);
  if (parsed.data.openaiApiKey) data.openaiApiKey = encryptSecret(parsed.data.openaiApiKey);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data });

  return NextResponse.json({ ok: true });
}
