import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import FloatingLabelPasswordInput from '../components/common/FloatingLabelPasswordInput';
import { validatePassword, passwordPolicyHint } from '../utils/passwordPolicy';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid reset link. Request a new one.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const check = validatePassword(password);
    if (!check.valid) {
      setError(check.message || 'Invalid password');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password, confirmPassword });
      navigate('/login', { replace: true, state: { message: 'Password reset. Please sign in.' } });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
          Reset password
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          <FloatingLabelPasswordInput
            id="password"
            name="password"
            label="New password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText={passwordPolicyHint()}
          />
          <FloatingLabelPasswordInput
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Reset password'}
          </button>
        </form>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-indigo-600 dark:text-indigo-400">
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}
