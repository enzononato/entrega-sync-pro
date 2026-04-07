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
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Search, CalendarIcon, X, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      return (data ?? []) as Array<{
        id: string; mapa: string; fase: string; veiculo: string; placa: string;
        frota_cadastro: string; tipo_mapa: string; data_operacao: string;
        hora_operacao: string; usuario: string; motorista_matricula: string;
        user_id: string | null; created_at: string;
      }>;
    },
  });
}

export default function HistoricoMapas() {
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const colabs = usuarios.filter(u => u.role === 'colaborador');
  const [importOpen, setImportOpen] = useState(false);

  const [filterMapa, setFilterMapa] = useState('');
  const [filterMotorista, setFilterMotorista] = useState('');
  const [filterDate, setFilterDate] = useState<Date | undefined>();

  const { data: historico = [], isLoading } = useHistoricoMapas();

  // Build matricula->nome map
  const matriculaNomeMap = useMemo(() => {
    const m = new Map<string, string>();
    colabs.forEach(u => { if (u.matricula) m.set(u.matricula.trim(), u.nome); });
    return m;
  }, [colabs]);

  const filtered = useMemo(() => {
    let rows = historico;
    if (filterMapa.trim()) {
      const q = filterMapa.trim().toUpperCase();
      rows = rows.filter(r => r.mapa.toUpperCase().includes(q));
    }
    if (filterMotorista.trim()) {
      const q = filterMotorista.trim().toUpperCase();
      rows = rows.filter(r => {
        const nome = matriculaNomeMap.get(r.motorista_matricula) ?? '';
        return r.motorista_matricula.toUpperCase().includes(q) || nome.toUpperCase().includes(q);
      });
    }
    if (filterDate) {
      const ds = format(filterDate, 'yyyy-MM-dd');
      rows = rows.filter(r => r.data_operacao === ds);
    }
    return rows;
  }, [historico, filterMapa, filterMotorista, filterDate, matriculaNomeMap]);

  const pg = usePagination(filtered);
  const hasFilters = !!(filterMapa || filterMotorista || filterDate);

  const clearFilters = () => {
    setFilterMapa('');
    setFilterMotorista('');
    setFilterDate(undefined);
  };

  // KPIs
  const totalRegistros = filtered.length;
  const mapasUnicos = useMemo(() => new Set(filtered.map(r => r.mapa)).size, [filtered]);
  const motoristasUnicos = useMemo(() => new Set(filtered.filter(r => r.motorista_matricula).map(r => r.motorista_matricula)).size, [filtered]);

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
          <p className="text-xs text-muted-foreground">Registros</p>
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
            <Input
              placeholder="Nº do mapa..."
              value={filterMapa}
              onChange={e => setFilterMapa(e.target.value)}
              className="pl-9 w-40 h-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Motorista</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Matrícula ou nome..."
              value={filterMotorista}
              onChange={e => setFilterMotorista(e.target.value)}
              className="pl-9 w-52 h-9"
            />
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
          titulo={hasFilters ? 'Nenhum registro encontrado' : 'Nenhum dado importado'}
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
                  <TableHead>Fase</TableHead>
                  <TableHead className="w-20">Veículo</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Data Op.</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Motorista</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.paginatedItems.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-medium">{row.mapa}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">{row.fase}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{row.veiculo}</TableCell>
                    <TableCell className="font-mono text-xs">{row.placa}</TableCell>
                    <TableCell className="text-sm">
                      {row.data_operacao ? format(new Date(row.data_operacao + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-sm">{row.hora_operacao || '-'}</TableCell>
                    <TableCell className="text-sm">{row.usuario || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {(matriculaNomeMap.get(row.motorista_matricula) ?? row.motorista_matricula) || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-3 border-t">
            <ListPagination
              page={pg.page}
              totalPages={pg.totalPages}
              from={pg.from}
              to={pg.to}
              totalCount={pg.totalCount}
              onPageChange={pg.setPage}
            />
          </div>
        </div>
      )}

      <ImportacaoMetasDiariasDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        usuarios={colabs}
      />
    </div>
  );
}
