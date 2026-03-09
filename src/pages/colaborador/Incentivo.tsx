import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useIncentivoDiario, useIncentivoDiarioHistorico, type IncentiveDailyRow } from '@/hooks/useIncentivoDiario';
import { useIncentivos } from '@/hooks/useIncentivos';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { CircularProgress } from '@/components/shared/CircularProgress';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DollarSign, Loader2, TrendingUp, Calendar, ChevronRight } from 'lucide-react';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function IncentivoColaborador() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: incentivo, isLoading: loadInc } = useIncentivoDiario(user?.id, today);
  const { data: historico = [], isLoading: loadHist } = useIncentivoDiarioHistorico(user?.id, 30);
  const { data: regras = [] } = useIncentivos({ worker_type: user?.worker_type ?? undefined, ativo: 'true' });
  const { data: desempenho = [] } = useDesempenhoDiario(today, { user_id: user?.id });

  // Build calculation breakdown
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

  // Monthly projection
  const mesHistorico = useMemo(() => {
    const now = new Date();
    const mesAtual = format(now, 'yyyy-MM');
    return historico.filter(h => h.data_referencia.startsWith(mesAtual));
  }, [historico]);

  const bonusAcumulado = mesHistorico.reduce((s, h) => s + (h.valor_fechado ?? h.valor_estimado), 0);
  const diasComDados = mesHistorico.length;
  const diasNoMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const diasUteis = Math.round(diasNoMes * 0.72); // ~22 dias úteis
  const projecaoMensal = diasComDados > 0 ? (bonusAcumulado / diasComDados) * diasUteis : 0;
  const pctProjecao = projecaoMensal > 0 ? Math.min(100, (bonusAcumulado / projecaoMensal) * 100) : 0;

  // Chart data (last 7 days)
  const chartData = useMemo(() =>
    [...historico].slice(0, 7).reverse().map(h => ({
      data: format(new Date(h.data_referencia + 'T00:00:00'), 'dd/MM'),
      valor: h.valor_fechado ?? h.valor_estimado,
    })),
  [historico]);

  // Meta diária atingida
  const metaDiariaAtingida = useMemo(() => {
    if (breakdown.length === 0) return '—';
    const atingidas = breakdown.filter(b => b.pct >= 100).length;
    return `${atingidas} /${breakdown.length}`;
  }, [breakdown]);

  if (loadInc) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 animate-fade-up">
      <h1 className="text-lg font-bold text-foreground">Remuneração Variável</h1>

      {/* Hero card: Taxa acumulada */}
      <div className="card-elevated overflow-hidden">
        <div className="gradient-hero p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">Taxa acumulada</p>
              <p className="text-3xl font-bold mt-1">{fmtBRL(bonusAcumulado)}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Meta diária atingida</span>
            <span className="font-bold text-foreground">{metaDiariaAtingida}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bonificação até o momento</span>
            <span className="font-bold text-foreground">{fmtBRL(bonusAcumulado)}</span>
          </div>
          {projecaoMensal > bonusAcumulado && (
            <p className="text-xs text-muted-foreground">
              Simulação: <span className="font-semibold text-primary">Faltam {fmtBRL(projecaoMensal - bonusAcumulado)}</span> para atingir 100%
            </p>
          )}
        </div>
      </div>

      {/* Projeção Mensal */}
      <div className="card-elevated p-4">
        <h3 className="text-sm font-bold text-foreground mb-3">Projeção Mensal</h3>
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-lg font-bold text-foreground">{fmtBRL(bonusAcumulado)}</span>
            <span className="text-sm text-muted-foreground"> / {fmtBRL(projecaoMensal)}</span>
          </div>
          <span className="text-sm font-bold text-primary">{pctProjecao.toFixed(0)}%</span>
        </div>
        <ProgressBar value={pctProjecao} color="blue" className="h-2.5 mb-3" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Bônus já acumulado: <strong className="text-foreground">{fmtBRL(bonusAcumulado)}</strong></span>
          <span>Dias: <strong className="text-foreground">{diasComDados}</strong></span>
        </div>
      </div>

      {/* Gráfico de evolução */}
      <div className="card-elevated p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Evolução do Dia</h3>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Últimos 7 dias</span>
        </div>
        {loadHist ? (
          <Skeleton className="h-36 w-full" />
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
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorValor)"
                dot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState titulo="Sem histórico de incentivos" icon={<DollarSign className="h-10 w-10" />} />
        )}
      </div>

      {/* Como é Calculado (breakdown) */}
      {breakdown.length > 0 && (
        <div className="card-elevated">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-bold text-foreground">Como é Calculado</h3>
          </div>
          <div className="divide-y divide-border/40">
            {breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{b.indicador}</p>
                  <p className="text-[11px] text-muted-foreground">Peso {b.peso} • Meta {b.meta} • Seu: {b.valor}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs font-semibold text-foreground">{b.pct.toFixed(0)}%</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-xs font-bold text-primary mt-0.5">{fmtBRL(b.valorGerado)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
              <span className="text-sm font-bold text-foreground">Total estimado hoje</span>
              <span className="text-lg font-bold text-primary">{fmtBRL(valorHoje)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Histórico tabela */}
      {historico.length > 0 && (
        <div className="card-elevated">
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
                  <tr key={h.id}>
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
