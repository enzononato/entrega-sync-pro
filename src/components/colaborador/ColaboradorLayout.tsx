import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from './BottomNav';
import { Truck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function ColaboradorLayout() {
  const { user } = useAuth();
  const initials = user?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground">EntregaApp</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user?.nome?.split(' ')[0]}</span>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-20 p-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
