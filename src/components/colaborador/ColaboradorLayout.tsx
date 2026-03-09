import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from './BottomNav';
import { Truck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function ColaboradorLayout() {
  const { user } = useAuth();
  const initials = user?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Dark navy header matching reference */}
      <header className="shrink-0 sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gradient-hero px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/20">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-base tracking-tight">RotaScore</span>
                <p className="text-[10px] text-white/50 font-medium tracking-wider uppercase">Gestão de Entregas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden min-[360px]:block">
                <p className="text-xs text-white/90 font-medium leading-tight">{user?.nome?.split(' ')[0]}</p>
                {user?.worker_type && (
                  <p className="text-[10px] text-white/50">{user.worker_type === 'motorista' ? 'Motorista' : 'Ajudante'}</p>
                )}
              </div>
              <Avatar className="h-9 w-9 ring-2 ring-white/30">
                <AvatarFallback className="bg-white/20 text-white text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-20 p-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
