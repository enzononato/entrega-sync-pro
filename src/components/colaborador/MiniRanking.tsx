import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useRanking } from '@/hooks/useRanking';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Medal, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

function getMedalConfig(position: number) {
  switch (position) {
    case 1: return { icon: Crown, color: 'text-yellow-500', ring: 'ring-yellow-500/40', bg: 'bg-yellow-500/10' };
    case 2: return { icon: Medal, color: 'text-slate-400', ring: 'ring-slate-400/40', bg: 'bg-slate-400/10' };
    case 3: return { icon: Medal, color: 'text-amber-700', ring: 'ring-amber-700/40', bg: 'bg-amber-700/10' };
    default: return null;
  }
}

function getPerformanceColor(pct: number) {
  if (pct >= 100) return 'text-success';
  if (pct >= 90) return 'text-warning';
  return 'text-destructive';
}

const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

interface MiniRankingProps {
  workerType: string;
  userId?: string;
}

export function MiniRanking({ workerType, userId }: MiniRankingProps) {
  const today = new Date();
  const dateRange = useMemo(() => ({
    start: format(startOfMonth(today), 'yyyy-MM-dd'),
    end: format(endOfMonth(today), 'yyyy-MM-dd'),
  }), []);

  const { data: ranking = [], isLoading } = useRanking({
    dataInicio: dateRange.start,
    dataFim: dateRange.end,
    worker_type: workerType,
  });

  const top3 = ranking.slice(0, 3);
  const myPosition = userId ? ranking.findIndex(r => r.user_id === userId) + 1 : 0;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    );
  }

  if (top3.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Podium cards */}
      <div className="grid grid-cols-3 gap-2 items-end">
        {[1, 0, 2].map(idx => {
          const entry = top3[idx];
          if (!entry) return <div key={idx} />;
          const position = idx + 1;
          const medal = getMedalConfig(position)!;
          const isFirst = position === 1;
          const isMe = entry.user_id === userId;

          return (
            <div
              key={entry.user_id}
              className={cn(
                'relative rounded-xl border p-3 text-center transition-all',
                medal.bg,
                isFirst ? 'py-4 shadow-md' : 'py-3',
                isMe && 'ring-2 ring-primary'
              )}
            >
              {isFirst && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <div className="bg-yellow-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-0.5">
                    <Flame className="h-2.5 w-2.5" /> TOP 1
                  </div>
                </div>
              )}
              <Avatar className={cn('mx-auto mb-1.5 ring-2', medal.ring, isFirst ? 'h-11 w-11' : 'h-9 w-9')}>
                <AvatarImage src={entry.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px] font-bold">{getInitials(entry.nome)}</AvatarFallback>
              </Avatar>
              <medal.icon className={cn('h-3.5 w-3.5 mx-auto mb-0.5', medal.color)} />
              <p className="text-[11px] font-semibold text-foreground truncate">
                {entry.nome.split(' ')[0]}
              </p>
              <p className={cn('font-bold', isFirst ? 'text-lg' : 'text-base', getPerformanceColor(entry.avg_atingimento))}>
                {entry.avg_atingimento.toFixed(1)}%
              </p>
              {isMe && <span className="text-[8px] font-bold text-primary">VOCÊ</span>}
            </div>
          );
        })}
      </div>

      {/* My position if not in top 3 */}
      {myPosition > 3 && (
        <div className="rounded-xl border bg-primary/5 border-primary/20 px-3 py-2 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{myPosition}º</span>
          </div>
          <p className="text-xs text-foreground font-medium flex-1">Sua posição no ranking</p>
          <p className={cn('text-sm font-bold', getPerformanceColor(ranking[myPosition - 1]?.avg_atingimento ?? 0))}>
            {ranking[myPosition - 1]?.avg_atingimento.toFixed(1) ?? 0}%
          </p>
        </div>
      )}
    </div>
  );
}
