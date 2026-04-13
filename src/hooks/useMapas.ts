import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useMapas() {
  const { data: mapas = [], isLoading, refetch } = useQuery({
    queryKey: ['mapas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapa_historico')
        .select('*')
        .order('data_operacao', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  return { mapas, loading: isLoading, refetch };
}
