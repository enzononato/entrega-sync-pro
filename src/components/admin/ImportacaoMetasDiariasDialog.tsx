import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2, Truck, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { User } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarios: Pick<User, 'id' | 'matricula' | 'nome'>[];
}

interface ParsedRow {
  mapa: string;
  fase: string;
  veiculo: string;
  placa: string;
  frota_cadastro: string;
  tipo_mapa: string;
  data_operacao: string;
  hora_operacao: string;
  usuario: string;
  motorista_matricula: string;
  user_id: string | null;
}

interface ParseResult {
  totalMapas: number;
  approvedMapas: number;
  discardedMapas: number;
  rows: ParsedRow[];
  warnings: string[];
}

function parseCSV(text: string, usuarios: Props['usuarios']): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { totalMapas: 0, approvedMapas: 0, discardedMapas: 0, rows: [], warnings: [] };

  const headers = lines[0].split(';').map(h => h.trim());
  const idx = (name: string) => headers.findIndex(h => h.toUpperCase() === name.toUpperCase());

  const iMapa = idx('Mapa');
  const iFase = idx('Fase');
  const iVeiculo = idx('Veiculo');
  const iPlaca = idx('Placa');
  const iFrota = idx('Frota Cadastro');
  const iTipo = idx('Tipo Mapa');
  const iDtOper = idx('DtOper');
  const iHrOper = idx('HrOper');
  const iUsuario = idx('Usuario');
  const iMotorista = idx('Motorista');

  const missing = [
    iMapa < 0 && 'Mapa', iFase < 0 && 'Fase', iVeiculo < 0 && 'Veiculo',
    iPlaca < 0 && 'Placa', iFrota < 0 && 'Frota Cadastro', iTipo < 0 && 'Tipo Mapa',
    iDtOper < 0 && 'DtOper', iHrOper < 0 && 'HrOper', iUsuario < 0 && 'Usuario',
    iMotorista < 0 && 'Motorista',
  ].filter(Boolean) as string[];

  if (missing.length) {
    return { totalMapas: 0, approvedMapas: 0, discardedMapas: 0, rows: [], warnings: [`Colunas não encontradas: ${missing.join(', ')}`] };
  }

  // Group by mapa
  const grouped: Record<string, { cols: string[][] }> = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim());
    const mapa = cols[iMapa]?.trim();
    if (!mapa) continue;
    if (!grouped[mapa]) grouped[mapa] = { cols: [] };
    grouped[mapa].cols.push(cols);
  }

  const totalMapas = Object.keys(grouped).length;
  const warnings: string[] = [];
  const approvedRows: ParsedRow[] = [];
  let discardedMapas = 0;

  // Build matricula -> user map
  const userMap = new Map<string, string>();
  usuarios.forEach(u => {
    if (u.matricula) userMap.set(u.matricula.trim(), u.id);
  });

  for (const [mapa, { cols: rowsCols }] of Object.entries(grouped)) {
    // Strict validation: ALL lines must be Padronizada + Rota
    const allValid = rowsCols.every(cols => {
      const frota = (cols[iFrota] ?? '').trim().toUpperCase();
      const tipo = (cols[iTipo] ?? '').trim().toUpperCase();
      return frota === 'PADRONIZADA' && tipo === 'ROTA';
    });

    if (!allValid) {
      discardedMapas++;
      continue;
    }

    // Discard maps where "Saida Cdd/Fab" phase has time outside 07:00–16:59
    const hasInvalidSaida = rowsCols.some(cols => {
      const fase = (cols[iFase] ?? '').trim().toUpperCase();
      if (!fase.includes('SAIDA CDD') && !fase.includes('SAIDA FAB')) return false;
      const hora = (cols[iHrOper] ?? '').trim();
      const hhmm = hora.replace(':', '').substring(0, 4);
      const numTime = parseInt(hhmm, 10);
      if (isNaN(numTime)) return false;
      return numTime > 1659 || numTime < 700;
    });

    if (hasInvalidSaida) {
      discardedMapas++;
      continue;
    }

    for (const cols of rowsCols) {
      const motorista = (cols[iMotorista] ?? '').trim();
      const userId = userMap.get(motorista) ?? null;
      if (motorista && !userId) {
        const warnKey = `Matrícula ${motorista} (Mapa ${mapa}) não encontrada no sistema`;
        if (!warnings.includes(warnKey)) warnings.push(warnKey);
      }

      // Parse date DD/MM/YYYY -> YYYY-MM-DD
      const rawDate = (cols[iDtOper] ?? '').trim();
      let dataOp = rawDate;
      const dateParts = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dateParts) dataOp = `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`;

      approvedRows.push({
        mapa,
        fase: (cols[iFase] ?? '').trim(),
        veiculo: (cols[iVeiculo] ?? '').trim(),
        placa: (cols[iPlaca] ?? '').trim(),
        frota_cadastro: (cols[iFrota] ?? '').trim(),
        tipo_mapa: (cols[iTipo] ?? '').trim(),
        data_operacao: dataOp,
        hora_operacao: (cols[iHrOper] ?? '').trim(),
        usuario: (cols[iUsuario] ?? '').trim(),
        motorista_matricula: motorista,
        user_id: userId,
      });
    }
  }

  return {
    totalMapas,
    approvedMapas: totalMapas - discardedMapas,
    discardedMapas,
    rows: approvedRows,
    warnings,
  };
}

export function ImportacaoMetasDiariasDialog({ open, onOpenChange, usuarios }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(1);
    setFileName('');
    setResult(null);
    setImporting(false);
    setProgress(0);
  }, []);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text, usuarios);
      setResult(parsed);
      setStep(2);
    };
    reader.readAsText(file, 'utf-8');
  }, [usuarios]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    if (!result?.rows.length) return;
    setImporting(true);
    setProgress(0);

    const BATCH = 200;
    const total = result.rows.length;
    let done = 0;

    try {
      for (let i = 0; i < total; i += BATCH) {
        const chunk = result.rows.slice(i, i + BATCH).map(r => ({
          mapa: r.mapa,
          fase: r.fase,
          veiculo: r.veiculo,
          placa: r.placa,
          frota_cadastro: r.frota_cadastro,
          tipo_mapa: r.tipo_mapa,
          data_operacao: r.data_operacao,
          hora_operacao: r.hora_operacao,
          usuario: r.usuario,
          motorista_matricula: r.motorista_matricula,
          user_id: r.user_id,
        }));

        const { error } = await supabase.from('mapa_historico' as any).insert(chunk as any);
        if (error) throw error;

        done += chunk.length;
        setProgress(Math.round((done / total) * 100));
      }

      // Calculate daily indicators from imported data
      const dates = [...new Set(result.rows.map(r => r.data_operacao))];
      try {
        const { error: calcErr } = await supabase.functions.invoke('calculate-daily-indicators', {
          body: { data_referencia: dates },
        });
        if (calcErr) console.error('Erro ao calcular indicadores:', calcErr);
        else toast.success(`${total} registros importados e indicadores calculados!`);
      } catch (calcE) {
        console.error('Erro ao calcular indicadores:', calcE);
        toast.success(`${total} registros importados (indicadores serão calculados em breve)`);
      }
      setStep(3);
    } catch (err: any) {
      toast.error('Erro na importação: ' + (err.message ?? err));
    } finally {
      setImporting(false);
    }
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" /> Importar Histórico de Mapas
          </DialogTitle>
          <DialogDescription>Importe um arquivo CSV com o histórico de mapas de entrega.</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Arraste o arquivo CSV aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Separador: ponto-e-vírgula (;)</p>
            </div>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {step === 2 && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> {fileName}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.totalMapas}</p>
                <p className="text-xs text-muted-foreground">Mapas únicos lidos</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-primary">{result.approvedMapas}</p>
                <p className="text-xs text-muted-foreground">Mapas aprovados (100% Padronizada/Rota)</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{result.discardedMapas}</p>
                <p className="text-xs text-muted-foreground">Mapas descartados (mistura)</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.rows.length}</p>
                <p className="text-xs text-muted-foreground">Linhas prontas para importação</p>
              </div>
            </div>

            {result.warnings.length > 0 && (
              <ScrollArea className="max-h-32">
                <div className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">{progress}%</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold">Importação concluída!</p>
            <p className="text-sm text-muted-foreground">{result?.rows.length} registros salvos com sucesso.</p>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <>
              <Button variant="ghost" onClick={reset} disabled={importing}>Voltar</Button>
              <Button onClick={handleImport} disabled={importing || !result?.rows.length}>
                {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importando...</> : `Importar ${result?.rows.length ?? 0} registro(s)`}
              </Button>
            </>
          )}
          {step === 3 && (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
