import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CSV_COLUMNS = [
  'Data','Transp','Entrega','CargaAtual','Frota','CustoSpot','Regiao','Veiculo','Placa','Mapa',
  'Capac.','Entregas','CxCarreg','CxEntreg','Ocup.','CxRota','CxAS','VeicBM','RShow','EntrVol',
  'HrSai','HrEntr','KmSai','KmEntr','KmPrev','TempoPrev','VlPtoMot','VlPtoAjd','VlEqMot','VlEqAjd',
  'CdMot','CdAju1','CdAju2','KmDesloc','KmLaco','TmpoDesloc','TmpoLaco','TmpoInterno',
  'MotNaoCarr','CxCarrCom','CapacidadeVeiculoKG','PesoCargaKG','ClassificacaoRoadshow','ClassificacaoRoads',
];

const DB_COLUMNS = [
  'data_operacao','transp','entrega','carga_atual','frota','custo_spot','regiao','veiculo','placa','mapa',
  'capacidade','entregas','cx_carreg','cx_entreg','ocupacao','cx_rota','cx_as','veic_bm','rshow','entr_vol',
  'hr_sai','hr_entr','km_sai','km_entr','km_prev','tempo_prev','vl_pto_mot','vl_pto_ajd','vl_eq_mot','vl_eq_ajd',
  'cd_mot','cd_aju1','cd_aju2','km_desloc','km_laco','tmpo_desloc','tmpo_laco','tmpo_interno',
  'mot_nao_carr','cx_carr_com','capacidade_veiculo_kg','peso_carga_kg','classificacao_roadshow','classificacao_roads',
];

const NUMERIC_COLS = new Set([
  'custo_spot','capacidade','cx_carreg','cx_entreg','ocupacao','cx_rota','cx_as','veic_bm','rshow',
  'km_sai','km_entr','km_prev','vl_pto_mot','vl_pto_ajd','vl_eq_mot','vl_eq_ajd',
  'km_desloc','km_laco','mot_nao_carr','cx_carr_com','capacidade_veiculo_kg','peso_carga_kg',
]);
const INT_COLS = new Set(['transp','entregas']);

function parseDate(raw: string): string {
  const s = raw.trim();
  if (s.includes('/')) {
    const [d, m, y] = s.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  if (!s.includes('-') && /^\d{7,8}$/.test(s)) {
    const padded = s.padStart(8, '0');
    const dd = padded.slice(0, 2);
    const mm = padded.slice(2, 4);
    const yyyy = padded.slice(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }
  return s;
}

function parseBrNum(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function parseCsvLine(line: string): string[] {
  return line.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
}

interface Props {
  onSuccess: () => void;
}

export function ImportMapasDialog({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV vazio'); return; }

      const header = parseCsvLine(lines[0]);
      const mapaIdx = header.findIndex(h => h.toLowerCase() === 'mapa');
      if (mapaIdx < 0) { toast.error('Coluna "Mapa" não encontrada no cabeçalho'); return; }

      const parsed: Record<string, unknown>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 10) continue;
        const row: Record<string, unknown> = {};
        header.forEach((h, idx) => {
          const csvIdx = CSV_COLUMNS.findIndex(c => c.toLowerCase() === h.toLowerCase());
          if (csvIdx < 0) return;
          const dbCol = DB_COLUMNS[csvIdx];
          const val = cols[idx] ?? '';
          if (dbCol === 'data_operacao') row[dbCol] = parseDate(val);
          else if (INT_COLS.has(dbCol)) row[dbCol] = parseInt(val) || 0;
          else if (NUMERIC_COLS.has(dbCol)) row[dbCol] = parseBrNum(val);
          else row[dbCol] = val;
        });
        if (row.mapa) parsed.push(row);
      }
      setRows(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const batchSize = 200;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from('mapa_historico').insert(batch as any);
        if (error) throw error;
      }
      toast.success(`${rows.length} registros importados!`);
      setRows([]);
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error('Erro na importação: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRows([]); }}>
      <DialogTrigger asChild>
        <Button><Upload className="h-4 w-4 mr-2" /> Importar CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Mapas (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione um arquivo CSV com separador <code>;</code> contendo as colunas da planilha de operação.
          </p>
          <input ref={inputRef} type="file" accept=".csv,.txt" onChange={handleFile} className="block w-full text-sm" />
          {rows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{rows.length} registros encontrados</p>
              <div className="max-h-48 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead><tr className="bg-muted">
                    <th className="p-1">Data</th><th className="p-1">Mapa</th><th className="p-1">Placa</th><th className="p-1">CdMot</th><th className="p-1">Entregas</th>
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">{String(r.data_operacao)}</td>
                        <td className="p-1">{String(r.mapa)}</td>
                        <td className="p-1">{String(r.placa)}</td>
                        <td className="p-1">{String(r.cd_mot)}</td>
                        <td className="p-1">{String(r.entregas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && <p className="p-1 text-center text-muted-foreground">... e mais {rows.length - 20}</p>}
              </div>
              <Button onClick={handleImport} disabled={importing} className="w-full">
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</> : <><FileUp className="h-4 w-4 mr-2" /> Confirmar Importação</>}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
