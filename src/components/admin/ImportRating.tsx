import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, Database, Search, X, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Column, DataTable } from '@/components/shared/DataTable';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePick } from '@/components/shared/DateRangePick';

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

function toNum(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace('%', '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toPct(v: any): number {
  // Excel pode trazer 0.9876 ou "98.76%" — normalizamos para 0..100
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
          .order('data_referencia_fim', { ascending: false })
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
      if (dateFrom && r.data_referencia_fim < dateFrom) return false;
      if (dateTo && r.data_referencia_inicio > dateTo) return false;
      if (workerType !== 'all' && r.worker_type !== workerType) return false;
      if (unidade !== 'all' && r.unidade !== unidade) return false;
      return true;
    });
  }, [dbRows, search, dateFrom, dateTo, workerType, unidade]);

  const avgRating = useMemo(() => {
    if (!filteredRows.length) return 0;
    return filteredRows.reduce((a, r) => a + Number(r.rating || 0), 0) / filteredRows.length;
  }, [filteredRows]);

  const hasFilters = !!(search || dateFrom || dateTo || workerType !== 'all' || unidade !== 'all');
  const clearFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo(''); setWorkerType('all'); setUnidade('all');
  };

  const dbColumns: Column<DbRow>[] = [
    {
      key: 'data_referencia_inicio',
      label: 'Período',
      render: (r) => `${formatDate(r.data_referencia_inicio)} – ${formatDate(r.data_referencia_fim)}`,
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
            Planilhas <strong>Planificador_Motorista.xlsx</strong> e <strong>Planificador_Ajudante.xlsx</strong>
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
            <DateRangePick from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} />
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
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [unidade, setUnidade] = useState('Revalle Juazeiro');
  const inputRef = useRef<HTMLInputElement>(null);

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

        // Encontra a linha de cabeçalho (contém "Código" e "Avaliações")
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
          // pula totais e linhas vazias / sem código numérico
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
    if (!dataInicio || !dataFim) { toast.error('Informe o período (data início e fim).'); return; }
    if (dataInicio > dataFim) { toast.error('Data início deve ser anterior à data fim.'); return; }

    setImporting(true);
    try {
      // Lookup matrículas → user_ids
      const matriculas = rows.map(r => r.matricula);
      const matriculaToUserId: Record<string, string> = {};
      const { data: users } = await supabase
        .from('users')
        .select('id, matricula')
        .in('matricula', matriculas);
      users?.forEach(u => { matriculaToUserId[u.matricula] = u.id; });

      const { data: authData } = await supabase.auth.getUser();
      const importedBy = authData.user?.id || null;

      const enriched = rows.map(r => ({
        data_referencia_inicio: dataInicio,
        data_referencia_fim: dataFim,
        worker_type: workerType,
        unidade: unidade.trim() || null,
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
          onConflict: 'data_referencia_inicio,data_referencia_fim,worker_type,matricula',
        });
        if (error) throw error;
      }

      const matched = Object.values(matriculaToUserId).length;
      toast.success(`${rows.length} avaliações importadas! (${matched}/${rows.length} matrículas vinculadas)`);
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
          <DialogTitle>Importar Rating (XLSX)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de colaborador</Label>
              <Select value={workerType} onValueChange={(v) => setWorkerType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="motorista">Motorista</SelectItem>
                  <SelectItem value="ajudante">Ajudante</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade / Revenda</Label>
              <Input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Ex: Revalle Juazeiro" />
            </div>
            <div>
              <Label>Período — Início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Período — Fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
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