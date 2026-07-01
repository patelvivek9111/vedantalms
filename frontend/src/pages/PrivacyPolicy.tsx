import React from 'react';
import { Link } from 'react-router-dom';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-gray-500">Last updated: July 1, 2026</p>

        <h2>Information we collect</h2>
        <p>
          We collect account information (name, email, role), course activity (submissions, grades,
          messages), login metadata (IP address, browser), and files you upload.
        </p>

        <h2>How we use information</h2>
        <p>
          Data is used to deliver learning services, protect academic records (FERPA-oriented
          controls), send notifications you opt into, and maintain platform security.
        </p>

        <h2>Data retention & deletion</h2>
        <p>
          Login activity is retained for 150 days. Administrators may delete accounts and
          associated data. Contact your institution administrator for data requests.
        </p>

        <h2>Third-party processors</h2>
        <p>
          Files may be stored on Cloudinary. Email is sent via configured SMTP. Video meetings may
          use Zoho Meeting when enabled by your institution.
        </p>

        <h2>Contact</h2>
        <p>Questions about privacy should be directed to your institution administrator.</p>

        <p>
          <Link to="/signup" className="text-indigo-600 dark:text-indigo-400">
            Back to sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
