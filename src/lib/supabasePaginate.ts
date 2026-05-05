import { supabase } from '@/integrations/supabase/client';

/**
 * Busca todas as linhas de uma tabela contornando o limite padrão de 1000
 * registros do PostgREST, usando .range() em loop.
 *
 * @param build  função que recebe um query builder fresco e devolve a query
 *               já com .select()/.eq()/.in() etc. aplicados (SEM .range()).
 * @param pageSize  tamanho da página (default 1000).
 */
export async function fetchAllPaginated<T = any>(
  build: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // hard cap para evitar loops infinitos em caso de erro inesperado
  for (let i = 0; i < 1000; i++) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/**
 * Aplica .in(column, values) em chunks (PostgREST tem limite prático de URL).
 * Retorna a união paginada de todos os chunks.
 */
export async function fetchAllIn<T = any>(
  build: (chunk: string[]) => any,
  values: string[],
  chunkSize = 300,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    const slice = values.slice(i, i + chunkSize);
    if (!slice.length) continue;
    const rows = await fetchAllPaginated<T>(() => build(slice), pageSize);
    all.push(...rows);
  }
  return all;
}