import React from 'react';
import { Link } from 'react-router-dom';

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-sm text-gray-500">Last updated: July 1, 2026</p>

        <h2>Acceptable use</h2>
        <p>
          You agree to use this platform for legitimate educational purposes, respect academic
          integrity, and not attempt to access data or accounts that are not yours.
        </p>

        <h2>Accounts</h2>
        <p>
          You are responsible for safeguarding your credentials. Staff roles are assigned by
          administrators — self-registration creates student accounts only.
        </p>

        <h2>Academic records</h2>
        <p>
          Grades, submissions, and related records are protected under institutional policies.
          Unauthorized access attempts are logged.
        </p>

        <h2>Suspension</h2>
        <p>
          Administrators may suspend accounts that violate these terms or institutional policies.
        </p>

        <p>
          <Link to="/signup" className="text-indigo-600 dark:text-indigo-400">
            Back to sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
