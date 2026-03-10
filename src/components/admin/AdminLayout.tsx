import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/Sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificationPopover } from '@/components/shared/NotificationPopover';

export default function AdminLayout() {
  const { user } = useAuth();
  const initials = user?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'AD';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/50 bg-card/90 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <h2 className="text-sm font-medium text-muted-foreground hidden md:block tracking-tight">Painel Administrativo</h2>
            </div>
            <div className="flex items-center gap-2">
              <NotificationPopover variant="admin" />
              <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium text-foreground leading-tight">{user?.nome?.split(' ')[0]}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Admin</p>
                </div>
                <Avatar className="h-8 w-8 ring-2 ring-primary/10 transition-all hover:ring-primary/25">
                  <AvatarFallback className="gradient-primary text-white text-[10px] font-bold">{initials}</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
