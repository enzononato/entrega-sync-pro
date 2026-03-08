import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from './BottomNav';
import { Truck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function ColaboradorLayout() {
  const { user } = useAuth();
  const initials = user?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 bg-card/80 backdrop-blur-lg border-b border-border/60 flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <Truck className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-foreground tracking-tight">EntregaApp</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-sm text-muted-foreground font-medium">{user?.nome?.split(' ')[0]}</span>
          <Avatar className="h-8 w-8 ring-2 ring-primary/10">
            <AvatarFallback className="gradient-primary text-white text-xs font-semibold">{initials}</AvatarFallback>
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
