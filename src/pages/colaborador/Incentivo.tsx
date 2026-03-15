import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useIncentivoDiario, useIncentivoDiarioHistorico, type IncentiveDailyRow } from '@/hooks/useIncentivoDiario';
import { useIncentivos } from '@/hooks/useIncentivos';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useDescontosColaborador } from '@/hooks/useDescontos';
import { CircularProgress } from '@/components/shared/CircularProgress';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DollarSign, Loader2, TrendingUp, Calendar, Target, AlertTriangle, TrendingDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function IncentivoColaborador() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: incentivo, isLoading: loadInc } = useIncentivoDiario(user?.id, today);
  const { data: historico = [], isLoading: loadHist } = useIncentivoDiarioHistorico(user?.id, 30);
  const { data: regras = [] } = useIncentivos({ worker_type: user?.worker_type ?? undefined, ativo: 'true' });
  const { data: desempenho = [] } = useDesempenhoDiario(today, { user_id: user?.id });
  const { data: descontos = [] } = useDescontosColaborador(user?.id, 60);

  const breakdown = useMemo(() => {
    return regras.map(r => {
      const d = desempenho.find(x => x.indicator_id === r.indicator_id);
      const pct = d?.percentual_atingimento ?? 0;
      const status = d?.status ?? 'abaixo_meta';
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
  const valorHoje = incentivo?.valor_estimado ?? totalEstimado;

  const mesHistorico = useMemo(() => {
    const mesAtual = format(new Date(), 'yyyy-MM');
    return historico.filter(h => h.data_referencia.startsWith(mesAtual));
  }, [historico]);

  const bonusAcumulado = mesHistorico.reduce((s, h) => s + (h.valor_fechado ?? h.valor_estimado), 0);
  const diasComDados = mesHistorico.length;
  const metaMensal = 1000;
  const pctProjecao = metaMensal > 0 ? Math.min(100, (bonusAcumulado / metaMensal) * 100) : 0;

  // Descontos do mês atual
  const mesAtualStr = format(new Date(), 'yyyy-MM');
  const descontosMes = useMemo(() => {
    return descontos.filter(d => d.data_referencia.startsWith(mesAtualStr));
  }, [descontos, mesAtualStr]);

  const totalDescontos = descontosMes.reduce((s, d) => s + d.valor_desconto, 0);
  const liquidoMes = bonusAcumulado - totalDescontos;

  const chartData = useMemo(() =>
    [...historico].slice(0, 7).reverse().map(h => ({
      data: format(new Date(h.data_referencia + 'T00:00:00'), 'dd/MM'),
      valor: h.valor_fechado ?? h.valor_estimado,
    })),
  [historico]);

  const metaDiariaAtingida = useMemo(() => {
    if (breakdown.length === 0) return '—';
    const atingidas = breakdown.filter(b => b.pct >= 100).length;
    return `${atingidas}/${breakdown.length}`;
  }, [breakdown]);

  if (loadInc) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5 stagger-children">
      <h1 className="text-xl font-bold text-foreground">Remuneração Variável</h1>

      {/* Hero card */}
      <div className="rounded-2xl overflow-hidden shadow-lg">
        <div className="gradient-hero p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Bônus acumulado no mês</p>
              <p className="text-3xl font-bold mt-1">{fmtBRL(bonusAcumulado)}</p>
              <p className="text-xs text-white/50 mt-1">
                {diasComDados} dia{diasComDados !== 1 ? 's' : ''} contabilizado{diasComDados !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-card p-4 grid grid-cols-3 divide-x divide-border/40">
          <div className="text-center pr-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Hoje</p>
            <p className="text-base font-bold text-foreground mt-0.5">{fmtBRL(valorHoje)}</p>
          </div>
          <div className="text-center px-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Descontos</p>
            <p className={cn("text-base font-bold mt-0.5", totalDescontos > 0 ? "text-destructive" : "text-foreground")}>
              {totalDescontos > 0 ? `-${fmtBRL(totalDescontos)}` : fmtBRL(0)}
            </p>
          </div>
          <div className="text-center pl-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Metas</p>
            <p className="text-base font-bold text-foreground mt-0.5">{metaDiariaAtingida}</p>
          </div>
        </div>
      </div>

      {/* Líquido do mês */}
      {totalDescontos > 0 && (
        <div className="card-elevated p-4 border-l-[3px] border-l-destructive">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Líquido estimado no mês</p>
              <p className="text-xs text-muted-foreground">Bônus - Descontos por metas não atingidas</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{fmtBRL(liquidoMes)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Projeção Mensal */}
      <div className="card-elevated p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Meta Mensal</h3>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-lg font-bold text-foreground">{fmtBRL(bonusAcumulado)}</span>
            <span className="text-sm text-muted-foreground"> / {fmtBRL(metaMensal)}</span>
          </div>
          <span className="text-sm font-bold text-primary">{pctProjecao.toFixed(0)}%</span>
        </div>
        <ProgressBar value={pctProjecao} color="blue" className="h-2.5" />
        {metaMensal > bonusAcumulado && (
          <p className="text-xs text-muted-foreground">
            Faltam <span className="font-semibold text-primary">{fmtBRL(metaMensal - bonusAcumulado)}</span> para atingir a meta
          </p>
        )}
      </div>

      {/* Gráfico de evolução */}
      <div className="card-elevated p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Evolução Diária</h3>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Últimos 7 dias</span>
        </div>
        {loadHist ? (
          <Skeleton className="h-36 w-full rounded-lg" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [fmtBRL(v), 'Valor']}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#colorValor)"
                dot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState titulo="Sem histórico de incentivos" icon={<DollarSign className="h-10 w-10" />} />
        )}
      </div>

      {/* Breakdown */}
      {breakdown.length > 0 && (
        <div className="card-elevated overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-bold text-foreground">Detalhamento</h3>
          </div>
          <div className="divide-y divide-border/40">
            {breakdown.map((b, i) => {
              const isGood = b.status === 'acima_meta' || b.status === 'dentro_meta';
              return (
                <div key={i} className="flex items-center justify-between px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{b.indicador}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Peso {b.peso} · Meta {b.meta} · Valor {b.valor}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={cn('text-xs font-bold', isGood ? 'text-success' : 'text-destructive')}>
                      {b.pct.toFixed(0)}%
                    </span>
                    <p className="text-xs font-bold text-primary mt-0.5">{fmtBRL(b.valorGerado)}</p>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3.5 bg-primary/5">
              <span className="text-sm font-bold text-foreground">Total estimado hoje</span>
              <span className="text-lg font-bold text-primary">{fmtBRL(valorHoje)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Descontos - Transparência */}
      <div className="card-elevated overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold text-foreground">Descontos por Meta</h3>
          <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium ml-auto">
            {descontosMes.length} desconto{descontosMes.length !== 1 ? 's' : ''}
          </span>
        </div>
        {descontosMes.length > 0 ? (
          <div className="divide-y divide-border/40">
            {descontosMes.map(d => (
              <div key={d.id} className="px-4 py-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {d.indicators?.nome ?? '—'}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                      {format(new Date(d.data_referencia + 'T00:00:00'), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-destructive">-{fmtBRL(d.valor_desconto)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Meta</p>
                    <p className="font-semibold text-foreground">{d.valor_meta}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Resultado</p>
                    <p className="font-semibold text-foreground">{d.valor_realizado}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Atingimento</p>
                    <p className={cn('font-semibold', d.percentual_atingimento >= 100 ? 'text-success' : 'text-destructive')}>
                      {d.percentual_atingimento.toFixed(0)}%
                    </p>
                  </div>
                </div>
                {d.motivo && (
                  <div className="flex items-start gap-1.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5">
                    <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-800 dark:text-amber-200">{d.motivo}</p>
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3.5 bg-destructive/5">
              <span className="text-sm font-bold text-foreground">Total descontos no mês</span>
              <span className="text-lg font-bold text-destructive">-{fmtBRL(totalDescontos)}</span>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum desconto no mês</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Continue mantendo suas metas em dia! 🎯</p>
          </div>
        )}
      </div>

      {/* Descontos anteriores */}
      {descontos.filter(d => !d.data_referencia.startsWith(mesAtualStr)).length > 0 && (
        <div className="card-elevated overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-bold text-foreground">Histórico de Descontos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-left px-4 py-2 font-medium">Indicador</th>
                  <th className="text-right px-4 py-2 font-medium">Desconto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {descontos
                  .filter(d => !d.data_referencia.startsWith(mesAtualStr))
                  .slice(0, 10)
                  .map(d => (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-foreground font-medium">
                        {format(new Date(d.data_referencia + 'T00:00:00'), 'dd/MM')}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{d.indicators?.nome ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-destructive font-bold">-{fmtBRL(d.valor_desconto)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Histórico de Incentivos */}
      {historico.length > 0 && (
        <div className="card-elevated overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Histórico Recente</h3>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-right px-4 py-2 font-medium">Estimado</th>
                  <th className="text-right px-4 py-2 font-medium">Fechado</th>
                  <th className="text-right px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {historico.slice(0, 7).map(h => (
                  <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground font-medium">
                      {format(new Date(h.data_referencia + 'T00:00:00'), 'dd/MM')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground">{fmtBRL(h.valor_estimado)}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{h.valor_fechado != null ? fmtBRL(h.valor_fechado) : '—'}</td>
                    <td className="px-4 py-2.5 text-right"><StatusBadge status={h.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
