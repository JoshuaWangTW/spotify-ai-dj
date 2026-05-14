import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <div className="liquid-shell flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-50">Spotify AI DJ</h1>
          <p className="mt-2 text-slate-400">登入你的帳號</p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-slate-400">
          還沒有帳號？{' '}
          <a href="/auth/register" className="aqua-link">
            立即註冊
          </a>
        </p>
      </div>
    </div>
  );
}
