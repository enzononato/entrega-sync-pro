import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useMapas() {
  const { data: mapas = [], isLoading, refetch } = useQuery({
    queryKey: ['mapas'],
    queryFn: async () => {
      const allRows: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('mapa_historico')
          .select('*')
          .order('data_operacao', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    },
  });

  return { mapas, loading: isLoading, refetch };
}
