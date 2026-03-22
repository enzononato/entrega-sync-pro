import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from './BottomNav';
import { PageTransition } from './PageTransition';
import { NotificationPopover } from '@/components/shared/NotificationPopover';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AnimatePresence } from 'framer-motion';

export default function ColaboradorLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const initials = user?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <header className="shrink-0 sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gradient-hero px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/12 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/15 overflow-hidden">
                <img src="/logo.png" alt="IncentivosPro" className="h-10 w-10 object-cover" />
              </div>
              <div>
                <span className="font-bold text-white text-base tracking-tight">IncentivosPro</span>
                <p className="text-[9px] text-white/50 font-medium tracking-[0.15em] uppercase">Gestão de Entregas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationPopover variant="colaborador" />
              <div className="text-right hidden min-[360px]:block">
                <p className="text-xs text-white/90 font-medium leading-tight">{user?.nome?.split(' ')[0]}</p>
                {user?.worker_type && (
                  <p className="text-[10px] text-white/50">
                    {user.worker_type === 'motorista' ? '🚛 Motorista' : user.worker_type === 'distribuicao' ? '📋 Distribuição' : '📦 Ajudante'}
                  </p>
                )}
              </div>
              <Avatar className="h-9 w-9 ring-2 ring-white/25 transition-all hover:ring-white/50">
                <AvatarImage src={user?.avatar_url || undefined} alt={user?.nome} />
                <AvatarFallback className={cn(
                  'text-xs font-bold text-white',
                  'bg-white/15'
                )}>{initials}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <OfflineBanner />

      <main className="flex-1 overflow-auto pb-20 p-4">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
