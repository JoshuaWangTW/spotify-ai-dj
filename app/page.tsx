import { cookies } from 'next/headers';
import AiDjWorkspace from '../components/dj/AiDjWorkspace';

async function getSessionUser(): Promise<{ displayName: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('spotify_ai_dj_session');
  if (!sessionCookie?.value) return null;

  const lastDot = sessionCookie.value.lastIndexOf('.');
  if (lastDot === -1) return null;

  const encodedPayload = sessionCookie.value.slice(0, lastDot);
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      displayName?: string;
    };
    return { displayName: payload.displayName ?? 'User' };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const sessionUser = await getSessionUser();

  return (
    <main className="liquid-shell min-h-screen px-4 py-6 text-slate-700 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
        <header className="glass-panel flex flex-col gap-4 rounded-lg px-5 py-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-600">
              Spotify AI DJ
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold text-slate-800 md:text-4xl">
              Personal music companion for jazz, classical, and focused listening.
            </h1>
          </div>
          <div className="glass-card flex flex-col gap-3 rounded-lg px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center">
            {sessionUser && <span className="text-slate-600">{sessionUser.displayName}</span>}
            <a
              href="/settings"
              className="glass-control rounded-md px-3 py-1.5 text-center text-sm text-slate-600 transition hover:border-sky-400/50 hover:text-white"
            >
              設定
            </a>
            <a
              href="/api/auth/logout"
              className="glass-control rounded-md px-3 py-1.5 text-center text-sm text-slate-600 transition hover:border-sky-400/50 hover:text-white"
            >
              登出
            </a>
            <a
              className="aqua-button rounded-md px-3 py-2 text-center text-sm font-semibold transition"
              href="/api/auth/spotify/login"
            >
              Connect Spotify
            </a>
          </div>
        </header>

        <AiDjWorkspace />
      </div>
    </main>
  );
}
