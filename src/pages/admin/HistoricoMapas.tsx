import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { useMapas } from '@/hooks/useMapas';
import { ImportMapasDialog } from '@/components/admin/ImportMapasDialog';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function HistoricoMapas() {
  const { mapas, loading, refetch } = useMapas();
  const [search, setSearch] = useState('');

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

  const columns: Column<typeof mapas[number]>[] = [
    { key: 'data_operacao', label: 'Data', render: (r) => r.data_operacao },
    { key: 'mapa', label: 'Mapa' },
    { key: 'veiculo', label: 'Veículo' },
    { key: 'placa', label: 'Placa' },
    { key: 'cd_mot', label: 'Motorista' },
    { key: 'cd_aju1', label: 'Ajudante 1' },
    { key: 'cd_aju2', label: 'Ajudante 2' },
    { key: 'entregas', label: 'Entregas' },
    { key: 'cx_entreg', label: 'Cx Entreg' },
    { key: 'hr_sai', label: 'Hr Saída' },
    { key: 'hr_entr', label: 'Hr Entrega' },
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
      <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="Nenhum mapa importado" />
    </div>
  );
}
