import { Truck, UserCheck, Package } from 'lucide-react';

export const WORKER_TYPES = [
  { value: 'motorista', label: 'Motorista', emoji: '🚛', icon: Truck, color: 'emerald', bgClass: 'bg-emerald-100 text-emerald-700', borderClass: 'border-emerald-300', dotClass: 'bg-emerald-500', darkBgClass: 'bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'ajudante', label: 'Ajudante', emoji: '📦', icon: UserCheck, color: 'violet', bgClass: 'bg-violet-100 text-violet-700', borderClass: 'border-violet-300', dotClass: 'bg-violet-500', darkBgClass: 'bg-violet-900/30 dark:text-violet-400' },
  { value: 'distribuicao', label: 'Distribuição', emoji: '📋', icon: Package, color: 'blue', bgClass: 'bg-blue-100 text-blue-700', borderClass: 'border-blue-300', dotClass: 'bg-blue-500', darkBgClass: 'bg-blue-900/30 dark:text-blue-400' },
] as const;

export type WorkerTypeValue = typeof WORKER_TYPES[number]['value'];

export function getWorkerConfig(type: string | null | undefined) {
  return WORKER_TYPES.find(w => w.value === type) ?? WORKER_TYPES[0];
}

export function getWorkerLabel(type: string | null | undefined) {
  return getWorkerConfig(type).label;
}

export function getWorkerEmoji(type: string | null | undefined) {
  const cfg = getWorkerConfig(type);
  return `${cfg.emoji} ${cfg.label}`;
}
