import { cn } from '@/lib/utils';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  acima_meta: { label: 'Acima da Meta', className: 'bg-emerald-100 text-emerald-800' },
  dentro_meta: { label: 'Na Meta', className: 'bg-blue-100 text-blue-800' },
  abaixo_meta: { label: 'Abaixo da Meta', className: 'bg-red-100 text-red-800' },
  aberto: { label: 'Aberto', className: 'bg-blue-100 text-blue-700' },
  em_andamento: { label: 'Em andamento', className: 'bg-yellow-100 text-yellow-700' },
  concluido: { label: 'Concluído', className: 'bg-emerald-100 text-emerald-700' },
  atrasado: { label: 'Atrasado', className: 'bg-red-100 text-red-700' },
  cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500' },
  baixa: { label: 'Baixa', className: 'bg-gray-100 text-gray-600' },
  media: { label: 'Média', className: 'bg-yellow-100 text-yellow-700' },
  alta: { label: 'Alta', className: 'bg-orange-100 text-orange-700' },
  critica: { label: 'Crítica', className: 'bg-red-100 text-red-700' },
  em_analise: { label: 'Em análise', className: 'bg-blue-100 text-blue-700' },
  respondido: { label: 'Respondido', className: 'bg-emerald-100 text-emerald-700' },
  encerrado: { label: 'Encerrado', className: 'bg-gray-100 text-gray-500' },
  estimado: { label: 'Estimado', className: 'bg-blue-100 text-blue-700' },
  fechado: { label: 'Fechado', className: 'bg-emerald-100 text-emerald-700' },
  revisao: { label: 'Em revisão', className: 'bg-yellow-100 text-yellow-700' },
  ativo: { label: 'Ativo', className: 'bg-emerald-100 text-emerald-700' },
  inativo: { label: 'Inativo', className: 'bg-gray-100 text-gray-500' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}
