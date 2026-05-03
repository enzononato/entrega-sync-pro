import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, Database, Search, X, Star, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Column, DataTable } from '@/components/shared/DataTable';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImportPreviewTable, RowStatus } from '@/components/admin/ImportPreviewTable';
import { ImportHistoryPanel } from '@/components/admin/ImportHistoryPanel';
import { createImportBatch } from '@/hooks/useImportBatches';

const RATING_INDICATOR_ID = '853beb35-febb-48b9-b3ae-be7173bfc6fc';
const RATING_META = 4.95;
const RATING_DESAFIO = 5.00;

interface ParsedRow {
  matricula: string;
  nome: string;
  avaliacoes: number;
  pdv: number;
  promotor: number;
  neutro: number;
  detrator: number;
  pct_promotor: number;
  pct_neutro: number;
  pct_detrator: number;
  rating: number;
  meta: number;
  gap: number;
}

interface DbRow {
  id: string;
  data_referencia_inicio: string;
  data_referencia_fim: string;
  worker_type: string;
  matricula: string;
  nome: string | null;
  avaliacoes: number;
  pdv: number;
  promotor: number;
  neutro: number;
  detrator: number;
  pct_promotor: number;
  pct_neutro: number;
  pct_detrator: number;
  rating: number;
  meta: number;
  gap: number;
  unidade: string | null;
  user_id: string | null;
  created_at: string;
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function formatMonth(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m] = dateStr.split('-');
  const mi = parseInt(m, 10) - 1;
  if (isNaN(mi) || mi < 0 || mi > 11) return dateStr;
  return `${MESES_PT[mi]}/${y}`;
}
function monthToRange(ym: string): { inicio: string; fim: string } {
  const [y, m] = ym.split('-').map(Number);
  const inicio = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const fim = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { inicio, fim };
}

function toNum(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace('%', '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toPct(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') {
    return v <= 1 ? v * 100 : v;
  }
  const s = String(v).trim();
  const hasPct = s.includes('%');
  const n = toNum(s);
  if (!hasPct && n <= 1 && n > 0) return n * 100;
  return n;
}

export default function ImportRating() {
  const [dbRows, setDbRows] = useState<DbRow[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [search, setSearch] = useState('');
  const [mes, setMes] = useState(''); // YYYY-MM
  const [workerType, setWorkerType] = useState('all');
  const [unidade, setUnidade] = useState('all');

  const fetchDbRows = useCallback(async () => {
    setLoadingDb(true);
    try {
      const allRows: DbRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await (supabase.from('rating_avaliacoes') as any)
          .select('*')
          .order('data_referencia_inicio', { ascending: false })
          .order('rating', { ascending: false })
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

  const unidades = useMemo(() => {
    const set = new Set<string>();
    dbRows.forEach(r => { if (r.unidade) set.add(r.unidade); });
    return Array.from(set).sort();
  }, [dbRows]);

  const filteredRows = useMemo(() => {
    return dbRows.filter(r => {
      if (search) {
        const s = search.toLowerCase();
        const match =
          r.matricula?.toLowerCase().includes(s) ||
          r.nome?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (mes) {
        const rowMes = r.data_referencia_inicio?.slice(0, 7);
        if (rowMes !== mes) return false;
      }
      if (workerType !== 'all' && r.worker_type !== workerType) return false;
      if (unidade !== 'all' && r.unidade !== unidade) return false;
      return true;
    });
  }, [dbRows, search, mes, workerType, unidade]);

  const avgRating = useMemo(() => {
    if (!filteredRows.length) return 0;
    return filteredRows.reduce((a, r) => a + Number(r.rating || 0), 0) / filteredRows.length;
  }, [filteredRows]);

  const hasFilters = !!(search || mes || workerType !== 'all' || unidade !== 'all');
  const clearFilters = () => {
    setSearch(''); setMes(''); setWorkerType('all'); setUnidade('all');
  };

  const dbColumns: Column<DbRow>[] = [
    {
      key: 'data_referencia_inicio',
      label: 'Mês de Referência',
      render: (r) => formatMonth(r.data_referencia_inicio),
    },
    { key: 'worker_type', label: 'Tipo', render: (r) => r.worker_type === 'motorista' ? 'Motorista' : 'Ajudante' },
    { key: 'matricula', label: 'Matrícula' },
    { key: 'nome', label: 'Nome' },
    { key: 'unidade', label: 'Unidade' },
    { key: 'avaliacoes', label: 'Avaliações' },
    { key: 'pdv', label: 'PDV' },
    { key: 'promotor', label: 'Promotor' },
    { key: 'neutro', label: 'Neutro' },
    { key: 'detrator', label: 'Detrator' },
    { key: 'pct_promotor', label: '% Promotor', render: (r) => `${Number(r.pct_promotor).toFixed(2)}%` },
    { key: 'pct_detrator', label: '% Detrator', render: (r) => `${Number(r.pct_detrator).toFixed(2)}%` },
    { key: 'rating', label: 'Rating', render: (r) => Number(r.rating).toFixed(2) },
    { key: 'meta', label: 'Meta', render: (r) => Number(r.meta).toFixed(2) },
    { key: 'gap', label: 'GAP', render: (r) => Number(r.gap).toFixed(2) },
    { key: 'user_id', label: 'Vinculado', render: (r) => r.user_id ? 'Sim' : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5" /> Importação de Rating (Avaliações de PDV)
          </h3>
          <p className="text-sm text-muted-foreground">
            Indicador <strong>mensal</strong> — Planilhas <strong>Planificador_Motorista.xlsx</strong> e <strong>Planificador_Ajudante.xlsx</strong>
          </p>
        </div>
        <ImportRatingDialog onSuccess={fetchDbRows} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            Dados Importados
          </CardTitle>
          <CardDescription>
            {loadingDb
              ? 'Carregando...'
              : `${filteredRows.length} de ${dbRows.length} registros • Rating médio: ${avgRating.toFixed(2)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar matrícula ou nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Input
              type="month"
              value={mes}
              onChange={e => setMes(e.target.value)}
              className="w-44 h-9"
              placeholder="Mês"
            />
            <Select value={workerType} onValueChange={setWorkerType}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="motorista">Motorista</SelectItem>
                <SelectItem value="ajudante">Ajudante</SelectItem>
              </SelectContent>
            </Select>
            {unidades.length > 0 && (
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Unidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas unidades</SelectItem>
                  {unidades.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
          <DataTable columns={dbColumns} data={filteredRows} loading={loadingDb} emptyMessage="Nenhum dado importado ainda." />
        </CardContent>
      </Card>
    </div>
  );
}

function ImportRatingDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [workerType, setWorkerType] = useState<'motorista' | 'ajudante'>('motorista');
  const [mesReferencia, setMesReferencia] = useState(''); // YYYY-MM
  const [unidade, setUnidade] = useState('');
  const [units, setUnits] = useState<{ id: string; nome: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('units').select('id, nome').eq('ativo', true).order('nome').then(({ data }) => {
      if (data) setUnits(data);
    });
  }, []);

  const reset = () => {
    setRows([]); setProgress('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let headerIdx = -1;
        for (let i = 0; i < json.length; i++) {
          const row = json[i].map((c: any) => String(c).trim().toLowerCase());
          if (row.includes('código') && row.some((c: string) => c.includes('avalia'))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) {
          toast.error('Cabeçalho não encontrado na planilha.');
          return;
        }

        const parsed: ParsedRow[] = [];
        for (let i = headerIdx + 1; i < json.length; i++) {
          const row = json[i];
          const matricula = String(row[0] ?? '').trim();
          if (!matricula || matricula.toLowerCase() === 'total' || matricula.toLowerCase().startsWith('filtros')) continue;
          if (!/^\d+$/.test(matricula)) continue;
          if (matricula === '0') continue;

          const nome = String(row[1] ?? '').trim();
          const avaliacoes = toNum(row[2]);
          if (avaliacoes <= 0) continue;

          parsed.push({
            matricula,
            nome,
            avaliacoes,
            pdv: toNum(row[3]),
            promotor: toNum(row[4]),
            neutro: toNum(row[5]),
            detrator: toNum(row[6]),
            pct_promotor: toPct(row[7]),
            pct_neutro: toPct(row[8]),
            pct_detrator: toPct(row[9]),
            rating: toNum(row[10]),
            meta: toNum(row[11]),
            gap: toNum(row[12]),
          });
        }

        if (!parsed.length) {
          toast.error('Nenhuma linha válida encontrada na planilha.');
          return;
        }
        setRows(parsed);
        toast.success(`${parsed.length} colaboradores prontos para importar.`);
      } catch (err: any) {
        toast.error('Erro ao ler planilha: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    if (!mesReferencia) { toast.error('Informe o mês de referência.'); return; }
    if (!unidade.trim()) { toast.error('Informe a unidade/revenda.'); return; }

    const { inicio, fim } = monthToRange(mesReferencia);

    setImporting(true);
    try {
      const matriculas = rows.map(r => r.matricula);
      const matriculaToUserId: Record<string, string> = {};
      const { data: users } = await supabase
        .from('users')
        .select('id, matricula, worker_type')
        .in('matricula', matriculas);
      // Vincular apenas se o worker_type bater com o tipo da importação
      users?.forEach(u => {
        if (u.worker_type === workerType) {
          matriculaToUserId[u.matricula] = u.id;
        }
      });

      const { data: authData } = await supabase.auth.getUser();
      const importedBy = authData.user?.id || null;

      const enriched = rows.map(r => ({
        data_referencia_inicio: inicio,
        data_referencia_fim: fim,
        worker_type: workerType,
        unidade: unidade.trim(),
        user_id: matriculaToUserId[r.matricula] || null,
        imported_by: importedBy,
        ...r,
      }));

      const batchSize = 500;
      const totalBatches = Math.ceil(enriched.length / batchSize);
      for (let i = 0; i < enriched.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1;
        setProgress(`Lote ${batchNum}/${totalBatches} (${Math.min(i + batchSize, enriched.length)}/${enriched.length})`);
        const batch = enriched.slice(i, i + batchSize);
        const { error } = await (supabase.from('rating_avaliacoes') as any).upsert(batch, {
          onConflict: 'data_referencia_inicio,worker_type,unidade,matricula',
        });
        if (error) throw error;
      }

      // Gera/atualiza indicador mensal Rating em user_indicator_daily
      setProgress('Atualizando indicador mensal de Rating...');
      const indicatorRows = enriched
        .filter(r => r.user_id)
        .map(r => {
          const ratingVal = Number(r.rating);
          const atingiuMeta = ratingVal >= RATING_META;
          const atingiuDesafio = ratingVal >= RATING_DESAFIO; // exatamente 5,00 ou mais
          return {
            user_id: r.user_id,
            indicator_id: RATING_INDICATOR_ID,
            data_referencia: inicio,
            valor: ratingVal,
            meta: RATING_META,
            desafio: RATING_DESAFIO,
            percentual_atingimento: (ratingVal / RATING_META) * 100,
            status: atingiuMeta ? 'dentro_meta' : 'abaixo_meta',
            status_desafio: atingiuDesafio ? 'atingiu' : 'nao_atingiu',
            origem_dado: 'import_rating',
            mapa_numero: 'MENSAL',
          };
        });

      let indicatorsUpserted = 0;
      if (indicatorRows.length) {
        for (let i = 0; i < indicatorRows.length; i += batchSize) {
          const batch = indicatorRows.slice(i, i + batchSize);
          const { error } = await (supabase.from('user_indicator_daily') as any).upsert(batch, {
            onConflict: 'user_id,indicator_id,data_referencia',
          });
          if (error) {
            console.error('Erro ao upsert user_indicator_daily:', error);
            // não bloqueia o sucesso da importação principal
            break;
          }
          indicatorsUpserted += batch.length;
        }
      }

      const matched = Object.keys(matriculaToUserId).length;
      toast.success(
        `${rows.length} avaliações importadas/atualizadas! ` +
        `${matched}/${rows.length} matrículas vinculadas. ` +
        `${indicatorsUpserted} indicadores mensais atualizados.`
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

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><Upload className="h-4 w-4 mr-2" /> Importar Planilha</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Rating Mensal (XLSX)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Reimportar uma planilha do mesmo <strong>mês + tipo + unidade</strong> irá <strong>substituir</strong> os valores existentes (não duplica).
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de colaborador *</Label>
              <Select value={workerType} onValueChange={(v) => setWorkerType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="motorista">Motorista</SelectItem>
                  <SelectItem value="ajudante">Ajudante</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade / Revenda *</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {units.map(u => <SelectItem key={u.id} value={u.nome}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Mês de referência *</Label>
              <Input type="month" value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} />
              {mesReferencia && (
                <p className="text-xs text-muted-foreground mt-1">
                  Será registrado como: <strong>{formatMonth(monthToRange(mesReferencia).inicio)}</strong>
                </p>
              )}
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
            <p className="text-xs text-muted-foreground mt-1">
              Selecione <strong>Planificador_Motorista.xlsx</strong> ou <strong>Planificador_Ajudante.xlsx</strong>.
              Linhas "Total" e sem código serão ignoradas.
            </p>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{rows.length} colaboradores prontos para importar</p>
              <div className="max-h-56 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead><tr className="bg-muted">
                    <th className="p-1 text-left">Matrícula</th>
                    <th className="p-1 text-left">Nome</th>
                    <th className="p-1 text-right">Avaliações</th>
                    <th className="p-1 text-right">% Promotor</th>
                    <th className="p-1 text-right">% Detrator</th>
                    <th className="p-1 text-right">Rating</th>
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 30).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">{r.matricula}</td>
                        <td className="p-1">{r.nome}</td>
                        <td className="p-1 text-right">{r.avaliacoes}</td>
                        <td className="p-1 text-right">{r.pct_promotor.toFixed(2)}%</td>
                        <td className="p-1 text-right">{r.pct_detrator.toFixed(2)}%</td>
                        <td className="p-1 text-right">{r.rating.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 30 && (
                <p className="text-xs text-muted-foreground">… e mais {rows.length - 30} linhas</p>
              )}
            </div>
          )}

          {progress && <p className="text-sm text-primary">{progress}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!rows.length || importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {importing ? 'Importando...' : `Importar ${rows.length || ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
