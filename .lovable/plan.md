

# Sugestões de Melhorias para o Sistema IncentivosPro

Após análise completa do sistema (portal colaborador + admin), aqui estão as melhorias organizadas por prioridade e impacto:

---

## 1. PWA + Modo Offline (Alta prioridade)
**Problema**: O app depende 100% de conexão. Motoristas/ajudantes frequentemente operam em áreas com sinal fraco.

**Solução**:
- Registrar Service Worker com cache de assets estáticos
- Implementar cache local dos dados do dia (indicadores, incentivo) com IndexedDB
- Adicionar banner "Sem conexão — dados do último acesso" no header
- Pull-to-refresh para sincronizar quando voltar online
- Manifest.json completo para instalação como PWA

**Arquivos**: `public/manifest.json`, `public/sw.js`, `src/main.tsx`, `ColaboradorLayout.tsx`

---

## 2. Dark Mode (Média prioridade)
**Problema**: Motoristas usam o app em diferentes condições de luz. Sem toggle de tema.

**Solução**:
- Toggle claro/escuro no Perfil e no header
- Usar as CSS variables já configuradas pelo Tailwind/shadcn
- Persistir preferência no localStorage

**Arquivos**: `src/contexts/ThemeContext.tsx`, `Perfil.tsx`, `ColaboradorLayout.tsx`

---

## 3. Notificações Push (Alta prioridade)
**Problema**: Notificações só aparecem dentro do app. Motoristas não recebem alertas em background.

**Solução**:
- Implementar Web Push via Service Worker + Supabase Edge Function
- Triggers: indicador abaixo da meta, plano de ação atrasado, feedback respondido
- Tela de preferências de notificação no Perfil

**Arquivos**: Edge function `push-notification`, `sw.js`, `Perfil.tsx`

---

## 4. Relatórios PDF para Admin (Média prioridade)
**Problema**: Gestores não conseguem exportar relatórios consolidados para reuniões.

**Solução**:
- Botão "Gerar Relatório" no Dashboard admin
- PDF com resumo de desempenho por unidade, ranking top/bottom, feedbacks pendentes
- Usar biblioteca como `jspdf` + `html2canvas` ou edge function com template

**Arquivos**: `src/lib/generateReport.ts`, `Dashboard.tsx`

---

## 5. Histórico de Desempenho Mensal no Perfil (Média prioridade)
**Problema**: O colaborador só vê dados do dia atual. Falta visão de evolução mensal.

**Solução**:
- Seção "Meu Histórico" no Perfil com gráfico de linha mensal
- Comparativo mês atual vs anterior
- Total de incentivo acumulado no mês

**Arquivos**: `Perfil.tsx`, novo hook `useDesempenhoMensal.ts`

---

## 6. Gamificação Avançada (Baixa prioridade)
**Problema**: O sistema de badges existe mas é básico. Falta engajamento contínuo.

**Solução**:
- Streak counter (dias consecutivos na meta)
- Níveis de experiência (Bronze → Prata → Ouro → Diamante)
- Animação de conquista ao atingir milestones
- Seção "Conquistas" visível no ranking

**Arquivos**: `Perfil.tsx`, `MiniRanking.tsx`, novo `useGamification.ts`

---

## 7. Busca Global no Admin (Baixa prioridade)
**Problema**: Admin precisa navegar entre várias telas para encontrar um colaborador ou indicador.

**Solução**:
- Command palette (Cmd+K) usando o componente `Command` já existente no projeto
- Busca por colaborador, unidade, rota, indicador
- Atalhos rápidos para telas principais

**Arquivos**: `AdminLayout.tsx`, novo `GlobalSearch.tsx`

---

## 8. Extrato de Descontos no Portal do Colaborador (Média prioridade)
**Problema**: O componente `ExtratoDescontos` existe mas pode não estar exposto de forma clara.

**Solução**:
- Garantir que o extrato esteja acessível na tela de Incentivo
- Adicionar detalhamento por tipo de desconto com drill-down

---

## 9. Melhoria na Segurança (Alta prioridade)
**Problema**: O `useMarkAllRead` marca notificações de todos os usuários como lidas (falta filtro `user_id`).

**Solução**:
- Corrigir a mutation para filtrar por `user_id` do usuário logado
- Revisar RLS policies nas tabelas de notificações

**Arquivo**: `src/hooks/useNotifications.ts` (linha 80)

---

## Resumo por Prioridade

| Prioridade | Melhoria |
|------------|----------|
| Alta | PWA + Offline, Notificações Push, Correção de segurança em notificações |
| Média | Dark Mode, Relatórios PDF, Histórico mensal, Extrato de descontos |
| Baixa | Gamificação avançada, Busca global admin |

---

Qual dessas melhorias você gostaria de implementar primeiro?

