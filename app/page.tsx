// app/page.tsx — mobile-shell entrypoint
// Replaces the previous desktop layout. Existing session/auth logic preserved.
import { cookies } from 'next/headers';

import MobileShell, { type SessionUser } from '../components/mobile/MobileShell';

async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('spotify_ai_dj_session');
  if (!sessionCookie?.value) return null;

  const lastDot = sessionCookie.value.lastIndexOf('.');
  if (lastDot === -1) return null;

  const encodedPayload = sessionCookie.value.slice(0, lastDot);
  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as { displayName?: string; spotifyConnected?: boolean };
    return {
      displayName: payload.displayName ?? 'User',
      spotifyConnected: payload.spotifyConnected === true,
    };
  } catch {
    return null;
  }
}

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const sessionUser = await getSessionUser();
  const params = await searchParams;
  const authResult = typeof params.auth === 'string' ? params.auth : null;
  const authError = typeof params.auth_error === 'string' ? params.auth_error : null;

  const spotifyConnected =
    authResult === 'spotify_connected' || sessionUser?.spotifyConnected === true;

  const banner =
    authResult === 'spotify_connected' ? (
      <div className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Spotify 連線成功！現在可以送出需求產生播放清單。
      </div>
    ) : authError === 'spotify_denied' ? (
      <div className="rounded-md border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Spotify 授權被取消。請再次連結。
      </div>
    ) : sessionUser && !spotifyConnected ? (
      <div className="rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        尚未連接 Spotify。請到 Profile 分頁完成授權。
      </div>
    ) : null;

  return <MobileShell sessionUser={sessionUser} authBanner={banner} />;
}
