import React from 'react';
import { Link } from 'react-router-dom';

export function RegistrarSettings() {
  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 max-w-xl">
      <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Settings (stub)</h2>
      <p>
        Institution grading policy, holds defaults, and programs will live here in later phases. For now
        use existing admin tools:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <Link className="text-blue-600 hover:underline" to="/registrar/programs">
            Programs
          </Link>{' '}
          — degree / stream catalog
        </li>
        <li>
          <Link className="text-blue-600 hover:underline" to="/admin/settings">
            Admin system settings
          </Link>{' '}
          — institution calendar / grading defaults
        </li>
        <li>
          <Link className="text-blue-600 hover:underline" to="/admin/accounts">
            Sub-accounts
          </Link>{' '}
          — department tree
        </li>
        <li>
          <Link className="text-blue-600 hover:underline" to="/registrar/operations">
            Operations
          </Link>{' '}
          — holds & SIS
        </li>
      </ul>
    </div>
  );
}

export default RegistrarSettings;
