import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  titulo: string;
  descricao?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ titulo, descricao, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
      {icon && <div className="mb-4 text-muted-foreground/40">{icon}</div>}
      <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
      {descricao && <p className="mt-1.5 text-sm text-muted-foreground max-w-xs leading-relaxed">{descricao}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5 rounded-xl gradient-primary text-white shadow-glow-primary hover:opacity-90 transition-all gap-2">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
