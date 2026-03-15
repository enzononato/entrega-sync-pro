import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, TrendingUp, Target, Flag, Award,
  Building2, MapPin, MessageSquare, ClipboardCheck, AlertTriangle, LogOut, Truck, Shield,
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
      { title: 'Auditoria', url: '/admin/auditoria', icon: Shield },
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
          <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/10 overflow-hidden">
            <img src="/logo.png" alt="IncentivosPro" className="h-9 w-9 object-cover" />
          </div>
          {!collapsed && (
            <div>
              <span className="font-bold text-base text-sidebar-foreground tracking-tight">IncentivosPro</span>
              <p className="text-[9px] text-sidebar-foreground/40 font-medium tracking-widest uppercase">Gestão</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map(section => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/35 text-[10px] tracking-[0.15em] font-semibold">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map(item => {
                  const active = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                      >
                        <NavLink
                          to={item.url}
                          className="hover:bg-sidebar-accent/50 rounded-lg transition-all duration-200"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                        >
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span className="text-[13px]">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/10">
            <AvatarFallback className="bg-white/15 text-sidebar-foreground text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.nome}</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 shrink-0 h-8 w-8 rounded-lg">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
