import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseMapasOptions {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
}

export function useMapas(options: UseMapasOptions = {}) {
  const { dateFrom, dateTo } = options;
  const { data: mapas = [], isLoading, refetch } = useQuery({
    queryKey: ['mapas', dateFrom ?? null, dateTo ?? null],
    queryFn: async () => {
      const allRows: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        let q = supabase
          .from('mapa_historico')
          .select('*')
          .order('data_operacao', { ascending: false })
          .range(from, from + pageSize - 1);
        if (dateFrom) q = q.gte('data_operacao', dateFrom);
        if (dateTo) q = q.lte('data_operacao', dateTo);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    },
    staleTime: 5 * 60_000,
  });

  return { mapas, loading: isLoading, refetch };
}
