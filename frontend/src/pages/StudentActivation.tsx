import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import FloatingLabelInput from '../components/common/FloatingLabelInput';
import { useTenant } from '../contexts/TenantContext';

const CONFIRMATION =
  "If your information matches our records, you'll receive an email shortly.";

/**
 * Public student self-service account activation.
 * Always shows the same confirmation after submit (enumeration-resistant).
 */
export function StudentActivation() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const activationEnabled = Boolean(tenant?.studentActivationEnabled);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/student-activation/claim', {
        firstName,
        middleName: middleName || undefined,
        lastName,
        studentId,
        personalEmail,
        company: company || undefined,
      });
    } catch {
      // Intentionally ignore — same confirmation either way.
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  if (tenant && !activationEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Account activation
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Self-service activation is not available for this institution. Please contact your
            registrar.
          </p>
          <p className="text-sm">
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Activate your account
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {tenant?.brand?.displayName || tenant?.name
              ? `Enter your details exactly as they appear on your ${tenant.brand?.displayName || tenant.name} records.`
              : 'Enter your details exactly as they appear on your school records.'}
          </p>
        </div>

        {submitted ? (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-700 dark:text-green-400">
            {CONFIRMATION}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            {/* Honeypot — hidden from users, bots often fill it */}
            <div className="absolute -left-[9999px] opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="company">Company</label>
              <input
                id="company"
                name="company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <FloatingLabelInput
              id="firstName"
              name="firstName"
              type="text"
              label="First name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
            <FloatingLabelInput
              id="middleName"
              name="middleName"
              type="text"
              label="Middle name (optional)"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              autoComplete="additional-name"
            />
            <FloatingLabelInput
              id="lastName"
              name="lastName"
              type="text"
              label="Last name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
            <FloatingLabelInput
              id="studentId"
              name="studentId"
              type="text"
              label="Student ID"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              autoComplete="off"
            />
            <FloatingLabelInput
              id="personalEmail"
              name="personalEmail"
              type="email"
              label="Personal email"
              required
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Activate account'}
            </button>
          </form>
        )}

        <p className="text-center text-sm">
          <Link to="/login" className="text-indigo-600 dark:text-indigo-400">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default StudentActivation;
