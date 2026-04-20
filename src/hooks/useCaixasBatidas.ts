import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export type CaixasBatidasMapa = {
  mapa: string;
  data: string;
  fator: number;
  valor_caixa: number;
  caixas: number;
  valor: number;
  role: string;
};

export type CaixasBatidasDetalhes = {
  tipo: 'caixas_batidas';
  mes: string;
  worker_type: string;
  valor_bruto: number;
  teto: number;
  teto_atingido: boolean;
  valor_cortado: number;
  total_caixas: number;
  qtd_mapas: number;
  mapas: CaixasBatidasMapa[];
};

export type CaixasBatidasRule = {
  id: string;
  fator_0: number;
  fator_1: number;
  fator_2: number;
  teto_motorista: number;
  teto_ajudante: number;
};

const firstDayOf = (mes: string) => `${mes}-01`;

export function useCaixasBatidasColaborador(userId: string | undefined, mes: string) {
  return useQuery({
    queryKey: ['caixas_batidas_colab', userId, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_incentives_daily')
        .select('*')
        .eq('user_id', userId!)
        .eq('data_referencia', firstDayOf(mes));
      if (error) throw error;
      const found = (data ?? []).find((r: any) => (r.detalhes_json as any)?.tipo === 'caixas_batidas');
      if (!found) return null;
      return {
        valor_estimado: Number(found.valor_estimado),
        detalhes: found.detalhes_json as unknown as CaixasBatidasDetalhes,
      };
    },
    enabled: !!userId,
  });
}

export function useCaixasBatidasAdminMes(mes: string) {
  return useQuery({
    queryKey: ['caixas_batidas_admin', mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_incentives_daily')
        .select('*, users:user_id(nome, matricula, worker_type)')
        .eq('data_referencia', firstDayOf(mes));
      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => (r.detalhes_json as any)?.tipo === 'caixas_batidas')
        .map((r: any) => ({
          user_id: r.user_id,
          nome: r.users?.nome ?? '—',
          matricula: r.users?.matricula ?? '',
          worker_type: r.users?.worker_type ?? '—',
          valor_final: Number(r.valor_estimado),
          detalhes: r.detalhes_json as CaixasBatidasDetalhes,
        }));
    },
  });
}

export function useCaixasBatidasRule() {
  return useQuery({
    queryKey: ['caixas_batidas_rule'],
    queryFn: async (): Promise<CaixasBatidasRule | null> => {
      const { data: indicator } = await supabase
        .from('indicators')
        .select('id')
        .eq('codigo', 'CX_BATIDAS')
        .maybeSingle();
      if (!indicator) return null;
      const { data: rules } = await supabase
        .from('incentive_rules')
        .select('*')
        .eq('indicator_id', indicator.id)
        .eq('ativo', true);
      const rule = (rules ?? []).find((r: any) => (r.regra_json as any)?.tipo === 'caixas_batidas');
      if (!rule) return null;
      const cfg = rule.regra_json as any;
      return {
        id: rule.id,
        fator_0: Number(cfg.fator_0 ?? 0.19),
        fator_1: Number(cfg.fator_1 ?? 0.18),
        fator_2: Number(cfg.fator_2 ?? 0.06),
        teto_motorista: Number(cfg.teto_motorista ?? 624),
        teto_ajudante: Number(cfg.teto_ajudante ?? 416),
      };
    },
  });
}

export function useUpdateCaixasBatidasRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: CaixasBatidasRule) => {
      const { error } = await supabase
        .from('incentive_rules')
        .update({
          regra_json: {
            tipo: 'caixas_batidas',
            fator_0: cfg.fator_0,
            fator_1: cfg.fator_1,
            fator_2: cfg.fator_2,
            teto_motorista: cfg.teto_motorista,
            teto_ajudante: cfg.teto_ajudante,
          },
        })
        .eq('id', cfg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caixas_batidas_rule'] });
    },
  });
}

export function useRecalcCaixasBatidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mes?: string) => {
      const m = mes ?? format(new Date(), 'yyyy-MM');
      const { data, error } = await supabase.functions.invoke('calculate-caixas-batidas', { body: { mes: m } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caixas_batidas_admin'] });
      qc.invalidateQueries({ queryKey: ['caixas_batidas_colab'] });
    },
  });
}
