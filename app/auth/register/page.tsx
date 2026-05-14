import RegisterForm from './RegisterForm';

export default function RegisterPage() {
  return (
    <div className="liquid-shell flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Spotify AI DJ</h1>
          <p className="mt-2 text-slate-500">建立你的帳號</p>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-slate-500">
          已有帳號？{' '}
          <a href="/auth/login" className="aqua-link">
            立即登入
          </a>
        </p>
      </div>
    </div>
  );
}
