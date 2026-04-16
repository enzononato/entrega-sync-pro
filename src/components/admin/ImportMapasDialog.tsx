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

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  const [progress, setProgress] = useState('');
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
          const csvIdx = CSV_COLUMNS.findIndex(c => stripAccents(c.toLowerCase()) === stripAccents(h.toLowerCase()));
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
      // Buscar mapa matrícula → user_id
      const allMatriculas = new Set<string>();
      rows.forEach(r => {
        const mot = String(r.cd_mot || '').trim();
        const a1 = String(r.cd_aju1 || '').trim();
        const a2 = String(r.cd_aju2 || '').trim();
        if (mot && mot !== '0') allMatriculas.add(mot);
        if (a1 && a1 !== '0') allMatriculas.add(a1);
        if (a2 && a2 !== '0') allMatriculas.add(a2);
      });

      const matriculaToUserId: Record<string, string> = {};
      if (allMatriculas.size > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, matricula')
          .in('matricula', Array.from(allMatriculas));
        users?.forEach(u => { matriculaToUserId[u.matricula] = u.id; });
      }

      const enriched = rows.map(r => {
        const mot = String(r.cd_mot || '').trim();
        const a1 = String(r.cd_aju1 || '').trim();
        const a2 = String(r.cd_aju2 || '').trim();
        return {
          ...r,
          mot_user_id: (mot && mot !== '0') ? matriculaToUserId[mot] || null : null,
          aju1_user_id: (a1 && a1 !== '0') ? matriculaToUserId[a1] || null : null,
          aju2_user_id: (a2 && a2 !== '0') ? matriculaToUserId[a2] || null : null,
        };
      });

      const batchSize = 500;
      const totalBatches = Math.ceil(enriched.length / batchSize);
      for (let i = 0; i < enriched.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1;
        setProgress(`Lote ${batchNum}/${totalBatches} (${Math.min(i + batchSize, enriched.length)}/${enriched.length} registros)`);
        const batch = enriched.slice(i, i + batchSize);
        const { error } = await supabase.from('mapa_historico').upsert(batch as any, { onConflict: 'mapa,data_operacao' });
        if (error) throw error;
      }

      // Recalcular indicadores a partir dos mapas importados
      setProgress('Recalculando indicadores...');
      try {
        const { error: calcErr } = await supabase.functions.invoke('calculate-daily-indicators', { body: {} });
        if (calcErr) console.error('Erro ao calcular indicadores:', calcErr);
      } catch (e) {
        console.error('Erro ao chamar calculate-daily-indicators:', e);
      }

      const matched = new Set(Object.keys(matriculaToUserId)).size;
      const total = allMatriculas.size;
      toast.success(`${rows.length} registros importados e indicadores recalculados! (${matched}/${total} matrículas vinculadas)`);
      setRows([]);
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error('Erro na importação: ' + err.message);
    } finally {
      setImporting(false);
      setProgress('');
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
              {importing && progress && <p className="text-xs text-muted-foreground text-center">{progress}</p>}
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
