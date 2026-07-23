import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '../services/api';

export type TenantBrand = {
  displayName?: string;
  wordmark?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
};

export type TenantInfo = {
  rootAccountId: string;
  name: string;
  code: string;
  institutionMode?: string;
  timezone?: string;
  brand?: TenantBrand;
  authProviders?: Array<{ _id?: string; authType: string; name: string }>;
  publicRegistrationDisabled?: boolean;
};

type TenantContextValue = {
  tenant: TenantInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await api.get('/tenant/current');
      if (res.data?.success && res.data.data) {
        setTenant(res.data.data as TenantInfo);
      } else {
        setTenant(null);
      }
    } catch {
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading, refresh }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return ctx;
}
