import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileUp, Loader2, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Column, DataTable } from '@/components/shared/DataTable';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

interface ParsedRow {
  unb: string;
  descricao_unb: string;
  codigo_cliente: string;
  nome_cliente: string;
  solicitacao_reposicao: string;
  tipo_solicitacao: string;
  data_solicitacao: string | null;
  hora: string;
  status_solicitacao: string;
  justificativa: string;
  mapa_origem: string;
  nf_origem: string;
  produto: string;
  descricao_produto: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
  valor: number;
  motorista_codigo: string;
  motorista_nome: string;
  ajudante_codigo: string;
  ajudante_nome: string;
  sistema_origem: string;
  observacao: string;
}

interface DbRow {
  id: string;
  data_solicitacao: string | null;
  unb: string | null;
  descricao_unb: string | null;
  codigo_cliente: string | null;
  nome_cliente: string | null;
  solicitacao_reposicao: string | null;
  tipo_solicitacao: string | null;
  hora: string | null;
  status_solicitacao: string | null;
  justificativa: string | null;
  mapa_origem: string | null;
  nf_origem: string | null;
  produto: string | null;
  descricao_produto: string | null;
  quantidade: number | null;
  unidade_medida: string | null;
  valor_unitario: number | null;
  valor: number | null;
  motorista_codigo: string | null;
  motorista_nome: string | null;
  ajudante_codigo: string | null;
  ajudante_nome: string | null;
  sistema_origem: string | null;
  observacao: string | null;
  created_at: string;
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

const JUSTIFICATIVAS_PERMITIDAS = ['Produto Avariado', 'Quebra'];

export default function Import031805() {
  const [dbRows, setDbRows] = useState<DbRow[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);

  const fetchDbRows = useCallback(async () => {
    setLoadingDb(true);
    try {
      const allRows: DbRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await (supabase.from('reposicao_031805') as any)
          .select('*')
          .order('data_solicitacao', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data) allRows.push(...data);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      setDbRows(allRows);
    } catch {
      // silent
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => { fetchDbRows(); }, [fetchDbRows]);

  const dbColumns: Column<DbRow>[] = [
    { key: 'data_solicitacao', label: 'Data', render: (r) => r.data_solicitacao ? formatDate(r.data_solicitacao) : '—' },
    { key: 'unb', label: 'UNB' },
    { key: 'descricao_unb', label: 'Desc. UNB' },
    { key: 'codigo_cliente', label: 'Cód. Cliente' },
    { key: 'nome_cliente', label: 'Cliente' },
    { key: 'solicitacao_reposicao', label: 'Solicitação' },
    { key: 'tipo_solicitacao', label: 'Tipo' },
    { key: 'hora', label: 'Hora' },
    { key: 'status_solicitacao', label: 'Status' },
    { key: 'justificativa', label: 'Justificativa' },
    { key: 'mapa_origem', label: 'Mapa' },
    { key: 'nf_origem', label: 'NF Origem' },
    { key: 'produto', label: 'Produto' },
    { key: 'descricao_produto', label: 'Desc. Produto' },
    { key: 'quantidade', label: 'Qtd' },
    { key: 'unidade_medida', label: 'UM' },
    { key: 'valor_unitario', label: 'Vlr Unit.', render: (r) => r.valor_unitario != null ? `R$ ${Number(r.valor_unitario).toFixed(2)}` : '—' },
    { key: 'valor', label: 'Valor', render: (r) => r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : '—' },
    { key: 'motorista_codigo', label: 'Cód. Mot.' },
    { key: 'motorista_nome', label: 'Motorista' },
    { key: 'ajudante_codigo', label: 'Cód. Ajud.' },
    { key: 'ajudante_nome', label: 'Ajudante' },
    { key: 'sistema_origem', label: 'Sistema' },
    { key: 'observacao', label: 'Observação' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Importação 03.18.05</h3>
          <p className="text-sm text-muted-foreground">
            Apenas registros com justificativa "Produto Avariado" ou "Quebra"
          </p>
        </div>
        <Import031805Dialog onSuccess={fetchDbRows} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            Dados Importados
          </CardTitle>
          <CardDescription>
            {loadingDb ? 'Carregando...' : `${dbRows.length} registros no banco de dados`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={dbColumns} data={dbRows} loading={loadingDb} emptyMessage="Nenhum dado importado ainda." />
        </CardContent>
      </Card>
    </div>
  );
}

function Import031805Dialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [totalOriginal, setTotalOriginal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV vazio'); return; }

      const header = lines[0].replace(/^\uFEFF/, '');
      const cols = header.split(';').map(c => c.trim());

      const jIdx = cols.indexOf('Justificativa');
      if (jIdx === -1) {
        toast.error('Coluna "Justificativa" não encontrada no CSV.');
        return;
      }

      const allRows: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(';').map(v => v.trim());
        if (vals.length < cols.length) continue;

        const justificativa = vals[jIdx];
        if (!JUSTIFICATIVAS_PERMITIDAS.some(j => justificativa.includes(j))) continue;

        allRows.push({
          unb: vals[0],
          descricao_unb: vals[1],
          codigo_cliente: vals[2],
          nome_cliente: vals[3],
          solicitacao_reposicao: vals[4],
          tipo_solicitacao: vals[5],
          data_solicitacao: parseBrDate(vals[6]),
          hora: vals[7],
          status_solicitacao: vals[8],
          justificativa,
          mapa_origem: vals[23],
          nf_origem: vals[24],
          produto: vals[14],
          descricao_produto: vals[15],
          quantidade: parseBrNumber(vals[16]),
          unidade_medida: vals[17],
          valor_unitario: parseBrNumber(vals[18]),
          valor: parseBrNumber(vals[19]),
          motorista_codigo: vals[33],
          motorista_nome: vals[34],
          ajudante_codigo: vals[35],
          ajudante_nome: vals[36],
          sistema_origem: vals[61],
          observacao: vals[62],
        });
      }

      setTotalOriginal(lines.length - 1);
      setRows(allRows);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      // Lookup matrículas → user_ids
      const allMatriculas = new Set<string>();
      rows.forEach(r => {
        const mot = r.motorista_codigo?.trim();
        const aju = r.ajudante_codigo?.trim();
        if (mot && mot !== '0') allMatriculas.add(mot);
        if (aju && aju !== '0') allMatriculas.add(aju);
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
        const mot = r.motorista_codigo?.trim();
        const aju = r.ajudante_codigo?.trim();
        return {
          ...r,
          mot_user_id: (mot && mot !== '0') ? matriculaToUserId[mot] || null : null,
          aju_user_id: (aju && aju !== '0') ? matriculaToUserId[aju] || null : null,
        };
      });

      const batchSize = 500;
      const totalBatches = Math.ceil(enriched.length / batchSize);
      for (let i = 0; i < enriched.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1;
        setProgress(`Lote ${batchNum}/${totalBatches} (${Math.min(i + batchSize, enriched.length)}/${enriched.length} registros)`);
        const batch = enriched.slice(i, i + batchSize);
        const { error } = await (supabase.from('reposicao_031805') as any).upsert(batch, { onConflict: 'solicitacao_reposicao,produto' });
        if (error) throw error;
      }

      const matched = Object.keys(matriculaToUserId).length;
      const total = allMatriculas.size;
      toast.success(`${rows.length} registros importados! (${matched}/${total} matrículas vinculadas)`);

      // Auto-calculate all indicators (includes reposição)
      setProgress('Recalculando indicadores...');
      try {
        const { error: calcErr } = await supabase.functions.invoke('calculate-daily-indicators', { body: {} });
        if (calcErr) console.error('Erro ao calcular indicadores:', calcErr);
        else toast.success('Indicadores recalculados automaticamente!');
      } catch (e) {
        console.error('Erro ao chamar calculate-daily-indicators:', e);
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
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRows([]); setTotalOriginal(0); } }}>
      <DialogTrigger asChild>
        <Button><Upload className="h-4 w-4 mr-2" /> Importar CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar 03.18.05 (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione um arquivo CSV com separador <code>;</code>. Apenas registros com justificativa
            "Produto Avariado" ou "Quebra" serão importados.
          </p>
          <input ref={inputRef} type="file" accept=".csv,.txt" onChange={handleFile} className="block w-full text-sm" />
          {rows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {totalOriginal} linhas no arquivo → <strong>{rows.length}</strong> registros filtrados
              </p>
              <div className="max-h-48 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead><tr className="bg-muted">
                    <th className="p-1">Data</th>
                    <th className="p-1">Justificativa</th>
                    <th className="p-1">Cliente</th>
                    <th className="p-1">Motorista</th>
                    <th className="p-1">Valor</th>
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">{r.data_solicitacao ?? '—'}</td>
                        <td className="p-1">{r.justificativa}</td>
                        <td className="p-1">{r.nome_cliente}</td>
                        <td className="p-1">{r.motorista_nome}</td>
                        <td className="p-1">R$ {r.valor.toFixed(2)}</td>
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
          {rows.length === 0 && totalOriginal > 0 && (
            <p className="text-sm text-amber-600">
              Nenhum registro com justificativa "Produto Avariado" ou "Quebra" encontrado.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
