import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { Receipt, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeductionEntry {
  id: string;
  data_referencia: string;
  valor_meta: number;
  valor_realizado: number;
  percentual_atingimento: number;
  valor_desconto: number;
  motivo: string;
  indicators: { nome: string; codigo: string } | null;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function getMonthOptions() {
  const options: { value: string; label: string; start: string; end: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = subMonths(now, i);
    const s = startOfMonth(d);
    const e = endOfMonth(d);
    options.push({
      value: format(s, 'yyyy-MM'),
      label: format(s, "MMMM 'de' yyyy", { locale: ptBR }),
      start: format(s, 'yyyy-MM-dd'),
      end: format(e, 'yyyy-MM-dd'),
    });
  }
  return options;
}

export function ExtratoDescontos({ userId }: { userId: string }) {
  const months = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [expanded, setExpanded] = useState(true);

  const month = months.find(m => m.value === selectedMonth)!;

  const { data: deductions = [], isLoading } = useQuery({
    queryKey: ['incentive_deductions', 'extrato', userId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('incentive_deductions' as any) as any)
        .select('*, indicators(nome, codigo)')
        .eq('user_id', userId)
        .gte('data_referencia', month.start)
        .lte('data_referencia', month.end)
        .order('data_referencia', { ascending: false });
      if (error) throw error;
      return data as DeductionEntry[];
    },
    enabled: !!userId,
  });

  const totalDescontos = deductions.reduce((s, d) => s + d.valor_desconto, 0);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Receipt className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-bold text-foreground">Extrato de Descontos</h2>
            <p className="text-[10px] text-muted-foreground">Holerite de metas mensal</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Month selector */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value} className="capitalize">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : deductions.length === 0 ? (
            <EmptyState
              titulo="Nenhum desconto"
              descricao="Sem descontos registrados neste mês. Continue assim! 🎉"
              icon={<TrendingDown className="h-8 w-8" />}
            />
          ) : (
            <>
              {/* Summary bar */}
              <div className="rounded-xl bg-destructive/5 border border-destructive/15 p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Total de Descontos</p>
                  <p className="text-lg font-bold text-destructive">{fmtBRL(totalDescontos)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">{deductions.length} desconto{deductions.length > 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Deduction list */}
              <div className="rounded-xl border border-border divide-y divide-border/40 overflow-hidden">
                {deductions.map(d => (
                  <div key={d.id} className="px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground truncate flex-1">
                        {d.indicators?.nome ?? 'Indicador'}
                      </span>
                      <span className="text-xs font-bold text-destructive ml-2 shrink-0">
                        -{fmtBRL(d.valor_desconto)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                      <span>{format(new Date(d.data_referencia + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                      <span>•</span>
                      <span>Meta: {d.valor_meta}</span>
                      <span>•</span>
                      <span>Real: {d.valor_realizado}</span>
                      <span>•</span>
                      <span className={cn(
                        'font-semibold',
                        d.percentual_atingimento >= 90 ? 'text-warning' : 'text-destructive'
                      )}>
                        {d.percentual_atingimento.toFixed(1)}%
                      </span>
                    </div>
                    {d.motivo && (
                      <p className="text-[10px] text-muted-foreground italic truncate">
                        💬 {d.motivo}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
