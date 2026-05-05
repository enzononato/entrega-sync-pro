## Objetivo
Criar uma RPC Postgres `dashboard_metrics` que devolve as métricas agregadas do dashboard em um único round-trip (~200 bytes em vez de ~5 MB), eliminando o fetch + agregação no browser para os cards de "Metas Atingidas", banner de Desafio e gráficos.

## Etapa 1 — Migração SQL

### Índices de suporte (idempotentes)
```sql
CREATE INDEX IF NOT EXISTS idx_uid_data_referencia
  ON public.user_indicator_daily (data_referencia);
CREATE INDEX IF NOT EXISTS idx_uid_user_data
  ON public.user_indicator_daily (user_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_uid_indicator_data
  ON public.user_indicator_daily (indicator_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_users_unidade_worker_ativo
  ON public.users (unidade_id, worker_type) WHERE ativo = true;
```

### RPC `dashboard_metrics`
- `SECURITY DEFINER`, `search_path=public`, retorno `jsonb`.
- Parâmetros: `p_inicio date`, `p_fim date`, `p_unidade_id uuid default null`, `p_worker_type text default null`.
- Validação no início: exige `has_role(auth.uid(),'admin')`; se `p_unidade_id` não nulo, exige `admin_can_access_unit(p_unidade_id)`; se nulo, restringe agregação às unidades visíveis ao admin (via `user_units` ou todas, igual `admin_can_access_unit`).
- Considera apenas `users.ativo = true AND role = 'colaborador'` e respeita filtros opcionais (`unidade_id`, `worker_type`).
- Trata indicadores mensais corretamente: se `indicators.periodicidade = 'mensal'`, filtra por interseção `to_char(data_referencia,'YYYY-MM')` entre os meses do período; senão por `data_referencia BETWEEN p_inicio AND p_fim`.
- Status canônico = `dentro_meta`/`acima_meta`/`atingiu` ⇒ atingida.

Retorno (shape estável):
```json
{
  "metas_atingidas": 1234,
  "metas_total": 1500,
  "abaixo_meta": 266,
  "desafios_total": 800,
  "desafios_atingidos": 420,
  "por_indicador": [
    { "indicator_id": "uuid", "codigo": "TML", "nome": "Tempo Médio...",
      "total": 200, "atingidas": 180, "abaixo": 20 }
  ]
}
```

## Etapa 2 — Hook React Query
Criar `src/hooks/useDashboardMetrics.ts`:
- `useQuery` com `queryKey: ['dashboard-metrics', from, to, unidade, tipo]`.
- Chama `supabase.rpc('dashboard_metrics', { p_inicio, p_fim, p_unidade_id, p_worker_type })`.
- `staleTime: 2 * 60_000`, `placeholderData: keepPreviousData`.

## Etapa 3 — Refatorar `src/pages/admin/Dashboard.tsx`
Substituir consumidores de `desempenho`/`filteredDesempenho` por dados da RPC:
- `dentroMeta`, `abaixoMeta`, `totalMetasDash`, `pctAtingidas` ⇒ direto do retorno.
- `barData` (Desempenho por Indicador) ⇒ map de `por_indicador`.
- `topCritical` (Top 5 críticos) ⇒ derivado de `por_indicador` (filtra `abaixo > 0`, ordena, slice 5).
- `desafioStats` (banner Desafio diário) ⇒ usa `desafios_total/desafios_atingidos`.

Manter intactos:
- `desafioStatsMes` (lógica de agregação mensal por user/indicador para o HeroStat "Desafio nas Metas").
- Bônus mensal (`bonusMensalRows` da edge function `calculate-monthly-bonus`).
- Filtros (Unidade, Perfil, Período, etc.) e demais cards (feedbacks, planos, caixas batidas).

### Otimização adicional
Tornar `useDesempenhoDashboard` **condicional**: só habilitar (`enabled`) quando o fallback de bônus for necessário — i.e., `bonusMensalRows.length === 0 && metasComBonus > 0`. No caminho normal (com `user_incentives_daily` populado) o fetch pesado de 38k linhas deixa de acontecer.

## Etapa 4 — Validação
- Comparar `metas_atingidas`, `metas_total` e `por_indicador` antes/depois em alguns períodos (mês corrente, mês anterior) para garantir paridade numérica.
- Verificar que filtros por unidade e por tipo continuam funcionando (admin com `user_units` restritos vê apenas suas unidades).

## Resultado esperado
- Dashboard inicial: de ~5–10 s para <500 ms em condições normais.
- Trocar filtro de unidade/perfil/período: instantâneo (RPC + `keepPreviousData`).
- Sem mudanças visuais nem nas regras de negócio (binário Atingiu/Não Atingiu mantido).

## Não-objetivos
- Não tocar nas telas de colaborador.
- Não alterar a edge function de bônus mensal.
- Não mexer nos importadores nem em RLS de outras tabelas.
