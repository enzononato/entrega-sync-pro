import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  backTo?: string;
}

export function PageHeader({ title, subtitle, actionLabel, onAction, backTo }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div className="flex items-center gap-3">
        {backTo && (
          <Button variant="ghost" size="icon" onClick={() => navigate(backTo)} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="rounded-xl gradient-primary text-white shadow-glow-primary hover:opacity-90 transition-opacity">{actionLabel}</Button>
      )}
    </div>
  );
}
