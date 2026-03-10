import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, useMarkNotificationRead, useMarkAllRead, type Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const typeIcons: Record<string, string> = {
  meta_nao_atingida: '📉',
  plano_vencido: '⏰',
  feedback_respondido: '💬',
  geral: '🔔',
};

function NotificationItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  return (
    <div
      className={cn(
        'px-4 py-3 border-b border-border/40 last:border-0 transition-colors',
        !n.read && 'bg-primary/5'
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base mt-0.5">{typeIcons[n.type] ?? '🔔'}</span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs leading-snug', !n.read ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
            {n.title}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        {!n.read && (
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onRead(n.id)}>
            <Check className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface NotificationPopoverProps {
  variant?: 'admin' | 'colaborador';
}

export function NotificationPopover({ variant = 'admin' }: NotificationPopoverProps) {
  const { data: notifications = [], unreadCount } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const isColab = variant === 'colaborador';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-8 w-8 rounded-lg',
            isColab ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map(n => (
              <NotificationItem key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
