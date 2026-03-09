import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  created_at: string;
}

interface AuditFilters {
  table_name?: string;
  action?: string;
  from?: string;
  to?: string;
}

export function useAuditLogs(filters?: AuditFilters) {
  return useQuery({
    queryKey: ['audit_logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters?.table_name) query = query.eq('table_name', filters.table_name);
      if (filters?.action) query = query.eq('action', filters.action);
      if (filters?.from) query = query.gte('created_at', filters.from);
      if (filters?.to) query = query.lte('created_at', filters.to + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AuditLog[];
    },
  });
}
