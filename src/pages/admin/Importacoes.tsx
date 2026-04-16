import { useState } from 'react';
import { Upload, RefreshCw, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import Import031805 from '@/components/admin/Import031805';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Importacoes() {
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const { error } = await supabase.functions.invoke('calculate-daily-indicators', {
        body: {},
      });
      if (error) throw error;
      toast.success('Indicadores recalculados com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao recalcular: ' + (err.message || String(err)));
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Importações" subtitle="Importe dados de tabelas para o sistema" />
        <Button variant="outline" onClick={handleRecalculate} disabled={recalculating}>
          {recalculating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {recalculating ? 'Recalculando...' : 'Recalcular Indicadores'}
        </Button>
      </div>

      <Tabs defaultValue="03.18.05" className="w-full">
        <TabsList>
          <TabsTrigger value="03.18.05">03.18.05</TabsTrigger>
          <TabsTrigger value="03.11.34.05">03.11.34.05</TabsTrigger>
        </TabsList>

        <TabsContent value="03.18.05">
          <Import031805 />
        </TabsContent>

        <TabsContent value="03.11.34.05">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Importação 03.11.34.05</CardTitle>
              <CardDescription>Importe os dados da tabela 03.11.34.05</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState titulo="Nenhuma importação realizada" descricao="Em breve você poderá importar dados aqui." icon={<Upload className="h-10 w-10" />} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}