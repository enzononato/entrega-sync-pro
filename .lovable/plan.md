

## Plano: Etapa 2 — Notificações in-app, Busca avançada, Exportação CSV

### 1. Notificações In-app (badge/sino)

**Banco de dados:**
- Criar tabela `notifications` com colunas: `id`, `user_id` (ref auth.users), `title`, `message`, `type` (enum: meta_nao_atingida, plano_vencido, feedback_respondido, geral), `read`, `created_at`
- RLS: usuários leem/atualizam apenas suas próprias notificações; admins inserem para qualquer um
- Criar function + trigger que gera notificações automaticamente quando:
  - Um `user_indicator_daily` é inserido com `status = 'abaixo_meta'`
  - Um `action_plans` tem `prazo < CURRENT_DATE` e status aberto/em_andamento
  - Um `feedbacks` é atualizado para `status = 'respondido'`

**Frontend:**
- Criar hook `useNotifications` — busca notificações não lidas do usuário logado, com count
- Criar componente `NotificationPopover` — Popover no ícone do sino com lista de notificações, badge com contagem, botão "marcar como lida"
- Integrar no `AdminLayout` e `ColaboradorLayout` — substituir o botão de sino estático pelo novo componente
- Usar Supabase Realtime (`subscribe`) para atualizar o badge em tempo real

### 2. Busca avançada por CPF/matrícula na listagem

**Backend:**
- Adicionar filtros `cpf` e `matricula` ao `useUsuariosPaginated` — usar `ilike` para busca parcial
- O campo de busca atual (`nome`) será expandido para buscar por nome OR CPF OR matrícula usando `or()` do Supabase

**Frontend (Colaboradores.tsx):**
- Alterar o placeholder do input de busca para "Buscar nome, CPF ou matrícula..."
- Atualizar a query no `useUsuariosPaginated` para usar `.or()` combinando `nome.ilike`, `cpf.ilike`, `matricula.ilike`

### 3. Exportação CSV/Excel

**Utilitário:**
- Criar `src/lib/exportCsv.ts` com função genérica `exportToCsv(filename, headers, rows)` que gera arquivo CSV com BOM UTF-8 e dispara download

**Páginas com botão de exportação:**
- **Colaboradores** — exportar lista filtrada (nome, matrícula, CPF, tipo, unidade, rota, status)
- **Desempenho** — exportar dados do dia/período (colaborador, indicador, valor, meta, %, status)
- **Incentivos** — exportar incentivos diários (colaborador, data, valor estimado, valor fechado, status)

Em cada página, adicionar botão "Exportar CSV" ao lado do título/header, usando os dados já carregados na tela.

---

### Resumo técnico de arquivos

| Ação | Arquivo |
|------|---------|
| Migration SQL | Tabela `notifications`, triggers automáticos |
| Criar | `src/hooks/useNotifications.ts` |
| Criar | `src/components/shared/NotificationPopover.tsx` |
| Criar | `src/lib/exportCsv.ts` |
| Editar | `src/components/admin/AdminLayout.tsx` — integrar NotificationPopover |
| Editar | `src/components/colaborador/ColaboradorLayout.tsx` — integrar NotificationPopover |
| Editar | `src/hooks/useUsuarios.ts` — busca por CPF/matrícula via `.or()` |
| Editar | `src/pages/admin/Colaboradores.tsx` — placeholder + botão exportar |
| Editar | `src/pages/admin/Desempenho.tsx` — botão exportar CSV |
| Editar | `src/pages/admin/Incentivos.tsx` — botão exportar CSV |

