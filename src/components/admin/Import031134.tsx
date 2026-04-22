import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, Database, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Column, DataTable } from '@/components/shared/DataTable';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
import { DateRangePick } from '@/components/shared/DateRangePick';

interface ParsedRow {
  data_operacao: string | null;
  mapa: string;
  veiculo: string;
  placa: string;
  transportadora: string;
  pct_incidencia_veiculo: number;
  pct_nao_aferido: number;
  cod_motorista: string;
  nome_motorista: string;
  cod_ajudante: string;
  nome_ajudante: string;
  cod_conferente: string;
  nome_conferente: string;
  item: string;
  descricao_item: string;
  total_aferido: number;
  quebrada: number;
  segunda: number;
  bicada_interna: number;
  bicada_externa: number;
  cor_fora_padrao: number;
  faltante: number;
  logomarca_estranha: number;
  rotulo_plastico: number;
  sujidade_interna: number;
  sujidade_externa: number;
  tampada: number;
  trincada: number;
  bicada_concorrente: number;
  outros: number;
  pct_refugo: number;
  qt_boa: number;
  tipo_sorteio: string;
}

interface DbRow {
  id: string;
  data_operacao: string;
  mapa: string;
  placa: string | null;
  veiculo: string | null;
  cod_motorista: string | null;
  nome_motorista: string | null;
  cod_ajudante: string | null;
  nome_ajudante: string | null;
  descricao_item: string | null;
  total_aferido: number | null;
  pct_refugo: number;
  qt_boa: number | null;
}

function parseBrDate(raw: string): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const parts = t.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function parseBrNumber(raw: string): number {
  const t = raw?.trim()?.replace(/\./g, '').replace(',', '.');
  return parseFloat(t) || 0;
}

// Decode WINDOWS-1252 → UTF-8 (CSV usa charset latin)
function decodeLatin(buf: ArrayBuffer): string {
  const decoder = new TextDecoder('windows-1252');
  return decoder.decode(buf);
}

export default function Import031134() {
  const [dbRows, setDbRows] = useState<DbRow[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchDbRows = useCallback(async () => {
    setLoadingDb(true);
    try {
      const allRows: DbRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await (supabase.from('refugo_031134') as any)
          .select('id, data_operacao, mapa, placa, veiculo, cod_motorista, nome_motorista, cod_ajudante, nome_ajudante, descricao_item, total_aferido, pct_refugo, qt_boa')
          .order('data_operacao', { ascending: false })
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
          r.mapa?.toLowerCase().includes(s) ||
          r.nome_motorista?.toLowerCase().includes(s) ||
          r.nome_ajudante?.toLowerCase().includes(s) ||
          r.placa?.toLowerCase().includes(s) ||
          r.descricao_item?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (dateFrom && r.data_operacao < dateFrom) return false;
      if (dateTo && r.data_operacao > dateTo) return false;
      return true;
    });
  }, [dbRows, search, dateFrom, dateTo]);

  const avgRefugo = useMemo(() => {
    if (!filteredRows.length) return 0;
    const sum = filteredRows.reduce((a, r) => a + Number(r.pct_refugo || 0), 0);
    return sum / filteredRows.length;
  }, [filteredRows]);

  const hasFilters = !!(search || dateFrom || dateTo);
  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); };

  const dbColumns: Column<DbRow>[] = [
    { key: 'data_operacao', label: 'Data', render: (r) => formatDate(r.data_operacao) },
    { key: 'mapa', label: 'Mapa' },
    { key: 'placa', label: 'Placa' },
    { key: 'cod_motorista', label: 'Cód. Mot.' },
    { key: 'nome_motorista', label: 'Motorista' },
    { key: 'cod_ajudante', label: 'Cód. Ajud.' },
    { key: 'nome_ajudante', label: 'Ajudante' },
    { key: 'descricao_item', label: 'Item' },
    { key: 'total_aferido', label: 'Total Aferido', render: (r) => r.total_aferido?.toLocaleString('pt-BR') ?? '—' },
    { key: 'pct_refugo', label: '% Refugo', render: (r) => `${Number(r.pct_refugo).toFixed(2)}%` },
    { key: 'qt_boa', label: 'Qt Boa', render: (r) => r.qt_boa?.toLocaleString('pt-BR') ?? '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Importação 03.11.34.05 (Refugo)</h3>
          <p className="text-sm text-muted-foreground">
            % Refugo aplicado aos ajudantes do mapa. Meta: 0,50%
          </p>
        </div>
        <Import031134Dialog onSuccess={fetchDbRows} />
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
              : `${filteredRows.length} de ${dbRows.length} registros • Refugo médio: ${avgRefugo.toFixed(2)}%`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar mapa, motorista, ajudante, placa, item..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <DateRangePick from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} />
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

function Import031134Dialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      const text = decodeLatin(buf);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV vazio'); return; }

      const header = lines[0].replace(/^\uFEFF/, '');
      const cols = header.split(';').map(c => c.trim());

      const idx = (name: string) => cols.findIndex(c => c.toLowerCase() === name.toLowerCase());
      const required = ['Data', 'Mapa', '% Refugo'];
      for (const r of required) {
        if (idx(r) === -1) { toast.error(`Coluna "${r}" não encontrada no CSV`); return; }
      }

      const allRows: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(';').map(v => v.trim());
        if (vals.length < cols.length - 2) continue;

        const data_operacao = parseBrDate(vals[idx('Data')]);
        const mapa = vals[idx('Mapa')];
        if (!data_operacao || !mapa) continue;

        allRows.push({
          data_operacao,
          mapa,
          veiculo: vals[idx('Veiculo')] || '',
          placa: vals[idx('Placa')] || '',
          transportadora: vals[idx('Transportadora')] || '',
          pct_incidencia_veiculo: parseBrNumber(vals[idx('% Incidencia Veiculo')] || '0'),
          pct_nao_aferido: parseBrNumber(vals[idx('% Nao Aferido')] || '0'),
          cod_motorista: vals[idx('Cod. Motorista')] || '',
          nome_motorista: vals[idx('Nome Motorista')] || '',
          cod_ajudante: vals[idx('Cod. Ajudante')] || '',
          nome_ajudante: vals[idx('Nome Ajudante')] || '',
          cod_conferente: vals[idx('Cod. Conferente')] || '',
          nome_conferente: vals[idx('Nome Conferente')] || '',
          item: vals[idx('Item')] || '',
          descricao_item: vals[idx('Descricao Item')] || '',
          total_aferido: parseBrNumber(vals[idx('Total Aferido')] || '0'),
          quebrada: parseBrNumber(vals[idx('Quebrada')] || '0'),
          segunda: parseBrNumber(vals[idx('Segunda')] || '0'),
          bicada_interna: parseBrNumber(vals[idx('Bicada Interna')] || '0'),
          bicada_externa: parseBrNumber(vals[idx('Bicada Externa')] || '0'),
          cor_fora_padrao: parseBrNumber(vals[idx('Cor Fora do Padrão')] || '0'),
          faltante: parseBrNumber(vals[idx('Faltante')] || '0'),
          logomarca_estranha: parseBrNumber(vals[idx('Logomarca Estranha')] || '0'),
          rotulo_plastico: parseBrNumber(vals[idx('Rotulo Plastico')] || '0'),
          sujidade_interna: parseBrNumber(vals[idx('Sujidade Interna')] || '0'),
          sujidade_externa: parseBrNumber(vals[idx('Sujidade Externa')] || '0'),
          tampada: parseBrNumber(vals[idx('Tampada')] || '0'),
          trincada: parseBrNumber(vals[idx('Trincada')] || '0'),
          bicada_concorrente: parseBrNumber(vals[idx('Bicada Concorrente')] || '0'),
          outros: parseBrNumber(vals[idx('Outros')] || '0'),
          pct_refugo: parseBrNumber(vals[idx('% Refugo')] || '0'),
          qt_boa: parseBrNumber(vals[idx('Qt Boa')] || '0'),
          tipo_sorteio: vals[idx('Tipo Sorteio')] || '',
        });
      }

      setRows(allRows);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      // Lookup matrículas → user_ids
      const allMatriculas = new Set<string>();
      rows.forEach(r => {
        const mot = r.cod_motorista?.trim();
        const aju = r.cod_ajudante?.trim();
        if (mot && mot !== '0' && mot !== '00000') allMatriculas.add(mot);
        if (aju && aju !== '0' && aju !== '00000') allMatriculas.add(aju);
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
        const mot = r.cod_motorista?.trim();
        const aju = r.cod_ajudante?.trim();
        return {
          ...r,
          mot_user_id: (mot && mot !== '0' && mot !== '00000') ? matriculaToUserId[mot] || null : null,
          aju1_user_id: (aju && aju !== '0' && aju !== '00000') ? matriculaToUserId[aju] || null : null,
          aju2_user_id: null,
        };
      });

      // Limpa registros das datas que vão ser reimportadas (substituição)
      const uniqueDates = [...new Set(rows.map(r => r.data_operacao!).filter(Boolean))];
      if (uniqueDates.length > 0) {
        await (supabase.from('refugo_031134') as any).delete().in('data_operacao', uniqueDates);
      }

      const batchSize = 500;
      const totalBatches = Math.ceil(enriched.length / batchSize);
      for (let i = 0; i < enriched.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1;
        setProgress(`Lote ${batchNum}/${totalBatches}`);
        const batch = enriched.slice(i, i + batchSize);
        const { error } = await (supabase.from('refugo_031134') as any).insert(batch);
        if (error) throw error;
      }

      toast.success(`${rows.length} registros importados!`);

      // Recalcula indicadores das datas afetadas (inclui REFUGO)
      setProgress('Recalculando indicadores...');
      try {
        const { error: calcErr } = await supabase.functions.invoke('calculate-daily-indicators', { body: { data_referencia: uniqueDates } });
        if (calcErr) console.error(calcErr);
        else toast.success('Indicadores recalculados!');
      } catch (e) {
        console.error(e);
      }

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
          <DialogTitle>Importar 03.11.34.05 (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            CSV com separador <code>;</code> (encoding latin/Windows-1252). O % Refugo será aplicado aos ajudantes do mapa.
          </p>
          <input ref={inputRef} type="file" accept=".csv,.txt" onChange={handleFile} className="block w-full text-sm" />
          {rows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium"><strong>{rows.length}</strong> registros prontos</p>
              <div className="max-h-48 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead><tr className="bg-muted">
                    <th className="p-1 text-left">Data</th>
                    <th className="p-1 text-left">Mapa</th>
                    <th className="p-1 text-left">Motorista</th>
                    <th className="p-1 text-left">Ajudante</th>
                    <th className="p-1 text-right">% Refugo</th>
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">{r.data_operacao}</td>
                        <td className="p-1">{r.mapa}</td>
                        <td className="p-1">{r.nome_motorista}</td>
                        <td className="p-1">{r.nome_ajudante}</td>
                        <td className="p-1 text-right">{r.pct_refugo.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
              <Button onClick={handleImport} disabled={importing} className="w-full">
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</> : `Importar ${rows.length} registros`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}