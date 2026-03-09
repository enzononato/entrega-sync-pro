import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FeedbackWithRelations {
  id: string; user_id: string; unidade_id: string | null; rota_id: string | null;
  data_referencia: string; tipo: string; titulo: string; descricao: string;
  urgencia: string; status: string; resposta_lideranca: string | null;
  respondido_por: string | null; responded_at: string | null; created_at: string;
  users: { nome: string; worker_type: string | null } | null;
  units: { nome: string } | null; routes: { nome: string } | null;
}

export function useFeedbacks(filters?: { status?: string; urgencia?: string; tipo?: string; unidade_id?: string }) {
  return useQuery({
    queryKey: ['feedbacks', filters],
    queryFn: async () => {
      let q = (supabase.from('feedbacks' as any) as any)
        .select('*, users:users!feedbacks_user_id_fkey(nome, worker_type), units(nome), routes(nome)')
        .order('created_at', { ascending: false });
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.urgencia) q = q.eq('urgencia', filters.urgencia);
      if (filters?.tipo) q = q.eq('tipo', filters.tipo);
      if (filters?.unidade_id) q = q.eq('unidade_id', filters.unidade_id);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as FeedbackWithRelations[];
    },
  });
}

export function useFeedbacksDoColaborador(userId?: string) {
  return useQuery({
    queryKey: ['feedbacks', 'byUser', userId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('feedbacks' as any) as any)
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as FeedbackWithRelations[];
    },
    enabled: !!userId,
  });
}

export function useCreateFeedback() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (row: { user_id: string; unidade_id?: string | null; rota_id?: string | null; data_referencia: string; tipo: string; titulo: string; descricao: string; urgencia: string }) => {
      const { data, error } = await (supabase.from('feedbacks' as any) as any).insert({ ...row, status: 'aberto' }).select().single();
      if (error) throw error; return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feedbacks'] }); toast({ title: 'Feedback enviado!' }); },
    onError: () => { toast({ title: 'Erro ao enviar feedback.', variant: 'destructive' }); },
  });
}

export function useResponderFeedback() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, resposta, status, respondido_por }: { id: string; resposta: string; status: string; respondido_por: string }) => {
      const { error } = await (supabase.from('feedbacks' as any) as any).update({
        resposta_lideranca: resposta, status, respondido_por, responded_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feedbacks'] }); toast({ title: 'Resposta salva!' }); },
    onError: () => { toast({ title: 'Erro ao responder.', variant: 'destructive' }); },
  });
}

export function useEncerrarFeedback() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('feedbacks' as any) as any).update({ status: 'encerrado' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feedbacks'] }); toast({ title: 'Feedback encerrado!' }); },
    onError: () => { toast({ title: 'Erro ao encerrar.', variant: 'destructive' }); },
  });
}
