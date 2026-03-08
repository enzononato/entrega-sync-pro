import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'search';
  options?: { value: string; label: string }[];
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function FilterBar({ filters, values, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      {filters.map(f => {
        if (f.type === 'search') {
          return (
            <div key={f.key} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={f.label}
                value={values[f.key] ?? ''}
                onChange={e => onChange(f.key, e.target.value)}
                className="pl-9"
              />
            </div>
          );
        }
        return (
          <Select key={f.key} value={values[f.key] ?? ''} onValueChange={v => onChange(f.key, v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              {f.options?.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </div>
  );
}
