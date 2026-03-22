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
    <div className="space-y-1.5">
      {top3.map((entry, idx) => {
        const position = idx + 1;
        const medal = getMedalConfig(position);
        const isMe = entry.user_id === userId;
        const MedalIcon = medal?.icon ?? Medal;

        return (
          <div
            key={entry.user_id}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all',
              isMe ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/40'
            )}
          >
            <div className={cn('flex items-center justify-center h-6 w-6 rounded-full shrink-0', medal?.bg ?? 'bg-muted')}>
              <MedalIcon className={cn('h-3.5 w-3.5', medal?.color ?? 'text-muted-foreground')} />
            </div>
            <span className="text-sm font-semibold text-foreground truncate flex-1">
              {position}º {entry.nome}
              {isMe && <span className="text-[10px] text-primary font-bold ml-1">(Você)</span>}
            </span>
            <span className={cn('text-sm font-bold shrink-0', getPerformanceColor(entry.avg_atingimento))}>
              {entry.avg_atingimento.toFixed(1)}%
            </span>
          </div>
        );
      })}

      {myPosition > 3 && (
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-primary/5 border border-primary/20">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">{myPosition}º</span>
          </div>
          <span className="text-sm font-medium text-foreground flex-1">Sua posição</span>
          <span className={cn('text-sm font-bold', getPerformanceColor(ranking[myPosition - 1]?.avg_atingimento ?? 0))}>
            {ranking[myPosition - 1]?.avg_atingimento.toFixed(1) ?? 0}%
          </span>
        </div>
      )}
    </div>
  );
}
