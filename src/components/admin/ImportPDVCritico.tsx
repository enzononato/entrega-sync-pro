import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, Database, Search, X, AlertCircle, AlertOctagon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Column, DataTable } from '@/components/shared/DataTable';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImportPreviewTable, RowStatus } from '@/components/admin/ImportPreviewTable';
import { ImportHistoryPanel } from '@/components/admin/ImportHistoryPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Copy } from 'lucide-react';
import { createImportBatch } from '@/hooks/useImportBatches';

const PDV_CRITICO_INDICATOR_CODE = 'PDV_CRITICO';
const PDV_META = 5;
const PDV_DESAFIO = 15;

const MES_TO_NUM: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, 'março': 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function normalizeMes(v: any): { mes: string; num: number } | null {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  const num = MES_TO_NUM[s];
  if (!num) return null;
  return { mes: s, num };
}

function normalizeCpf(v: any): string {
  if (v == null) return '';
  return String(v).replace(/\D/g, '');
}

function normalizeMatricula(v: any): string {
  if (v == null) return '';
  return String(v).trim();
}

function toIntOrNull(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseInt(String(v).trim(), 10);
  return isNaN(n) ? null : n;
}

function toDateOrNull(v: any): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Excel serial
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    return null;
  }
  const s = String(v).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

interface ParsedRow {
  mes: string;
  mes_num: number;
  semana: number | null;
  codigo_cliente: string | null;
  cliente: string | null;
  motorista_nome: string | null;
  comentario: string | null;
  estado: string | null;
  data_notificacao: string | null;
  tratado_por: string | null;
  data_analise: string | null;
  instrucao: string | null;
  categoria: string | null;
  status: string | null;
  tmr: number | null;
  matricula: string;
  cpf: string;
}

interface DbRow {
  id: string;
  data_referencia: string;
  mes: string;
  mes_num: number;
  ano: number;
  semana: number | null;
  motorista_nome: string | null;
  cpf: string | null;
  matricula: string | null;
  estado: string | null;
  categoria: string | null;
  cliente: string | null;
  user_id: string | null;
}

export default function ImportPDVCritico() {
  const [dbRows, setDbRows] = useState<DbRow[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [search, setSearch] = useState('');
  const [mes, setMes] = useState(''); // YYYY-MM
  const [estadoFilter, setEstadoFilter] = useState<'all' | 'Relevante' | 'Irrelevante'>('all');

  const fetchDbRows = useCallback(async () => {
    setLoadingDb(true);
    try {
      const allRows: DbRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await (supabase.from('pdv_critico_feedbacks' as any) as any)
          .select('id, data_referencia, mes, mes_num, ano, semana, motorista_nome, cpf, matricula, estado, categoria, cliente, user_id')
          .order('data_referencia', { ascending: false })
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

  const filteredRows = useMemo(() => {
    return dbRows.filter(r => {
      if (search) {
        const s = search.toLowerCase();
        const match =
          r.motorista_nome?.toLowerCase().includes(s) ||
          r.cpf?.toLowerCase().includes(s) ||
          r.matricula?.toLowerCase().includes(s) ||
          r.cliente?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (mes) {
        const rowMes = r.data_referencia?.slice(0, 7);
        if (rowMes !== mes) return false;
      }
      if (estadoFilter !== 'all') {
        const e = (r.estado || '').trim();
        if (e !== estadoFilter) return false;
      }
      return true;
    });
  }, [dbRows, search, mes, estadoFilter]);

  const totalRelevantes = useMemo(
    () => filteredRows.filter(r => (r.estado || '').trim() === 'Relevante').length,
    [filteredRows]
  );

  const hasFilters = !!(search || mes || estadoFilter !== 'all');
  const clearFilters = () => { setSearch(''); setMes(''); setEstadoFilter('all'); };

  const dbColumns: Column<DbRow>[] = [
    {
      key: 'data_referencia', label: 'Mês',
      render: (r) => `${MES_LABEL[r.mes_num - 1] ?? r.mes}/${r.ano}`,
    },
    { key: 'semana', label: 'Sem.', render: (r) => r.semana ?? '—' },
    { key: 'motorista_nome', label: 'Motorista' },
    { key: 'cpf', label: 'CPF' },
    { key: 'matricula', label: 'Matrícula' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'categoria', label: 'Categoria' },
    {
      key: 'estado', label: 'Estado',
      render: (r) => {
        const e = (r.estado || '').trim();
        const isRel = e === 'Relevante';
        return (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${isRel ? 'bg-destructive/15 text-destructive border-destructive/30' : 'bg-muted text-muted-foreground'}`}>
            {e || '—'}
          </span>
        );
      },
    },
    { key: 'user_id', label: 'Vinculado', render: (r) => r.user_id ? 'Sim' : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertOctagon className="h-5 w-5" /> PDV Crítico (Feedbacks de Motorista)
          </h3>
          <p className="text-sm text-muted-foreground">
            Indicador <strong>mensal — somente motoristas</strong>. Conta feedbacks com estado <strong>Relevante</strong>. Meta: {PDV_META} • Desafio: {PDV_DESAFIO}.
          </p>
        </div>
        <ImportPDVCriticoDialog onSuccess={fetchDbRows} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" /> Feedbacks Importados
          </CardTitle>
          <CardDescription>
            {loadingDb
              ? 'Carregando...'
              : `${filteredRows.length} de ${dbRows.length} registros • ${totalRelevantes} relevantes`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar motorista, CPF, matrícula ou cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-44 h-9" />
            <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as any)}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="Relevante">Relevante</SelectItem>
                <SelectItem value="Irrelevante">Irrelevante</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
          <DataTable columns={dbColumns} data={filteredRows} loading={loadingDb} emptyMessage="Nenhum feedback importado ainda." />
        </CardContent>
      </Card>

      <ImportHistoryPanel tipo="pdv_critico" />
    </div>
  );
}

function ImportPDVCriticoDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [classifications, setClassifications] = useState<{ row: ParsedRow; status: RowStatus; reason?: string }[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState<number>(currentYear);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]); setClassifications([]); setFileName(''); setProgress('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    // Tenta inferir ano do nome do arquivo: "_2026_3"
    const m = file.name.match(/(20\d{2})/);
    if (m) setAno(parseInt(m[1], 10));

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames.find(n => n.trim().toUpperCase() === 'BEES');
        if (!sheetName) {
          toast.error('Aba "BEES" não encontrada no arquivo.');
          return;
        }
        const sheet = wb.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
        if (!json.length) {
          toast.error('Aba BEES está vazia.');
          return;
        }

        const parsed: ParsedRow[] = [];
        for (const r of json) {
          // Headers: Mês, Semana , Código, Cliente, Motorista, Comentário (motorista),
          // Estado, Data Notificação, Tratado PorH:I, Data Análise, Instrução,
          // Categoria, Status, TMR, MATRICULA, CPF
          const mesObj = normalizeMes(r['Mês'] ?? r['MES'] ?? r['Mes']);
          if (!mesObj) continue;
          const cpf = normalizeCpf(r['CPF']);
          const matricula = normalizeMatricula(r['MATRICULA'] ?? r['Matricula'] ?? r['MATRÍCULA']);
          if (!cpf && !matricula) continue;

          parsed.push({
            mes: mesObj.mes,
            mes_num: mesObj.num,
            semana: toIntOrNull(r['Semana '] ?? r['Semana']),
            codigo_cliente: r['Código'] != null ? String(r['Código']).trim() : null,
            cliente: r['Cliente'] ? String(r['Cliente']).trim() : null,
            motorista_nome: r['Motorista'] ? String(r['Motorista']).trim() : null,
            comentario: r['Comentário (motorista)'] ? String(r['Comentário (motorista)']).trim() : null,
            estado: r['Estado'] ? String(r['Estado']).trim() : null,
            data_notificacao: toDateOrNull(r['Data Notificação']),
            tratado_por: r['Tratado PorH:I'] ? String(r['Tratado PorH:I']).trim() : null,
            data_analise: toDateOrNull(r['Data Análise']),
            instrucao: r['Instrução'] ? String(r['Instrução']).trim() : null,
            categoria: r['Categoria'] ? String(r['Categoria']).trim() : null,
            status: r['Status'] ? String(r['Status']).trim() : null,
            tmr: r['TMR'] != null ? Number(r['TMR']) : null,
            matricula,
            cpf,
          });
        }

        if (!parsed.length) {
          toast.error('Nenhuma linha válida encontrada na aba BEES.');
          return;
        }
        setRows(parsed);
        await classify(parsed, ano);
        toast.success(`${parsed.length} feedbacks carregados.`);
      } catch (err: any) {
        toast.error('Erro ao ler planilha: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const classify = async (parsed: ParsedRow[], anoRef: number) => {
    // Carrega chaves existentes para os meses presentes no arquivo
    const mesesNum = Array.from(new Set(parsed.map(r => r.mes_num)));
    const existingKeys = new Set<string>();
    try {
      const { data } = await (supabase.from('pdv_critico_feedbacks' as any) as any)
        .select('cpf, mes_num, ano, semana, codigo_cliente, comentario, data_analise, tmr')
        .eq('ano', anoRef)
        .in('mes_num', mesesNum);
      data?.forEach((d: any) => {
        const key = [
          d.cpf || '',
          d.mes_num,
          d.ano,
          d.semana ?? 0,
          d.codigo_cliente || '',
          // hash leve do comentário
          (d.comentario || '').slice(0, 60),
          d.data_analise || '',
          d.tmr ?? '',
        ].join('|');
        existingKeys.add(key);
      });
    } catch (e) {
      console.warn('Falha ao checar duplicidade pdv_critico:', e);
    }

    const seen = new Set<string>();
    const cls = parsed.map(row => {
      const key = [
        row.cpf || '',
        row.mes_num,
        anoRef,
        row.semana ?? 0,
        row.codigo_cliente || '',
        (row.comentario || '').slice(0, 60),
        row.data_analise || '',
        row.tmr ?? '',
      ].join('|');

      let status: RowStatus = 'novo';
      let reason: string | undefined;
      const estadoNorm = (row.estado || '').trim().toLowerCase();
      if (!row.cpf && !row.matricula) {
        status = 'invalido'; reason = 'Sem CPF nem matrícula';
      } else if (estadoNorm !== 'relevante') {
        status = 'invalido'; reason = `Estado "${row.estado || '—'}" (não conta no indicador)`;
      } else if (existingKeys.has(key)) {
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

  useEffect(() => {
    if (rows.length) classify(rows, ano);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano]);

  const handleImport = async () => {
    const toInsert = classifications.filter(c => c.status === 'novo').map(c => c.row);
    if (!toInsert.length) { toast.error('Nenhum registro novo para importar.'); return; }

    setImporting(true);
    try {
      // Resolve user_id por CPF (ou matrícula como fallback)
      const cpfs = Array.from(new Set(toInsert.map(r => r.cpf).filter(Boolean)));
      const matriculas = Array.from(new Set(toInsert.map(r => r.matricula).filter(Boolean)));
      const cpfToUserId: Record<string, string> = {};
      const matToUserId: Record<string, string> = {};
      const cpfToUnidade: Record<string, string | null> = {};
      const matToUnidade: Record<string, string | null> = {};

      // Buscar todos os usuários candidatos (motoristas)
      const { data: usersByCpf } = await (supabase.from('users') as any)
        .select('id, cpf, matricula, worker_type, unidade_id')
        .in('cpf', cpfs.length ? cpfs : ['__none__']);
      usersByCpf?.forEach((u: any) => {
        const cpfNorm = normalizeCpf(u.cpf);
        if (cpfNorm && u.worker_type === 'motorista') {
          cpfToUserId[cpfNorm] = u.id;
          cpfToUnidade[cpfNorm] = u.unidade_id;
        }
      });
      const { data: usersByMat } = await (supabase.from('users') as any)
        .select('id, matricula, worker_type, unidade_id')
        .in('matricula', matriculas.length ? matriculas : ['__none__']);
      usersByMat?.forEach((u: any) => {
        if (u.worker_type === 'motorista' && u.matricula) {
          matToUserId[u.matricula] = u.id;
          matToUnidade[u.matricula] = u.unidade_id;
        }
      });

      // Indicator id
      const { data: ind } = await supabase.from('indicators').select('id').eq('codigo', PDV_CRITICO_INDICATOR_CODE).maybeSingle();
      const indicatorId = (ind as any)?.id as string | undefined;

      const { data: authData } = await supabase.auth.getUser();
      const importedBy = authData.user?.id || null;

      const mesesUnicos = Array.from(new Set(toInsert.map(r => `${ano}-${String(r.mes_num).padStart(2, '0')}-01`)));

      const batchId = await createImportBatch({
        tipo: 'pdv_critico',
        arquivo_nome: fileName,
        total_linhas: classifications.length,
        linhas_inseridas: toInsert.length,
        linhas_duplicadas: classifications.filter(c => c.status === 'duplicado').length,
        linhas_invalidas: classifications.filter(c => c.status === 'invalido').length,
        payload_preview: classifications.slice(0, 50).map(c => ({
          status: c.status,
          motorista: c.row.motorista_nome,
          cpf: c.row.cpf,
          mes: c.row.mes,
          semana: c.row.semana,
          estado: c.row.estado,
        })),
        metadata: { ano, meses: mesesUnicos, indicator_id: indicatorId },
      });

      const enriched = toInsert.map(r => {
        const userId = (r.cpf && cpfToUserId[r.cpf]) || (r.matricula && matToUserId[r.matricula]) || null;
        const unidadeId = (r.cpf && cpfToUnidade[r.cpf]) || (r.matricula && matToUnidade[r.matricula]) || null;
        return {
          mes: r.mes,
          mes_num: r.mes_num,
          ano,
          semana: r.semana,
          data_referencia: `${ano}-${String(r.mes_num).padStart(2, '0')}-01`,
          codigo_cliente: r.codigo_cliente,
          cliente: r.cliente,
          motorista_nome: r.motorista_nome,
          comentario: r.comentario,
          estado: r.estado,
          data_notificacao: r.data_notificacao,
          tratado_por: r.tratado_por,
          data_analise: r.data_analise,
          instrucao: r.instrucao,
          categoria: r.categoria,
          status: r.status,
          tmr: r.tmr,
          matricula: r.matricula,
          cpf: r.cpf,
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
        const { error } = await (supabase.from('pdv_critico_feedbacks' as any) as any).insert(batch);
        if (error) throw error;
      }

      // Recalcula indicador mensal
      if (indicatorId) {
        setProgress('Atualizando indicador mensal de PDV Crítico...');
        await recalcPdvCritico({ indicatorId, ano, mesesNum: Array.from(new Set(toInsert.map(r => r.mes_num))) });
      }

      // Recalcula bônus mensal (user_incentives_daily) de cada mês afetado
      const mesesAfetados = Array.from(new Set(toInsert.map(r => `${ano}-${String(r.mes_num).padStart(2, '0')}`)));
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
        `${toInsert.length} feedbacks importados! ` +
        `${matched}/${toInsert.length} vinculados a motoristas.`
      );
      reset();
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error('Erro na importação: ' + err.message);
    } finally {
      setImporting(false);
      setProgress('');
    }
  };

  const semVinculo = classifications.filter(c => c.status === 'novo' && !c.row.cpf && !c.row.matricula).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><Upload className="h-4 w-4 mr-2" /> Importar Planilha</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar PDV Crítico (XLSX — aba BEES)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Apenas linhas com <strong>Estado = Relevante</strong> contam para o indicador. Vínculo é feito por <strong>CPF</strong> (com fallback para matrícula). Linhas iguais (mesmo CPF + mês + semana + cliente + comentário + data análise + TMR) já existentes serão marcadas como <strong>duplicadas</strong> e ignoradas.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ano de referência *</Label>
              <Input
                type="number"
                min={2024} max={2099}
                value={ano}
                onChange={e => setAno(parseInt(e.target.value, 10) || currentYear)}
              />
              <p className="text-xs text-muted-foreground mt-1">Inferido do nome do arquivo quando possível.</p>
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
          </div>

          {classifications.length > 0 && (
            <>
              {semVinculo > 0 && (
                <p className="text-xs text-warning">
                  {semVinculo} linha(s) sem CPF nem matrícula — serão importadas como "sem vínculo" e não contarão para o indicador.
                </p>
              )}
              <ImportPreviewTable
                rows={classifications}
                columns={[
                  { key: 'motorista_nome', label: 'Motorista', render: (r) => r.motorista_nome ?? '—' },
                  { key: 'cpf', label: 'CPF', render: (r) => r.cpf || '—' },
                  { key: 'mes', label: 'Mês', render: (r) => r.mes },
                  { key: 'semana', label: 'Sem.', align: 'right', render: (r) => String(r.semana ?? '—') },
                  { key: 'estado', label: 'Estado', render: (r) => r.estado ?? '—' },
                  { key: 'categoria', label: 'Categoria', render: (r) => r.categoria ?? '—' },
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

/**
 * Recalcula o indicador mensal PDV_CRITICO em user_indicator_daily.
 */
function DuplicatesPanel({
  classifications,
}: {
  classifications: { row: ParsedRow; status: RowStatus; reason?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const dups = classifications.filter(c => c.status === 'duplicado');
  if (!dups.length) return null;

  const noBanco = dups.filter(c => c.reason === 'Já existe no banco').length;
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
                <th className="p-2 text-left">Motorista</th>
                <th className="p-2 text-left">CPF</th>
                <th className="p-2 text-left">Mês</th>
                <th className="p-2 text-right">Sem.</th>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Data Análise</th>
                <th className="p-2 text-right">TMR</th>
                <th className="p-2 text-left">Comentário</th>
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
                  <td className="p-2">{d.row.motorista_nome ?? '—'}</td>
                  <td className="p-2">{d.row.cpf || '—'}</td>
                  <td className="p-2">{d.row.mes}</td>
                  <td className="p-2 text-right">{d.row.semana ?? '—'}</td>
                  <td className="p-2 truncate max-w-[160px]" title={d.row.cliente ?? ''}>
                    {d.row.cliente ?? '—'}
                  </td>
                  <td className="p-2">{d.row.data_analise ?? '—'}</td>
                  <td className="p-2 text-right">{d.row.tmr ?? '—'}</td>
                  <td className="p-2 truncate max-w-[260px]" title={d.row.comentario ?? ''}>
                    {d.row.comentario ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          A chave de duplicidade é: <strong>CPF + Mês + Ano + Semana + Código do cliente + Comentário + Data Análise + TMR</strong>.
          "Banco" = já foi importado antes. "Planilha" = aparece mais de uma vez no arquivo atual.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Recalcula o indicador mensal PDV_CRITICO em user_indicator_daily.
 * Para cada (user_id, mes, ano): conta feedbacks com estado='Relevante'.
 * Lógica MAIOR é melhor:
 * - status: dentro_meta se valor >= 5; abaixo_meta se < 5
 * - status_desafio: 'atingiu' se valor >= 15; 'nao_atingiu' caso contrário
 * Bônus: meta R$ 52,50 + desafio R$ 10,00 (configurado em goals).
 */
export async function recalcPdvCritico(opts: { indicatorId: string; ano: number; mesesNum: number[] }) {
  const { indicatorId, ano, mesesNum } = opts;
  if (!mesesNum.length) return;

  // Busca todos os feedbacks relevantes desses meses (paginado)
  const all: { user_id: string | null; mes_num: number; ano: number }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await (supabase.from('pdv_critico_feedbacks' as any) as any)
      .select('user_id, mes_num, ano')
      .eq('ano', ano)
      .in('mes_num', mesesNum)
      .eq('estado', 'Relevante')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (data) all.push(...data);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Agrega por (user_id, ano-mes)
  const counts = new Map<string, number>();
  for (const r of all) {
    if (!r.user_id) continue;
    const key = `${r.user_id}|${r.ano}|${r.mes_num}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Para cada motorista que TEVE feedback, faz upsert. Para meses sem nenhum
  // feedback do motorista no período importado, NÃO criamos linha automática
  // (mantemos consistência com Rating que só grava quem aparece no arquivo).
  const rows = Array.from(counts.entries()).map(([key, valor]) => {
    const [userId, anoStr, mesStr] = key.split('|');
    const data_referencia = `${anoStr}-${String(parseInt(mesStr, 10)).padStart(2, '0')}-01`;
    const atingiuMeta = valor >= PDV_META;
    const atingiuDesafio = valor >= PDV_DESAFIO;
    return {
      user_id: userId,
      indicator_id: indicatorId,
      data_referencia,
      valor,
      meta: PDV_META,
      desafio: PDV_DESAFIO,
      percentual_atingimento: PDV_META > 0 ? Math.min(100, (valor / PDV_META) * 100) : 0,
      status: atingiuMeta ? 'dentro_meta' : 'abaixo_meta',
      status_desafio: atingiuDesafio ? 'atingiu' : 'nao_atingiu',
      origem_dado: 'import_pdv_critico',
      mapa_numero: 'MENSAL',
    };
  });

  // Também precisamos ZERAR motoristas que estavam em meses anteriores mas
  // que neste import não tiveram nenhum relevante? Mantemos simples: só upsert
  // dos que aparecem. Admin pode rodar "Recalcular" para refazer.

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const { error } = await (supabase.from('user_indicator_daily') as any).upsert(slice, {
      onConflict: 'user_id,indicator_id,data_referencia,mapa_numero',
    });
    if (error) throw error;
  }
}