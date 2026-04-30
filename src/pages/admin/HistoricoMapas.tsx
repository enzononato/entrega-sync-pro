import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { useMapas } from '@/hooks/useMapas';
import { useMetas } from '@/hooks/useMetas';
import { ImportMapasDialog } from '@/components/admin/ImportMapasDialog';
import { Input } from '@/components/ui/input';
import { Search, Clock, Truck, Timer, Route, PackageX, Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePick } from '@/components/shared/DateRangePick';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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

type MetasMap = Record<string, number>;

function calculateMapIndicators(row: any, metas: MetasMap): IndicatorCalc[] {
  const hrSai = parseTime(row.hr_sai);
  const hrEntr = parseTime(row.hr_entr);
  const tiVal = parseTime(row.tmpo_interno);

  const REF_TIME = 7 * 60 + 50;
  const LIMIT_TIME = 8 * 60 + 20;

  const metaTML = metas['TML'] ?? 30;
  const metaTR = metas['TR'] ?? 560;
  const metaTI = metas['TI'] ?? 30;
  const metaJL = metas['JL'] ?? 620;
  const metaTXDEV = metas['TX_DEVOLUCAO'] ?? 5;

  const results: IndicatorCalc[] = [];

  // TML
  const tmlVal = hrSai !== null ? Math.max(0, hrSai - REF_TIME) : null;
  const tmlOk = hrSai !== null && hrSai <= LIMIT_TIME;
  results.push({
    code: 'TML',
    label: 'Tempo Manhã Logística',
    valor: tmlVal,
    valorFormatted: tmlVal !== null ? formatMinutes(tmlVal) : '—',
    meta: metaTML,
    metaFormatted: formatMinutes(metaTML),
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
    meta: metaTR,
    metaFormatted: formatMinutes(metaTR),
    status: trVal !== null && trVal <= metaTR ? 'dentro_meta' : 'abaixo_meta',
    icon: <Route className="h-5 w-5" />,
  });

  // TI
  results.push({
    code: 'TI',
    label: 'Tempo Interno',
    valor: tiVal,
    valorFormatted: tiVal !== null ? formatMinutes(tiVal) : '—',
    meta: metaTI,
    metaFormatted: formatMinutes(metaTI),
    status: tiVal !== null && tiVal <= metaTI ? 'dentro_meta' : 'abaixo_meta',
    icon: <Timer className="h-5 w-5" />,
  });

  // JL
  const jlVal = tmlVal !== null && trVal !== null && tiVal !== null ? tmlVal + trVal + tiVal : null;
  results.push({
    code: 'JL',
    label: 'Jornada Líquida',
    valor: jlVal,
    valorFormatted: jlVal !== null ? formatMinutes(jlVal) : '—',
    meta: metaJL,
    metaFormatted: formatMinutes(metaJL),
    status: jlVal !== null && jlVal <= metaJL ? 'dentro_meta' : 'abaixo_meta',
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
    meta: metaTXDEV,
    metaFormatted: `${metaTXDEV}%`,
    status: txDevVal !== null && txDevVal <= metaTXDEV ? 'dentro_meta' : 'abaixo_meta',
    icon: <PackageX className="h-5 w-5" />,
  });

  // DISP_TEMPO: percentual de dispersão = ((tempoReal - tempoPrev) / tempoPrev) * 100
  // Meta: não pode ultrapassar 15% do tempo previsto
  const metaDISP = metas['DISP_TEMPO'] ?? 15;
  const tempoPrevRaw = row.tempo_prev;
  let tempoPrevVal: number | null = null;
  if (tempoPrevRaw) {
    const cleanTP = tempoPrevRaw.replace(/[^\d:]/g, '');
    const partsTP = cleanTP.split(':');
    if (partsTP.length === 2) {
      const hTP = parseInt(partsTP[0], 10);
      const mTP = parseInt(partsTP[1], 10);
      if (!isNaN(hTP) && !isNaN(mTP)) {
        tempoPrevVal = hTP * 60 + mTP;
      }
    }
  }
  let dispVal: number | null = null;
  if (tempoPrevVal !== null && tempoPrevVal > 0 && hrEntr !== null && hrSai !== null) {
    const tempoReal = Math.max(0, hrEntr - hrSai);
    const pct = ((tempoReal - tempoPrevVal) / tempoPrevVal) * 100;
    dispVal = Math.round(Math.max(0, pct) * 100) / 100;
  }
  results.push({
    code: 'DISP_TEMPO',
    label: 'Dispersão de Tempo',
    valor: dispVal,
    valorFormatted: dispVal !== null ? `${dispVal}%` : '—',
    meta: metaDISP,
    metaFormatted: `${metaDISP}%`,
    status: dispVal !== null && dispVal <= metaDISP ? 'dentro_meta' : 'abaixo_meta',
    icon: <Gauge className="h-5 w-5" />,
  });

  return results;
}

export default function HistoricoMapas() {
  const { mapas, loading, refetch } = useMapas();
  const { data: goals = [] } = useMetas({ ativo: 'true' });
  const [search, setSearch] = useState('');
  const [searchMot, setSearchMot] = useState('');
  const [searchAju, setSearchAju] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [regiao, setRegiao] = useState('all');
  const [frota, setFrota] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const metasMap = useMemo<MetasMap>(() => {
    const map: MetasMap = {};
    for (const g of goals) {
      const code = g.indicators?.codigo?.toUpperCase();
      if (code && !map[code]) map[code] = g.valor_meta;
    }
    return map;
  }, [goals]);

  const regioes = useMemo(() => {
    const set = new Set<string>();
    mapas.forEach(m => { if (m.regiao) set.add(m.regiao); });
    return Array.from(set).sort();
  }, [mapas]);

  const frotas = useMemo(() => {
    const set = new Set<string>();
    mapas.forEach(m => { if (m.frota) set.add(m.frota); });
    return Array.from(set).sort();
  }, [mapas]);

  const filtered = useMemo(() => {
    return mapas.filter(m => {
      if (search) {
        const s = search.toLowerCase();
        const match =
          m.mapa?.toLowerCase().includes(s) ||
          m.placa?.toLowerCase().includes(s) ||
          m.cd_mot?.toLowerCase().includes(s) ||
          m.cd_aju1?.toLowerCase().includes(s) ||
          m.veiculo?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (searchMot) {
        const s = searchMot.toLowerCase();
        if (!m.cd_mot?.toLowerCase().includes(s)) return false;
      }
      if (searchAju) {
        const s = searchAju.toLowerCase();
        const match = m.cd_aju1?.toLowerCase().includes(s) || m.cd_aju2?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (dateFrom && m.data_operacao < dateFrom) return false;
      if (dateTo && m.data_operacao > dateTo) return false;
      if (regiao !== 'all' && m.regiao !== regiao) return false;
      if (frota !== 'all' && m.frota !== frota) return false;
      if (statusFilter !== 'all') {
        const inds = calculateMapIndicators(m, metasMap);
        const allOk = inds.every(i => i.valor === null || i.status === 'dentro_meta');
        if (statusFilter === 'ok' && !allOk) return false;
        if (statusFilter === 'falhou' && allOk) return false;
      }
      return true;
    });
  }, [mapas, search, searchMot, searchAju, dateFrom, dateTo, regiao, frota, statusFilter, metasMap]);

  const hasFilters = !!(search || searchMot || searchAju || dateFrom || dateTo || regiao !== 'all' || frota !== 'all' || statusFilter !== 'all');
  const clearFilters = () => {
    setSearch(''); setSearchMot(''); setSearchAju(''); setDateFrom(''); setDateTo(''); setRegiao('all'); setFrota('all'); setStatusFilter('all');
  };

  const selectedMapa = selectedIndex !== null ? filtered[selectedIndex] : null;
  const indicators = useMemo(() => selectedMapa ? calculateMapIndicators(selectedMapa, metasMap) : [], [selectedMapa, metasMap]);

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
        <ImportMapasDialog onSuccess={refetch} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mapa, placa, matrícula..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="relative w-44">
          <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cód. motorista"
            value={searchMot}
            onChange={e => setSearchMot(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="relative w-44">
          <PackageX className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cód. ajudante"
            value={searchAju}
            onChange={e => setSearchAju(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <DateRangePick from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} />
        <Select value={regiao} onValueChange={setRegiao}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Região" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas regiões</SelectItem>
            {regioes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={frota} onValueChange={setFrota}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Frota" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas frotas</SelectItem>
            {frotas.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ok">Todas metas atingidas</SelectItem>
            <SelectItem value="falhou">Com falhas</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <Dialog open={selectedMapa !== null} onOpenChange={(open) => { if (!open) setSelectedIndex(null); }}>
        <DialogContent className="max-w-2xl">
          {selectedMapa && (
            <>
              <DialogHeader>
                <DialogTitle>Indicadores — Mapa {selectedMapa.mapa}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(selectedMapa.data_operacao)} • Placa: {selectedMapa.placa || '—'} • Motorista: {selectedMapa.cd_mot || '—'}
                  {selectedMapa.hr_sai && ` • Saída: ${selectedMapa.hr_sai}`}
                  {selectedMapa.hr_entr && ` • Entrega: ${selectedMapa.hr_entr}`}
                </p>
              </DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
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
            </>
          )}
        </DialogContent>
      </Dialog>

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
