import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Save, Package, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable, Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useCaixasBatidasRule, useUpdateCaixasBatidasRule, useRecalcCaixasBatidas,
  useCaixasBatidasAdminMes,
} from '@/hooks/useCaixasBatidas';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function IncentivosAdmin() {
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const { data: rule, isLoading: loadingRule } = useCaixasBatidasRule();
  const update = useUpdateCaixasBatidasRule();
  const recalc = useRecalcCaixasBatidas();
  const { data: rows = [], isLoading: loadingRows } = useCaixasBatidasAdminMes(mes);

  const [form, setForm] = useState<{ fator_0: string; fator_1: string; fator_2: string; teto_motorista: string; teto_ajudante: string }>({
    fator_0: '', fator_1: '', fator_2: '', teto_motorista: '', teto_ajudante: '',
  });

  useEffect(() => {
    if (rule) {
      setForm({
        fator_0: String(rule.fator_0),
        fator_1: String(rule.fator_1),
        fator_2: String(rule.fator_2),
        teto_motorista: String(rule.teto_motorista),
        teto_ajudante: String(rule.teto_ajudante),
      });
    }
  }, [rule]);

  const handleSave = async () => {
    if (!rule) return;
    try {
      await update.mutateAsync({
        id: rule.id,
        fator_0: parseFloat(form.fator_0) || 0,
        fator_1: parseFloat(form.fator_1) || 0,
        fator_2: parseFloat(form.fator_2) || 0,
        teto_motorista: parseFloat(form.teto_motorista) || 0,
        teto_ajudante: parseFloat(form.teto_ajudante) || 0,
      });
      toast.success('Configuração salva');
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    }
  };

  const handleRecalc = async () => {
    try {
      const result: any = await recalc.mutateAsync(mes);
      toast.success(`Recalculado: ${result?.processados ?? 0} colaboradores em ${result?.qtd_mapas ?? 0} mapas`);
    } catch (e: any) {
      toast.error('Erro ao recalcular: ' + e.message);
    }
  };

  const columns: Column<typeof rows[number]>[] = [
    { key: 'nome', label: 'Colaborador' },
    { key: 'matricula', label: 'Matrícula' },
    {
      key: 'worker_type',
      label: 'Tipo',
      render: (r) => <Badge variant="outline" className="capitalize">{r.worker_type}</Badge>,
    },
    { key: 'qtd_mapas', label: 'Mapas', render: (r) => r.detalhes.qtd_mapas },
    { key: 'caixas', label: 'Caixas', render: (r) => r.detalhes.total_caixas.toLocaleString('pt-BR') },
    {
      key: 'cx_f0',
      label: 'Cx Fator 0',
      render: (r) => (r.detalhes.mapas ?? [])
        .filter((m) => m.fator === 0)
        .reduce((s, m) => s + (m.caixas || 0), 0)
        .toLocaleString('pt-BR'),
    },
    {
      key: 'cx_f1',
      label: 'Cx Fator 1',
      render: (r) => (r.detalhes.mapas ?? [])
        .filter((m) => m.fator === 1)
        .reduce((s, m) => s + (m.caixas || 0), 0)
        .toLocaleString('pt-BR'),
    },
    {
      key: 'cx_f2',
      label: 'Cx Fator 2',
      render: (r) => (r.detalhes.mapas ?? [])
        .filter((m) => m.fator === 2)
        .reduce((s, m) => s + (m.caixas || 0), 0)
        .toLocaleString('pt-BR'),
    },
    { key: 'bruto', label: 'Bruto', render: (r) => fmtBRL(r.detalhes.valor_bruto) },
    {
      key: 'cortado',
      label: 'Cortado',
      render: (r) => r.detalhes.valor_cortado > 0
        ? <span className="text-warning font-semibold">-{fmtBRL(r.detalhes.valor_cortado)}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'final',
      label: 'Valor Final',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-primary">{fmtBRL(r.valor_final)}</span>
          {r.detalhes.teto_atingido && (
            <Badge variant="outline" className="text-warning border-warning/50 text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-1" /> Teto
            </Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Incentivos" subtitle="Configure regras e recalcule incentivos especiais" />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Caixas Batidas
              </CardTitle>
              <CardDescription>
                Bonificação mensal acumulada por caixa entregue, com fator baseado no número de ajudantes do mapa.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingRule ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !rule ? (
            <p className="text-sm text-muted-foreground">Regra não configurada.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="f0">Fator 0 — Sem ajudante (R$/cx)</Label>
                  <Input id="f0" type="number" step="0.01" value={form.fator_0}
                    onChange={e => setForm(s => ({ ...s, fator_0: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="f1">Fator 1 — 1 ajudante (R$/cx)</Label>
                  <Input id="f1" type="number" step="0.01" value={form.fator_1}
                    onChange={e => setForm(s => ({ ...s, fator_1: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="f2">Fator 2 — 2 ajudantes (R$/cx)</Label>
                  <Input id="f2" type="number" step="0.01" value={form.fator_2}
                    onChange={e => setForm(s => ({ ...s, fator_2: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="tm">Teto mensal — Motorista (R$)</Label>
                  <Input id="tm" type="number" step="0.01" value={form.teto_motorista}
                    onChange={e => setForm(s => ({ ...s, teto_motorista: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="ta">Teto mensal — Ajudante (R$)</Label>
                  <Input id="ta" type="number" step="0.01" value={form.teto_ajudante}
                    onChange={e => setForm(s => ({ ...s, teto_ajudante: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={update.isPending}>
                  {update.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar configuração
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Resultado do mês</CardTitle>
              <CardDescription>{format(new Date(mes + '-01T00:00:00'), "MMMM 'de' yyyy", { locale: ptBR })}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-44" />
              <Button onClick={handleRecalc} disabled={recalc.isPending} variant="secondary">
                {recalc.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Recalcular
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            loading={loadingRows}
            emptyMessage="Nenhum cálculo encontrado para este mês. Clique em Recalcular."
          />
        </CardContent>
      </Card>
    </div>
  );
}
