import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidades } from '@/hooks/useUnidades';

/**
 * Returns only the units the current admin is allowed to manage.
 * If the admin has entries in user_units, only those units are returned.
 * Otherwise, all active units are returned (super-admin behaviour).
 */
export function useAllowedUnits() {
  const { user } = useAuth();
  const { data: units = [] } = useUnidades();
  const activeUnits = units.filter(u => u.ativo);

  const { data: myUserUnits } = useQuery({
    queryKey: ['my-user-units', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_units')
        .select('unit_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(r => r.unit_id);
    },
    enabled: !!user?.id,
  });

  const allowedUnits = useMemo(() => {
    if (!myUserUnits || myUserUnits.length === 0) return activeUnits;
    return activeUnits.filter(u => myUserUnits.includes(u.id));
  }, [activeUnits, myUserUnits]);

  const allowedUnitIds = useMemo(() => new Set(allowedUnits.map(u => u.id)), [allowedUnits]);

  return { allowedUnits, allowedUnitIds, isRestricted: !!myUserUnits && myUserUnits.length > 0 };
}
