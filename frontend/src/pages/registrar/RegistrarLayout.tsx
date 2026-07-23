import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { MobileAppShell } from '../../components/common/MobileAppShell';
import { useAuth } from '../../contexts/AuthContext';

const NAV = [
  { to: '/registrar/dashboard', label: 'Dashboard', roles: ['admin', 'registrar', 'department_admin', 'platform_admin'] },
  { to: '/registrar/terms', label: 'Terms', roles: ['admin', 'registrar', 'department_admin', 'platform_admin'] },
  { to: '/registrar/students', label: 'Students', roles: ['admin', 'registrar', 'department_admin', 'platform_admin'] },
  { to: '/registrar/programs', label: 'Programs', roles: ['admin', 'registrar', 'department_admin', 'platform_admin'] },
  { to: '/registrar/sections', label: 'Sections', roles: ['admin', 'registrar', 'department_admin', 'platform_admin'] },
  { to: '/registrar/grades', label: 'Grade status', roles: ['admin', 'registrar', 'department_admin', 'platform_admin'] },
  { to: '/registrar/transcripts', label: 'Transcripts', roles: ['admin', 'registrar', 'platform_admin'] },
  { to: '/registrar/reports', label: 'Reports', roles: ['admin', 'registrar', 'department_admin', 'platform_admin'] },
  { to: '/registrar/operations', label: 'Operations', roles: ['admin', 'registrar', 'department_admin', 'platform_admin'] },
  { to: '/registrar/sis', label: 'SIS', roles: ['admin', 'registrar', 'platform_admin'] },
  { to: '/registrar/settings', label: 'Settings', roles: ['admin', 'registrar', 'department_admin', 'platform_admin'] },
] as const;

export function RegistrarLayout() {
  const { user } = useAuth();
  const role = user?.role || '';
  const links = NAV.filter((n) => (n.roles as readonly string[]).includes(role));

  return (
    <MobileAppShell title="Registrar">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Registrar Office</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Terms, enrollments, grade status, transcripts, and reports.
            </p>
          </div>
          <Link
            to={role === 'admin' || role === 'platform_admin' ? '/admin' : '/account'}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {role === 'admin' || role === 'platform_admin' ? 'Admin home' : 'Account'}
          </Link>
        </div>

        <nav className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm rounded-md ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </MobileAppShell>
  );
}

export default RegistrarLayout;
