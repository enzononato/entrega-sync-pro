import { useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { useLoginAttempts, type LoginAttempt } from '@/hooks/useLoginAttempts';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, Search, CheckCircle2, XCircle, Globe, Monitor,
  KeyRound, User, Mail, Clock, ShieldAlert, LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatUserAgent(ua: string | null): string {
  if (!ua) return 'Desconhecido';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  if (/Opera|OPR\//.test(ua)) return 'Opera';
  return 'Outro';
}

function deviceFromUA(ua: string | null): string {
  if (!ua) return '';
  if (/Mobile|Android|iPhone|iPad/.test(ua)) return 'Mobile';
  return 'Desktop';
}

export default function LogsLogin() {
  const [tab, setTab] = useState<'all' | 'success' | 'failure'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LoginAttempt | null>(null);

  const { data: logs = [], isLoading } = useLoginAttempts({
    status: tab,
    search: search.trim() || undefined,
  });

  const stats = useMemo(() => {
    const total = logs.length;
    const ok = logs.filter(l => l.success).length;
    const fail = total - ok;
    return { total, ok, fail };
  }, [logs]);

  const { paginatedItems, ...pag } = usePagination(logs, 25);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs de Login"
        subtitle="Histórico completo de tentativas de acesso ao sistema (sucesso e falha)"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total exibido</p>
            <p className="text-2xl font-bold tracking-tight">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Logins bem-sucedidos</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-600">{stats.ok}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tentativas falhas</p>
            <p className="text-2xl font-bold tracking-tight text-destructive">{stats.fail}</p>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3 flex flex-col md:flex-row gap-3 md:items-center">
        <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="success">Sucessos</TabsTrigger>
            <TabsTrigger value="failure">Falhas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por matrícula, e-mail, nome ou IP…"
            className="pl-9"
          />
        </div>
      </Card>

      {/* Lista */}
      <Card className="divide-y divide-border/50">
        {isLoading && (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
          </div>
        )}
        {!isLoading && logs.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum registro encontrado para os filtros atuais.
          </div>
        )}
        {!isLoading && paginatedItems.map(log => {
          const browser = formatUserAgent(log.user_agent);
          const device = deviceFromUA(log.user_agent);
          return (
            <button
              key={log.id}
              onClick={() => setSelected(log)}
              className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-center gap-3"
            >
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                log.success ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive',
              )}>
                {log.success ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">
                    {log.user_nome || log.identifier || '—'}
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {log.identifier_type}
                  </Badge>
                  {log.success ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">
                      Sucesso
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">Falha</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="font-mono">{log.identifier}</span>
                  {log.ip_address && (
                    <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{log.ip_address}</span>
                  )}
                  {browser && (
                    <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />{browser}{device && ` · ${device}`}</span>
                  )}
                </div>
                {!log.success && log.failure_reason && (
                  <p className="text-xs text-destructive mt-1 truncate">
                    {log.failure_reason}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-foreground">
                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(log.created_at), { locale: ptBR, addSuffix: true })}
                </p>
              </div>
            </button>
          );
        })}
        {!isLoading && logs.length > 0 && (
          <div className="p-3">
            <ListPagination {...pag} />
          </div>
        )}
      </Card>

      {/* Detalhes */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected?.success ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Login bem-sucedido</>
              ) : (
                <><XCircle className="h-5 w-5 text-destructive" /> Tentativa de login falhou</>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[70vh] pr-3">
              <div className="space-y-3 text-sm">
                <DetailRow icon={Clock} label="Data e hora" value={format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })} />
                <DetailRow icon={KeyRound} label="Identificador informado" value={`${selected.identifier} (${selected.identifier_type})`} />
                {selected.user_nome && <DetailRow icon={User} label="Usuário identificado" value={selected.user_nome} />}
                {selected.user_email && <DetailRow icon={Mail} label="E-mail" value={selected.user_email} />}
                <DetailRow icon={Globe} label="Endereço IP" value={selected.ip_address || 'Não capturado'} />
                <DetailRow icon={Monitor} label="Navegador" value={`${formatUserAgent(selected.user_agent)} · ${deviceFromUA(selected.user_agent) || '—'}`} />
                {!selected.success && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                    <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">Motivo da falha</p>
                    <p className="text-sm text-destructive">{selected.failure_reason || 'Não especificado'}</p>
                  </div>
                )}
                {selected.user_agent && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">User Agent completo</p>
                    <p className="text-[11px] font-mono bg-muted/50 p-2 rounded break-all">{selected.user_agent}</p>
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>Fechar</Button>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm text-foreground break-all">{value}</p>
      </div>
    </div>
  );
}