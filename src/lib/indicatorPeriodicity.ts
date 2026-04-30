import type { DesempenhoRow } from '@/hooks/useDesempenho';

/**
 * Indicators marked as `mensal` no banco não estão atrelados a mapa.
 * Eles são importados/calculados por mês de referência (dia 01) e devem
 * aparecer numa seção própria, fora do agrupamento por mapa.
 */
export function isMonthlyRow(row: DesempenhoRow): boolean {
  return row.indicators?.periodicidade === 'mensal';
}

/**
 * Separa as linhas em diárias (vinculadas a mapa) e mensais.
 * Linhas mensais são deduplicadas por (user, indicador, ano-mês),
 * preferindo o registro mais recente (updated_at desc).
 */
export function splitByPeriodicidade(rows: DesempenhoRow[]) {
  const diarios: DesempenhoRow[] = [];
  const mensaisMap = new Map<string, DesempenhoRow>();
  for (const r of rows) {
    if (isMonthlyRow(r)) {
      const ym = (r.data_referencia ?? '').slice(0, 7); // YYYY-MM
      const key = `${r.user_id}|${r.indicator_id}|${ym}`;
      const existing = mensaisMap.get(key);
      if (!existing) {
        mensaisMap.set(key, r);
      } else {
        const a = new Date(existing.updated_at || existing.created_at || 0).getTime();
        const b = new Date(r.updated_at || r.created_at || 0).getTime();
        if (b >= a) mensaisMap.set(key, r);
      }
    } else {
      diarios.push(r);
    }
  }
  // Ordena mensais: mais recente primeiro, depois por código de indicador.
  const mensais = Array.from(mensaisMap.values()).sort((a, b) => {
    const dr = b.data_referencia.localeCompare(a.data_referencia);
    if (dr !== 0) return dr;
    return (a.indicators?.codigo ?? '').localeCompare(b.indicators?.codigo ?? '');
  });
  return { diarios, mensais };
}

/** Formata "YYYY-MM-01" como "Outubro/2026" (capitalizado). */
export function formatMonthLabel(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m] = dateStr.split('-');
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
  return `${months[idx]}/${y}`;
}