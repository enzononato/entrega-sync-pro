import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LoginAttempt {
  id: string;
  created_at: string;
  identifier: string;
  identifier_type: string;
  success: boolean;
  failure_reason: string | null;
  user_id: string | null;
  user_nome: string | null;
  user_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface LoginAttemptFilters {
  status?: 'all' | 'success' | 'failure';
  search?: string;
  from?: string;
  to?: string;
}

export function useLoginAttempts(filters?: LoginAttemptFilters) {
  return useQuery({
    queryKey: ['login_attempts', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('login_attempts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters?.status === 'success') query = query.eq('success', true);
      if (filters?.status === 'failure') query = query.eq('success', false);
      if (filters?.from) query = query.gte('created_at', filters.from);
      if (filters?.to) query = query.lte('created_at', filters.to + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data ?? []) as LoginAttempt[];
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        rows = rows.filter(r =>
          (r.identifier ?? '').toLowerCase().includes(s) ||
          (r.user_nome ?? '').toLowerCase().includes(s) ||
          (r.user_email ?? '').toLowerCase().includes(s) ||
          (r.ip_address ?? '').toLowerCase().includes(s),
        );
      }
      return rows;
    },
    refetchInterval: 30_000,
  });
}