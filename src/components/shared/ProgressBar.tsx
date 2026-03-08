import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  color?: 'green' | 'blue' | 'red' | 'yellow';
  className?: string;
}

const colorMap = {
  green: 'bg-emerald-500',
  blue: 'bg-primary',
  red: 'bg-destructive',
  yellow: 'bg-warning',
};

export function ProgressBar({ value, color = 'blue', className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('h-2 w-full rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', colorMap[color])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
