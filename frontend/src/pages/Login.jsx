import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { ErrorNote, Spinner } from '../components/ui/Feedback';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(params.get('expired') ? 'Your session expired. Sign in again.' : '');
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label="Loading" />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/cashier'} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(form.username.trim(), form.password);
      navigate(u.role === 'admin' ? '/admin' : '/cashier', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-ink text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9h16v11H4V9Zm0 0 2-5h12l2 5M9 20v-6h6v6" />
            </svg>
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Store POS</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to open the till</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-card">
          <ErrorNote message={error} />

          <Field label="Username or email" required>
            <Input
              name="username"
              autoComplete="username"
              autoFocus
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="admin"
            />
          </Field>

          <Field label="Password" required>
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </Field>

          <Button type="submit" size="lg" loading={busy} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Just browsing?{' '}
          <a href="/shop" className="font-medium text-brand-600 underline underline-offset-2">
            View the product list
          </a>
        </p>
      </div>
    </div>
  );
}
