import { useState, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, ChevronDown, Truck, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── De-Para: prefixo da coluna da planilha → código do indicador no banco ── */
const COLUMN_MAP: Record<string, string> = {
  'Dev. PDV': 'DEV_PDV',
  'Disp. Tem.': 'DISP_TEMPO',
  'Rating': 'RATING',
  'PDV crítico': 'PDV_CRITICO',
  'Reposição': 'REPOSICAO',
  'Relatos': 'RELATOS',
  'Refugo': 'REFUGO',
};

/* ── Indicadores por cargo ── */
const MOTORISTA_CODES = ['DEV_PDV', 'DISP_TEMPO', 'RATING', 'PDV_CRITICO', 'REPOSICAO'];
const AJUDANTE_CODES = ['RATING', 'RELATOS', 'REFUGO'];

function cargoToCodes(cargo: string): string[] | null {
  const c = cargo.toLowerCase().trim();
  if (c.includes('motorista')) return MOTORISTA_CODES;
  if (c.includes('ajudante')) return AJUDANTE_CODES;
  return null;
}

function cargoToWorkerType(cargo: string): 'motorista' | 'ajudante' | null {
  const c = cargo.toLowerCase().trim();
  if (c.includes('motorista')) return 'motorista';
  if (c.includes('ajudante')) return 'ajudante';
  return null;
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface ColumnInfo {
  code: string;       // código do indicador (ex: DEV_PDV)
  realColIdx: number; // índice da coluna "Real" na planilha
  meta: number;       // meta extraída do header
}

interface ParsedRecord {
  matricula: string;
  cargo: string;
  workerType: 'motorista' | 'ajudante';
  userId: string;
  indicatorCode: string;
  indicatorId: string;
  valor: number;
  meta: number;
}

interface ParseError {
  row: number;
  msg: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarios: { id: string; matricula: string; worker_type: string | null; nome: string }[];
  indicators: { id: string; codigo: string; nome: string }[];
  onImport: (rows: { user_id: string; indicator_id: string; data_referencia: string; valor: number; meta: number; origem_dado: string }[]) => Promise<void>;
}

export function ImportacaoRevalleDialog({ open, onOpenChange, usuarios, indicators, onImport }: Props) {
  const [mesRef, setMesRef] = useState('');
  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const indicatorMap = useMemo(() => {
    const m: Record<string, string> = {};
    indicators.forEach(i => { m[i.codigo.toUpperCase()] = i.id; });
    return m;
  }, [indicators]);

  const userMap = useMemo(() => {
    const m: Record<string, { id: string; worker_type: string | null }> = {};
    usuarios.forEach(u => { m[u.matricula.trim()] = { id: u.id, worker_type: u.worker_type }; });
    return m;
  }, [usuarios]);

  const reset = useCallback(() => {
    setFileName('');
    setRecords([]);
    setErrors([]);
    setImporting(false);
    setDone(false);
    setDetailsOpen(false);
  }, []);

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rawRows.length < 3) {
          setErrors([{ row: 0, msg: 'Planilha com menos de 3 linhas — verifique o formato.' }]);
          return;
        }

        // ── Localizar headers ──
        // Procurar a linha que contém "Matrícula"
        let headerRowIdx = -1;
        let matriculaColIdx = -1;
        let cargoColIdx = -1;

        for (let r = 0; r < Math.min(10, rawRows.length); r++) {
          const row = rawRows[r].map((c: any) => String(c).trim());
          const mIdx = row.findIndex((c: string) => c.toLowerCase().includes('matrícula') || c.toLowerCase().includes('matricula'));
          if (mIdx >= 0) {
            headerRowIdx = r;
            matriculaColIdx = mIdx;
            const cIdx = row.findIndex((c: string) => c.toLowerCase().includes('cargo'));
            cargoColIdx = cIdx >= 0 ? cIdx : -1;
            break;
          }
        }

        if (headerRowIdx < 0 || matriculaColIdx < 0) {
          setErrors([{ row: 0, msg: 'Coluna "Matrícula" não encontrada nas primeiras 10 linhas.' }]);
          return;
        }

        // ── Mapear colunas de indicadores ──
        // Percorrer todos os headers para encontrar prefixos do COLUMN_MAP
        // e a sub-coluna "Real" adjacente
        const headerRow = rawRows[headerRowIdx].map((c: any) => String(c).trim());
        // Pode haver uma segunda linha de sub-headers (Real, Meta, etc.)
        const subHeaderRow = headerRowIdx + 1 < rawRows.length
          ? rawRows[headerRowIdx + 1].map((c: any) => String(c).trim())
          : [];

        const columns: ColumnInfo[] = [];

        for (let c = 0; c < headerRow.length; c++) {
          const h = headerRow[c];
          if (!h) continue;

          for (const [prefix, code] of Object.entries(COLUMN_MAP)) {
            if (h.toLowerCase().includes(prefix.toLowerCase())) {
              // Extrair meta do header
              let meta = 0;
              const metaMatch = h.match(/Meta\s*([\d]+[.,]?\d*)/i);
              if (metaMatch) {
                meta = parseFloat(metaMatch[1].replace(',', '.'));
              }

              // Encontrar a coluna "Real" — pode ser no sub-header ou nas colunas adjacentes
              let realIdx = -1;

              // Caso 1: sub-header na mesma coluna ou adjacente
              for (let sc = c; sc < Math.min(c + 5, subHeaderRow.length); sc++) {
                if (subHeaderRow[sc]?.toLowerCase().includes('real')) {
                  realIdx = sc;
                  break;
                }
              }

              // Caso 2: se não tem sub-header, usar a própria coluna
              if (realIdx < 0) {
                // Verificar se o header adjacente contém "Real"
                for (let sc = c; sc < Math.min(c + 5, headerRow.length); sc++) {
                  if (headerRow[sc]?.toLowerCase().includes('real')) {
                    realIdx = sc;
                    break;
                  }
                }
              }

              // Fallback: usar a própria coluna
              if (realIdx < 0) realIdx = c;

              // Verificar se o indicador existe no banco
              if (indicatorMap[code]) {
                columns.push({ code, realColIdx: realIdx, meta });
              }
              break;
            }
          }
        }

        if (columns.length === 0) {
          setErrors([{ row: 0, msg: 'Nenhuma coluna de indicador reconhecida. Verifique os headers da planilha.' }]);
          return;
        }

        // ── Parse das linhas de dados ──
        const dataStartRow = subHeaderRow.length > 0 && subHeaderRow.some((s: string) => s.toLowerCase().includes('real'))
          ? headerRowIdx + 2
          : headerRowIdx + 1;

        const parsed: ParsedRecord[] = [];
        const errs: ParseError[] = [];

        for (let r = dataStartRow; r < rawRows.length; r++) {
          const row = rawRows[r];
          const matricula = String(row[matriculaColIdx] ?? '').trim();
          if (!matricula || matricula === '0') continue;

          const cargo = cargoColIdx >= 0 ? String(row[cargoColIdx] ?? '').trim() : '';
          const allowedCodes = cargoToCodes(cargo);
          const wt = cargoToWorkerType(cargo);

          if (!allowedCodes || !wt) {
            if (cargo) errs.push({ row: r + 1, msg: `Cargo desconhecido: "${cargo}" (Matrícula: ${matricula})` });
            continue;
          }

          const user = userMap[matricula];
          if (!user) {
            errs.push({ row: r + 1, msg: `Matrícula não encontrada: ${matricula}` });
            continue;
          }

          for (const col of columns) {
            if (!allowedCodes.includes(col.code)) continue;
            const rawVal = row[col.realColIdx];
            const valor = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(',', '.'));
            if (isNaN(valor)) continue;

            parsed.push({
              matricula,
              cargo,
              workerType: wt,
              userId: user.id,
              indicatorCode: col.code,
              indicatorId: indicatorMap[col.code],
              valor,
              meta: col.meta,
            });
          }
        }

        setRecords(parsed);
        setErrors(errs);
      } catch {
        setErrors([{ row: 0, msg: 'Erro ao ler o arquivo. Verifique se é um XLSX válido.' }]);
      }
    };
    reader.readAsBinaryString(file);
  }, [indicatorMap, userMap]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRecords([]);
    setErrors([]);
    setDone(false);
    parseFile(file);
  };

  const motoristas = useMemo(() => [...new Set(records.filter(r => r.workerType === 'motorista').map(r => r.userId))].length, [records]);
  const ajudantes = useMemo(() => [...new Set(records.filter(r => r.workerType === 'ajudante').map(r => r.userId))].length, [records]);

  const doImport = async () => {
    if (!mesRef || records.length === 0) return;
    setImporting(true);
    try {
      const dataRef = lastDayOfMonth(mesRef);
      const rows = records.map(r => ({
        user_id: r.userId,
        indicator_id: r.indicatorId,
        data_referencia: dataRef,
        valor: r.valor,
        meta: r.meta,
        origem_dado: 'importacao',
      }));
      await onImport(rows);
      setDone(true);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar Fecho Operacional
            </DialogTitle>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="px-6 py-5 space-y-5">
            {done ? (
              /* ── Sucesso ── */
              <div className="text-center py-8 space-y-3">
                <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
                <h3 className="text-lg font-bold text-foreground">Importação concluída!</h3>
                <p className="text-sm text-muted-foreground">
                  {records.length} lançamentos importados com sucesso.
                </p>
                <Button variant="outline" onClick={() => handleClose(false)}>Fechar</Button>
              </div>
            ) : (
              <>
                {/* ── Step 1: Mês + Upload ── */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Data de Referência (Mês) *</Label>
                    <Input
                      type="month"
                      className="h-9 max-w-[220px]"
                      value={mesRef}
                      onChange={e => setMesRef(e.target.value)}
                    />
                    {mesRef && (
                      <p className="text-[11px] text-muted-foreground">
                        Todos os registos serão salvos com data: <strong>{lastDayOfMonth(mesRef)}</strong>
                      </p>
                    )}
                  </div>

                  <div
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                      'hover:border-primary/50 hover:bg-primary/5',
                      fileName ? 'border-primary/30 bg-primary/5' : 'border-border'
                    )}
                  >
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    {fileName ? (
                      <p className="text-sm font-medium text-foreground">{fileName}</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-foreground">Clique ou arraste o arquivo</p>
                        <p className="text-xs text-muted-foreground mt-1">Formatos: .xlsx, .xls</p>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Step 2: Preview ── */}
                {records.length > 0 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-3 text-center">
                        <Truck className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{motoristas}</p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-500">Motoristas</p>
                      </div>
                      <div className="rounded-lg border bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 p-3 text-center">
                        <UserCheck className="h-5 w-5 text-violet-600 mx-auto mb-1" />
                        <p className="text-xl font-bold text-violet-700 dark:text-violet-400">{ajudantes}</p>
                        <p className="text-[10px] text-violet-600 dark:text-violet-500">Ajudantes</p>
                      </div>
                      <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 text-center">
                        <FileSpreadsheet className="h-5 w-5 text-primary mx-auto mb-1" />
                        <p className="text-xl font-bold text-primary">{records.length}</p>
                        <p className="text-[10px] text-muted-foreground">Lançamentos</p>
                      </div>
                    </div>

                    {errors.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-300">{errors.length} aviso(s)</span>
                        </div>
                        <ul className="text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5 max-h-24 overflow-auto">
                          {errors.map((e, i) => (
                            <li key={i}>Linha {e.row}: {e.msg}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs w-full justify-between">
                          Ver detalhes dos lançamentos
                          <ChevronDown className={cn('h-4 w-4 transition-transform', detailsOpen && 'rotate-180')} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="rounded-lg border overflow-hidden mt-2">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-2 font-bold text-muted-foreground">Matrícula</th>
                                <th className="text-left p-2 font-bold text-muted-foreground">Cargo</th>
                                <th className="text-left p-2 font-bold text-muted-foreground">Indicador</th>
                                <th className="text-right p-2 font-bold text-muted-foreground">Valor</th>
                                <th className="text-right p-2 font-bold text-muted-foreground">Meta</th>
                              </tr>
                            </thead>
                            <tbody>
                              {records.slice(0, 100).map((r, i) => (
                                <tr key={i} className="border-t border-border/50">
                                  <td className="p-2 font-mono">{r.matricula}</td>
                                  <td className="p-2">
                                    <span className={cn(
                                      'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                                      r.workerType === 'motorista' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
                                    )}>
                                      {r.workerType === 'motorista' ? 'Mot' : 'Aj'}
                                    </span>
                                  </td>
                                  <td className="p-2 font-mono">{r.indicatorCode}</td>
                                  <td className="p-2 text-right font-medium">{r.valor}</td>
                                  <td className="p-2 text-right text-muted-foreground">{r.meta}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {records.length > 100 && (
                            <p className="text-[10px] text-muted-foreground text-center py-2">
                              Mostrando 100 de {records.length} registos
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {records.length === 0 && errors.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                      <span className="text-xs font-bold text-red-800 dark:text-red-300">Erros na importação</span>
                    </div>
                    <ul className="text-[11px] text-red-700 dark:text-red-400 space-y-0.5">
                      {errors.map((e, i) => (
                        <li key={i}>{e.msg}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {!done && (
          <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
            <Button
              onClick={doImport}
              disabled={importing || records.length === 0 || !mesRef}
            >
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importar {records.length} lançamento(s)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
