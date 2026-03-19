import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * Checks if the collaborator has unaddressed below-target indicators today.
 * Returns the list of indicators that still need a feedback/root-cause submission.
 */
export function usePendingMandatoryFeedback(userId?: string) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['mandatory_feedback_check', userId, today],
    queryFn: async () => {
      // 1. Get today's below-target indicators
      const { data: belowTarget, error: e1 } = await supabase
        .from('user_indicator_daily')
        .select('id, indicator_id, valor, meta, percentual_atingimento, indicators(nome, codigo)')
        .eq('user_id', userId!)
        .eq('data_referencia', today)
        .eq('status', 'abaixo_meta');
      if (e1) throw e1;
      if (!belowTarget || belowTarget.length === 0) return [];

      // 2. Check which already have a root_cause_record for today
      const { data: existingCauses, error: e2 } = await (supabase.from('root_cause_records' as any) as any)
        .select('indicator_id')
        .eq('user_id', userId!)
        .eq('data_referencia', today);
      if (e2) throw e2;

      const coveredIds = new Set((existingCauses ?? []).map((c: any) => c.indicator_id));

      // 3. Return only uncovered indicators
      return belowTarget.filter(i => !coveredIds.has(i.indicator_id));
    },
    enabled: !!userId,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
