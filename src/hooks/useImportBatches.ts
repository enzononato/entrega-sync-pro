import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ImportBatchTipo =
  | 'mapas'
  | 'rating'
  | 'refugo_031134'
  | 'reposicao_031805'
  | 'colaboradores'
  | 'pdv_critico';

export interface ImportBatch {
  id: string;
  tipo: ImportBatchTipo;
  status: 'preview' | 'confirmed' | 'undone';
  arquivo_nome: string;
  total_linhas: number;
  linhas_inseridas: number;
  linhas_duplicadas: number;
  linhas_invalidas: number;
  payload_preview: any[];
  metadata: Record<string, any>;
  imported_by: string | null;
  confirmed_at: string | null;
  undone_at: string | null;
  undone_by: string | null;
  created_at: string;
}

const TARGET_TABLE: Record<ImportBatchTipo, string> = {
  mapas: 'mapa_historico',
  rating: 'rating_avaliacoes',
  refugo_031134: 'refugo_031134',
  reposicao_031805: 'reposicao_031805',
  colaboradores: 'users',
  pdv_critico: 'pdv_critico_feedbacks',
};

export const TIPO_LABEL: Record<ImportBatchTipo, string> = {
  mapas: 'Mapas',
  rating: 'Rating',
  refugo_031134: '03.11.34 (Refugo)',
  reposicao_031805: '03.18.05 (Reposição)',
  colaboradores: 'Colaboradores',
  pdv_critico: 'PDV Crítico',
};

export function useImportBatches(tipo?: ImportBatchTipo) {
  return useQuery({
    queryKey: ['import_batches', tipo ?? 'all'],
    queryFn: async () => {
      let q = (supabase.from('import_batches' as any) as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (tipo) q = q.eq('tipo', tipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ImportBatch[];
    },
  });
}

/**
 * Cria um lote (registra a importação). Retorna o id para ser usado no insert.
 */
export async function createImportBatch(input: {
  tipo: ImportBatchTipo;
  arquivo_nome: string;
  total_linhas: number;
  linhas_inseridas: number;
  linhas_duplicadas: number;
  linhas_invalidas: number;
  payload_preview: any[];
  metadata?: Record<string, any>;
}): Promise<string> {
  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = await (supabase.from('import_batches' as any) as any)
    .insert({
      ...input,
      metadata: input.metadata ?? {},
      imported_by: authData.user?.id ?? null,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

export function useUndoImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (batch: ImportBatch) => {
      const tableName = TARGET_TABLE[batch.tipo];

      // Para Colaboradores, NÃO deletamos usuários (poderia quebrar referências).
      // Em vez disso desativamos os criados naquele lote.
      if (batch.tipo === 'colaboradores') {
        const { error } = await (supabase.from('users') as any)
          .update({ ativo: false })
          .eq('import_batch_id', batch.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from(tableName as any) as any)
          .delete()
          .eq('import_batch_id', batch.id);
        if (error) throw error;
      }

      const { data: authData } = await supabase.auth.getUser();
      const { error: upErr } = await (supabase.from('import_batches' as any) as any)
        .update({
          status: 'undone',
          undone_at: new Date().toISOString(),
          undone_by: authData.user?.id ?? null,
        })
        .eq('id', batch.id);
      if (upErr) throw upErr;

      // Recalcular indicadores quando aplicável
      const datasAfetadas: string[] = batch.metadata?.datas ?? [];
      if (datasAfetadas.length && batch.tipo !== 'colaboradores' && batch.tipo !== 'rating' && batch.tipo !== 'pdv_critico') {
        try {
          await supabase.functions.invoke('calculate-daily-indicators', {
            body: { data_referencia: datasAfetadas },
          });
        } catch (e) {
          console.warn('Falha ao recalcular indicadores no undo:', e);
        }
      }

      // PDV Crítico: limpar entradas de user_indicator_daily geradas pelo lote
      if (batch.tipo === 'pdv_critico') {
        const meses: string[] = batch.metadata?.meses ?? [];
        const indicatorId: string | undefined = batch.metadata?.indicator_id;
        if (meses.length && indicatorId) {
          try {
            await (supabase.from('user_indicator_daily') as any)
              .delete()
              .eq('indicator_id', indicatorId)
              .eq('mapa_numero', 'MENSAL')
              .in('data_referencia', meses);
          } catch (e) {
            console.warn('Falha ao limpar indicador PDV Crítico no undo:', e);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import_batches'] });
    },
  });
}