

## Plano: Padronizar RLS com `has_role()` em todas as tabelas

### Situação atual

Todas as tabelas já têm RLS habilitado com políticas separando admin (acesso total) e colaborador (dados próprios). Porém, a maioria usa `is_admin(auth.uid())` em vez da função mais flexível `has_role()`. A ideia é padronizar e garantir consistência.

### O que muda

Uma única migration SQL que:

1. **Remove todas as políticas existentes** das 12 tabelas
2. **Recria com `has_role(auth.uid(), 'admin')`** no lugar de `is_admin(auth.uid())`
3. **Mantém as políticas de colaborador** usando `get_user_id(auth.uid())` para acesso a dados próprios
4. **Adiciona política faltante**: colaboradores poderem atualizar seus próprios feedbacks abertos (atualmente só podem inserir e ler)

### Tabelas afetadas

| Tabela | Admin | Colaborador |
|--------|-------|-------------|
| users | CRUD completo | SELECT/UPDATE próprio |
| user_roles | CRUD completo | SELECT próprio |
| user_units | CRUD completo | SELECT próprio |
| notifications | INSERT + SELECT | SELECT/UPDATE próprio |
| indicators | CRUD completo | SELECT (todos) |
| units | CRUD completo | SELECT (todos) |
| routes | CRUD completo | SELECT (todos) |
| goals | CRUD completo | SELECT (próprios + compartilhados) |
| incentive_rules | CRUD completo | SELECT (todos) |
| user_indicator_daily | CRUD completo | SELECT próprio |
| user_incentives_daily | CRUD completo | SELECT próprio |
| action_plans | CRUD completo | SELECT/INSERT/UPDATE próprio |
| root_cause_records | CRUD completo | SELECT/INSERT próprio |
| feedbacks | CRUD completo | SELECT/INSERT/UPDATE próprio |
| audit_logs | SELECT (admin only) | — |

### Arquivos

| Ação | Arquivo |
|------|---------|
| Migration SQL | Drop + recreate todas as políticas RLS com `has_role()` |

Nenhum arquivo frontend precisa ser alterado — a lógica de acesso é toda no banco.

