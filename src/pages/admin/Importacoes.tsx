import { useState } from 'react';
import { Upload, Calculator, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import Import031805 from '@/components/admin/Import031805';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Importacoes() {
  const [calculating, setCalculating] = useState(false);

  const handleRecalculate = async () => {
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-reposicao', { body: {} });
      if (error) throw error;
      toast.success(`Reposição recalculada! ${data?.total_inserted ?? 0} registros gerados.`);
    } catch (err: any) {
      toast.error('Erro ao recalcular: ' + (err.message || String(err)));
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Importações" subtitle="Importe dados de tabelas para o sistema" />

      <Tabs defaultValue="03.18.05" className="w-full">
        <TabsList>
          <TabsTrigger value="03.18.05">03.18.05</TabsTrigger>
          <TabsTrigger value="03.11.34.05">03.11.34.05</TabsTrigger>
        </TabsList>

        <TabsContent value="03.18.05">
          <div className="space-y-4">
            <Import031805 />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recalcular Indicador de Reposição</CardTitle>
                <CardDescription className="text-xs">
                  Recalcula o valor mensal de reposição (R$) por motorista com base nos dados importados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={handleRecalculate} disabled={calculating}>
                  {calculating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</>
                  ) : (
                    <><Calculator className="h-4 w-4 mr-2" /> Recalcular Reposição</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
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
