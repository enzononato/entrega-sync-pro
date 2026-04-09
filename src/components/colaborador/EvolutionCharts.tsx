import { useMemo, useState } from 'react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDesempenhoPorColaborador } from '@/hooks/useDesempenho';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface Props {
  userId: string | undefined;
}

export function EvolutionCharts({ userId }: Props) {
  const [period, setPeriod] = useState<'semanal' | 'mensal'>('semanal');
  const today = new Date();

  // Weekly: last 7 days
  const weekStart = format(subDays(today, 6), 'yyyy-MM-dd');
  const weekEnd = format(today, 'yyyy-MM-dd');

  // Monthly: last 6 months
  const monthStart = format(startOfMonth(subMonths(today, 5)), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

  const rangeStart = period === 'semanal' ? weekStart : monthStart;
  const rangeEnd = period === 'semanal' ? weekEnd : monthEnd;

  const { data: rawData = [], isLoading } = useDesempenhoPorColaborador(userId, rangeStart, rangeEnd);

  const weeklyData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(today, 6), end: today });
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayRecords = rawData.filter(r => r.data_referencia === dateStr);
      const total = dayRecords.length;
      const atingiu = dayRecords.filter(r => r.status === 'dentro_meta' || r.status === 'acima_meta').length;
      const pctAtingidas = total > 0 ? Math.round((atingiu / total) * 100) : 0;
      return {
        label: format(day, 'EEE', { locale: ptBR }).replace('.', ''),
        fullDate: format(day, 'dd/MM'),
        realizado: pctAtingidas,
        meta: 100,
      };
    });
  }, [rawData, today]);

  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: startOfMonth(subMonths(today, 5)),
      end: startOfMonth(today),
    });
    return months.map(month => {
      const mStr = format(month, 'yyyy-MM');
      const monthRecords = rawData.filter(r => r.data_referencia.startsWith(mStr));
      const total = monthRecords.length;
      const atingiu = monthRecords.filter(r => r.status === 'dentro_meta' || r.status === 'acima_meta').length;
      const pctAtingidas = total > 0 ? Math.round((atingiu / total) * 100) : 0;
      return {
        label: format(month, 'MMM', { locale: ptBR }),
        fullDate: format(month, 'MMM/yy', { locale: ptBR }),
        realizado: pctAtingidas,
        meta: 100,
      };
    });
  }, [rawData, today]);

  const chartData = period === 'semanal' ? weeklyData : monthlyData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-card p-2.5 shadow-lg text-xs">
        <p className="font-semibold text-foreground mb-1">{payload[0]?.payload?.fullDate ?? label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.dataKey === 'realizado' ? 'Realizado' : 'Meta'}:</span>
            <span className="font-bold text-foreground">{p.value}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" /> Evolução
        </h2>
        <Tabs value={period} onValueChange={v => setPeriod(v as any)}>
          <TabsList className="h-7 p-0.5 bg-muted/60">
            <TabsTrigger value="semanal" className="text-[10px] h-6 px-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Semanal
            </TabsTrigger>
            <TabsTrigger value="mensal" className="text-[10px] h-6 px-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Mensal
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="card-elevated rounded-2xl p-4 overflow-hidden">
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <div className="w-full h-52">
            <ResponsiveContainer width="100%" height="100%">
              {period === 'semanal' ? (
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[0, 'auto']} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <Area
                    type="monotone" dataKey="meta" name="Meta"
                    stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5"
                    fill="none" strokeWidth={1.5}
                  />
                  <Area
                    type="monotone" dataKey="realizado" name="Realizado"
                    stroke="hsl(var(--primary))" fill="url(#gradReal)"
                    strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[0, 'auto']} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" opacity={0.25} radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
