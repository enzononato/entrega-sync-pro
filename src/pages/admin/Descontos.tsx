import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useDescontosAdmin, useCreateDesconto, useDeleteDesconto, type DeductionWithRelations } from '@/hooks/useDescontos';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useAuth } from '@/contexts/AuthContext';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { exportToCsv } from '@/lib/exportCsv';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Loader2, CalendarIcon, DollarSign, TrendingDown, Trash2,
  AlertTriangle, Target, Download, Users, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function DatePick({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-9', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(new Date(value + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

const emptyForm = {
  user_id: '',
  indicator_id: '',
  data_referencia: format(new Date(), 'yyyy-MM-dd'),
  valor_meta: 0,
  valor_realizado: 0,
  percentual_atingimento: 0,
  valor_desconto: 0,
  motivo: '',
};

export default function Descontos() {
  const { user } = useAuth();
  const [filterDate, setFilterDate] = useState('');
  const { data: descontos = [], isLoading } = useDescontosAdmin(filterDate || undefined);
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const { data: indicators = [] } = useIndicadores({ ativo: 'true' });
  const colaboradores = usuarios.filter(u => u.role === 'colaborador');

  const createMut = useCreateDesconto();
  const deleteMut = useDeleteDesconto();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const pg = usePagination(descontos);

  // KPIs
  const totalDescontos = descontos.reduce((s, d) => s + d.valor_desconto, 0);
  const colaboradoresAfetados = new Set(descontos.map(d => d.user_id)).size;
  const indicadoresAfetados = new Set(descontos.map(d => d.indicator_id)).size;

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const pct = form.valor_meta > 0 ? (form.valor_realizado / form.valor_meta) * 100 : 0;
    await createMut.mutateAsync({
      ...form,
      percentual_atingimento: Math.round(pct * 100) / 100,
      created_by: user?.id,
    });
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteMut.mutateAsync(confirmDelete);
      setConfirmDelete(null);
    }
  };

  const kpis = [
    { label: 'Total Descontos', value: fmtBRL(totalDescontos), icon: TrendingDown, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500' },
    { label: 'Registros', value: descontos.length, icon: AlertTriangle, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', borderColor: 'border-l-amber-500' },
    { label: 'Colaboradores', value: colaboradoresAfetados, icon: Users, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Indicadores', value: indicadoresAfetados, icon: Target, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', borderColor: 'border-l-violet-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PageHeader title="Descontos por Meta" subtitle="Registre descontos quando metas não são atingidas" actionLabel="Novo Desconto" onAction={openCreate} />
        <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => {
          const rows = descontos.map(d => [
            d.users?.nome ?? '', d.indicators?.nome ?? '', d.data_referencia,
            d.valor_meta, d.valor_realizado, d.percentual_atingimento,
            d.valor_desconto, d.motivo,
          ]);
          exportToCsv('descontos.csv', ['Colaborador', 'Indicador', 'Data', 'Meta', 'Realizado', '% Ating.', 'Desconto', 'Motivo'], rows);
        }}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={cn('rounded-xl border bg-card p-4 shadow-sm border-l-[3px] transition-all hover:shadow-md', k.borderColor)}>
              <div className="flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', k.iconBg)}>
                  <Icon className={cn('h-5 w-5', k.iconColor)} />
                </div>
                <div>
                  <p className="font-bold text-foreground text-lg leading-none">{k.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{k.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <DatePick value={filterDate} onChange={setFilterDate} placeholder="Filtrar por data" />
        {filterDate && (
          <Button variant="ghost" size="sm" onClick={() => setFilterDate('')}>Limpar</Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : descontos.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <TrendingDown className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum desconto registrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Lance descontos quando as metas não forem atingidas</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border/50">
            {pg.paginatedItems.map((d: DeductionWithRelations) => {
              const pctOk = d.percentual_atingimento >= 100;
              return (
                <div key={d.id} className="flex items-start gap-4 px-5 py-4 transition-colors group hover:bg-muted/20">
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{d.users?.nome ?? '—'}</span>
                      <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                        {d.indicators?.nome ?? '—'}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                        {format(new Date(d.data_referencia + 'T00:00:00'), 'dd/MM/yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>Meta: <strong className="text-foreground">{d.valor_meta}</strong></span>
                      <span>Resultado: <strong className="text-foreground">{d.valor_realizado}</strong></span>
                      <span>Ating.: <strong className={pctOk ? 'text-emerald-600' : 'text-red-600'}>{d.percentual_atingimento.toFixed(0)}%</strong></span>
                    </div>
                    {d.motivo && (
                      <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{d.motivo}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base font-bold text-destructive">-{fmtBRL(d.valor_desconto)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setConfirmDelete(d.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Desconto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Colaborador *</Label>
              <Select value={form.user_id} onValueChange={v => setForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.worker_type ? `(${u.worker_type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Indicador *</Label>
              <Select value={form.indicator_id} onValueChange={v => setForm(f => ({ ...f, indicator_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data de Referência *</Label>
              <DatePick value={form.data_referencia} onChange={v => setForm(f => ({ ...f, data_referencia: v }))} placeholder="Selecione" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Meta</Label>
                <Input type="number" min={0} step={0.01} value={form.valor_meta} onChange={e => setForm(f => ({ ...f, valor_meta: Number(e.target.value) }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Realizado</Label>
                <Input type="number" min={0} step={0.01} value={form.valor_realizado} onChange={e => setForm(f => ({ ...f, valor_realizado: Number(e.target.value) }))} className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Valor do Desconto (R$) *</Label>
              <Input type="number" min={0} step={0.01} value={form.valor_desconto} onChange={e => setForm(f => ({ ...f, valor_desconto: Number(e.target.value) }))} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Motivo do Desconto *</Label>
              <Textarea
                value={form.motivo}
                onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                rows={3}
                className="resize-none"
                placeholder="Explique o motivo do desconto para transparência com o colaborador..."
              />
            </div>

            {/* Preview */}
            {form.valor_meta > 0 && form.valor_realizado > 0 && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <p className="text-xs font-bold text-foreground">Prévia</p>
                <p className="text-[11px] text-muted-foreground">
                  Atingimento: <strong className={cn((form.valor_realizado / form.valor_meta) * 100 >= 100 ? 'text-emerald-600' : 'text-red-600')}>
                    {((form.valor_realizado / form.valor_meta) * 100).toFixed(1)}%
                  </strong>
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-border/50">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || !form.user_id || !form.indicator_id || !form.motivo}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remover desconto"
        description="Deseja remover este desconto? O colaborador não verá mais este registro."
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
