## Objetivo

Implementar separação real de visualização e ações por unidade (revenda) para administradores. Um admin vinculado a "Bonfim" só vê e age sobre dados de Bonfim. Admins sem nenhum vínculo em `user_units` continuam como super-admin (vendo tudo) — isso preserva o comportamento atual de quem gerencia o sistema inteiro.

## Como o controle será aplicado

A regra "quem pode ver/agir em quais unidades" já existe em `user_units` + hook `useAllowedUnits`. Vamos:

1. Estender o filtro a TODAS as telas, hooks e importações do admin.
2. Reforçar no banco (RLS) para que mesmo chamadas diretas respeitem a regra — frontend sozinho não é segurança.
3. Validar no servidor (edge functions) operações sensíveis (criar/excluir usuário, importar dados).

## Mudanças no Frontend

### Páginas admin que ainda não filtram por unidade
Aplicar `useAllowedUnits` + filtro nas listagens e nos selects de unidade:
- `Usuarios.tsx` — listar só usuários cuja `unidade_id` (ou `user_units`) esteja nas permitidas; no formulário de criação só oferecer unidades permitidas.
- `Auditoria.tsx`, `LogsLogin.tsx` — filtrar registros cujo usuário pertença às unidades permitidas.
- `CausaRaiz.tsx`, `PlanosDeAcao.tsx`, `Descontos.tsx`, `Indicadores.tsx` — filtrar por usuário/unidade permitida.
- `HistoricoMapas.tsx` — filtrar mapas das unidades permitidas (via usuários vinculados).
- `Importacoes.tsx` (histórico) — mostrar só batches feitos por admins que compartilham unidades.

### Importações (componentes em `src/components/admin/Import*`)
- Já pedem unidade no formulário; restringir o select para `allowedUnits`.
- Ao classificar/inserir, descartar linhas cujo colaborador pertença a unidade fora das permitidas (com aviso na pré-visualização).

### Componentes globais
- `GlobalSearch.tsx` — restringir resultados às unidades permitidas.
- `Sidebar.tsx` — nada muda (links iguais), mas mostrar um chip com a(s) unidade(s) do admin atual para clareza.

## Mudanças no Banco (RLS)

Hoje quase todas as policies admin são `has_role(auth.uid(), 'admin')` — o que dá acesso total. Vamos criar uma função e trocar policies.

### Função helper
```sql
create or replace function public.admin_can_access_unit(_unit_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select
    has_role(auth.uid(), 'admin') and (
      -- super-admin: nenhum vínculo em user_units
      not exists (select 1 from user_units uu
                  where uu.user_id = get_user_id(auth.uid()))
      or _unit_id is null
      or exists (select 1 from user_units uu
                 where uu.user_id = get_user_id(auth.uid())
                   and uu.unit_id = _unit_id)
    );
$$;
```

E uma variante para tabelas que só têm `user_id` (não `unidade_id`):
```sql
create or replace function public.admin_can_access_user(_target_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select admin_can_access_unit(
    (select unidade_id from users where id = _target_user_id)
  );
$$;
```

### Policies a reescrever
Substituir `has_role(...,'admin')` por uma combinação com a função acima nas tabelas:

| Tabela | Critério |
|---|---|
| `users`, `user_units`, `user_roles` | `admin_can_access_unit(users.unidade_id)` |
| `routes` | `admin_can_access_unit(routes.unidade_id)` |
| `goals`, `feedbacks`, `relatos_seguranca`, `pdv_critico_feedbacks`, `rating_avaliacoes` | `admin_can_access_unit(unidade_id)` |
| `mapa_historico`, `refugo_031134`, `reposicao_031805` | `admin_can_access_user(mot_user_id)` (ou aju) |
| `user_indicator_daily`, `user_incentives_daily`, `incentive_deductions`, `root_cause_records`, `action_plans` | `admin_can_access_user(user_id)` |
| `audit_logs`, `login_attempts`, `import_batches` | manter aberto a admin (auditoria global) — confirmar com você |
| `units` | super-admin tudo; admin restrito só vê suas unidades (SELECT) e não pode editar/excluir |

A tabela `indicators` continua leitura aberta para todos autenticados.

### Edge functions
- `create-user`, `delete-user`, `bulk-create-users`, `reset-password` — validar que a unidade alvo está nas unidades do admin chamador antes de executar.

## Como atribuir admins a unidades
Já existe na tela `/admin/usuarios` (checkboxes "revendas"). Nada novo na UI — só garantir que para `role='administrador'` essas associações sejam usadas como regra de acesso (hoje só são usadas para colaboradores).

## Pontos a confirmar com você

1. **Super-admin**: confirmar que admin SEM nenhum vínculo em `user_units` continua vendo tudo (caso contrário ninguém mais consegue gerenciar o sistema). Sim/Não?
2. **Auditoria/Logs de login/Importações históricas**: devem ser globais (todos admins veem tudo) ou também restritos por unidade?
3. **Indicadores/Metas globais (sem unidade)**: metas com `unidade_id IS NULL` aparecem para todos os admins? (recomendo: sim, são templates globais)
4. **Importações multi-unidade** (planilha mistura várias revendas): bloquear o upload, ou importar só as linhas das unidades permitidas e descartar o resto com aviso?

## Resumo técnico (para devs)

- 1 migration: 2 funções SECURITY DEFINER + recriação das policies admin nas ~15 tabelas listadas.
- ~10 páginas admin atualizadas para usar `useAllowedUnits` no filtro de listagem e nos selects.
- ~7 componentes de importação validando `allowedUnits`.
- 4 edge functions com check de unidade do chamador.
- Sem mudança em telas do colaborador.
