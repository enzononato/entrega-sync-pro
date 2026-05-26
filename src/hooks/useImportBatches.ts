import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ImportBatchTipo =
  | 'mapas'
  | 'rating'
  | 'refugo_031134'
  | 'reposicao_031805'
  | 'colaboradores'
  | 'pdv_critico'
  | 'relatos';

export interface ImportBatch {
  id: string;
  tipo: ImportBatchTipo;
  status: 'preview' | 'confirmed' | 'undone' | 'failed';
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
  error_message?: string | null;
  imported_by_nome?: string | null;
  undone_by_nome?: string | null;
}

const TARGET_TABLE: Record<ImportBatchTipo, string> = {
  mapas: 'mapa_historico',
  rating: 'rating_avaliacoes',
  refugo_031134: 'refugo_031134',
  reposicao_031805: 'reposicao_031805',
  colaboradores: 'users',
  pdv_critico: 'pdv_critico_feedbacks',
  relatos: 'relatos_seguranca',
};

export const TIPO_LABEL: Record<ImportBatchTipo, string> = {
  mapas: 'Mapas',
  rating: 'Rating',
  refugo_031134: '03.11.34 (Refugo)',
  reposicao_031805: '03.18.05 (Reposição)',
  colaboradores: 'Colaboradores',
  pdv_critico: 'PDV Crítico',
  relatos: 'Relatos de Segurança',
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
      const batches = (data ?? []) as ImportBatch[];
      // Enriquecer com nomes de quem importou e desfez
      const authIds = Array.from(
        new Set(
          batches.flatMap(b => [b.imported_by, b.undone_by]).filter((v): v is string => !!v),
        ),
      );
      if (authIds.length > 0) {
        const { data: users } = await (supabase.from('users') as any)
          .select('auth_user_id, nome, email')
          .in('auth_user_id', authIds);
        const map = new Map<string, string>();
        (users ?? []).forEach((u: any) => map.set(u.auth_user_id, u.nome || u.email || ''));
        batches.forEach(b => {
          b.imported_by_nome = b.imported_by ? map.get(b.imported_by) ?? null : null;
          b.undone_by_nome = b.undone_by ? map.get(b.undone_by) ?? null : null;
        });
      }
      return batches;
    },
  });
}

/**
 * Marca um lote de importação como falho, registrando a mensagem de erro.
 * Útil para preservar o histórico mesmo quando a importação não foi concluída.
 */
export async function markImportBatchFailed(batchId: string, errorMessage: string): Promise<void> {
  try {
    await (supabase.from('import_batches' as any) as any)
      .update({
        status: 'failed',
        error_message: (errorMessage || 'Erro desconhecido').slice(0, 1000),
      })
      .eq('id', batchId);
  } catch (e) {
    console.warn('Falha ao marcar batch como failed:', e);
  }
}

/**
 * Cria um registro de importação já marcado como falha (quando o erro
 * ocorreu antes de termos chance de criar o batch normalmente).
 */
export async function createFailedImportBatch(input: {
  tipo: ImportBatchTipo;
  arquivo_nome: string;
  total_linhas?: number;
  error_message: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  try {
    await (supabase.from('import_batches' as any) as any).insert({
      tipo: input.tipo,
      arquivo_nome: input.arquivo_nome,
      total_linhas: input.total_linhas ?? 0,
      linhas_inseridas: 0,
      linhas_duplicadas: 0,
      linhas_invalidas: 0,
      payload_preview: [],
      metadata: input.metadata ?? {},
      imported_by: authData.user?.id ?? null,
      status: 'failed',
      error_message: (input.error_message || 'Erro desconhecido').slice(0, 1000),
    });
  } catch (e) {
    console.warn('Falha ao criar batch failed:', e);
  }
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

      // Para rating: capturar user_ids antes de deletar para limpar indicadores depois
      let ratingUserIds: string[] = [];
      if (batch.tipo === 'rating') {
        const { data: ratingRows } = await (supabase.from('rating_avaliacoes') as any)
          .select('user_id')
          .eq('import_batch_id', batch.id)
          .not('user_id', 'is', null);
        ratingUserIds = Array.from(new Set((ratingRows ?? []).map((r: any) => r.user_id).filter(Boolean)));
      }

      // Para Colaboradores, NÃO deletamos usuários (poderia quebrar referências).
      // Em vez disso desativamos os criados naquele lote.
      if (batch.tipo === 'colaboradores') {
        const { error } = await (supabase.from('users') as any)
          .update({ ativo: false })
          .eq('import_batch_id', batch.id);
        if (error) throw error;
      } else {
        const { error, count } = await (supabase.from(tableName as any) as any)
          .delete({ count: 'exact' })
          .eq('import_batch_id', batch.id);
        if (error) throw error;
        (batch as any)._deletedCount = count ?? 0;
      }

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

      // Rating: limpar user_indicator_daily mensal gerados pelo lote
      let ratingRestoreFailed = false;
      if (batch.tipo === 'rating') {
        const mes: string | undefined = batch.metadata?.mes;
        const RATING_INDICATOR_ID = '853beb35-febb-48b9-b3ae-be7173bfc6fc';
        if (mes && ratingUserIds.length) {
          const [y, m] = mes.split('-').map(Number);
          const inicio = `${y}-${String(m).padStart(2, '0')}-01`;
          try {
            await (supabase.from('user_indicator_daily') as any)
              .delete()
              .eq('indicator_id', RATING_INDICATOR_ID)
              .eq('data_referencia', inicio)
              .eq('origem_dado', 'import_rating')
              .in('user_id', ratingUserIds);
          } catch (e) {
            console.warn('Falha ao limpar indicador Rating no undo:', e);
          }
        }

        // Restaura os valores antigos a partir do snapshot guardado no metadata.
        const snapshot: any[] | undefined = batch.metadata?.snapshot;
        if (Array.isArray(snapshot) && snapshot.length) {
          try {
            const CHUNK = 500;
            let restoredUserIds = new Set<string>();
            for (let i = 0; i < snapshot.length; i += CHUNK) {
              const slice = snapshot.slice(i, i + CHUNK);
              const { error: restErr } = await (supabase as any).rpc('restore_rating_snapshot', {
                p_snapshot: slice,
              });
              if (restErr) throw restErr;
              slice.forEach((r: any) => { if (r?.user_id) restoredUserIds.add(r.user_id); });
            }

            // Recalcula os indicadores mensais para os usuários restaurados
            if (mes && restoredUserIds.size) {
              const [y, m] = mes.split('-').map(Number);
              const inicio = `${y}-${String(m).padStart(2, '0')}-01`;
              const RATING_META = 4.95;
              const RATING_DESAFIO = 5.0;
              const userIds = Array.from(restoredUserIds);
              const { data: restored } = await (supabase.from('rating_avaliacoes') as any)
                .select('user_id, rating')
                .eq('data_referencia_inicio', inicio)
                .in('user_id', userIds);
              const rows = (restored ?? [])
                .filter((r: any) => r.user_id)
                .map((r: any) => {
                  const v = Number(r.rating) || 0;
                  return {
                    user_id: r.user_id,
                    indicator_id: RATING_INDICATOR_ID,
                    data_referencia: inicio,
                    valor: v,
                    meta: RATING_META,
                    desafio: RATING_DESAFIO,
                    percentual_atingimento: (v / RATING_META) * 100,
                    status: v >= RATING_META ? 'dentro_meta' : 'abaixo_meta',
                    status_desafio: v >= RATING_DESAFIO ? 'atingiu' : 'nao_atingiu',
                    origem_dado: 'import_rating',
                    mapa_numero: 'MENSAL',
                  };
                });
              if (rows.length) {
                await (supabase.from('user_indicator_daily') as any).upsert(rows, {
                  onConflict: 'user_id,indicator_id,data_referencia',
                });
              }
            }
          } catch (e) {
            console.warn('Falha ao restaurar snapshot do Rating no undo:', e);
            ratingRestoreFailed = true;
          }
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

      // Relatos de Segurança: limpar entradas de user_indicator_daily geradas pelo lote
      if (batch.tipo === 'relatos') {
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
            console.warn('Falha ao limpar indicador Relatos no undo:', e);
          }
        }
      }

      // Marca o batch como desfeito SOMENTE depois que as restaurações críticas
      // terminaram. Se a restauração do snapshot do Rating falhou, marcamos como
      // 'failed' para evitar inconsistência silenciosa.
      const { data: authData } = await supabase.auth.getUser();
      const { error: upErr } = await (supabase.from('import_batches' as any) as any)
        .update({
          status: ratingRestoreFailed ? 'failed' : 'undone',
          undone_at: new Date().toISOString(),
          undone_by: authData.user?.id ?? null,
          error_message: ratingRestoreFailed
            ? 'Undo parcial: snapshot do Rating não pôde ser restaurado completamente.'
            : null,
        })
        .eq('id', batch.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import_batches'] });
    },
  });
}