import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUnidades } from '@/hooks/useUnidades';
import { useCreateUsuario } from '@/hooks/useUsuarios';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface CsvRow {
  nome: string;
  cpf: string;
  email: string;
  password: string;
  matricula: string;
  role: string;
  worker_type: string;
  ativo: boolean;
  codigo_unidade: string;
}

interface ImportResult {
  success: number;
  errors: { nome: string; error: string }[];
}

export function ImportColaboradoresDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { data: units = [] } = useUnidades();
  const qc = useQueryClient();

  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const reset = () => {
    setRows([]);
    setFileName('');
    setProgress({ current: 0, total: 0 });
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const parseCsv = (text: string): CsvRow[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, '').toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return {
        nome: obj['nome'] || '',
        cpf: obj['cpf'] || '',
        email: obj['email'] || '',
        password: obj['password'] || 'rev123',
        matricula: obj['matricula'] || '',
        role: obj['role'] || 'colaborador',
        worker_type: obj['worker_type'] || '',
        ativo: (obj['ativo'] || 'true').toLowerCase() === 'true',
        codigo_unidade: obj['codigo_unidade'] || '',
      };
    }).filter(r => r.nome);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCsv(text));
    };
    reader.readAsText(file, 'utf-8');
  };

  const motoristas = rows.filter(r => r.worker_type === 'motorista').length;
  const ajudantes = rows.filter(r => r.worker_type === 'ajudante').length;
  const outros = rows.length - motoristas - ajudantes;

  const processRow = async (row: CsvRow, session: any): Promise<{ ok: boolean; nome: string; error?: string }> => {
    try {
      const unit = units.find(u => u.codigo.toUpperCase() === row.codigo_unidade.toUpperCase());
      const unitId = unit?.id || null;

      const res = await supabase.functions.invoke('create-user', {
        body: {
          email: row.email,
          password: row.password,
          nome: row.nome,
          matricula: row.matricula.toUpperCase(),
          cpf: row.cpf || null,
          role: row.role || 'colaborador',
          worker_type: row.worker_type || null,
          unidade_id: unitId,
          rota_id: null,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      if (unitId && res.data?.user_id) {
        await supabase.from('user_units').insert({ user_id: res.data.user_id, unit_id: unitId });
      }

      return { ok: true, nome: row.nome };
    } catch (err: any) {
      return { ok: false, nome: row.nome, error: err.message || 'Erro desconhecido' };
    }
  };

  const BATCH_SIZE = 5;

  const handleImport = async () => {
    setImporting(true);
    setProgress({ current: 0, total: rows.length });
    const errors: { nome: string; error: string }[] = [];
    let success = 0;

    const { data: { session } } = await supabase.auth.getSession();

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(row => processRow(row, session)));
      
      for (const r of results) {
        if (r.ok) success++;
        else errors.push({ nome: r.nome, error: r.error! });
      }
      setProgress({ current: Math.min(i + BATCH_SIZE, rows.length), total: rows.length });
    }

    setResult({ success, errors });
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['users-paginated'] });

    if (success > 0) {
      toast({ title: `${success} colaborador(es) importado(s) com sucesso!` });
    }
    if (errors.length > 0) {
      toast({ title: `${errors.length} erro(s) na importação`, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg">Importar Colaboradores</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* File Upload */}
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Selecione um arquivo CSV com as colunas: <span className="font-mono text-[10px]">nome, cpf, email, password, matricula, role, worker_type, ativo, codigo_unidade</span>
            </p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
            <Button variant="outline" className="w-full h-20 border-dashed gap-2" onClick={() => fileRef.current?.click()}>
              {fileName ? (
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Clique para selecionar o CSV</span>
                </div>
              )}
            </Button>
          </div>

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Preview da Importação</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Motoristas: <strong className="text-foreground">{motoristas}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-violet-500" />
                  <span className="text-muted-foreground">Ajudantes: <strong className="text-foreground">{ajudantes}</strong></span>
                </div>
                {outros > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground">Outros: <strong className="text-foreground">{outros}</strong></span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Total: <strong className="text-foreground">{rows.length}</strong> colaboradores serão criados
              </p>

              {/* Show unique units */}
              <div className="text-[11px] text-muted-foreground">
                Unidades: {[...new Set(rows.map(r => r.codigo_unidade))].filter(Boolean).join(', ') || 'Nenhuma'}
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && progress.total > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Processando...</span>
                <span className="font-mono">{progress.current}/{progress.total}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {Math.round((progress.current / progress.total) * 100)}% concluído
              </p>
            </div>
          )

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-foreground font-medium">{result.success} importado(s) com sucesso</span>
                </div>
                {result.errors.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-foreground font-medium">{result.errors.length} erro(s)</span>
                  </div>
                )}
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 max-h-40 overflow-y-auto space-y-1.5">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                      <span><strong>{e.nome}</strong>: {e.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border/50 pt-4">
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }} disabled={importing}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={importing || rows.length === 0}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importar {rows.length > 0 ? `(${rows.length})` : ''}
            </Button>
          )}
          {result && (
            <Button variant="outline" onClick={reset}>Nova Importação</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
