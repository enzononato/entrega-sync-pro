import { Upload } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';

export default function Importacoes() {
  return (
    <div className="space-y-6">
      <PageHeader title="Importações" subtitle="Importe dados de tabelas para o sistema" />

      <Tabs defaultValue="03.18.05" className="w-full">
        <TabsList>
          <TabsTrigger value="03.18.05">03.18.05</TabsTrigger>
          <TabsTrigger value="03.11.34.05">03.11.34.05</TabsTrigger>
        </TabsList>

        <TabsContent value="03.18.05">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Importação 03.18.05</CardTitle>
              <CardDescription>Importe os dados da tabela 03.18.05</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState icon={Upload} title="Nenhuma importação realizada" description="Em breve você poderá importar dados aqui." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="03.11.34.05">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Importação 03.11.34.05</CardTitle>
              <CardDescription>Importe os dados da tabela 03.11.34.05</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState icon={Upload} title="Nenhuma importação realizada" description="Em breve você poderá importar dados aqui." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
