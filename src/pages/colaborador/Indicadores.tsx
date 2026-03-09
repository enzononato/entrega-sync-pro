import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useDesempenhoDiario, useDesempenhoPorColaborador } from '@/hooks/useDesempenho';
import { KpiCard } from '@/components/shared/KpiCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, CalendarIcon, AlertCircle, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';
import type { IndicatorStatus } from '@/types';

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

  const getSparkData = (indicatorId: string) => {
    return historico
      .filter(h => h.indicator_id === indicatorId)
      .sort((a, b) => a.data_referencia.localeCompare(b.data_referencia))
      .map(h => ({
        data: format(new Date(h.data_referencia + 'T00:00:00'), 'dd/MM'),
        valor: h.percentual_atingimento ?? 0,
        meta: 100,
        status: h.status,
      }));
  };

  const statusColor = (s: string | null) => {
    if (s === 'acima_meta') return 'hsl(var(--success))';
    if (s === 'dentro_meta') return 'hsl(var(--primary))';
    return 'hsl(var(--destructive))';
  };

  const okCount = kpis.filter(d => d.status === 'acima_meta' || d.status === 'dentro_meta').length;
  const avgPct = kpis.length > 0
    ? Math.round(kpis.reduce((s, d) => s + (d.percentual_atingimento ?? 0), 0) / kpis.length)
    : 0;

  return (
    <div className="space-y-5 stagger-children">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Meus Indicadores
        </h1>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={prevDay}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="font-medium rounded-xl h-9 px-4">
              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
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
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" disabled={isToday} onClick={nextDay}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card-elevated p-3 text-center">
            <p className="text-lg font-bold text-foreground">{kpis.length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Indicadores</p>
          </div>
          <div className="card-elevated p-3 text-center">
            <p className="text-lg font-bold text-primary">{okCount}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Na Meta</p>
          </div>
          <div className="card-elevated p-3 text-center">
            <p className="text-lg font-bold text-foreground">{avgPct}%</p>
            <p className="text-[10px] text-muted-foreground font-medium">Média</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : kpis.length === 0 ? (
        <EmptyState titulo="Sem indicadores para esta data" icon={<AlertCircle className="h-10 w-10" />} />
      ) : (
        <div className="space-y-3">
          {kpis.map(d => {
            const isExpanded = expanded === d.indicator_id;
            const sparkData = isExpanded ? getSparkData(d.indicator_id) : [];
            return (
              <div key={d.id} className="overflow-hidden rounded-xl">
                <div
                  onClick={() => setExpanded(isExpanded ? null : d.indicator_id)}
                  className="cursor-pointer active:scale-[0.99] transition-transform"
                >
                  <KpiCard
                    titulo={d.indicators?.nome ?? ''}
                    valor={d.valor}
                    meta={d.meta ?? undefined}
                    percentual={d.percentual_atingimento ?? undefined}
                    status={d.status as IndicatorStatus | undefined}
                    unidade={d.indicators?.unidade_medida}
                  />
                </div>
                {isExpanded && sparkData.length > 1 && (
                  <div className="border border-t-0 border-border bg-card p-4 rounded-b-xl">
                    <p className="text-xs text-muted-foreground mb-3 font-medium">Evolução — Últimos 7 dias</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={sparkData}>
                        <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                        <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Atingimento']} />
                        <ReferenceLine y={100} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: 'Meta', fontSize: 9, fill: 'hsl(var(--destructive))' }} />
                        <Line
                          type="monotone" dataKey="valor" stroke="hsl(var(--primary))"
                          strokeWidth={2.5} dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            return <circle key={payload.data} cx={cx} cy={cy} r={4} fill={statusColor(payload.status)} stroke="white" strokeWidth={2} />;
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
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
