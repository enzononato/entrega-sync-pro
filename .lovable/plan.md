## Diagnóstico

### Problema 1 — Motorista matrícula 19 não mostra todos os mapas em Desempenho

Confirmei diretamente no banco:

- `users` matrícula 19: **2 usuários** (motorista MATHEUS e ajudante ANTONIO).
- `mapa_historico`: 46 mapas com `cd_mot='19'` e 27 com `cd_aju*='19'`.
- Vínculos atuais (após a migração de ontem): **100% corretos** — `mot_user_id` aponta para o motorista nos 46 mapas e `aju*_user_id` para o ajudante nos 27. ✅
- Porém em `user_indicator_daily` o motorista 19 só tem **3 mapas distintos** (datas 24/04 a 28/04), enquanto o ajudante tem 72.

**Causa**: ao corrigir os vínculos ontem, a recálculo da edge `calculate-daily-indicators` foi disparado apenas para as datas importadas mais recentes. As 43 datas históricas anteriores continuam com indicadores apontando para o ajudante (id antigo) em vez do motorista. Resultado: a página Desempenho não exibe esses mapas para o motorista.

**Bônus**: a edge `calculate-daily-indicators` ainda contém o mesmo bug original que existia no importador — o `matriculaMap` (linha ~169) é único e não distingue por `worker_type`. Se um mapa entrar com `mot_user_id` nulo e o último a registrar a matrícula no map for o ajudante, ela re-vincula errado. Precisa do mesmo split que o importador já tem.

### Problema 2 — Páginas com tabelas travando

Hoje os hooks carregam 100% dos registros em loop até o fim:

- `useMapas` → 2.479 linhas de `mapa_historico` (com 47 colunas cada).
- `useDesempenhoDiario` → até 36.194 linhas em `user_indicator_daily` quando o período é amplo.
- `useRanking` → mesmo padrão.

Tudo vai pra memória do navegador e é re-renderizado a cada filtro. Em períodos longos isso trava.

---

## Plano

### 1. Recalcular indicadores históricos

Disparar a edge `calculate-daily-indicators` para todas as 43 datas distintas em que o motorista 19 (e qualquer outro afetado pelo bug antigo) tem mapas. Para garantir consistência total, vou rodar para **todas as datas distintas em `mapa_historico`** desde o início — é uma operação one-shot que conserta qualquer registro que tenha ficado órfão da migração anterior.

A chamada será feita em lotes de ~30 datas para não estourar timeout da edge.

### 2. Corrigir bug residual na edge `calculate-daily-indicators`

Em `supabase/functions/calculate-daily-indicators/index.ts`:

- Substituir o único `matriculaMap` por dois mapas: `motMatriculaMap` e `ajuMatriculaMap`.
- Na lógica `tryLink` (linhas ~213-222), usar o mapa correto conforme o campo:
  - `cd_mot` → `motMatriculaMap`
  - `cd_aju1`/`cd_aju2` → `ajuMatriculaMap`

Isso garante que futuras recálculas nunca mais embaralhem motorista/ajudante de mesma matrícula.

### 3. Otimizar carregamento das tabelas pesadas

Mudar a estratégia de "carrega tudo" para **paginação server-side com filtros aplicados na query**:

**a) `useMapas` (Histórico de Mapas)**
- Aceitar parâmetros: `dateStart`, `dateEnd`, `page`, `pageSize` (default 50), e os filtros já existentes (placa, mapa, motorista, ajudante).
- Aplicar `.gte/.lte` em `data_operacao` e `.ilike` nos campos de busca direto no Supabase.
- Retornar `{ rows, total }` usando `count: 'exact'` e `.range()`.
- A página `HistoricoMapas.tsx` passa a debouncar inputs (300ms) e usar paginação real (botões anterior/próxima já existem via `ListPagination`).
- **Default**: últimos 30 dias, em vez de tudo.

**b) `useDesempenhoDiario` (Desempenho)**
- Já aceita período. Adicionar filtros server-side para `unidade_id` e `worker_type` via JOIN/in (em vez de filtrar no cliente após baixar tudo).
- Para isso, primeiro buscar `users.id` que batem nos filtros, depois `.in('user_id', ids)` na query principal. Reduz drasticamente o payload quando o admin filtra por unidade.
- Manter loop de paginação interna (já existe), mas com filtros aplicados antes.
- **Default**: hoje (já é).

**c) `useRanking`**
- Mesma abordagem do desempenho: filtrar `user_id`/`worker_type`/`unidade` antes do download.

**d) Cache do React Query**
- Aumentar `staleTime` para 5 min nos três hooks (já está em alguns) para evitar refetch ao trocar de aba.

### 4. Validação

Após implementar:
- Verificar que a página Desempenho mostra os 46 mapas do motorista 19 quando filtrado por período cobrindo todas as datas.
- Conferir tempo de carregamento de Histórico de Mapas (deve ficar instantâneo com 50 linhas/página).
- Conferir Desempenho com filtro de unidade aplicado (deve baixar só as linhas relevantes).

---

## Arquivos afetados

```text
supabase/functions/calculate-daily-indicators/index.ts   (fix bug matrícula)
src/hooks/useMapas.ts                                    (paginação server-side)
src/hooks/useDesempenho.ts                               (filtros server-side)
src/hooks/useRanking.ts                                  (filtros server-side)
src/pages/admin/HistoricoMapas.tsx                       (debounce + paginação)
```

E uma execução one-shot da edge para recalcular o histórico (sem migration SQL — só chamada da function).
