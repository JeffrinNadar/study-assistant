import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { login, signup } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isLogin && password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = isLogin
        ? await login(email, password)
        : await signup(email, password);
      setAuth(res.access_token, res.email);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let message = 'Something went wrong';
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0];
        const field = first?.loc?.[first.loc.length - 1];
        if (field === 'password') {
          message = 'Password must be between 8 and 128 characters.';
        } else if (field === 'email') {
          message = 'Please enter a valid email address.';
        } else if (typeof first?.msg === 'string') {
          message = first.msg;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper bg-ruled">
      <div className="w-full max-w-sm rounded-lg bg-cream border border-ruled p-8 shadow-lg rotate-[-0.5deg] hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center justify-center gap-2 mb-6">
          <BookOpen size={28} className="text-pencil" />
          <h1 className="font-hand text-3xl text-pencil">Study Assistant</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-charcoal-light">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={error ? 'auth-error' : undefined}
              className="w-full rounded-md border border-ruled bg-white px-3 py-2 text-sm text-charcoal focus:border-pencil focus:outline-none focus:ring-1 focus:ring-pencil dark:bg-chalk-bg dark:border-chalk-muted dark:text-chalk-text"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-charcoal-light">
              Password{!isLogin && <span className="font-normal text-charcoal-light/60"> (min. 8 characters)</span>}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={isLogin ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? 'auth-error' : undefined}
              className="w-full rounded-md border border-ruled bg-white px-3 py-2 text-sm text-charcoal focus:border-pencil focus:outline-none focus:ring-1 focus:ring-pencil dark:bg-chalk-bg dark:border-chalk-muted dark:text-chalk-text"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p id="auth-error" role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 border border-red-200">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-pencil px-4 py-2 text-sm font-medium text-white hover:bg-pencil-dark disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : isLogin ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-charcoal-light">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="font-medium text-pencil hover:underline"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
