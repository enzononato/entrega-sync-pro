import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  color?: 'green' | 'blue' | 'red' | 'yellow';
  className?: string;
}

const colorMap = {
  green: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  blue: 'bg-gradient-to-r from-primary to-secondary',
  red: 'bg-gradient-to-r from-destructive to-red-400',
  yellow: 'bg-gradient-to-r from-warning to-amber-400',
};

export function ProgressBar({ value, color = 'blue', className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('h-2 w-full rounded-full bg-muted/80', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-700 ease-out', colorMap[color])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
