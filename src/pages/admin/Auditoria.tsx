import { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuditLogs, type AuditLog } from '@/hooks/useAuditLogs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, Plus, Pencil, Trash2, Eye, Shield, Database, Layers,
  Building2, MapPin, Users, Target, Flag, Award, TrendingUp,
  AlertTriangle, ClipboardCheck, MessageSquare, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TABLE_CONFIG: Record<string, { label: string; icon: typeof Database; color: string }> = {
  units: { label: 'Unidades', icon: Building2, color: 'text-blue-600 bg-blue-100' },
  
  users: { label: 'Usuários', icon: Users, color: 'text-violet-600 bg-violet-100' },
  indicators: { label: 'Indicadores', icon: Target, color: 'text-amber-600 bg-amber-100' },
  goals: { label: 'Metas', icon: Flag, color: 'text-green-600 bg-green-100' },
  incentive_rules: { label: 'Incentivos', icon: Award, color: 'text-pink-600 bg-pink-100' },
  user_indicator_daily: { label: 'Desempenho', icon: TrendingUp, color: 'text-cyan-600 bg-cyan-100' },
  user_incentives_daily: { label: 'Incentivos Diários', icon: Award, color: 'text-rose-600 bg-rose-100' },
  root_cause_records: { label: 'Causa Raiz', icon: AlertTriangle, color: 'text-orange-600 bg-orange-100' },
  action_plans: { label: 'Planos de Ação', icon: ClipboardCheck, color: 'text-indigo-600 bg-indigo-100' },
  feedbacks: { label: 'Feedbacks', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-100' },
};

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Plus; color: string }> = {
  INSERT: { label: 'Criação', icon: Plus, color: 'text-emerald-600 bg-emerald-100' },
  UPDATE: { label: 'Atualização', icon: Pencil, color: 'text-blue-600 bg-blue-100' },
  DELETE: { label: 'Exclusão', icon: Trash2, color: 'text-red-600 bg-red-100' },
};

function getRecordLabel(log: AuditLog): string {
  const data = log.new_data || log.old_data;
  if (!data) return log.record_id.slice(0, 8);
  return (data.nome as string) || (data.titulo as string) || (data.codigo as string) || (data.email as string) || log.record_id.slice(0, 8);
}

function getChangedFields(log: AuditLog): { field: string; from: unknown; to: unknown }[] {
  if (log.action !== 'UPDATE' || !log.old_data || !log.new_data) return [];
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  for (const key of Object.keys(log.new_data)) {
    if (['updated_at', 'created_at'].includes(key)) continue;
    const oldVal = log.old_data[key];
    const newVal = log.new_data[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, from: oldVal, to: newVal });
    }
  }
  return changes;
}

export default function Auditoria() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: logs = [], isLoading } = useAuditLogs({
    table_name: filters.table_name || undefined,
    action: filters.action || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  });

  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  const pg = usePagination(logs);

  // KPIs
  const totalLogs = logs.length;
  const totalInserts = logs.filter(l => l.action === 'INSERT').length;
  const totalUpdates = logs.filter(l => l.action === 'UPDATE').length;
  const totalDeletes = logs.filter(l => l.action === 'DELETE').length;

  const kpis = [
    { label: 'Total de Logs', value: totalLogs, icon: Layers, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Criações', value: totalInserts, icon: Plus, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Atualizações', value: totalUpdates, icon: Pencil, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', borderColor: 'border-l-amber-500' },
    { label: 'Exclusões', value: totalDeletes, icon: Trash2, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500' },
  ];

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    pg.paginatedItems.forEach(l => {
      const day = format(new Date(l.created_at), 'yyyy-MM-dd');
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(l);
    });
    return Array.from(map.entries());
  }, [pg.paginatedItems]);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Auditoria" subtitle="Logs de todas as alterações do sistema" />

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
                  <p className="text-2xl font-bold text-foreground leading-none">{k.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{k.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filters.table_name ?? ''} onValueChange={v => setFilters(f => ({ ...f, table_name: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Tabela" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(TABLE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.action ?? ''} onValueChange={v => setFilters(f => ({ ...f, action: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-40 h-9 text-xs"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="INSERT">Criação</SelectItem>
            <SelectItem value="UPDATE">Atualização</SelectItem>
            <SelectItem value="DELETE">Exclusão</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={filters.from ?? ''} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className="h-9 w-full sm:w-40 text-xs" placeholder="De" />
        <Input type="date" value={filters.to ?? ''} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className="h-9 w-full sm:w-40 text-xs" placeholder="Até" />
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum log encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">As alterações aparecerão aqui automaticamente</p>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {grouped.map(([day, dayLogs]) => (
              <div key={day}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{format(new Date(day + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{dayLogs.length}</span>
                </div>
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border/50">
                  {dayLogs.map(log => {
                    const tbl = TABLE_CONFIG[log.table_name] ?? { label: log.table_name, icon: Database, color: 'text-muted-foreground bg-muted' };
                    const act = ACTION_CONFIG[log.action] ?? { label: log.action, icon: FileText, color: 'text-muted-foreground bg-muted' };
                    const TblIcon = tbl.icon;
                    const ActIcon = act.icon;
                    const changes = getChangedFields(log);
                    return (
                      <div key={log.id} className="flex items-center gap-4 px-5 py-3 transition-colors group hover:bg-muted/30">
                        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', act.color.split(' ')[1])}><ActIcon className={cn('h-4 w-4', act.color.split(' ')[0])} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', tbl.color)}><TblIcon className="h-3 w-3" />{tbl.label}</span>
                            <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold', act.color)}>{act.label}</span>
                            <span className="text-sm font-medium text-foreground truncate">{getRecordLabel(log)}</span>
                          </div>
                          {changes.length > 0 && <p className="text-[11px] text-muted-foreground truncate">Campos: {changes.map(c => c.field).join(', ')}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-muted-foreground hidden sm:inline">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}</span>
                          <span className="text-[10px] text-muted-foreground/60 font-mono">{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDetailLog(log)}><Eye className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={open => { if (!open) setDetailLog(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0">
          <div className="px-6 pt-6 pb-4 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Detalhes do Log
              </DialogTitle>
            </DialogHeader>
          </div>
          {detailLog && (
            <ScrollArea className="px-6 py-4 max-h-[65vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tabela</p>
                    <p className="text-sm font-medium text-foreground">{TABLE_CONFIG[detailLog.table_name]?.label ?? detailLog.table_name}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Ação</p>
                    <p className="text-sm font-medium text-foreground">{ACTION_CONFIG[detailLog.action]?.label ?? detailLog.action}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Data/Hora</p>
                    <p className="text-sm font-medium text-foreground">{format(new Date(detailLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">ID do Registro</p>
                    <p className="text-sm font-mono text-foreground truncate">{detailLog.record_id}</p>
                  </div>
                </div>

                {/* Changes for UPDATE */}
                {detailLog.action === 'UPDATE' && (() => {
                  const changes = getChangedFields(detailLog);
                  if (!changes.length) return null;
                  return (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Campos Alterados</p>
                      <div className="rounded-lg border overflow-hidden divide-y divide-border/50">
                        {changes.map(c => (
                          <div key={c.field} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            <span className="font-mono text-xs font-medium text-foreground w-32 shrink-0">{c.field}</span>
                            <span className="text-red-500 line-through text-xs truncate flex-1">{String(c.from ?? 'null')}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-emerald-600 text-xs truncate flex-1">{String(c.to ?? 'null')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Raw data */}
                {detailLog.new_data && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      {detailLog.action === 'DELETE' ? 'Dados Removidos' : 'Dados Atuais'}
                    </p>
                    <pre className="rounded-lg bg-muted/40 p-3 text-xs font-mono overflow-x-auto text-foreground whitespace-pre-wrap">
                      {JSON.stringify(detailLog.action === 'DELETE' ? detailLog.old_data : detailLog.new_data, null, 2)}
                    </pre>
                  </div>
                )}
                {detailLog.action === 'DELETE' && detailLog.old_data && !detailLog.new_data && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Dados Removidos</p>
                    <pre className="rounded-lg bg-muted/40 p-3 text-xs font-mono overflow-x-auto text-foreground whitespace-pre-wrap">
                      {JSON.stringify(detailLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
