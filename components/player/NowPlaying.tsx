const mockTrack = {
  title: 'Waltz for Debby',
  artist: 'Bill Evans',
  album: 'Waltz for Debby',
  progress: '2:14',
  duration: '5:55',
  progressPercent: 38,
  isPlaying: true,
};

export default function NowPlaying() {
  return (
    <section className="min-h-[620px] rounded-lg border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Now Playing</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Spotify Web Playback SDK placeholder.
          </p>
        </div>
        <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
          Demo
        </span>
      </div>

      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <div className="aspect-square rounded-lg bg-[linear-gradient(135deg,#10b981_0%,#0f766e_36%,#18181b_36%,#18181b_100%)]" />
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">正在播放</p>
          <p className="mt-2 text-2xl font-semibold text-white">{mockTrack.title}</p>
          <p className="mt-1 text-zinc-400">{mockTrack.artist}</p>
          <p className="text-sm text-zinc-500">{mockTrack.album}</p>
        </div>

        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${mockTrack.progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm text-zinc-500">
            <span>{mockTrack.progress}</span>
            <span>{mockTrack.duration}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <button
            className="rounded-md bg-zinc-800 px-3 py-3 text-sm text-zinc-100 hover:bg-zinc-700"
            type="button"
          >
            上一首
          </button>
          <button
            className="rounded-md bg-emerald-500 px-3 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            type="button"
          >
            {mockTrack.isPlaying ? '暫停' : '播放'}
          </button>
          <button
            className="rounded-md bg-zinc-800 px-3 py-3 text-sm text-zinc-100 hover:bg-zinc-700"
            type="button"
          >
            下一首
          </button>
        </div>
      </div>
    </section>
  );
}
