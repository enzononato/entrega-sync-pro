import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/Sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function AdminLayout() {
  const { user } = useAuth();
  const initials = user?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'AD';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <h2 className="text-lg font-semibold text-foreground hidden md:block">Painel Administrativo</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">{user?.nome}</span>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
