import { useEffect, useState } from 'react';
import {
  fetchAcademicSettings,
  type InstitutionMode,
} from '../../services/academicApi';
import { getRegistrarModeFlags } from './registrarMode';

export function useRegistrarMode() {
  const [mode, setMode] = useState<InstitutionMode>('mixed');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAcademicSettings();
        if (!cancelled) {
          setMode((res.data?.institutionMode as InstitutionMode) || 'mixed');
        }
      } catch {
        if (!cancelled) setMode('mixed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flags = getRegistrarModeFlags(mode);
  return { mode, loading, flags, isSchool: mode === 'school', isCollege: mode === 'college' };
}
