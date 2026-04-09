import { useState, useMemo } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRanking, type RankingEntry, type IndicatorBreakdown } from '@/hooks/useRanking';
import { useAllowedUnits } from '@/hooks/useAllowedUnits';
import { PageHeader } from '@/components/shared/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/shared/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProgressBar } from '@/components/shared/ProgressBar';
import {
  Medal, TrendingUp, TrendingDown, Users, Crown, Star, Flame,
  ChevronRight, BarChart3, Target, ArrowUp, ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMinutesHHMM } from '@/lib/formatters';

const TIME_INDICATORS = ['TML', 'TR', 'TI', 'JL'];

function formatIndicatorValue(codigo: string, value: number): string {
  if (TIME_INDICATORS.includes(codigo.toUpperCase())) {
    return formatMinutesHHMM(value);
  }
  return value.toFixed(1);
}

function formatIndicatorPair(ind: IndicatorBreakdown): string {
  const v = formatIndicatorValue(ind.indicator_codigo, ind.avg_valor);
  const m = formatIndicatorValue(ind.indicator_codigo, ind.avg_meta);
  return `${v} / ${m}`;
}

const PERIODOS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Últimos 7 dias' },
  { value: 'mes_atual', label: 'Mês Atual' },
  { value: 'mes_anterior', label: 'Mês Anterior' },
  { value: '30dias', label: 'Últimos 30 dias' },
];

function getDateRange(periodo: string) {
  const today = new Date();
  switch (periodo) {
    case 'hoje':
      return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    case 'semana':
      return { start: format(subDays(today, 6), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    case 'mes_atual':
      return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
    case 'mes_anterior': {
      const prev = subMonths(today, 1);
      return { start: format(startOfMonth(prev), 'yyyy-MM-dd'), end: format(endOfMonth(prev), 'yyyy-MM-dd') };
    }
    case '30dias':
    default:
      return { start: format(subDays(today, 29), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
  }
}

function getMedalConfig(position: number) {
  switch (position) {
    case 1: return { icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30', ring: 'ring-yellow-500/40', label: 'Ouro' };
    case 2: return { icon: Medal, color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/30', ring: 'ring-slate-400/40', label: 'Prata' };
    case 3: return { icon: Medal, color: 'text-amber-700', bg: 'bg-amber-700/10 border-amber-700/30', ring: 'ring-amber-700/40', label: 'Bronze' };
    default: return null;
  }
}

function getPerformanceColor(pct: number) {
  if (pct >= 75) return 'text-success';
  if (pct >= 50) return 'text-warning';
  return 'text-destructive';
}

function getBarColor(pct: number): 'green' | 'yellow' | 'red' {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'yellow';
  return 'red';
}

const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export default function RankingAdmin() {
  const [periodo, setPeriodo] = useState('mes_atual');
  const [unidadeId, setUnidadeId] = useState('todas');
  const [workerType, setWorkerType] = useState('motorista');
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null);
  const { allowedUnits: unidades } = useAllowedUnits();

  const { start, end } = useMemo(() => getDateRange(periodo), [periodo]);
  const { data: ranking = [], isLoading } = useRanking({
    dataInicio: start,
    dataFim: end,
    unidade_id: unidadeId === 'todas' ? undefined : unidadeId,
    worker_type: workerType,
  });

  const top10 = ranking.slice(0, 10);
  const topThree = top10.slice(0, 3);
  const rest = top10.slice(3);

  // Stats
  const avgGeral = ranking.length > 0 ? ranking.reduce((s, r) => s + r.avg_atingimento, 0) / ranking.length : 0;
  const todosAtingiram = ranking.filter(r => r.avg_atingimento >= 100).length;
  const menosMetade = ranking.filter(r => r.avg_atingimento < 50).length;

  // Per-unit breakdown
  const unitBreakdown = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; avg: number; total: number }>();
    ranking.forEach(r => {
      const key = r.unidade_nome ?? 'Sem unidade';
      if (!map.has(key)) map.set(key, { nome: key, count: 0, avg: 0, total: 0 });
      const u = map.get(key)!;
      u.count++;
      u.total += r.avg_atingimento;
      u.avg = u.total / u.count;
    });
    return Array.from(map.values()).sort((a, b) => b.avg - a.avg);
  }, [ranking]);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Ranking de Desempenho"
        subtitle="Top performers por unidade e período"
      />

      {/* Cargo tabs */}
      <Tabs value={workerType} onValueChange={setWorkerType}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="motorista" className="flex-1 sm:flex-none gap-1.5">🚛 Motoristas</TabsTrigger>
          <TabsTrigger value="ajudante" className="flex-1 sm:flex-none gap-1.5">📦 Ajudantes</TabsTrigger>
          <TabsTrigger value="distribuicao" className="flex-1 sm:flex-none gap-1.5">📋 Distribuição</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={unidadeId} onValueChange={setUnidadeId}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Unidades</SelectItem>
            {unidades.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : top10.length === 0 ? (
        <EmptyState
          titulo="Sem dados de ranking"
          descricao="Nenhum lançamento de desempenho encontrado para o período e filtros selecionados."
          icon={<Users className="h-12 w-12" />}
        />
      ) : (
        <>
          {/* Stats summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Colaboradores', value: ranking.length, icon: Users, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
              { label: '% Metas Atingidas', value: `${avgGeral.toFixed(0)}%`, icon: BarChart3, iconBg: 'bg-primary/10', iconColor: 'text-primary', borderColor: 'border-l-primary' },
              { label: '100% Metas', value: todosAtingiram, icon: ArrowUp, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
              { label: '< 50% Metas', value: menosMetade, icon: ArrowDown, iconBg: 'bg-destructive/10', iconColor: 'text-destructive', borderColor: 'border-l-destructive' },
            ].map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className={cn('rounded-xl border bg-card p-4 shadow-sm border-l-[3px] transition-all hover:shadow-md', k.borderColor)}>
                  <div className="flex items-center gap-3">
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', k.iconBg)}>
                      <Icon className={cn('h-5 w-5', k.iconColor)} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground leading-none">{k.value}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{k.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Podium - Top 3 */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-3 gap-3 items-end">
              {[1, 0, 2].map(idx => {
                const entry = topThree[idx];
                if (!entry) return <div key={idx} />;
                const position = idx + 1;
                const medal = getMedalConfig(position)!;
                const isFirst = position === 1;
                const initials = getInitials(entry.nome);

                return (
                  <div
                    key={entry.user_id}
                    className={cn(
                      'relative rounded-2xl border p-4 text-center transition-all cursor-pointer hover:shadow-lg',
                      medal.bg,
                      isFirst ? 'py-6 scale-105 shadow-lg' : 'py-4'
                    )}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    {isFirst && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <div className="bg-yellow-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-md flex items-center gap-1">
                          <Flame className="h-3 w-3" /> TOP 1
                        </div>
                      </div>
                    )}
                    <div className={cn('mx-auto mb-2', isFirst ? 'h-16 w-16' : 'h-12 w-12')}>
                      <Avatar className={cn('h-full w-full ring-2', medal.ring)}>
                        <AvatarImage src={entry.avatar_url ?? undefined} />
                        <AvatarFallback className={cn('text-sm font-bold', isFirst && 'text-lg')}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <medal.icon className={cn('h-5 w-5 mx-auto mb-1', medal.color)} />
                    <p className={cn('font-bold text-foreground truncate', isFirst ? 'text-sm' : 'text-xs')}>
                      {entry.nome.split(' ').slice(0, 2).join(' ')}
                    </p>
                    <p className={cn('font-bold mt-1', isFirst ? 'text-2xl' : 'text-xl', getPerformanceColor(entry.avg_atingimento))}>
                      {entry.on_target_count}/{entry.total_indicators}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      metas atingidas ({entry.avg_atingimento.toFixed(0)}%)
                    </p>
                    {entry.unidade_nome && (
                      <p className="text-[9px] text-muted-foreground mt-1 truncate">📍 {entry.unidade_nome}</p>
                    )}
                    {/* Indicator values */}
                    <div className="mt-2 space-y-0.5">
                      {entry.indicators_breakdown.slice(0, 4).map(ind => (
                        <p key={ind.indicator_id} className="text-[9px] text-muted-foreground truncate">
                          <span className="font-medium">{ind.indicator_codigo}:</span>{' '}
                          <span className={cn('font-bold', ind.on_target === ind.count ? 'text-emerald-500' : ind.on_target > 0 ? 'text-amber-500' : 'text-red-400')}>
                            {ind.on_target}/{ind.count}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rest of ranking 4-10 */}
          {rest.length > 0 && (
            <div className="rounded-2xl border bg-card overflow-hidden divide-y divide-border/40">
              {rest.map((entry, i) => {
                const position = i + 4;
                const initials = getInitials(entry.nome);
                return (
                  <div
                    key={entry.user_id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-muted-foreground">{position}º</span>
                    </div>
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={entry.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{entry.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {entry.unidade_nome && (
                          <span className="text-[10px] text-muted-foreground truncate">📍 {entry.unidade_nome}</span>
                        )}
                      </div>
                    </div>
                    {/* Mini indicator breakdown */}
                    <div className="hidden lg:flex items-center gap-1.5 shrink-0">
                      {entry.indicators_breakdown.slice(0, 3).map(ind => {
                        const indAtingiu = ind.avg_pct >= 100;
                        return (
                          <div key={ind.indicator_id} className="text-center">
                            <p className="text-[9px] text-muted-foreground truncate max-w-[70px]">{ind.indicator_codigo}</p>
                            <p className={cn('text-[10px] font-bold', indAtingiu ? 'text-emerald-600' : 'text-red-600')}>
                              {indAtingiu ? '✓' : '✗'}
                            </p>
                            <p className="text-[9px] text-muted-foreground">{formatIndicatorPair(ind)}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={cn('text-sm font-bold', getPerformanceColor(entry.avg_atingimento))}>
                        {entry.avg_atingimento.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {entry.on_target_count}/{entry.total_indicators}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Per-unit breakdown */}
          {unitBreakdown.length > 1 && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Desempenho por Unidade</span>
              </div>
              <div className="space-y-3">
                {unitBreakdown.map(u => (
                  <div key={u.nome} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{u.nome}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{u.count} colab.</span>
                        <span className={cn('text-xs font-bold', getPerformanceColor(u.avg))}>{u.avg.toFixed(1)}%</span>
                      </div>
                    </div>
                    <ProgressBar value={Math.min(u.avg, 100)} color={getBarColor(u.avg)} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-md p-0">
          {selectedEntry && (() => {
            const pos = ranking.findIndex(r => r.user_id === selectedEntry.user_id) + 1;
            const medal = getMedalConfig(pos);
            return (
              <>
                <div className={cn('px-6 pt-6 pb-4 border-b border-border/50', medal ? medal.bg : '')}>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={selectedEntry.avatar_url ?? undefined} />
                        <AvatarFallback className="font-bold">{getInitials(selectedEntry.nome)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <DialogTitle className="text-base">{selectedEntry.nome}</DialogTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">{selectedEntry.worker_type}</Badge>
                          {selectedEntry.unidade_nome && <span className="text-[10px] text-muted-foreground">📍 {selectedEntry.unidade_nome}</span>}
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-xs text-muted-foreground">{pos}º lugar</p>
                        <p className={cn('text-xl font-bold', getPerformanceColor(selectedEntry.avg_atingimento))}>
                          {selectedEntry.avg_atingimento.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </DialogHeader>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/40 p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{selectedEntry.total_indicators}</p>
                      <p className="text-[10px] text-muted-foreground">Lançamentos</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
                      <p className="text-lg font-bold text-success">{selectedEntry.on_target_count}</p>
                      <p className="text-[10px] text-muted-foreground">Na Meta</p>
                    </div>
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-center">
                      <p className="text-lg font-bold text-destructive">{selectedEntry.total_indicators - selectedEntry.on_target_count}</p>
                      <p className="text-[10px] text-muted-foreground">Fora</p>
                    </div>
                  </div>

                  {/* Indicator breakdown */}
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-primary" /> Desempenho por Indicador
                    </p>
                    <div className="space-y-2.5">
                      {selectedEntry.indicators_breakdown.map(ind => {
                        const indAtingiu = ind.avg_pct >= 100;
                        return (
                          <div key={ind.indicator_id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-foreground font-medium truncate">{ind.indicator_nome}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{formatIndicatorPair(ind)}</span>
                                <span className={cn(
                                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                  indAtingiu ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                )}>
                                  {indAtingiu ? 'Atingiu' : 'Não Atingiu'}
                                </span>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{ind.count} registro(s)</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
