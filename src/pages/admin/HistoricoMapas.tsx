import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Upload } from 'lucide-react';

export default function HistoricoMapas() {
  return (
    <div className="space-y-6">
      <PageHeader title="Histórico de Mapas" />
      <EmptyState
        icon={<Upload className="h-12 w-12" />}
        titulo="Nova versão em breve"
        descricao="Esta página será reconfigurada com o novo formato de planilha."
      />
    </div>
  );
}
