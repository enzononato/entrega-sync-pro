

# Plan: Metas Mensais com Bonificação (TX_DEVOLUCAO, DISP_TEMPO, TX_REPOSICAO)

## Context

Three indicators have **monthly** goals: TX_DEVOLUCAO, DISP_TEMPO, TX_REPOSICAO. If a worker meets the monthly target, they receive a bonus (R$). The bonus values differ per indicator and per worker type (Motorista/Ajudante). Currently, DISP_TEMPO goals are set as `diario` -- they need to be `mensal`.

## What Changes

### 1. Fix DISP_TEMPO goal period (Database)
- Update the two DISP_TEMPO goal records from `periodo_tipo = 'diario'` to `periodo_tipo = 'mensal'` so they align with the other monthly indicators.

### 2. Create monthly bonus calculation Edge Function
- New function `calculate-monthly-bonus` that:
  - For each user, for a given month, aggregates `user_indicator_daily` data for TX_DEVOLUCAO, DISP_TEMPO, TX_REPOSICAO
  - **TX_DEVOLUCAO**: Monthly average deviation rate must be <= meta (5%)
  - **DISP_TEMPO**: Monthly average dispersion % must be <= meta (15%)
  - **TX_REPOSICAO**: Monthly total reposition value must be <= meta (49.80)
  - Looks up `goals` table for the `valor_bonificacao` per indicator/worker_type
  - Upserts results into `user_incentives_daily` (or a new `user_incentives_monthly` table) with the bonus breakdown

### 3. Add monthly bonus summary to admin UI
- On the **Desempenho** or **Incentivo** page, show monthly aggregation for these 3 indicators per worker
- Display whether each monthly goal was met and the corresponding bonus earned

### 4. Worker portal visibility
- On the worker's **Incentivo** page, show the 3 monthly goals with current month progress and potential bonus value

## Technical Details

- The Edge Function will be callable manually or via cron at month-end
- Monthly aggregation logic:
  - **TX_DEVOLUCAO**: `AVG(valor)` across all daily records in the month <= meta
  - **DISP_TEMPO**: `AVG(valor)` across all daily records in the month <= meta  
  - **TX_REPOSICAO**: Already calculated monthly by `calculate-reposicao` -- just check the monthly total <= meta
- Bonus values come from `goals.valor_bonificacao` for the matching indicator + worker_type
- The user will set the R$ values via the existing Metas UI (which already has the bonificacao field)

## Steps

1. Update DISP_TEMPO goals to `periodo_tipo = 'mensal'`
2. Create `calculate-monthly-bonus` Edge Function  
3. Add a "Calcular Bônus Mensal" button on admin Desempenho or Incentivo page
4. Show monthly bonus results on worker Incentivo page
5. Update memory with monthly bonus rules

