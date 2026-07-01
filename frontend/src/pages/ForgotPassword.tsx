import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import FloatingLabelInput from '../components/common/FloatingLabelInput';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message || 'If an account exists, a reset link has been sent.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
          Forgot password
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-400">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          <FloatingLabelInput
            id="email"
            name="email"
            type="email"
            label="Email address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="text-center text-sm">
          <Link to="/login" className="text-indigo-600 dark:text-indigo-400">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
