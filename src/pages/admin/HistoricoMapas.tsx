import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { useMapas } from '@/hooks/useMapas';
import { ImportMapasDialog } from '@/components/admin/ImportMapasDialog';
import { Input } from '@/components/ui/input';
import { Search, X, Clock, Truck, Timer, Route, PackageX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function parseTime(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const clean = hhmm.replace(/[^\d:]/g, '');
  const parts = clean.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface IndicatorCalc {
  code: string;
  label: string;
  valor: number | null;
  valorFormatted: string;
  meta: number;
  metaFormatted: string;
  status: 'dentro_meta' | 'abaixo_meta';
  icon: React.ReactNode;
}

function calculateMapIndicators(row: any): IndicatorCalc[] {
  const hrSai = parseTime(row.hr_sai);
  const hrEntr = parseTime(row.hr_entr);
  const tiVal = parseTime(row.tmpo_interno);

  const REF_TIME = 7 * 60 + 50;
  const LIMIT_TIME = 8 * 60 + 20;

  const results: IndicatorCalc[] = [];

  // TML
  const tmlVal = hrSai !== null ? Math.max(0, hrSai - REF_TIME) : null;
  const tmlOk = hrSai !== null && hrSai <= LIMIT_TIME;
  results.push({
    code: 'TML',
    label: 'Tempo Manhã Logística',
    valor: tmlVal,
    valorFormatted: tmlVal !== null ? formatMinutes(tmlVal) : '—',
    meta: 30,
    metaFormatted: '00:30',
    status: tmlOk ? 'dentro_meta' : 'abaixo_meta',
    icon: <Clock className="h-5 w-5" />,
  });

  // TR
  const trVal = hrEntr !== null && hrSai !== null ? Math.max(0, hrEntr - hrSai) : null;
  results.push({
    code: 'TR',
    label: 'Tempo em Rota',
    valor: trVal,
    valorFormatted: trVal !== null ? formatMinutes(trVal) : '—',
    meta: 560,
    metaFormatted: '09:20',
    status: trVal !== null && trVal <= 560 ? 'dentro_meta' : 'abaixo_meta',
    icon: <Route className="h-5 w-5" />,
  });

  // TI
  results.push({
    code: 'TI',
    label: 'Tempo Interno',
    valor: tiVal,
    valorFormatted: tiVal !== null ? formatMinutes(tiVal) : '—',
    meta: 30,
    metaFormatted: '00:30',
    status: tiVal !== null && tiVal <= 30 ? 'dentro_meta' : 'abaixo_meta',
    icon: <Timer className="h-5 w-5" />,
  });

  // JL
  const jlVal = tmlVal !== null && trVal !== null && tiVal !== null ? tmlVal + trVal + tiVal : null;
  results.push({
    code: 'JL',
    label: 'Jornada Líquida',
    valor: jlVal,
    valorFormatted: jlVal !== null ? formatMinutes(jlVal) : '—',
    meta: 620,
    metaFormatted: '10:20',
    status: jlVal !== null && jlVal <= 620 ? 'dentro_meta' : 'abaixo_meta',
    icon: <Truck className="h-5 w-5" />,
  });

  // TX_DEVOLUCAO
  const cxCarreg = Number(row.cx_carreg);
  const cxEntreg = Number(row.cx_entreg);
  let txDevVal: number | null = null;
  if (cxCarreg > 0 && !isNaN(cxCarreg) && !isNaN(cxEntreg)) {
    txDevVal = Math.round(((1 - cxEntreg / cxCarreg) * 100) * 100) / 100;
    if (txDevVal < 0) txDevVal = 0;
  }
  results.push({
    code: 'TX_DEV',
    label: 'Taxa de Devolução',
    valor: txDevVal,
    valorFormatted: txDevVal !== null ? `${txDevVal.toFixed(2)}%` : '—',
    meta: 5,
    metaFormatted: '5%',
    status: txDevVal !== null && txDevVal <= 5 ? 'dentro_meta' : 'abaixo_meta',
    icon: <PackageX className="h-5 w-5" />,
  });

  return results;
}

export default function HistoricoMapas() {
  const { mapas, loading, refetch } = useMapas();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const filtered = mapas.filter(m => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      m.mapa?.toLowerCase().includes(s) ||
      m.placa?.toLowerCase().includes(s) ||
      m.cd_mot?.toLowerCase().includes(s) ||
      m.cd_aju1?.toLowerCase().includes(s) ||
      m.veiculo?.toLowerCase().includes(s)
    );
  });

  const selectedMapa = selectedIndex !== null ? filtered[selectedIndex] : null;
  const indicators = useMemo(() => selectedMapa ? calculateMapIndicators(selectedMapa) : [], [selectedMapa]);

  const formatDate = (d: string | null) => {
    if (!d) return '';
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  };

  const columns: Column<typeof mapas[number]>[] = [
    { key: 'data_operacao', label: 'Data', render: (r) => formatDate(r.data_operacao) },
    { key: 'transp', label: 'Transp' },
    { key: 'entrega', label: 'Entrega' },
    { key: 'carga_atual', label: 'Carga Atual' },
    { key: 'frota', label: 'Frota' },
    { key: 'custo_spot', label: 'Custo Spot' },
    { key: 'regiao', label: 'Região' },
    { key: 'veiculo', label: 'Veículo' },
    { key: 'placa', label: 'Placa' },
    { key: 'mapa', label: 'Mapa' },
    { key: 'capacidade', label: 'Capac.' },
    { key: 'entregas', label: 'Entregas' },
    { key: 'cx_carreg', label: 'Cx Carreg' },
    { key: 'cx_entreg', label: 'Cx Entreg' },
    { key: 'ocupacao', label: 'Ocup.' },
    { key: 'cx_rota', label: 'Cx Rota' },
    { key: 'cx_as', label: 'Cx AS' },
    { key: 'veic_bm', label: 'Veic BM' },
    { key: 'rshow', label: 'RShow' },
    { key: 'entr_vol', label: 'Entr Vol' },
    { key: 'hr_sai', label: 'Hr Saída' },
    { key: 'hr_entr', label: 'Hr Entrega' },
    { key: 'km_sai', label: 'Km Saída' },
    { key: 'km_entr', label: 'Km Entrega' },
    { key: 'km_prev', label: 'Km Prev' },
    { key: 'tempo_prev', label: 'Tempo Prev' },
    { key: 'vl_pto_mot', label: 'Vl Pto Mot' },
    { key: 'vl_pto_ajd', label: 'Vl Pto Ajd' },
    { key: 'vl_eq_mot', label: 'Vl Eq Mot' },
    { key: 'vl_eq_ajd', label: 'Vl Eq Ajd' },
    { key: 'cd_mot', label: 'Cd Mot' },
    { key: 'cd_aju1', label: 'Cd Aju1' },
    { key: 'cd_aju2', label: 'Cd Aju2' },
    { key: 'km_desloc', label: 'Km Desloc' },
    { key: 'km_laco', label: 'Km Laço' },
    { key: 'tmpo_desloc', label: 'Tmpo Desloc' },
    { key: 'tmpo_laco', label: 'Tmpo Laço' },
    { key: 'tmpo_interno', label: 'Tmpo Interno' },
    { key: 'mot_nao_carr', label: 'Mot Não Carr' },
    { key: 'cx_carr_com', label: 'Cx Carr Com' },
    { key: 'capacidade_veiculo_kg', label: 'Cap. Veíc. KG' },
    { key: 'peso_carga_kg', label: 'Peso Carga KG' },
    { key: 'classificacao_roadshow', label: 'Class. Roadshow' },
    { key: 'classificacao_roads', label: 'Class. Roads' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mapas" subtitle={`${filtered.length} registros`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mapa, placa, matrícula..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <ImportMapasDialog onSuccess={refetch} />
        </div>
      </PageHeader>

      {/* Indicator detail panel */}
      {selectedMapa && (
        <Card className="border-primary/30 bg-accent/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Indicadores — Mapa {selectedMapa.mapa}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(selectedMapa.data_operacao)} • Placa: {selectedMapa.placa || '—'} • Motorista: {selectedMapa.cd_mot || '—'}
                  {selectedMapa.hr_sai && ` • Saída: ${selectedMapa.hr_sai}`}
                  {selectedMapa.hr_entr && ` • Entrega: ${selectedMapa.hr_entr}`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedIndex(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {indicators.map(ind => (
                <div key={ind.code} className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {ind.icon}
                    <span className="text-xs font-semibold uppercase">{ind.code}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{ind.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight">{ind.valorFormatted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Meta: {ind.metaFormatted}</span>
                    <Badge variant={ind.valor !== null ? (ind.status === 'dentro_meta' ? 'default' : 'destructive') : 'secondary'}>
                      {ind.valor === null ? 'S/ dados' : ind.status === 'dentro_meta' ? 'Atingiu' : 'Não Atingiu'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="Nenhum mapa importado"
        onRowClick={(_, i) => setSelectedIndex(selectedIndex === i ? null : i)}
        selectedIndex={selectedIndex ?? undefined}
      />
    </div>
  );
}
