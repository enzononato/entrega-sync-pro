import { useMemo } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface MapaRow {
  id: string;
  mapa: string;
  fase: string;
  veiculo: string;
  placa: string;
  frota_cadastro: string;
  tipo_mapa: string;
  data_operacao: string;
  hora_operacao: string;
  usuario: string;
  motorista_matricula: string;
  user_id: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mapa: string;
  rows: MapaRow[];
  matriculaNomeMap: Map<string, string>;
}

export function MapaDetailDialog({ open, onOpenChange, mapa, rows, matriculaNomeMap }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono">Mapa {mapa}</DialogTitle>
          <DialogDescription>
            {rows.length} registro(s) no histórico deste mapa
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fase</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Frota</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data Op.</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Motorista</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">{row.fase}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">{row.veiculo}</TableCell>
                  <TableCell className="font-mono text-xs">{row.placa}</TableCell>
                  <TableCell className="text-xs">{row.frota_cadastro}</TableCell>
                  <TableCell className="text-xs">{row.tipo_mapa}</TableCell>
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
      </DialogContent>
    </Dialog>
  );
}
