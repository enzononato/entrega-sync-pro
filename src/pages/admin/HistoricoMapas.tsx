import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useUsuarios } from '@/hooks/useUsuarios';
import { ImportacaoMetasDiariasDialog } from '@/components/admin/ImportacaoMetasDiariasDialog';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export default function HistoricoMapas() {
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const colabs = usuarios.filter(u => u.role === 'colaborador');
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader titulo="Histórico de Mapas" descricao="Importação e visualização do histórico de mapas de entrega." />
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" /> Importar CSV
        </Button>
      </div>

      <ImportacaoMetasDiariasDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        usuarios={colabs}
      />
    </div>
  );
}
