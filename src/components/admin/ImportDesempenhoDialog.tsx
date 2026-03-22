import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParsedRow {
  matricula: string;
  codigo_indicador: string;
  data_referencia: string;
  valor: number;
  meta: number;
  // resolved
  user_id?: string;
  indicator_id?: string;
  nome_colab?: string;
  nome_indicador?: string;
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarios: { id: string; matricula: string; nome: string; worker_type: string | null }[];
  indicators: { id: string; codigo: string; nome: string }[];
  onImport: (rows: { user_id: string; indicator_id: string; data_referencia: string; valor: number; meta: number; origem_dado: string }[]) => Promise<void>;
}

export function ImportDesempenhoDialog({ open, onOpenChange, usuarios, indicators, onImport }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setRows([]); setFileName(''); setDone(false); };

  const resolveRow = useCallback((raw: Record<string, any>): ParsedRow => {
    const matricula = String(raw['matricula'] ?? raw['Matricula'] ?? raw['MATRICULA'] ?? '').trim().toUpperCase();
    const codigo = String(raw['codigo_indicador'] ?? raw['codigo'] ?? raw['Codigo'] ?? raw['CODIGO'] ?? '').trim().toUpperCase();
    const dataRef = String(raw['data_referencia'] ?? raw['data'] ?? raw['Data'] ?? raw['DATA'] ?? '').trim();
    const valor = parseFloat(raw['valor'] ?? raw['Valor'] ?? raw['VALOR'] ?? 0) || 0;
    const meta = parseFloat(raw['meta'] ?? raw['Meta'] ?? raw['META'] ?? 0) || 0;

    const user = usuarios.find(u => u.matricula.toUpperCase() === matricula);
    const ind = indicators.find(i => i.codigo.toUpperCase() === codigo);

    // Try to parse date in dd/MM/yyyy or yyyy-MM-dd
    let parsedDate = dataRef;
    if (dataRef.includes('/')) {
      const parts = dataRef.split('/');
      if (parts.length === 3) parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(parsedDate);

    let error: string | undefined;
    if (!matricula) error = 'Matrícula vazia';
    else if (!user) error = `Matrícula "${matricula}" não encontrada`;
    else if (!ind) error = `Indicador "${codigo}" não encontrado`;
    else if (!dateValid) error = `Data inválida: "${dataRef}"`;
    else if (valor <= 0) error = 'Valor deve ser > 0';

    return {
      matricula, codigo_indicador: codigo, data_referencia: parsedDate, valor, meta,
      user_id: user?.id, indicator_id: ind?.id,
      nome_colab: user?.nome, nome_indicador: ind?.nome, error,
    };
  }, [usuarios, indicators]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
      setRows(jsonRows.map(resolveRow));
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const validRows = rows.filter(r => !r.error);
  const errorRows = rows.filter(r => !!r.error);

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImport(validRows.map(r => ({
        user_id: r.user_id!, indicator_id: r.indicator_id!,
        data_referencia: r.data_referencia, valor: r.valor, meta: r.meta,
        origem_dado: 'importacao',
      })));
      setDone(true);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['matricula', 'codigo_indicador', 'data_referencia', 'valor', 'meta'],
      ['MAT001', 'TML', '2026-03-22', 95, 100],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_importacao_desempenho.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" /> Importar Lançamentos
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-foreground">Importação concluída!</p>
              <p className="text-sm text-muted-foreground mt-1">{validRows.length} lançamento(s) importados com sucesso.</p>
              <Button className="mt-4" onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
            </div>
          ) : rows.length === 0 ? (
            <>
              <div className="text-center py-6">
                <div
                  className="border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Arraste ou clique para selecionar arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .csv, .xlsx, .xls</p>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Formato esperado</h4>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 pr-4 font-semibold text-foreground">matricula</th>
                        <th className="text-left py-1.5 pr-4 font-semibold text-foreground">codigo_indicador</th>
                        <th className="text-left py-1.5 pr-4 font-semibold text-foreground">data_referencia</th>
                        <th className="text-left py-1.5 pr-4 font-semibold text-foreground">valor</th>
                        <th className="text-left py-1.5 font-semibold text-foreground">meta</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr><td className="py-1 pr-4 font-mono">MAT001</td><td className="pr-4 font-mono">TML</td><td className="pr-4 font-mono">2026-03-22</td><td className="pr-4">95</td><td>100</td></tr>
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> Baixar modelo
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{fileName}</span>
                  <button onClick={reset} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600 font-medium">{validRows.length} válidos</span>
                  {errorRows.length > 0 && <span className="text-destructive font-medium">{errorRows.length} com erro</span>}
                </div>
              </div>

              <ScrollArea className="h-64 rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                      <th className="text-left px-3 py-2 font-semibold">Matrícula</th>
                      <th className="text-left px-3 py-2 font-semibold">Colaborador</th>
                      <th className="text-left px-3 py-2 font-semibold">Indicador</th>
                      <th className="text-left px-3 py-2 font-semibold">Data</th>
                      <th className="text-right px-3 py-2 font-semibold">Valor</th>
                      <th className="text-right px-3 py-2 font-semibold">Meta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {rows.map((r, i) => (
                      <tr key={i} className={cn(r.error && 'bg-destructive/5')}>
                        <td className="px-3 py-2">
                          {r.error ? (
                            <span className="inline-flex items-center gap-1 text-destructive" title={r.error}>
                              <AlertCircle className="h-3.5 w-3.5" /> Erro
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" /> OK
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">{r.matricula}</td>
                        <td className="px-3 py-2">{r.nome_colab ?? <span className="text-destructive italic">{r.error}</span>}</td>
                        <td className="px-3 py-2">{r.nome_indicador ?? r.codigo_indicador}</td>
                        <td className="px-3 py-2">{r.data_referencia}</td>
                        <td className="px-3 py-2 text-right font-medium">{r.valor}</td>
                        <td className="px-3 py-2 text-right">{r.meta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}
        </div>

        {rows.length > 0 && !done && (
          <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing || validRows.length === 0} className="gap-2">
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar {validRows.length} lançamento(s)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
