import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Spotify AI DJ</h1>
          <p className="mt-2 text-zinc-400">登入你的帳號</p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-zinc-400">
          還沒有帳號？{' '}
          <a href="/auth/register" className="text-emerald-400 hover:text-emerald-300">
            立即註冊
          </a>
        </p>
      </div>
    </div>
  );
}
