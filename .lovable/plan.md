

## Plano: Reformular Painel do Colaborador

### Visao geral
Transformar o painel do colaborador em um dashboard unico e intuitivo, com filtro de periodo, eliminando paginas redundantes.

### Navegacao: 4 abas no BottomNav
```text
Dashboard | Incentivo | Feedback | Perfil
```
- **Dashboard** (nova): consolida Home + Indicadores + Causa Raiz
- **Incentivo**: permanece como esta
- **Feedback**: permanece como esta
- **Perfil**: permanece (planos de acao acessiveis via link no perfil ou dashboard)
- O menu "Mais" e removido. Planos de Acao fica acessivel como link dentro do Dashboard ou Perfil.

### Dashboard: estrutura das secoes

1. **Header** -- saudacao + data atual + unidade
2. **Filtro de periodo** -- Tabs: Hoje | Semana | Mes | Personalizado (date picker)
3. **Hero Card** -- % de metas atingidas no periodo, contadores (atingiu/nao atingiu), total de mapas
4. **Banner de sucesso** (condicional) -- se todas metas atingidas
5. **KPIs por Mapa** -- cards agrupados por mapa (como ja existe em Indicadores), com expand/collapse e mini spark chart dos ultimos 7 dias
6. **Grafico de Evolucao** -- AreaChart/BarChart semanal ou mensal (reutiliza EvolutionCharts)
7. **Mini Ranking** -- Top 3 do worker_type do usuario

### Paginas removidas
- `/colaborador/indicadores` -- conteudo absorvido pelo Dashboard
- `/colaborador/causa-raiz` -- removida (admin-only ou futura reintegracao)

### Rotas atualizadas
- Remover rotas de `/colaborador/indicadores` e `/colaborador/causa-raiz`
- Atualizar BottomNav para 4 itens
- Planos de Acao permanece como pagina acessivel via link

### Arquivos modificados
- `src/pages/colaborador/Home.tsx` -- reescrever como Dashboard com filtro de periodo e KPIs detalhados
- `src/components/colaborador/BottomNav.tsx` -- 4 abas (Dashboard, Incentivo, Feedback, Perfil)
- `src/routes/AppRoutes.tsx` -- remover rotas de Indicadores e CausaRaiz do colaborador
- `src/components/colaborador/EvolutionCharts.tsx` -- ajustar para aceitar periodo externo como prop

### Arquivos removidos
- `src/pages/colaborador/Indicadores.tsx`
- `src/pages/colaborador/CausaRaiz.tsx`

### Detalhes tecnicos
- O filtro de periodo sera um state local no Dashboard que controla `dataInicio` e `dataFim` passados ao `useDesempenhoDiario`
- Mini Ranking continua usando `useRanking` com range do mes
- O hook `useDesempenhoPorColaborador` sera usado para o spark chart por indicador

