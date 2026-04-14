

## Plano: Indicadores para Ajudantes + Metas por worker_type

### Problema identificado
A edge function `calculate-daily-indicators` processa indicadores **apenas para motoristas** (`mot_user_id`). Ajudantes (`aju1_user_id`, `aju2_user_id`) nunca recebem dados em `user_indicator_daily`, então não aparecem em Desempenho nem Ranking.

Além disso, as metas são carregadas sem diferenciar `worker_type` -- a function pega a primeira meta que encontra, ignorando se é de motorista ou ajudante.

### O que será feito

#### 1. Edge Function: processar ajudantes
Alterar o loop principal para, além do motorista, processar `aju1_user_id` e `aju2_user_id`. Para ajudantes, calcular apenas os indicadores que se aplicam a eles: **TML, TR, TI, JL** (conforme `applies_to_worker_type` no banco).

TX_DEVOLUCAO e DISP_TEMPO continuam apenas para motoristas.

#### 2. Edge Function: metas por worker_type
Carregar metas do banco diferenciando por `worker_type`. A function buscará `worker_type` de cada usuário e usará a meta correspondente (motorista ou ajudante). Se não encontrar meta específica, usa a meta geral (sem worker_type). Se nenhuma existir, usa o default.

#### 3. Redeploy da edge function
Após as alterações, a function será redeployada.

### Páginas afetadas automaticamente
- **Desempenho** e **Ranking** já leem de `user_indicator_daily` -- dados de ajudantes aparecerão automaticamente após recalcular.
- **Home do colaborador**, **MiniRanking**, etc. -- idem.

### Arquivos modificados
- `supabase/functions/calculate-daily-indicators/index.ts`

### Detalhes técnicos

```text
Fluxo atual:
  mapa_historico → mot_user_id → [TML,TR,TI,JL,TX_DEV,DISP] → user_indicator_daily

Fluxo novo:
  mapa_historico → mot_user_id  → [TML,TR,TI,JL,TX_DEV,DISP] → user_indicator_daily
                 → aju1_user_id → [TML,TR,TI,JL]              → user_indicator_daily
                 → aju2_user_id → [TML,TR,TI,JL]              → user_indicator_daily
```

Metas: `Map<indicatorCode, Map<workerType|'default', number>>` para suportar valores diferentes por tipo.

