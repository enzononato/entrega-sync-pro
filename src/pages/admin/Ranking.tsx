import { useState, useMemo } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRanking } from '@/hooks/useRanking';
import { useUnidades } from '@/hooks/useUnidades';
import { PageHeader } from '@/components/shared/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Medal, TrendingUp, Users, Crown, Star, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  if (pct >= 100) return 'text-success';
  if (pct >= 90) return 'text-warning';
  return 'text-destructive';
}

export default function RankingAdmin() {
  const [periodo, setPeriodo] = useState('mes_atual');
  const [unidadeId, setUnidadeId] = useState('todas');
  const { data: unidades = [] } = useUnidades();

  const { start, end } = useMemo(() => getDateRange(periodo), [periodo]);
  const { data: ranking = [], isLoading } = useRanking({
    dataInicio: start,
    dataFim: end,
    unidade_id: unidadeId === 'todas' ? undefined : unidadeId,
  });

  const top10 = ranking.slice(0, 10);
  const topThree = top10.slice(0, 3);
  const rest = top10.slice(3);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ranking de Desempenho"
        subtitle="Top performers por unidade e período"
      />

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
          {/* Podium - Top 3 */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-3 gap-3 items-end">
              {[1, 0, 2].map(idx => {
                const entry = topThree[idx];
                if (!entry) return <div key={idx} />;
                const position = idx + 1;
                const medal = getMedalConfig(position)!;
                const isFirst = position === 1;
                const initials = entry.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                return (
                  <div
                    key={entry.user_id}
                    className={cn(
                      'relative rounded-2xl border p-4 text-center transition-all',
                      medal.bg,
                      isFirst ? 'py-6 scale-105 shadow-lg' : 'py-4'
                    )}
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
                      {entry.avg_atingimento.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {entry.on_target_count}/{entry.total_indicators} na meta
                    </p>
                    {entry.unidade_nome && (
                      <p className="text-[9px] text-muted-foreground mt-1 truncate">📍 {entry.unidade_nome}</p>
                    )}
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
                const initials = entry.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div key={entry.user_id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    {/* Position */}
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-muted-foreground">{position}º</span>
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={entry.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{entry.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {entry.worker_type && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                            {entry.worker_type}
                          </Badge>
                        )}
                        {entry.unidade_nome && (
                          <span className="text-[10px] text-muted-foreground truncate">📍 {entry.unidade_nome}</span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-bold', getPerformanceColor(entry.avg_atingimento))}>
                        {entry.avg_atingimento.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {entry.on_target_count}/{entry.total_indicators}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card p-4 text-center">
              <Users className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{ranking.length}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Colaboradores</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <TrendingUp className="h-5 w-5 text-success mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">
                {ranking.length > 0 ? (ranking.reduce((s, r) => s + r.avg_atingimento, 0) / ranking.length).toFixed(1) : 0}%
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">Média Geral</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <Star className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">
                {ranking.filter(r => r.avg_atingimento >= 100).length}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">Acima da Meta</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
