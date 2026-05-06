import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, Database, Search, X, AlertCircle, ShieldAlert, ChevronDown, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Column, DataTable } from '@/components/shared/DataTable';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImportPreviewTable, RowStatus } from '@/components/admin/ImportPreviewTable';
import { ImportHistoryPanel } from '@/components/admin/ImportHistoryPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { createImportBatch, markImportBatchFailed, createFailedImportBatch } from '@/hooks/useImportBatches';

const RELATOS_INDICATOR_CODE = 'RELATOS';
const RELATOS_META = 5;
const RELATOS_DESAFIO = 15;

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function normalizeCpf(v: any): string {
  if (v == null) return '';
  const s = String(v).replace(/\D/g, '');
  // Remove leading zeros para detectar o literal "0"
  return s.replace(/^0+$/, '') ? s : '';
}

function normalizeMatricula(v: any): string {
  if (v == null) return '';
  const s = String(v).trim();
  if (!s || /^0+$/.test(s)) return '';
  return s;
}

/** Aceita 'dd-mm-aaaa', 'dd/mm/aaaa', Date e Excel serial. Retorna 'YYYY-MM-DD'. */
function toDateOrNull(v: any): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    return null;
  }
  const s = String(v).trim();
  // dd-mm-aaaa ou dd/mm/aaaa
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // ISO
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

interface ParsedRow {
  data_cadastrado: string;       // YYYY-MM-DD
  mes_num: number;
  ano: number;
  data_referencia: string;       // YYYY-MM-01
  relato_id: string | null;
  cargo_relatante: string | null;
  revenda: string | null;
  tipo: string | null;
  local: string | null;
  infracao: string | null;
  relato: string | null;
  status: string | null;
  classificacao: string | null;
  prioridade: string | null;
  data_ocorrido: string | null;
  cpf: string;
  matricula: string;
}

interface DbRow {
  id: string;
  data_cadastrado: string;
  data_referencia: string;
  mes_num: number;
  ano: number;
  relato_id: string | null;
  cargo_relatante: string | null;
  cpf: string | null;
  matricula: string | null;
  tipo: string | null;
  local: string | null;
  infracao: string | null;
  user_id: string | null;
}

export default function ImportRelatos() {
  const [dbRows, setDbRows] = useState<DbRow[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [search, setSearch] = useState('');
  const [mes, setMes] = useState(''); // YYYY-MM
  const [cargoFilter, setCargoFilter] = useState<string>('all');

  const fetchDbRows = useCallback(async () => {
    setLoadingDb(true);
    try {
      const allRows: DbRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await (supabase.from('relatos_seguranca' as any) as any)
          .select('id, data_cadastrado, data_referencia, mes_num, ano, relato_id, cargo_relatante, cpf, matricula, tipo, local, infracao, user_id')
          .order('data_cadastrado', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data) allRows.push(...data);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      setDbRows(allRows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => { fetchDbRows(); }, [fetchDbRows]);

  const cargosUnicos = useMemo(() => {
    return Array.from(new Set(dbRows.map(r => r.cargo_relatante).filter(Boolean))) as string[];
  }, [dbRows]);

  const filteredRows = useMemo(() => {
    return dbRows.filter(r => {
      if (search) {
        const s = search.toLowerCase();
        const match =
          r.cpf?.toLowerCase().includes(s) ||
          r.matricula?.toLowerCase().includes(s) ||
          r.cargo_relatante?.toLowerCase().includes(s) ||
          r.local?.toLowerCase().includes(s) ||
          r.infracao?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (mes) {
        const rowMes = r.data_referencia?.slice(0, 7);
        if (rowMes !== mes) return false;
      }
      if (cargoFilter !== 'all' && r.cargo_relatante !== cargoFilter) return false;
      return true;
    });
  }, [dbRows, search, mes, cargoFilter]);

  const totalVinculados = useMemo(
    () => filteredRows.filter(r => !!r.user_id).length,
    [filteredRows]
  );

  const hasFilters = !!(search || mes || cargoFilter !== 'all');
  const clearFilters = () => { setSearch(''); setMes(''); setCargoFilter('all'); };

  const fmtBr = (iso: string | null) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const dbColumns: Column<DbRow>[] = [
    { key: 'data_cadastrado', label: 'Data', render: (r) => fmtBr(r.data_cadastrado) },
    { key: 'mes_num', label: 'Mês ref.', render: (r) => `${MES_LABEL[r.mes_num - 1] ?? r.mes_num}/${r.ano}` },
    { key: 'cargo_relatante', label: 'Cargo' },
    { key: 'cpf', label: 'CPF' },
    { key: 'matricula', label: 'Matrícula' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'local', label: 'Local' },
    { key: 'infracao', label: 'Infração' },
    { key: 'user_id', label: 'Vinculado', render: (r) => r.user_id ? 'Sim' : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Relatos de Segurança
          </h3>
          <p className="text-sm text-muted-foreground">
            Indicador <strong>mensal — somente ajudantes</strong>. Conta a quantidade de relatos por mês (coluna "Data Cadastrado"). Meta: {RELATOS_META} • Desafio: {RELATOS_DESAFIO}.
          </p>
        </div>
        <ImportRelatosDialog onSuccess={fetchDbRows} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" /> Relatos Importados
          </CardTitle>
          <CardDescription>
            {loadingDb
              ? 'Carregando...'
              : `${filteredRows.length} de ${dbRows.length} registros • ${totalVinculados} vinculados a ajudantes`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar CPF, matrícula, cargo, local..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-44 h-9" />
            <Select value={cargoFilter} onValueChange={setCargoFilter}>
              <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Cargo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cargos</SelectItem>
                {cargosUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
          <DataTable columns={dbColumns} data={filteredRows} loading={loadingDb} emptyMessage="Nenhum relato importado ainda." />
        </CardContent>
      </Card>

      <ImportHistoryPanel tipo="relatos" />
    </div>
  );
}

function ImportRelatosDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [classifications, setClassifications] = useState<{ row: ParsedRow; status: RowStatus; reason?: string }[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]); setClassifications([]); setFileName(''); setProgress('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        // Aba "Riscos" (case-insensitive) ou primeira aba
        const sheetName =
          wb.SheetNames.find(n => n.trim().toLowerCase() === 'riscos') ?? wb.SheetNames[0];
        if (!sheetName) {
          toast.error('Nenhuma aba encontrada no arquivo.');
          return;
        }
        const sheet = wb.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
        if (!json.length) {
          toast.error(`Aba "${sheetName}" está vazia.`);
          return;
        }

        const parsed: ParsedRow[] = [];
        for (const r of json) {
          const cpfRaw = String(r['CPF'] ?? r['cpf'] ?? '').trim();
          const matRaw = String(r['MATRÍCULA'] ?? r['MATRICULA'] ?? r['Matrícula'] ?? r['Matricula'] ?? '').trim();
          // Ignora linhas onde CPF ou matrícula é literalmente "0"
          if (/^0+$/.test(cpfRaw.replace(/\D/g, '')) && cpfRaw !== '') continue;
          if (/^0+$/.test(matRaw) && matRaw !== '') continue;
          const cpf = normalizeCpf(r['CPF'] ?? r['cpf']);
          const matricula = normalizeMatricula(r['MATRÍCULA'] ?? r['MATRICULA'] ?? r['Matrícula'] ?? r['Matricula']);
          if (!cpf && !matricula) continue;

          const dataCad = toDateOrNull(r['Data Cadastrado'] ?? r['Data Cadastro'] ?? r['DataCadastrado']);
          if (!dataCad) continue;
          const [y, m] = dataCad.split('-');
          const ano = parseInt(y, 10);
          const mes_num = parseInt(m, 10);

          parsed.push({
            data_cadastrado: dataCad,
            mes_num,
            ano,
            data_referencia: `${y}-${m}-01`,
            relato_id: r['ID'] != null ? String(r['ID']).trim() : null,
            cargo_relatante: r['Cargo Relatante'] ? String(r['Cargo Relatante']).trim() : null,
            revenda: r['Revenda'] ? String(r['Revenda']).trim() : null,
            tipo: r['Tipo'] ? String(r['Tipo']).trim() : null,
            local: r['Local'] ? String(r['Local']).trim() : null,
            infracao: r['Infração'] ? String(r['Infração']).trim() : (r['Infracao'] ? String(r['Infracao']).trim() : null),
            relato: r['Relato'] ? String(r['Relato']).trim() : null,
            status: r['Status'] ? String(r['Status']).trim() : null,
            classificacao: r['Classificação'] ? String(r['Classificação']).trim() : (r['Classificacao'] ? String(r['Classificacao']).trim() : null),
            prioridade: r['Prioridade'] != null ? String(r['Prioridade']).trim() : null,
            data_ocorrido: toDateOrNull(r['Data Ocorrido']),
            cpf,
            matricula,
          });
        }

        if (!parsed.length) {
          toast.error('Nenhuma linha válida encontrada (todas sem CPF/matrícula ou sem Data Cadastrado).');
          return;
        }
        setRows(parsed);
        await classify(parsed);
        toast.success(`${parsed.length} relatos carregados.`);
      } catch (err: any) {
        toast.error('Erro ao ler planilha: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const classify = async (parsed: ParsedRow[]) => {
    // Carrega chaves existentes (relato_id) e fallback (cpf|data|relato).
    // IMPORTANTE: Supabase limita 1000 linhas por query. Para evitar truncamento
    // em planilhas grandes, fazemos chunk do .in() (em blocos de 500) e
    // paginação manual com .range() dentro de cada chunk.
    const relatoIds = Array.from(new Set(parsed.map(r => r.relato_id).filter(Boolean) as string[]));
    const existingIds = new Set<string>();
    const existingFallback = new Set<string>();

    const IN_CHUNK = 500;
    const PAGE = 1000;

    const fetchAllChunked = async (
      values: string[],
      column: string,
      select: string,
      onRow: (row: any) => void,
    ) => {
      for (let i = 0; i < values.length; i += IN_CHUNK) {
        const slice = values.slice(i, i + IN_CHUNK);
        let from = 0;
        while (true) {
          const { data, error } = await (supabase.from('relatos_seguranca' as any) as any)
            .select(select)
            .in(column, slice)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (data) data.forEach(onRow);
          if (!data || data.length < PAGE) break;
          from += PAGE;
        }
      }
    };

    try {
      if (relatoIds.length) {
        await fetchAllChunked(relatoIds, 'relato_id', 'relato_id', (d: any) => {
          if (d.relato_id) existingIds.add(String(d.relato_id));
        });
      }
      // Fallback por CPF para registros sem ID
      const cpfs = Array.from(new Set(parsed.filter(r => !r.relato_id).map(r => r.cpf).filter(Boolean)));
      if (cpfs.length) {
        await fetchAllChunked(
          cpfs,
          'cpf',
          'cpf, data_cadastrado, relato, local, infracao',
          (d: any) => {
            const k = [d.cpf || '', d.data_cadastrado || '', (d.relato || '').slice(0, 60), d.local || '', d.infracao || ''].join('|');
            existingFallback.add(k);
          },
        );
      }
    } catch (e) {
      console.warn('Falha ao checar duplicidade relatos:', e);
    }

    const seen = new Set<string>();
    const cls = parsed.map(row => {
      const fallbackKey = [row.cpf || '', row.data_cadastrado || '', (row.relato || '').slice(0, 60), row.local || '', row.infracao || ''].join('|');
      const key = row.relato_id ? `id:${row.relato_id}` : `fb:${fallbackKey}`;

      let status: RowStatus = 'novo';
      let reason: string | undefined;
      if (!row.cpf && !row.matricula) {
        status = 'invalido'; reason = 'Sem CPF nem matrícula';
      } else if (row.relato_id && existingIds.has(row.relato_id)) {
        status = 'duplicado'; reason = 'Já existe no banco (mesmo ID)';
      } else if (!row.relato_id && existingFallback.has(fallbackKey)) {
        status = 'duplicado'; reason = 'Já existe no banco';
      } else if (seen.has(key)) {
        status = 'duplicado'; reason = 'Repetido na planilha';
      } else {
        seen.add(key);
      }
      return { row, status, reason };
    });
    setClassifications(cls);
  };

  const handleImport = async () => {
    const toInsert = classifications.filter(c => c.status === 'novo').map(c => c.row);
    if (!toInsert.length) { toast.error('Nenhum registro novo para importar.'); return; }

    setImporting(true);
    let batchId: string | null = null;
    try {
      const cpfs = Array.from(new Set(toInsert.map(r => r.cpf).filter(Boolean)));
      const matriculas = Array.from(new Set(toInsert.map(r => r.matricula).filter(Boolean)));
      const cpfToUserId: Record<string, string> = {};
      const matToUserId: Record<string, string> = {};
      const cpfToUnidade: Record<string, string | null> = {};
      const matToUnidade: Record<string, string | null> = {};

      const { data: usersByCpf } = await (supabase.from('users') as any)
        .select('id, cpf, matricula, worker_type, unidade_id')
        .in('cpf', cpfs.length ? cpfs : ['__none__']);
      usersByCpf?.forEach((u: any) => {
        const cpfNorm = String(u.cpf || '').replace(/\D/g, '');
        if (cpfNorm && u.worker_type === 'ajudante') {
          cpfToUserId[cpfNorm] = u.id;
          cpfToUnidade[cpfNorm] = u.unidade_id;
        }
      });
      const { data: usersByMat } = await (supabase.from('users') as any)
        .select('id, matricula, worker_type, unidade_id')
        .in('matricula', matriculas.length ? matriculas : ['__none__']);
      usersByMat?.forEach((u: any) => {
        if (u.worker_type === 'ajudante' && u.matricula) {
          matToUserId[u.matricula] = u.id;
          matToUnidade[u.matricula] = u.unidade_id;
        }
      });

      const { data: ind } = await supabase.from('indicators').select('id').eq('codigo', RELATOS_INDICATOR_CODE).maybeSingle();
      const indicatorId = (ind as any)?.id as string | undefined;

      const { data: authData } = await supabase.auth.getUser();
      const importedBy = authData.user?.id || null;

      const mesesUnicos = Array.from(new Set(toInsert.map(r => r.data_referencia)));

      batchId = await createImportBatch({
        tipo: 'relatos',
        arquivo_nome: fileName,
        total_linhas: classifications.length,
        linhas_inseridas: toInsert.length,
        linhas_duplicadas: classifications.filter(c => c.status === 'duplicado').length,
        linhas_invalidas: classifications.filter(c => c.status === 'invalido').length,
        payload_preview: classifications.slice(0, 50).map(c => ({
          status: c.status,
          cpf: c.row.cpf,
          matricula: c.row.matricula,
          data_cadastrado: c.row.data_cadastrado,
          cargo: c.row.cargo_relatante,
        })),
        metadata: { meses: mesesUnicos, indicator_id: indicatorId },
      });

      const enriched = toInsert.map(r => {
        const userId = (r.cpf && cpfToUserId[r.cpf]) || (r.matricula && matToUserId[r.matricula]) || null;
        const unidadeId = (r.cpf && cpfToUnidade[r.cpf]) || (r.matricula && matToUnidade[r.matricula]) || null;
        return {
          data_cadastrado: r.data_cadastrado,
          mes_num: r.mes_num,
          ano: r.ano,
          data_referencia: r.data_referencia,
          relato_id: r.relato_id,
          cargo_relatante: r.cargo_relatante,
          revenda: r.revenda,
          tipo: r.tipo,
          local: r.local,
          infracao: r.infracao,
          relato: r.relato,
          status: r.status,
          classificacao: r.classificacao,
          prioridade: r.prioridade,
          data_ocorrido: r.data_ocorrido,
          cpf: r.cpf,
          matricula: r.matricula,
          user_id: userId,
          unidade_id: unidadeId,
          imported_by: importedBy,
          import_batch_id: batchId,
        };
      });

      const batchSize = 500;
      const totalBatches = Math.ceil(enriched.length / batchSize);
      for (let i = 0; i < enriched.length; i += batchSize) {
        const n = Math.floor(i / batchSize) + 1;
        setProgress(`Lote ${n}/${totalBatches} (${Math.min(i + batchSize, enriched.length)}/${enriched.length})`);
        const batch = enriched.slice(i, i + batchSize);
        const { error } = await (supabase.from('relatos_seguranca' as any) as any).insert(batch);
        if (error) throw error;
      }

      if (indicatorId) {
        setProgress('Atualizando indicador mensal de Relatos...');
        const mesesAfetadosKeys = Array.from(new Set(toInsert.map(r => `${r.ano}-${r.mes_num}`)));
        const anos = Array.from(new Set(toInsert.map(r => r.ano)));
        for (const ano of anos) {
          const meses = mesesAfetadosKeys.filter(k => k.startsWith(`${ano}-`)).map(k => parseInt(k.split('-')[1], 10));
          if (meses.length) {
            await recalcRelatos({ indicatorId, ano, mesesNum: meses });
          }
        }
      }

      const mesesAfetados = Array.from(new Set(toInsert.map(r => r.data_referencia.slice(0, 7))));
      for (const mes of mesesAfetados) {
        setProgress(`Recalculando bônus mensal de ${mes}...`);
        try {
          await supabase.functions.invoke('calculate-monthly-bonus', { body: { month: mes } });
        } catch (e) {
          console.warn('Falha ao recalcular bônus mensal de', mes, e);
        }
      }

      const matched = enriched.filter(r => r.user_id).length;
      toast.success(
        `${toInsert.length} relatos importados! ` +
        `${matched}/${toInsert.length} vinculados a ajudantes.`
      );
      reset();
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (batchId) await markImportBatchFailed(batchId, errMsg);
      else await createFailedImportBatch({ tipo: 'relatos', arquivo_nome: fileName, total_linhas: classifications.length, error_message: errMsg });
      toast.error('Erro na importação: ' + errMsg);
    } finally {
      setImporting(false);
      setProgress('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><Upload className="h-4 w-4 mr-2" /> Importar Planilha</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Relatos de Segurança (XLSX — aba Riscos)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Cada linha conta como <strong>1 relato</strong> no mês da coluna <strong>Data Cadastrado</strong>. Vínculo é feito por <strong>CPF</strong> (com fallback para matrícula) <strong>somente em ajudantes</strong>. Linhas com CPF e matrícula iguais a <code>0</code> são ignoradas. Duplicidade é detectada pelo <strong>ID do relato</strong>.
            </div>
          </div>

          <div>
            <Label>Arquivo .xlsx</Label>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="block w-full text-sm mt-1"
            />
          </div>

          {classifications.length > 0 && (
            <>
              <SummaryPanel classifications={classifications} />
              <ImportPreviewTable
                rows={classifications}
                columns={[
                  { key: 'data_cadastrado', label: 'Data Cad.', render: (r) => {
                    const [y, m, d] = r.data_cadastrado.split('-');
                    return `${d}/${m}/${y}`;
                  } },
                  { key: 'cargo', label: 'Cargo', render: (r) => r.cargo_relatante ?? '—' },
                  { key: 'cpf', label: 'CPF', render: (r) => r.cpf || '—' },
                  { key: 'matricula', label: 'Mat.', render: (r) => r.matricula || '—' },
                  { key: 'tipo', label: 'Tipo', render: (r) => r.tipo ?? '—' },
                  { key: 'local', label: 'Local', render: (r) => r.local ?? '—' },
                  { key: 'infracao', label: 'Infração', render: (r) => r.infracao ?? '—' },
                ]}
              />
              <DuplicatesPanel classifications={classifications} />
            </>
          )}

          {progress && <p className="text-sm text-primary">{progress}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!classifications.some(c => c.status === 'novo') || importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {importing ? 'Importando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryPanel({
  classifications,
}: {
  classifications: { row: ParsedRow; status: RowStatus; reason?: string }[];
}) {
  const total = classifications.length;
  const novos = classifications.filter(c => c.status === 'novo').length;
  const duplicados = classifications.filter(c => c.status === 'duplicado').length;
  const invalidos = classifications.filter(c => c.status === 'invalido');

  const motivos = new Map<string, number>();
  for (const c of invalidos) {
    const key = c.reason || 'Sem motivo';
    motivos.set(key, (motivos.get(key) ?? 0) + 1);
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded border bg-background">
          Total: <strong>{total}</strong>
        </span>
        <span className="px-2 py-1 rounded border bg-success/10 text-success border-success/30">
          A importar: <strong>{novos}</strong>
        </span>
        <span className="px-2 py-1 rounded border bg-warning/10 text-warning border-warning/30">
          Duplicados: <strong>{duplicados}</strong>
        </span>
        <span className="px-2 py-1 rounded border bg-destructive/10 text-destructive border-destructive/30">
          Inválidos: <strong>{invalidos.length}</strong>
        </span>
      </div>
      {motivos.size > 0 && (
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Motivos de inválidos:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {Array.from(motivos.entries()).map(([motivo, count]) => (
              <li key={motivo}>
                <span className="text-foreground">{motivo}</span>: <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DuplicatesPanel({
  classifications,
}: {
  classifications: { row: ParsedRow; status: RowStatus; reason?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const dups = classifications.filter(c => c.status === 'duplicado');
  if (!dups.length) return null;

  const noBanco = dups.filter(c => c.reason?.startsWith('Já existe')).length;
  const naPlanilha = dups.filter(c => c.reason === 'Repetido na planilha').length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-warning" />
            Ver {dups.length} duplicado(s)
            <span className="text-xs text-muted-foreground">
              ({noBanco} já no banco · {naPlanilha} repetidos na planilha)
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="max-h-64 overflow-auto rounded border text-xs">
          <table className="w-full">
            <thead className="sticky top-0 bg-muted z-10">
              <tr>
                <th className="p-2 text-left">Motivo</th>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">CPF</th>
                <th className="p-2 text-left">Data Cad.</th>
                <th className="p-2 text-left">Local</th>
                <th className="p-2 text-left">Infração</th>
              </tr>
            </thead>
            <tbody>
              {dups.map((d, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] bg-warning/15 text-warning border-warning/30">
                      {d.reason === 'Repetido na planilha' ? 'Planilha' : 'Banco'}
                    </span>
                  </td>
                  <td className="p-2">{d.row.relato_id ?? '—'}</td>
                  <td className="p-2">{d.row.cpf || '—'}</td>
                  <td className="p-2">{d.row.data_cadastrado}</td>
                  <td className="p-2 truncate max-w-[160px]" title={d.row.local ?? ''}>{d.row.local ?? '—'}</td>
                  <td className="p-2 truncate max-w-[200px]" title={d.row.infracao ?? ''}>{d.row.infracao ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Duplicidade detectada por <strong>ID do relato</strong> (preferencial) ou por <strong>CPF + Data Cadastrado + Local + Infração + Relato</strong> (fallback).
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Recalcula o indicador mensal RELATOS em user_indicator_daily.
 * Para cada (user_id, ano, mes_num): conta relatos importados.
 * Lógica MAIOR é melhor:
 * - status: dentro_meta se valor >= 5; abaixo_meta se < 5
 * - status_desafio: 'atingiu' se valor >= 15; 'nao_atingiu' caso contrário
 * Bônus: meta R$ 52,50 + desafio R$ 10,00 (configurado em goals).
 */
export async function recalcRelatos(opts: { indicatorId: string; ano: number; mesesNum: number[] }) {
  const { indicatorId, ano, mesesNum } = opts;
  if (!mesesNum.length) return;

  const all: { user_id: string | null; mes_num: number; ano: number }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await (supabase.from('relatos_seguranca' as any) as any)
      .select('user_id, mes_num, ano')
      .eq('ano', ano)
      .in('mes_num', mesesNum)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (data) all.push(...data);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  const counts = new Map<string, number>();
  for (const r of all) {
    if (!r.user_id) continue;
    const key = `${r.user_id}|${r.ano}|${r.mes_num}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows = Array.from(counts.entries()).map(([key, valor]) => {
    const [userId, anoStr, mesStr] = key.split('|');
    const data_referencia = `${anoStr}-${String(parseInt(mesStr, 10)).padStart(2, '0')}-01`;
    const atingiuMeta = valor >= RELATOS_META;
    const atingiuDesafio = valor >= RELATOS_DESAFIO;
    return {
      user_id: userId,
      indicator_id: indicatorId,
      data_referencia,
      valor,
      meta: RELATOS_META,
      desafio: RELATOS_DESAFIO,
      percentual_atingimento: RELATOS_META > 0 ? Math.min(100, (valor / RELATOS_META) * 100) : 0,
      status: atingiuMeta ? 'dentro_meta' : 'abaixo_meta',
      status_desafio: atingiuDesafio ? 'atingiu' : 'nao_atingiu',
      origem_dado: 'import_relatos',
      mapa_numero: 'MENSAL',
    };
  });

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const { error } = await (supabase.from('user_indicator_daily') as any).upsert(slice, {
      onConflict: 'user_id,indicator_id,data_referencia,mapa_numero',
    });
    if (error) throw error;
  }
}