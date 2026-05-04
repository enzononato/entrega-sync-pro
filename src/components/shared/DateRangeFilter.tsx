import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
  monthsBack?: number;
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

export function DateRangeFilter({ from, to, onChange, className, monthsBack = 12 }: Props) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const today = new Date();
  const todayStr = fmt(today);

  const presets = useMemo(() => {
    const list: { key: string; label: string; from: string; to: string }[] = [
      { key: 'today', label: 'Hoje', from: todayStr, to: todayStr },
      { key: 'yesterday', label: 'Ontem', from: fmt(subDays(today, 1)), to: fmt(subDays(today, 1)) },
      { key: '7d', label: 'Últimos 7 dias', from: fmt(subDays(today, 6)), to: todayStr },
      { key: '30d', label: 'Últimos 30 dias', from: fmt(subDays(today, 29)), to: todayStr },
      { key: 'thisMonth', label: 'Este mês', from: fmt(startOfMonth(today)), to: fmt(endOfMonth(today)) },
      { key: 'lastMonth', label: 'Mês anterior', from: fmt(startOfMonth(subMonths(today, 1))), to: fmt(endOfMonth(subMonths(today, 1))) },
    ];
    return list;
  }, [todayStr]);

  const months = useMemo(() => {
    const arr: { key: string; label: string; from: string; to: string }[] = [];
    for (let i = 2; i < monthsBack; i++) {
      const d = subMonths(startOfDay(today), i);
      arr.push({
        key: 'm-' + format(d, 'yyyy-MM'),
        label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
        from: fmt(startOfMonth(d)),
        to: fmt(endOfMonth(d)),
      });
    }
    return arr;
  }, [monthsBack, today]);

  const activePreset = [...presets, ...months].find(p => p.from === from && p.to === to);
  const label = activePreset
    ? activePreset.label
    : from && to
      ? from === to
        ? format(new Date(from + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
        : `${format(new Date(from + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })} — ${format(new Date(to + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })}`
      : 'Período';

  const apply = (f: string, t: string) => {
    onChange(f, t);
    setOpen(false);
  };

  const selectedRange: DateRange = {
    from: from ? new Date(from + 'T00:00:00') : undefined,
    to: to ? new Date(to + 'T00:00:00') : undefined,
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('justify-between gap-2 h-9 font-normal', className)}
          >
            <span className="flex items-center gap-2 truncate">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="truncate capitalize">{label}</span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1.5 pb-1">Rápido</div>
          <div className="grid grid-cols-2 gap-1">
            {presets.map(p => (
              <button
                key={p.key}
                onClick={() => apply(p.from, p.to)}
                className={cn(
                  'text-left text-xs px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors',
                  activePreset?.key === p.key && 'bg-accent text-accent-foreground font-medium',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {months.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-1">Meses anteriores</div>
              <div className="max-h-44 overflow-y-auto">
                {months.map(m => (
                  <button
                    key={m.key}
                    onClick={() => apply(m.from, m.to)}
                    className={cn(
                      'w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors capitalize',
                      activePreset?.key === m.key && 'bg-accent text-accent-foreground font-medium',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="border-t my-1.5" />
          <button
            onClick={() => { setOpen(false); setCustomOpen(true); }}
            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-primary font-medium"
          >
            Personalizado…
          </button>
        </PopoverContent>
      </Popover>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild><span className="hidden" /></PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={(range) => {
              if (range?.from) {
                const f = fmt(range.from);
                const t = range.to ? fmt(range.to) : f;
                onChange(f, t);
                if (range.from && range.to) setCustomOpen(false);
              }
            }}
            numberOfMonths={2}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
