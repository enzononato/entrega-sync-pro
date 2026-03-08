import { cn } from '@/lib/utils';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  acima_meta: { label: 'Acima da Meta', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  dentro_meta: { label: 'Na Meta', className: 'bg-primary-light text-primary ring-1 ring-primary/20' },
  abaixo_meta: { label: 'Abaixo da Meta', className: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  aberto: { label: 'Aberto', className: 'bg-primary-light text-primary ring-1 ring-primary/20' },
  em_andamento: { label: 'Em andamento', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  concluido: { label: 'Concluído', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  atrasado: { label: 'Atrasado', className: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  cancelado: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
  baixa: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
  media: { label: 'Média', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  alta: { label: 'Alta', className: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' },
  critica: { label: 'Crítica', className: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  em_analise: { label: 'Em análise', className: 'bg-primary-light text-primary ring-1 ring-primary/20' },
  respondido: { label: 'Respondido', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  encerrado: { label: 'Encerrado', className: 'bg-muted text-muted-foreground' },
  estimado: { label: 'Estimado', className: 'bg-primary-light text-primary ring-1 ring-primary/20' },
  fechado: { label: 'Fechado', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  revisao: { label: 'Em revisão', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  ativo: { label: 'Ativo', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  inativo: { label: 'Inativo', className: 'bg-muted text-muted-foreground' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold', config.className, className)}>
      {config.label}
    </span>
  );
}
