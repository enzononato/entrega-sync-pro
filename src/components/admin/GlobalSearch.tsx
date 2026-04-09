import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  LayoutDashboard, Users, TrendingUp, Target, Flag, Award,
  Building2, MessageSquare, ClipboardCheck, AlertTriangle, Shield,
  TrendingDown, UserCog, Search,
} from 'lucide-react';

const PAGES = [
  { title: 'Dashboard', url: '/admin/dashboard', icon: LayoutDashboard, keywords: 'resumo visão geral kpi' },
  { title: 'Ranking', url: '/admin/ranking', icon: Award, keywords: 'classificação posição' },
  { title: 'Colaboradores', url: '/admin/colaboradores', icon: Users, keywords: 'motorista ajudante funcionário' },
  { title: 'Desempenho', url: '/admin/desempenho', icon: TrendingUp, keywords: 'performance resultado' },
  { title: 'Indicadores', url: '/admin/indicadores', icon: Target, keywords: 'kpi métricas' },
  { title: 'Metas', url: '/admin/metas', icon: Flag, keywords: 'objetivo alvo' },
  
  { title: 'Descontos', url: '/admin/descontos', icon: TrendingDown, keywords: 'dedução penalidade' },
  { title: 'Feedbacks', url: '/admin/feedbacks', icon: MessageSquare, keywords: 'reclamação sugestão' },
  { title: 'Planos de Ação', url: '/admin/planos-de-acao', icon: ClipboardCheck, keywords: 'tarefas atividades' },
  { title: 'Causa Raiz', url: '/admin/causa-raiz', icon: AlertTriangle, keywords: 'problema análise' },
  { title: 'Unidades', url: '/admin/unidades', icon: Building2, keywords: 'revenda filial' },
  { title: 'Usuários', url: '/admin/usuarios', icon: UserCog, keywords: 'contas acesso' },
  { title: 'Auditoria', url: '/admin/auditoria', icon: Shield, keywords: 'log histórico' },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-muted/50 text-muted-foreground text-xs hover:bg-muted transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar página, colaborador, indicador..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Páginas">
            {PAGES.map(page => (
              <CommandItem
                key={page.url}
                value={`${page.title} ${page.keywords}`}
                onSelect={() => handleSelect(page.url)}
                className="cursor-pointer"
              >
                <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {page.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
