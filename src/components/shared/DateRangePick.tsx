import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangePickProps {
  from: string;
  to: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  className?: string;
}

export function DateRangePick({ from, to, onChangeFrom, onChangeTo, className }: DateRangePickProps) {
  const [open, setOpen] = useState(false);

  const selected: DateRange = {
    from: from ? new Date(from + 'T00:00:00') : undefined,
    to: to ? new Date(to + 'T00:00:00') : undefined,
  };

  const label = from && to
    ? from === to
      ? format(new Date(from + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
      : `${format(new Date(from + 'T00:00:00'), 'dd/MM', { locale: ptBR })} — ${format(new Date(to + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`
    : 'Período';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('justify-start text-left font-normal h-9', !from && 'text-muted-foreground', className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={(range) => {
            if (range?.from) {
              onChangeFrom(format(range.from, 'yyyy-MM-dd'));
              onChangeTo(range.to ? format(range.to, 'yyyy-MM-dd') : format(range.from, 'yyyy-MM-dd'));
            }
            if (range?.from && range?.to) {
              setOpen(false);
            }
          }}
          numberOfMonths={2}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
