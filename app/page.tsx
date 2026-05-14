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
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
        <header className="glass-panel flex flex-col gap-4 rounded-2xl p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-600">
              Spotify AI DJ
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold text-slate-700 md:text-4xl">
              Personal music companion for jazz, classical, and focused listening.
            </h1>
          </div>
          <div className="glass-card flex flex-col gap-3 rounded-xl px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center">
            {sessionUser && (
              <span className="text-zinc-400">
                {sessionUser.displayName}
              </span>
            )}
            <a
              href="/settings"
              className="liquid-pill rounded-md px-3 py-1.5 text-center text-sm transition hover:border-slate-400 hover:text-slate-700"
            >
              設定
            </a>
            <a
              href="/api/auth/logout"
              className="liquid-pill rounded-md px-3 py-1.5 text-center text-sm transition hover:border-slate-400 hover:text-slate-700"
            >
              登出
            </a>
            <a
              className="rounded-md bg-cyan-200 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-cyan-100"
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
