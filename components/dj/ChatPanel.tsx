type Message = {
  role: 'user' | 'assistant';
  text: string;
};

const mockMessages: Message[] = [
  { role: 'user', text: '我想聽爵士，想學一點，不要太硬。' },
  {
    role: 'assistant',
    text: '先從旋律清楚的 vocal jazz 進入，再接 piano trio，最後用 cool jazz 練習聽留白。',
  },
];

const mockModes = ['Jazz Intro', 'Classical Intro', 'Work Focus'];

export default function ChatPanel() {
  return (
    <section className="min-h-[620px] rounded-lg border border-zinc-800 bg-zinc-900 p-5 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">AI DJ Chat</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            輸入情境後產生搜尋策略、播放邏輯與導聆方向。
          </p>
        </div>
        <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
          Mock
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {mockModes.map((mode) => (
          <button
            key={mode}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-emerald-400 hover:text-white"
            type="button"
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {mockMessages.map((message, index) => (
          <div
            key={index}
            className={`rounded-lg border p-4 ${
              message.role === 'assistant'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-zinc-100'
                : 'border-zinc-700 bg-zinc-950 text-zinc-200'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              {message.role}
            </p>
            <p className="mt-2 leading-7">{message.text}</p>
          </div>
        ))}
      </div>

      <form className="mt-6 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <textarea
          className="h-32 w-full resize-none rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-400"
          placeholder="請輸入你的音樂需求..."
          readOnly
        />
        <button
          className="rounded-md bg-emerald-500 px-5 py-3 text-base font-semibold text-zinc-950 hover:bg-emerald-400"
          type="button"
        >
          送出需求（mock）
        </button>
      </form>
    </section>
  );
}
