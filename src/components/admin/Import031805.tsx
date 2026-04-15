import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DataTable } from '@/components/shared/DataTable';

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
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [fileName, setFileName] = useState('');
  const [totalOriginal, setTotalOriginal] = useState(0);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImported(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const header = lines[0].replace(/^\uFEFF/, '');
      const cols = header.split(';').map(c => c.trim());

      const jIdx = cols.indexOf('Justificativa');
      if (jIdx === -1) {
        toast({ title: 'Erro', description: 'Coluna "Justificativa" não encontrada no CSV.', variant: 'destructive' });
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
  }, []);

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const batchSize = 200;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await (supabase.from('reposicao_031805') as any).insert(batch);
        if (error) throw error;
      }
      setImported(true);
      toast({ title: 'Importação concluída', description: `${rows.length} registros importados com sucesso.` });
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    { header: 'Data', accessorKey: 'data_solicitacao' as const },
    { header: 'Justificativa', accessorKey: 'justificativa' as const },
    { header: 'Cliente', accessorKey: 'nome_cliente' as const },
    { header: 'Produto', accessorKey: 'descricao_produto' as const },
    { header: 'Qtd', accessorKey: 'quantidade' as const },
    { header: 'Valor', accessorKey: 'valor' as const },
    { header: 'Motorista', accessorKey: 'motorista_nome' as const },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Importação 03.18.05</CardTitle>
        <CardDescription>
          Importe os dados da tabela 03.18.05 — apenas registros com justificativa "Produto Avariado" ou "Quebra"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
            <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent text-sm font-medium transition-colors">
              <FileSpreadsheet className="h-4 w-4" />
              Selecionar CSV
            </div>
          </label>
          {fileName && (
            <span className="text-sm text-muted-foreground">{fileName}</span>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {totalOriginal} linhas no arquivo → <strong className="text-foreground">{rows.length}</strong> registros filtrados
              </span>
              {imported ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="h-4 w-4" /> Importado
                </span>
              ) : (
                <Button onClick={handleImport} disabled={importing} size="sm">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Importar {rows.length} registros
                </Button>
              )}
            </div>

            <DataTable columns={columns} data={rows} />
          </>
        )}

        {rows.length === 0 && fileName && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            Nenhum registro com justificativa "Produto Avariado" ou "Quebra" encontrado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
