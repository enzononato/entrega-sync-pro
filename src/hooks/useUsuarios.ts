import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserUnit {
  unit_id: string;
  units: { nome: string } | null;
}

export interface UserWithRelations {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  matricula: string;
  cpf: string | null;
  role: string;
  worker_type: string | null;
  unidade_id: string | null;
  rota_id: string | null;
  ativo: boolean;
  created_at: string;
  units: { nome: string } | null;
  routes: { nome: string } | null;
  user_units?: UserUnit[];
}

interface UsersFilters {
  nome?: string;
  worker_type?: string;
  unidade_id?: string;
  ativo?: string;
}

export function useUsuarios(filters?: UsersFilters) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      let query = supabase.from('users').select('*, units(nome), routes(nome), user_units(unit_id, units(nome))').order('nome');
      if (filters?.nome) query = query.ilike('nome', `%${filters.nome}%`);
      if (filters?.worker_type) query = query.eq('worker_type', filters.worker_type);
      if (filters?.unidade_id) query = query.eq('unidade_id', filters.unidade_id);
      if (filters?.ativo === 'true') query = query.eq('ativo', true);
      if (filters?.ativo === 'false') query = query.eq('ativo', false);
      const { data, error } = await query;
      if (error) throw error;
      return data as UserWithRelations[];
    },
  });
}

export function useUsuario(id: string | undefined) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*, units(nome), routes(nome), user_units(unit_id, units(nome))').eq('id', id!).single();
      if (error) throw error;
      return data as UserWithRelations;
    },
    enabled: !!id,
  });
}

export function useUserUnits(userId: string | undefined) {
  return useQuery({
    queryKey: ['user_units', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_units')
        .select('unit_id, units(nome)')
        .eq('user_id', userId!);
      if (error) throw error;
      return data as UserUnit[];
    },
    enabled: !!userId,
  });
}

export function useCreateUsuario() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      email: string; password: string; nome: string; matricula: string;
      cpf?: string | null;
      role: string; worker_type: string | null; unidade_id: string | null; rota_id: string | null;
      unit_ids?: string[];
    }) => {
      const { unit_ids, ...rest } = payload;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-user', {
        body: rest,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      // Save user_units associations
      if (unit_ids && unit_ids.length > 0 && res.data?.user_id) {
        const rows = unit_ids.map(uid => ({ user_id: res.data.user_id, unit_id: uid }));
        const { error } = await supabase.from('user_units').insert(rows);
        if (error) console.error('Error inserting user_units:', error);
      }

      return res.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['user_units'] }); toast({ title: 'Colaborador criado com sucesso!' }); },
    onError: (e: Error) => { toast({ title: e.message || 'Erro ao criar colaborador.', variant: 'destructive' }); },
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, unit_ids, ...data }: { id: string; nome?: string; email?: string; matricula?: string; role?: string; worker_type?: string | null; unidade_id?: string | null; rota_id?: string | null; ativo?: boolean; unit_ids?: string[] }) => {
      const { error } = await supabase.from('users').update(data).eq('id', id);
      if (error) throw error;

      // Sync user_units if provided
      if (unit_ids !== undefined) {
        // Delete existing
        await supabase.from('user_units').delete().eq('user_id', id);
        // Insert new
        if (unit_ids.length > 0) {
          const rows = unit_ids.map(uid => ({ user_id: id, unit_id: uid }));
          const { error: insertErr } = await supabase.from('user_units').insert(rows);
          if (insertErr) throw insertErr;
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['user_units'] }); toast({ title: 'Colaborador atualizado!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar.', variant: 'destructive' }); },
  });
}

export function useToggleUsuarioAtivo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('users').update({ ativo: !ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'Status atualizado!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar status.', variant: 'destructive' }); },
  });
}
