import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListPagination } from '@/components/shared/ListPagination';
import { useUsuarios } from '@/hooks/useUsuarios';
import { usePagination } from '@/hooks/usePagination';
import { ImportacaoMetasDiariasDialog } from '@/components/admin/ImportacaoMetasDiariasDialog';
import { MapaDetailDialog } from '@/components/admin/MapaDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Search, CalendarIcon, X, Truck, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

type MapaRow = {
  id: string; mapa: string; fase: string; veiculo: string; placa: string;
  frota_cadastro: string; tipo_mapa: string; data_operacao: string;
  hora_operacao: string; usuario: string; motorista_matricula: string;
  user_id: string | null; created_at: string;
};

interface GroupedMapa {
  mapa: string;
  totalLinhas: number;
  dataOperacao: string;
  motoristas: string[];
  veiculos: string[];
  fases: string[];
  rows: MapaRow[];
}

function useHistoricoMapas() {
  return useQuery({
    queryKey: ['mapa_historico'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('mapa_historico')
        .select('*')
        .order('data_operacao', { ascending: false })
        .order('mapa', { ascending: true })
        .order('hora_operacao', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MapaRow[];
    },
  });
}

export default function HistoricoMapas() {
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const colabs = usuarios.filter(u => u.role === 'colaborador');
  const [importOpen, setImportOpen] = useState(false);
  const [selectedMapa, setSelectedMapa] = useState<GroupedMapa | null>(null);

  const [filterMapa, setFilterMapa] = useState('');
  const [filterMotorista, setFilterMotorista] = useState('');
  const [filterDate, setFilterDate] = useState<Date | undefined>();

  const { data: historico = [], isLoading } = useHistoricoMapas();

  const matriculaNomeMap = useMemo(() => {
    const m = new Map<string, string>();
    colabs.forEach(u => { if (u.matricula) m.set(u.matricula.trim(), u.nome); });
    return m;
  }, [colabs]);

  // Group rows by mapa
  const grouped = useMemo(() => {
    const map = new Map<string, MapaRow[]>();
    historico.forEach(r => {
      if (!map.has(r.mapa)) map.set(r.mapa, []);
      map.get(r.mapa)!.push(r);
    });
    const result: GroupedMapa[] = [];
    map.forEach((rows, mapa) => {
      const motoristasSet = new Set<string>();
      const veiculosSet = new Set<string>();
      const fasesSet = new Set<string>();
      rows.forEach(r => {
        if (r.motorista_matricula) {
          const nome = matriculaNomeMap.get(r.motorista_matricula) ?? r.motorista_matricula;
          motoristasSet.add(nome);
        }
        if (r.veiculo) veiculosSet.add(r.veiculo);
        if (r.fase) fasesSet.add(r.fase);
      });
      result.push({
        mapa,
        totalLinhas: rows.length,
        dataOperacao: rows[0]?.data_operacao ?? '',
        motoristas: Array.from(motoristasSet),
        veiculos: Array.from(veiculosSet),
        fases: Array.from(fasesSet),
        rows,
      });
    });
    // Sort by date desc, then mapa asc
    result.sort((a, b) => b.dataOperacao.localeCompare(a.dataOperacao) || a.mapa.localeCompare(b.mapa));
    return result;
  }, [historico, matriculaNomeMap]);

  const filtered = useMemo(() => {
    let items = grouped;
    if (filterMapa.trim()) {
      const q = filterMapa.trim().toUpperCase();
      items = items.filter(g => g.mapa.toUpperCase().includes(q));
    }
    if (filterMotorista.trim()) {
      const q = filterMotorista.trim().toUpperCase();
      items = items.filter(g => g.motoristas.some(m => m.toUpperCase().includes(q)));
    }
    if (filterDate) {
      const ds = format(filterDate, 'yyyy-MM-dd');
      items = items.filter(g => g.dataOperacao === ds);
    }
    return items;
  }, [grouped, filterMapa, filterMotorista, filterDate]);

  const pg = usePagination(filtered);
  const hasFilters = !!(filterMapa || filterMotorista || filterDate);

  const clearFilters = () => {
    setFilterMapa('');
    setFilterMotorista('');
    setFilterDate(undefined);
  };

  const totalRegistros = historico.length;
  const mapasUnicos = grouped.length;
  const motoristasUnicos = useMemo(() => {
    const s = new Set<string>();
    historico.forEach(r => { if (r.motorista_matricula) s.add(r.motorista_matricula); });
    return s.size;
  }, [historico]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Histórico de Mapas" subtitle="Importação e visualização do histórico de mapas de entrega." />
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" /> Importar CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalRegistros}</p>
          <p className="text-xs text-muted-foreground">Registros totais</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{mapasUnicos}</p>
          <p className="text-xs text-muted-foreground">Mapas únicos</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{motoristasUnicos}</p>
          <p className="text-xs text-muted-foreground">Motoristas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Mapa</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Nº do mapa..." value={filterMapa} onChange={e => setFilterMapa(e.target.value)} className="pl-9 w-40 h-9" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Motorista</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Nome do motorista..." value={filterMotorista} onChange={e => setFilterMotorista(e.target.value)} className="pl-9 w-52 h-9" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Data Operação</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-40 justify-start text-left font-normal h-9', !filterDate && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filterDate ? format(filterDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={filterDate} onSelect={setFilterDate} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-9">
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          titulo={hasFilters ? 'Nenhum mapa encontrado' : 'Nenhum dado importado'}
          descricao={hasFilters ? 'Tente ajustar os filtros.' : 'Importe um arquivo CSV para começar.'}
          icon={<Truck className="h-10 w-10" />}
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Mapa</TableHead>
                  <TableHead>Data Op.</TableHead>
                  <TableHead>Motorista(s)</TableHead>
                  <TableHead>Veículo(s)</TableHead>
                  <TableHead>Fases</TableHead>
                  <TableHead className="text-center w-20">Registros</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.paginatedItems.map(g => (
                  <TableRow key={g.mapa} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedMapa(g)}>
                    <TableCell className="font-mono font-medium">{g.mapa}</TableCell>
                    <TableCell className="text-sm">
                      {g.dataOperacao ? format(new Date(g.dataOperacao + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{g.motoristas.join(', ') || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{g.veiculos.join(', ') || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {g.fases.map(f => (
                          <Badge key={f} variant="outline" className="text-xs font-normal">{f}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{g.totalLinhas}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setSelectedMapa(g); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-3 border-t">
            <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
          </div>
        </div>
      )}

      {selectedMapa && (
        <MapaDetailDialog
          open={!!selectedMapa}
          onOpenChange={v => { if (!v) setSelectedMapa(null); }}
          mapa={selectedMapa.mapa}
          rows={selectedMapa.rows}
          matriculaNomeMap={matriculaNomeMap}
        />
      )}

      <ImportacaoMetasDiariasDialog open={importOpen} onOpenChange={setImportOpen} usuarios={colabs} />
    </div>
  );
}
