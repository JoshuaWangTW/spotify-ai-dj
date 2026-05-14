import RegisterForm from './RegisterForm';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Spotify AI DJ</h1>
          <p className="mt-2 text-zinc-400">建立你的帳號</p>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-zinc-400">
          已有帳號？{' '}
          <a href="/auth/login" className="text-emerald-400 hover:text-emerald-300">
            立即登入
          </a>
        </p>
      </div>
    </div>
  );
}
