import { useQuery } from '@tanstack/react-query';
import { getUserPreferences } from '../services/api';

export const userPreferencesQueryKey = ['user', 'preferences'] as const;

export function useUserPreferencesQuery(enabled = true) {
  return useQuery({
    queryKey: userPreferencesQueryKey,
    queryFn: async () => {
      const res = await getUserPreferences();
      return res.data?.preferences || {};
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
