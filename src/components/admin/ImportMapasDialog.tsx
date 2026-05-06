import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ImportPreviewTable, RowStatus } from '@/components/admin/ImportPreviewTable';
import { createImportBatch, markImportBatchFailed, createFailedImportBatch } from '@/hooks/useImportBatches';
import { parseFlexibleDate } from '@/lib/dateParser';
import { fetchAllIn } from '@/lib/supabasePaginate';

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

function parseDate(raw: string): string | null {
  return parseFlexibleDate(raw);
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
  const [classifications, setClassifications] = useState<{ row: Record<string, unknown>; status: RowStatus; reason?: string }[]>([]);
  const [fileName, setFileName] = useState('');
  const [skipped, setSkipped] = useState<Record<string, number>>({});
  const [detectedCols, setDetectedCols] = useState<{ name: string; mapped: boolean }[]>([]);
  const [invalidLines, setInvalidLines] = useState<{ line: number; reason: string; preview?: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV vazio'); return; }

      const header = parseCsvLine(lines[0]);
      const mapaIdx = header.findIndex(h => h.toLowerCase() === 'mapa');
      if (mapaIdx < 0) { toast.error('Coluna "Mapa" não encontrada no cabeçalho'); return; }

      // Resumo de colunas detectadas vs reconhecidas
      const detected = header.map(h => {
        const csvIdx = CSV_COLUMNS.findIndex(c => stripAccents(c.toLowerCase()) === stripAccents(h.toLowerCase()));
        return { name: h, mapped: csvIdx >= 0 };
      });
      setDetectedCols(detected);

      const skipReasons: Record<string, number> = {};
      const invalids: { line: number; reason: string; preview?: string }[] = [];
      const pushInvalid = (lineNum: number, reason: string, raw: string) => {
        invalids.push({ line: lineNum, reason, preview: raw.slice(0, 120) });
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;
      };
      const parsed: Record<string, unknown>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const lineNum = i + 1;
        if (cols.length < 10) {
          pushInvalid(lineNum, 'Linha incompleta (< 10 campos)', lines[i]);
          continue;
        }
        // Pular linhas de cabeçalho repetidas (algumas exportações duplicam o header)
        if ((cols[0] || '').trim().toLowerCase() === 'data') {
          skipReasons['Cabeçalho repetido'] = (skipReasons['Cabeçalho repetido'] || 0) + 1;
          continue;
        }
        const row: Record<string, unknown> = {};
        header.forEach((h, idx) => {
          const csvIdx = CSV_COLUMNS.findIndex(c => stripAccents(c.toLowerCase()) === stripAccents(h.toLowerCase()));
          if (csvIdx < 0) return;
          const dbCol = DB_COLUMNS[csvIdx];
          const val = cols[idx] ?? '';
          if (dbCol === 'data_operacao') row[dbCol] = parseDate(val); // null se inválida
          else if (INT_COLS.has(dbCol)) row[dbCol] = parseInt(val) || 0;
          else if (NUMERIC_COLS.has(dbCol)) row[dbCol] = parseBrNum(val);
          else row[dbCol] = val;
        });
        // Validar data (parser já retorna null para entradas inválidas/cabeçalho)
        const dataStr = row.data_operacao as string | null;
        const dataOk = !!dataStr && /^\d{4}-\d{2}-\d{2}$/.test(dataStr);
        if (!row.mapa) {
          pushInvalid(lineNum, 'Mapa vazio', lines[i]);
        } else if (!dataOk) {
          const rawDate = (cols[header.findIndex(h => h.toLowerCase() === 'data')] || '').slice(0, 30);
          pushInvalid(lineNum, `Data inválida ("${rawDate}")`, lines[i]);
        } else {
          parsed.push(row);
        }
      }
      setRows(parsed);
      setSkipped(skipReasons);
      setInvalidLines(invalids);

      // Detectar duplicidade: mesma combinação mapa+data já existe no banco
      const keys = parsed.map(r => `${r.mapa}__${r.data_operacao}`);
      const existingSet = new Set<string>();
      try {
        const mapas = [...new Set(parsed.map(r => String(r.mapa)))];
        const datas = [...new Set(parsed.map(r => String(r.data_operacao)))];
        if (mapas.length && datas.length) {
          // Pagina sobre chunks de mapas para evitar o limite de 1000 linhas
          const datasSet = new Set(datas);
          const data = await fetchAllIn<{ mapa: string; data_operacao: string }>(
            (chunk) => supabase
              .from('mapa_historico')
              .select('mapa, data_operacao')
              .in('mapa', chunk),
            mapas,
          );
          data.forEach(d => {
            if (datasSet.has(String(d.data_operacao))) {
              existingSet.add(`${d.mapa}__${d.data_operacao}`);
            }
          });
        }
      } catch (e) {
        console.warn('Falha ao checar duplicidade de mapas:', e);
      }

      // Detectar duplicados dentro do próprio CSV
      const seenInBatch = new Set<string>();
      const cls = parsed.map((r, i) => {
        const k = keys[i];
        let status: RowStatus = 'novo';
        let reason: string | undefined;
        if (!r.mapa || !r.data_operacao) {
          status = 'invalido';
          reason = 'Mapa ou Data ausente';
        } else if (existingSet.has(k)) {
          status = 'duplicado';
          reason = 'Já existe no banco (mapa+data)';
        } else if (seenInBatch.has(k)) {
          status = 'duplicado';
          reason = 'Repetido no próprio CSV';
        } else {
          seenInBatch.add(k);
        }
        return { row: r, status, reason };
      });
      setClassifications(cls);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    const toInsert = classifications.filter(c => c.status === 'novo').map(c => c.row);
    if (!toInsert.length) {
      toast.error('Nenhum registro novo para importar.');
      return;
    }
    setImporting(true);
    let batchId: string | null = null;
    try {
      // Buscar mapa matrícula → user_id
      const allMatriculas = new Set<string>();
      toInsert.forEach(r => {
        const mot = String(r.cd_mot || '').trim();
        const a1 = String(r.cd_aju1 || '').trim();
        const a2 = String(r.cd_aju2 || '').trim();
        if (mot && mot !== '0') allMatriculas.add(mot);
        if (a1 && a1 !== '0') allMatriculas.add(a1);
        if (a2 && a2 !== '0') allMatriculas.add(a2);
      });

      // Mapas separados por worker_type para evitar colisão de matrícula
      // (motorista e ajudante podem ter a mesma matrícula).
      const motMap: Record<string, string> = {};
      const ajuMap: Record<string, string> = {};
      if (allMatriculas.size > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, matricula, worker_type')
          .in('matricula', Array.from(allMatriculas));
        users?.forEach(u => {
          if (u.worker_type === 'motorista') motMap[u.matricula] = u.id;
          else if (u.worker_type === 'ajudante') ajuMap[u.matricula] = u.id;
        });
      }

      const uniqueDates = [...new Set(toInsert.map(r => String((r as any).data_operacao)))].filter(Boolean);

      // Cria o batch ANTES para vincular import_batch_id (necessário para o undo).
      // Em caso de erro abaixo, removemos o batch para não ficar "confirmado" sem dados.
      batchId = await createImportBatch({
        tipo: 'mapas',
        arquivo_nome: fileName,
        total_linhas: classifications.length,
        linhas_inseridas: 0,
        linhas_duplicadas: classifications.filter(c => c.status === 'duplicado').length,
        linhas_invalidas: classifications.filter(c => c.status === 'invalido').length,
        payload_preview: classifications.slice(0, 200).map(c => ({
          status: c.status,
          reason: c.reason,
          mapa: (c.row as any).mapa,
          data: (c.row as any).data_operacao,
          placa: (c.row as any).placa,
          cd_mot: (c.row as any).cd_mot,
        })),
        metadata: { datas: uniqueDates },
      });

      const enriched = toInsert.map(r => {
        const mot = String(r.cd_mot || '').trim();
        const a1 = String(r.cd_aju1 || '').trim();
        const a2 = String(r.cd_aju2 || '').trim();
        return {
          ...r,
          mot_user_id: (mot && mot !== '0') ? motMap[mot] || null : null,
          aju1_user_id: (a1 && a1 !== '0') ? ajuMap[a1] || null : null,
          aju2_user_id: (a2 && a2 !== '0') ? ajuMap[a2] || null : null,
          import_batch_id: batchId,
        };
      });

      const batchSize = 500;
      const totalBatches = Math.ceil(enriched.length / batchSize);
      let inseridos = 0;
      let duplicadosNoInsert = 0;
      for (let i = 0; i < enriched.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1;
        setProgress(`Lote ${batchNum}/${totalBatches} (${Math.min(i + batchSize, enriched.length)}/${enriched.length} registros)`);
        const batch = enriched.slice(i, i + batchSize);
        // upsert com ignoreDuplicates evita falha quando algum registro
        // já existe (rede de segurança contra a constraint mapa+data).
        const { data: ins, error } = await supabase
          .from('mapa_historico')
          .upsert(batch as any, { onConflict: 'mapa,data_operacao', ignoreDuplicates: true })
          .select('id');
        if (error) throw error;
        const got = ins?.length ?? 0;
        inseridos += got;
        duplicadosNoInsert += batch.length - got;
      }

      // Atualiza contagens reais no batch
      const totalDuplicadas =
        classifications.filter(c => c.status === 'duplicado').length + duplicadosNoInsert;
      await (supabase.from('import_batches' as any) as any)
        .update({
          linhas_inseridas: inseridos,
          linhas_duplicadas: totalDuplicadas,
        })
        .eq('id', batchId);

      // Recalcular indicadores apenas para as datas importadas
      setProgress('Recalculando indicadores...');
      try {
        const { error: calcErr } = await supabase.functions.invoke('calculate-daily-indicators', {
          body: { data_referencia: uniqueDates },
        });
        if (calcErr) console.error('Erro ao calcular indicadores:', calcErr);
      } catch (e) {
        console.error('Erro ao chamar calculate-daily-indicators:', e);
      }

      const matchedCount = enriched.reduce(
        (acc, r: any) => acc + (r.mot_user_id ? 1 : 0) + (r.aju1_user_id ? 1 : 0) + (r.aju2_user_id ? 1 : 0),
        0,
      );
      toast.success(
        `${inseridos} registros importados${duplicadosNoInsert ? ` (${duplicadosNoInsert} já existiam e foram ignorados)` : ''}. ${matchedCount} vínculos motorista/ajudante.`,
      );
      setRows([]);
      setClassifications([]);
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      // Mantém o batch no histórico como "falha" para auditoria
      const errMsg = err?.message || String(err);
      if (batchId) {
        await markImportBatchFailed(batchId, errMsg);
      } else {
        await createFailedImportBatch({
          tipo: 'mapas',
          arquivo_nome: fileName,
          total_linhas: classifications.length,
          error_message: errMsg,
        });
      }
      toast.error('Erro na importação: ' + errMsg);
    } finally {
      setImporting(false);
      setProgress('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRows([]); setClassifications([]); setFileName(''); setInvalidLines([]); setSkipped({}); setDetectedCols([]); } }}>
      <DialogTrigger asChild>
        <Button><Upload className="h-4 w-4 mr-2" /> Importar CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Mapas (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione um arquivo CSV com separador <code>;</code> contendo as colunas da planilha de operação.
          </p>
          <input ref={inputRef} type="file" accept=".csv,.txt" onChange={handleFile} className="block w-full text-sm" />
          {classifications.length > 0 && (
            <div className="space-y-3">
              <ImportPreviewTable
                rows={classifications}
                fileName={fileName}
                skippedCount={Object.values(skipped).reduce((a, b) => a + b, 0)}
                skippedReasons={skipped}
                detectedColumns={detectedCols}
                invalidLines={invalidLines}
                columns={[
                  { key: 'data_operacao', label: 'Data', render: (r: any) => String(r.data_operacao) },
                  { key: 'mapa', label: 'Mapa', render: (r: any) => String(r.mapa) },
                  { key: 'placa', label: 'Placa', render: (r: any) => String(r.placa ?? '') },
                  { key: 'cd_mot', label: 'CdMot', render: (r: any) => String(r.cd_mot ?? '') },
                  { key: 'entregas', label: 'Entregas', align: 'right', render: (r: any) => String(r.entregas ?? 0) },
                ]}
              />
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
