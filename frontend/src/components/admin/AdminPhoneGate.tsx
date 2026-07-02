import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminPhoneDevice } from '../../utils/adminPhoneAccess';
import { AdminPhoneBlocked } from './AdminPhoneBlocked';

export function AdminPhoneGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isPhone = useAdminPhoneDevice();

  if (user?.role === 'admin' && isPhone) {
    return <AdminPhoneBlocked />;
  }

  return <>{children}</>;
}
