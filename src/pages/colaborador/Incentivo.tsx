import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useIncentivoDiario, useIncentivoDiarioHistorico, type IncentiveDailyRow } from '@/hooks/useIncentivoDiario';
import { useIncentivos } from '@/hooks/useIncentivos';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Loader2 } from 'lucide-react';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function IncentivoColaborador() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: incentivo, isLoading: loadInc } = useIncentivoDiario(user?.id, today);
  const { data: historico = [], isLoading: loadHist } = useIncentivoDiarioHistorico(user?.id, 7);
  const { data: regras = [] } = useIncentivos({ worker_type: user?.worker_type ?? undefined, ativo: 'true' });
  const { data: desempenho = [] } = useDesempenhoDiario(today, { user_id: user?.id });

  // Build calculation breakdown
  const breakdown = useMemo(() => {
    return regras.map(r => {
      const d = desempenho.find(x => x.indicator_id === r.indicator_id);
      const pct = d?.percentual_atingimento ?? 0;
      const status = d?.status ?? 'abaixo_meta';
      // simplified calc: linear between min and max based on pct
      let valorGerado = 0;
      if (pct >= 100) valorGerado = r.valor_maximo * r.peso;
      else if (pct >= 90) valorGerado = r.valor_minimo + (r.valor_maximo - r.valor_minimo) * ((pct - 90) / 10) * r.peso;
      return {
        indicador: r.indicators?.nome ?? '',
        peso: r.peso,
        meta: r.meta,
        valor: d?.valor ?? 0,
        pct,
        status,
        valorGerado: Math.round(valorGerado * 100) / 100,
      };
    });
  }, [regras, desempenho]);

  const totalEstimado = breakdown.reduce((s, b) => s + b.valorGerado, 0);

  // Chart data
  const chartData = useMemo(() =>
    [...historico].reverse().map(h => ({
      data: format(new Date(h.data_referencia + 'T00:00:00'), 'dd/MM'),
      valor: h.valor_fechado ?? h.valor_estimado,
    })),
  [historico]);

  if (loadInc) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Incentivo</h1>

      {/* Card Incentivo de Hoje */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm text-center">
        <p className="text-4xl font-bold text-foreground">{fmtBRL(incentivo?.valor_estimado ?? totalEstimado)}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <StatusBadge status={incentivo?.status ?? 'estimado'} />
          <span className="text-xs text-muted-foreground">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</span>
        </div>
        {incentivo?.status === 'fechado' && incentivo.valor_fechado != null && (
          <div className="mt-2 text-sm text-muted-foreground">
            <span>Valor final: <strong className="text-foreground">{fmtBRL(incentivo.valor_fechado)}</strong></span>
            <span className="mx-2">vs</span>
            <span>Estimado: {fmtBRL(incentivo.valor_estimado)}</span>
          </div>
        )}
      </div>

      {/* Card Como é Calculado */}
      {breakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Como é Calculado</h3>
          <div className="space-y-3">
            {breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{b.indicador}</p>
                  <p className="text-xs text-muted-foreground">Peso {b.peso} • Meta {b.meta} • Seu: {b.valor}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-xs">{b.pct.toFixed(1)}%</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-xs font-medium text-foreground">{fmtBRL(b.valorGerado)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-semibold text-foreground">Total estimado</span>
              <span className="text-lg font-bold text-foreground">{fmtBRL(totalEstimado)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Histórico 7 dias */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3">Últimos 7 Dias</h3>
        {loadHist ? (
          <Skeleton className="h-32 w-full" />
        ) : chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData}>
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [fmtBRL(v), 'Valor']} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left p-1.5">Data</th><th className="text-right p-1.5">Estimado</th><th className="text-right p-1.5">Fechado</th><th className="text-right p-1.5">Status</th>
                </tr></thead>
                <tbody>
                  {[...historico].reverse().map(h => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="p-1.5 text-foreground">{format(new Date(h.data_referencia + 'T00:00:00'), 'dd/MM')}</td>
                      <td className="p-1.5 text-right">{fmtBRL(h.valor_estimado)}</td>
                      <td className="p-1.5 text-right">{h.valor_fechado != null ? fmtBRL(h.valor_fechado) : '—'}</td>
                      <td className="p-1.5 text-right"><StatusBadge status={h.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState titulo="Sem histórico de incentivos" icon={<DollarSign className="h-10 w-10" />} />
        )}
      </div>
    </div>
  );
}
