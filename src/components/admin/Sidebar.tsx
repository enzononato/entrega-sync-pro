import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, TrendingUp, Target, Flag, Award,
  Building2, MapPin, MessageSquare, ClipboardCheck, AlertTriangle, LogOut, Truck,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/NavLink';

const sections = [
  {
    label: 'VISÃO GERAL',
    items: [{ title: 'Dashboard', url: '/admin/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'OPERAÇÃO',
    items: [
      { title: 'Colaboradores', url: '/admin/colaboradores', icon: Users },
      { title: 'Desempenho', url: '/admin/desempenho', icon: TrendingUp },
    ],
  },
  {
    label: 'CONFIGURAÇÕES',
    items: [
      { title: 'Indicadores', url: '/admin/indicadores', icon: Target },
      { title: 'Metas', url: '/admin/metas', icon: Flag },
      { title: 'Incentivos', url: '/admin/incentivos', icon: Award },
      { title: 'Unidades', url: '/admin/unidades', icon: Building2 },
      { title: 'Rotas', url: '/admin/rotas', icon: MapPin },
    ],
  },
  {
    label: 'ACOMPANHAMENTO',
    items: [
      { title: 'Feedbacks', url: '/admin/feedbacks', icon: MessageSquare },
      { title: 'Planos de Ação', url: '/admin/planos-de-acao', icon: ClipboardCheck },
      { title: 'Causa Raiz', url: '/admin/causa-raiz', icon: AlertTriangle },
    ],
  },
];

export function AdminSidebar() {
  const { user, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const location = useLocation();
  const initials = user?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'AD';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5 text-sidebar-accent-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-lg text-sidebar-foreground">EntregaApp</span>}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map(section => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] tracking-widest">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map(item => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.nome}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-sidebar-foreground/60 hover:text-sidebar-foreground shrink-0 h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
