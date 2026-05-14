'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('兩次密碼不一致');
      return;
    }

    if (password.length < 8) {
      setError('密碼至少需要 8 個字元');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? '註冊失敗');
        return;
      }

      router.push('/settings');
    } catch {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel space-y-4 rounded-lg p-6">
      {error && (
        <div className="rounded-md border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-slate-600">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="glass-control w-full rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-sky-400/60 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="displayName" className="block text-sm font-medium text-slate-600">
          顯示名稱 <span className="text-slate-400">（選填）</span>
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="glass-control w-full rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-sky-400/60 focus:outline-none"
          placeholder="你的名字"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-slate-600">
          密碼 <span className="text-slate-400">（至少 8 個字元）</span>
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="glass-control w-full rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-sky-400/60 focus:outline-none"
          placeholder="••••••••"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-600">
          確認密碼
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="glass-control w-full rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-sky-400/60 focus:outline-none"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="aqua-button w-full rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '註冊中…' : '建立帳號'}
      </button>
    </form>
  );
}
