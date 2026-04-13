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
      <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="Nenhum mapa importado" />
    </div>
  );
}
