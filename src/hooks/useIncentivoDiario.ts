import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface IncentiveDailyRow {
  id: string; user_id: string; data_referencia: string;
  valor_estimado: number; valor_fechado: number | null;
  status: string; detalhes_json: Record<string, unknown>; created_at: string;
}

export interface IncentiveDailyWithUser extends IncentiveDailyRow {
  users: { nome: string; worker_type: string | null } | null;
}

export function useIncentivoDiario(userId?: string, data?: string) {
  return useQuery({
    queryKey: ['user_incentives_daily', userId, data],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('user_incentives_daily' as any)
        .select('*')
        .eq('user_id', userId!)
        .eq('data_referencia', data!)
        .maybeSingle();
      if (error) throw error;
      return rows as IncentiveDailyRow | null;
    },
    enabled: !!userId && !!data,
  });
}

export function useIncentivoDiarioHistorico(userId?: string, days = 30) {
  return useQuery({
    queryKey: ['user_incentives_daily', 'historico', userId, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_incentives_daily' as any)
        .select('*')
        .eq('user_id', userId!)
        .order('data_referencia', { ascending: false })
        .limit(days);
      if (error) throw error;
      return data as IncentiveDailyRow[];
    },
    enabled: !!userId,
  });
}

export function useIncentivoDiarioAdmin(data: string) {
  return useQuery({
    queryKey: ['user_incentives_daily', 'admin', data],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('user_incentives_daily' as any)
        .select('*, users(nome, worker_type)')
        .eq('data_referencia', data)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return rows as IncentiveDailyWithUser[];
    },
  });
}

export function useCreateIncentivoDiario() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (row: { user_id: string; data_referencia: string; valor_estimado: number; status?: string; detalhes_json?: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('user_incentives_daily' as any)
        .upsert(
          { ...row, status: row.status ?? 'estimado', detalhes_json: row.detalhes_json ?? {} },
          { onConflict: 'user_id,data_referencia' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user_incentives_daily'] }); toast({ title: 'Incentivo salvo!' }); },
    onError: () => { toast({ title: 'Erro ao salvar incentivo.', variant: 'destructive' }); },
  });
}

export function useFecharIncentivo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, valor_fechado }: { id: string; valor_fechado: number }) => {
      const { error } = await supabase
        .from('user_incentives_daily' as any)
        .update({ status: 'fechado', valor_fechado })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user_incentives_daily'] }); toast({ title: 'Incentivo fechado!' }); },
    onError: () => { toast({ title: 'Erro ao fechar incentivo.', variant: 'destructive' }); },
  });
}
