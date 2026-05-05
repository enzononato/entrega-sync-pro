/**
 * Parsing flexível de datas para imports CSV.
 * Retorna 'YYYY-MM-DD' válido ou null para qualquer entrada não-data
 * (incluindo cabeçalhos como "Data", strings vazias, lixo, etc.).
 */

function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Aceita os formatos:
 *  - DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
 *  - YYYY-MM-DD ou YYYY/MM/DD
 *  - DDMMYYYY (compactado, 7 ou 8 dígitos)
 *  - Excel serial number (>= 30000)
 *
 * Retorna null se a entrada não for uma data plausível
 * (ex.: "Data", "", "abc", números pequenos como "1").
 */
export function parseFlexibleDate(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Rejeita qualquer coisa que tenha letras (ex.: "Data", "N/A")
  if (/[a-zA-Z]/.test(s)) return null;

  // YYYY-MM-DD ou YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    return isValidYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = +m[3];
    if (y < 100) y += y >= 50 ? 1900 : 2000;
    return isValidYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // Compactado DDMMYYYY (7 ou 8 dígitos)
  if (/^\d{7,8}$/.test(s)) {
    const padded = s.padStart(8, '0');
    const d = +padded.slice(0, 2);
    const mo = +padded.slice(2, 4);
    const y = +padded.slice(4, 8);
    return isValidYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // Excel serial date (apenas números grandes plausíveis)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n >= 30000 && n <= 80000) {
      const ms = Math.round((n - 25569) * 86400 * 1000);
      const dt = new Date(ms);
      const y = dt.getUTCFullYear();
      const mo = dt.getUTCMonth() + 1;
      const d = dt.getUTCDate();
      return isValidYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
    return null;
  }

  return null;
}