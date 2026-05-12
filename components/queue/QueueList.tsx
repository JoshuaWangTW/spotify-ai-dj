type Track = {
  title: string;
  artist: string;
  album: string;
  reason: string;
  energy: 'Low' | 'Medium';
};

const mockQueue: Track[] = [
  {
    title: 'My Funny Valentine',
    artist: 'Chet Baker',
    album: 'Chet Baker Sings',
    reason: '旋律清楚，人聲比例低壓，適合先進入狀態。',
    energy: 'Low',
  },
  {
    title: 'Waltz for Debby',
    artist: 'Bill Evans',
    album: 'Waltz for Debby',
    reason: '聽鋼琴、低音與鼓之間的互動，難度仍保持入門。',
    energy: 'Medium',
  },
  {
    title: 'So What',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    reason: '用 modal jazz 的留白收尾，讓銜接從旋律轉向空間感。',
    energy: 'Medium',
  },
];

export default function QueueList() {
  return (
    <section className="min-h-[620px] rounded-lg border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Queue / Recommendations</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">AI plan 的 mock queue 與推薦理由。</p>
        </div>
        <span className="rounded-md bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-300">
          3 tracks
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {mockQueue.map((track) => (
          <article key={track.title} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{track.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{track.artist}</p>
                <p className="text-sm text-zinc-500">{track.album}</p>
              </div>
              <span className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
                {track.energy}
              </span>
            </div>
            <p className="mt-4 border-l-2 border-emerald-400 pl-3 text-sm leading-6 text-zinc-300">
              {track.reason}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
