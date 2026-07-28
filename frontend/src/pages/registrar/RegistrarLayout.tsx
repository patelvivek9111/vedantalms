import React from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { MobileAppShell } from '../../components/common/MobileAppShell';
import { useAuth } from '../../contexts/AuthContext';
import { ru } from './registrarUi';
import { useRegistrarMode } from './useRegistrarMode';
import type { RegistrarNavId } from './registrarMode';

const NAV: {
  id: RegistrarNavId;
  to: string;
  label: string;
  roles: readonly string[];
}[] = [
  { id: 'dashboard', to: '/registrar/dashboard', label: 'Dashboard', roles: ['admin', 'registrar', 'department_admin'] },
  { id: 'terms', to: '/registrar/terms', label: 'Terms', roles: ['admin', 'registrar', 'department_admin'] },
  { id: 'students', to: '/registrar/students', label: 'Students', roles: ['admin', 'registrar', 'department_admin'] },
  { id: 'programs', to: '/registrar/programs', label: 'Programs', roles: ['admin', 'registrar', 'department_admin'] },
  { id: 'sections', to: '/registrar/sections', label: 'Sections', roles: ['admin', 'registrar', 'department_admin'] },
  { id: 'grades', to: '/registrar/grades', label: 'Grade status', roles: ['admin', 'registrar', 'department_admin'] },
  { id: 'transcripts', to: '/registrar/transcripts', label: 'Transcripts', roles: ['admin', 'registrar'] },
  { id: 'reports', to: '/registrar/reports', label: 'Reports', roles: ['admin', 'registrar', 'department_admin'] },
  { id: 'operations', to: '/registrar/operations', label: 'Operations', roles: ['admin', 'registrar', 'department_admin'] },
  { id: 'sis', to: '/registrar/sis', label: 'SIS', roles: ['admin', 'registrar'] },
  { id: 'settings', to: '/registrar/settings', label: 'Settings', roles: ['admin', 'registrar', 'department_admin'] },
];

export function RegistrarLayout() {
  const { user } = useAuth();
  const { flags, mode, loading } = useRegistrarMode();
  const location = useLocation();
  const role = user?.role || '';
  const links = NAV.filter(
    (n) => (n.roles as readonly string[]).includes(role) && flags.nav.includes(n.id)
  );
  const homeTo = role === 'admin' ? '/dashboard' : '/account';
  const homeLabel = role === 'admin' ? 'Admin home' : 'Account';

  // If current path is hidden for this mode, bounce to dashboard
  const pathAllowed = links.some(
    (l) => location.pathname === l.to || location.pathname.startsWith(`${l.to}/`)
  );
  if (
    !loading &&
    location.pathname.startsWith('/registrar') &&
    location.pathname !== '/registrar' &&
    location.pathname !== '/registrar/' &&
    !pathAllowed &&
    !location.pathname.startsWith('/registrar/students/')
  ) {
    return <Navigate to="/registrar/dashboard" replace />;
  }

  const modeBadge =
    mode === 'school' ? 'School mode' : mode === 'college' ? 'College mode' : 'Mixed mode';

  return (
    <MobileAppShell title="Registrar">
      <div className={ru.shell}>
        <div className={ru.container}>
          <header className={ru.headerRow}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-400">
                  Academic records
                </p>
                <span className={ru.pill}>{modeBadge}</span>
              </div>
              <h1 className={ru.title}>Registrar Office</h1>
              <p className={ru.subtitle}>{flags.subtitle}</p>
            </div>
            <Link to={homeTo} className={ru.backLink}>
              <span aria-hidden>←</span>
              {homeLabel}
            </Link>
          </header>

          <nav className={ru.nav} aria-label="Registrar sections">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? ru.navLinkActive : ru.navLink)}
              >
                {flags.navLabels[item.id] || item.label}
              </NavLink>
            ))}
          </nav>

          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </MobileAppShell>
  );
}

export default RegistrarLayout;
