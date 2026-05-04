import { useMemo } from 'react';
import { format, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon } from 'lucide-react';

interface MonthSelectorProps {
  /** valor no formato 'yyyy-MM' */
  value: string;
  onChange: (value: string) => void;
  monthsBack?: number;
  className?: string;
}

export function MonthSelector({ value, onChange, monthsBack = 12, className }: MonthSelectorProps) {
  const meses = useMemo(() => {
    const arr: { value: string; label: string }[] = [];
    for (let i = 0; i < monthsBack; i++) {
      const d = startOfMonth(subMonths(new Date(), i));
      arr.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
      });
    }
    return arr;
  }, [monthsBack]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? 'h-8 w-[180px] rounded-full text-xs'}>
        <CalendarIcon className="h-3.5 w-3.5 mr-1 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {meses.map(m => (
          <SelectItem key={m.value} value={m.value} className="capitalize text-sm">
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
