import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useDesempenhoDiario, useDesempenhoPorColaborador } from '@/hooks/useDesempenho';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ChevronLeft, ChevronRight, CalendarIcon, AlertCircle,
  BarChart3, TrendingUp, TrendingDown, Target, CheckCircle, XCircle, ChevronDown,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { cn } from '@/lib/utils';
import type { IndicatorStatus } from '@/types';

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  acima_meta: { label: 'Acima', color: 'text-success', bg: 'bg-success/10', icon: TrendingUp },
  dentro_meta: { label: 'Na meta', color: 'text-primary', bg: 'bg-primary/10', icon: CheckCircle },
  abaixo_meta: { label: 'Abaixo', color: 'text-destructive', bg: 'bg-destructive/10', icon: TrendingDown },
};

const progressColor: Record<string, 'green' | 'blue' | 'red'> = {
  acima_meta: 'green', dentro_meta: 'blue', abaixo_meta: 'red',
};

export default function IndicadoresColaborador() {
  const { user } = useAuth();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [dateStr, setDateStr] = useState(todayStr);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: desempenho = [], isLoading } = useDesempenhoDiario(dateStr, { user_id: user?.id });

  const startDate = format(subDays(new Date(dateStr + 'T00:00:00'), 6), 'yyyy-MM-dd');
  const { data: historico = [] } = useDesempenhoPorColaborador(user?.id, startDate, dateStr);

  const kpis = useMemo(() => desempenho.filter(d => {
    if (!user?.worker_type || !d.indicators) return true;
    const cod = d.indicators.codigo?.toLowerCase() ?? '';
    if (user.worker_type === 'motorista' && cod.includes('refugo')) return false;
    if (user.worker_type === 'ajudante' && cod.includes('repos')) return false;
    return true;
  }), [desempenho, user?.worker_type]);

  const prevDay = () => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setDateStr(format(d, 'yyyy-MM-dd'));
  };
  const nextDay = () => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setDateStr(format(d, 'yyyy-MM-dd'));
  };
  const isToday = dateStr === todayStr;

  const okCount = kpis.filter(d => d.status === 'acima_meta' || d.status === 'dentro_meta').length;
  const badCount = kpis.filter(d => d.status === 'abaixo_meta').length;
  const avgPct = kpis.length > 0
    ? Math.round(kpis.reduce((s, d) => s + (d.percentual_atingimento ?? 0), 0) / kpis.length)
    : 0;

  const getSparkData = (indicatorId: string) =>
    historico
      .filter(h => h.indicator_id === indicatorId)
      .sort((a, b) => a.data_referencia.localeCompare(b.data_referencia))
      .map(h => ({
        data: format(new Date(h.data_referencia + 'T00:00:00'), 'dd/MM'),
        valor: h.percentual_atingimento ?? 0,
        status: h.status,
      }));

  return (
    <div className="space-y-5 stagger-children pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Meus Indicadores
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Acompanhe seus KPIs diários</p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={prevDay}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="font-medium rounded-xl h-9 px-4 text-sm">
              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
              {format(new Date(dateStr + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={new Date(dateStr + 'T00:00:00')}
              onSelect={d => d && setDateStr(format(d, 'yyyy-MM-dd'))}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={isToday} onClick={nextDay}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Hero summary */}
      {kpis.length > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-lg gradient-hero">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Média Geral</p>
                <p className={cn('text-4xl font-extrabold mt-1', avgPct >= 100 ? 'text-success' : avgPct >= 80 ? 'text-warning' : 'text-destructive')}>
                  {avgPct}<span className="text-lg text-white/50">%</span>
                </p>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1.5 justify-end">
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                  <span className="text-sm font-bold text-white">{okCount}</span>
                  <span className="text-[10px] text-white/50">na meta</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-sm font-bold text-white">{badCount}</span>
                  <span className="text-[10px] text-white/50">abaixo</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <Target className="h-3.5 w-3.5 text-white/40" />
                  <span className="text-sm font-bold text-white">{kpis.length}</span>
                  <span className="text-[10px] text-white/50">total</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indicator cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : kpis.length === 0 ? (
        <EmptyState titulo="Sem indicadores para esta data" icon={<AlertCircle className="h-10 w-10" />} />
      ) : (
        <div className="space-y-3">
          {kpis.map(d => {
            const pct = d.percentual_atingimento ?? 0;
            const status = (d.status as IndicatorStatus | undefined) ?? 'abaixo_meta';
            const cfg = statusConfig[status] ?? statusConfig.abaixo_meta;
            const StatusIcon = cfg.icon;
            const isExpanded = expanded === d.indicator_id;
            const sparkData = isExpanded ? getSparkData(d.indicator_id) : [];

            return (
              <div key={d.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all">
                {/* Card header */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : d.indicator_id)}
                  className="w-full text-left px-4 py-3.5 active:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                        <StatusIcon className={cn('h-4 w-4', cfg.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{d.indicators?.nome ?? ''}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {d.valor} / {d.meta ?? '—'} {d.indicators?.unidade_medida ?? ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-1.5">
                      <span className={cn('text-lg font-bold', cfg.color)}>{pct.toFixed(0)}%</span>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                    </div>
                  </div>
                  <ProgressBar value={pct} color={progressColor[status] ?? 'blue'} className="h-1.5" />
                </button>

                {/* Expanded chart */}
                {isExpanded && sparkData.length > 1 && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground font-medium mb-2 uppercase tracking-wider">Últimos 7 dias</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={sparkData}>
                        <defs>
                          <linearGradient id={`grad-${d.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="data" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                          formatter={(v: number) => [`${v.toFixed(1)}%`, 'Atingimento']}
                        />
                        <ReferenceLine y={100} stroke="hsl(var(--destructive)/0.4)" strokeDasharray="3 3" />
                        <Area
                          type="monotone" dataKey="valor"
                          stroke="hsl(var(--primary))" strokeWidth={2}
                          fill={`url(#grad-${d.id})`}
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            const dotCfg = statusConfig[payload.status] ?? statusConfig.abaixo_meta;
                            return (
                              <circle
                                key={payload.data} cx={cx} cy={cy} r={3.5}
                                fill={payload.status === 'abaixo_meta' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                                stroke="white" strokeWidth={1.5}
                              />
                            );
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {isExpanded && sparkData.length <= 1 && (
                  <div className="px-4 pb-3 pt-1 border-t border-border/50">
                    <p className="text-xs text-muted-foreground text-center py-2">Sem histórico suficiente</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
