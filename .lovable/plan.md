## Objetivo
Reduzir o tempo de carregamento do Dashboard de "vários segundos" para sub-segundo, atacando as 3 causas reais: falta de índices, fetches redundantes e agregação no cliente.

## Etapa 1 — Índices no Postgres (ganho imediato, baixo risco)
Criar índices que faltam em `user_indicator_daily`:

```sql
CREATE INDEX IF NOT EXISTS idx_uid_data_referencia
  ON public.user_indicator_daily (data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_uid_user_data
  ON public.user_indicator_daily (user_id, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_uid_indicator_data
  ON public.user_indicator_daily (indicator_id, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_users_unidade_worker
  ON public.users (unidade_id, worker_type) WHERE ativo = true;
```

Sozinho isso já deve cortar 50–70% do tempo das queries atuais.

## Etapa 2 — RPC de agregação para o Dashboard
Criar uma function SQL `dashboard_metrics(p_inicio date, p_fim date, p_unidade_id uuid, p_worker_type text)` que devolve **um único JSON** com:
- `metas_atingidas` (count distinct user/indicator/data com status `dentro_meta`/`acima_meta`/`atingiu`)
- `metas_total`
- `desafios_atingidos`
- `bonus_estimado_total`
- `caixas_batidas_total`
- breakdown por indicador (para o gráfico de barras)
- breakdown por status (para o pie)

Vantagens:
- 1 round-trip em vez de 6+.
- Agregação roda no Postgres, com índices, em ms.
- Sem RLS por linha; a function é `SECURITY DEFINER` e valida acesso à unidade no início via `admin_can_access_unit`.

## Etapa 3 — Limpar `src/pages/admin/Dashboard.tsx`
- Remover a chamada `useDesempenhoDiario(periodoInicio, periodoFim)` (a redundante, com join pesado e sem filtro).
- Substituir os `useMemo` que recontam métricas em JS por leitura direta do retorno da nova RPC.
- Manter `useDesempenhoDashboard` apenas para o que a RPC ainda não cobrir (ou aposentar de vez se a RPC cobrir tudo do dashboard).
- Manter `placeholderData: keepPreviousData` para UX suave em troca de filtro.

## Etapa 4 — Ajustes finos
- Aumentar `staleTime` do dashboard para 2–3 minutos (dados não mudam segundo a segundo).
- Compartilhar a query de `usuarios` entre componentes via `queryKey` estável (já é o caso, só revalidar).

## Não-objetivos
- Não mexer na lógica das importações (estão corretas).
- Não mudar nenhuma regra de negócio (binário Atingiu / Não Atingiu permanece).
- Não tocar nas telas de colaborador.

## Resultado esperado
- Carregamento inicial do Dashboard: de ~5–10 s para <1 s em condições normais.
- Trocar filtro de unidade: instantâneo (placeholder + RPC rápida).
- Sem alterações visuais nem de números exibidos.
