import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import FloatingLabelInput from '../components/common/FloatingLabelInput';
import FloatingLabelPasswordInput from '../components/common/FloatingLabelPasswordInput';

export function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { tenant } = useTenant();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(
    () => tenant?.brand?.displayName || tenant?.name || 'MySl8te',
    [tenant]
  );

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token');
      setLoading(false);
      return;
    }
    api
      .get(`/auth/invites/${token}`)
      .then((res) => {
        if (res.data?.success) {
          setEmail(res.data.data.email);
          setRole(res.data.data.role);
        } else {
          setError('Invitation not found');
        }
      })
      .catch(() => setError('Invitation is invalid or expired'))
      .finally(() => setLoading(false));
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/accept-invite', {
        token,
        firstName,
        lastName,
        password,
      });
      navigate('/login', { replace: true, state: { message: 'Account created. Please sign in.' } });
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Could not accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Join {title}</h1>
        <p className="mt-1 text-sm text-slate-500">Accept your invitation to create an account.</p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading invitation…</p>
        ) : error && !email ? (
          <p className="mt-6 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Invited as <span className="font-medium">{role}</span> · {email}
            </p>
            <FloatingLabelInput
              id="invite-first"
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <FloatingLabelInput
              id="invite-last"
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <FloatingLabelPasswordInput
              id="invite-password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create account'}
            </button>
            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-600">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
