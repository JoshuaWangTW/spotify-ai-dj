import AiDjWorkspace from '../components/dj/AiDjWorkspace';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-400">
              Spotify AI DJ
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold text-white md:text-4xl">
              Personal music companion for jazz, classical, and focused listening.
            </h1>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Spotify OAuth and Web Playback SDK ready.
            </div>
            <a
              className="rounded-md bg-emerald-500 px-3 py-2 text-center text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
              href="/api/auth/spotify/login"
            >
              Login with Spotify
            </a>
          </div>
        </header>

        <AiDjWorkspace />
      </div>
    </main>
  );
}
