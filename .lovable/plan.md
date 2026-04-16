

## Problem

In `useRanking.ts`, `bonusPotencial` and `bonusGanho` are accumulated per daily record (per map). If a user has 20 maps in a month and the bonus is R$50, the ranking shows R$1,000 instead of R$50. The fix must match the Dashboard logic: aggregate all records by user+indicator for the month, then award the bonus once per indicator if the monthly aggregate meets the goal.

## Plan

### 1. Refactor bonus calculation in `useRanking.ts`

**After** building the `byIndicator` map (which already aggregates values per user per indicator), compute bonuses in a second pass:

- For each user, iterate over their `byIndicator` entries
- Calculate monthly aggregate: **sum** for `TX_REPOSICAO`, **average** for all others
- Look up the goal's `valor_meta`, `valor_desafio`, `valor_bonificacao`, `valor_bonificacao_desafio` from the goals query
- Award `bonusPotencial` = sum of all `valor_bonificacao` (+ `valor_bonificacao_desafio` where applicable) across indicators that have a bonus configured
- Award `bonusGanho` only if the monthly aggregate <= meta (and challenge bonus if <= desafio)

**Changes needed:**
- Expand the goals query to also fetch `valor_meta`, `valor_desafio`, `valor_bonificacao_desafio` and indicator `codigo`
- Remove the per-row bonus accumulation (lines 119-121)
- Add a second loop after the data grouping that calculates bonus from aggregated indicator data
- Use the same `SUM_CODES = ['TX_REPOSICAO']` pattern as Dashboard

### 2. Also fix `onTarget` status recalculation

Currently `onTarget` uses the snapshot `status` from daily records. To stay consistent with the "goals table is source of truth" rule, recalculate status from aggregated values using current goal targets — same as Dashboard does.

**Technical details:**
- `bonusPotencial`: sum of `valor_bonificacao` (+ `valor_bonificacao_desafio`) for all indicators that have a bonus, counted once per indicator per user
- `bonusGanho`: same but only where monthly aggregate meets the target
- Aggregation: group records by `(user_id, indicator_id)`, compute sum of `valor` and count, then derive aggregate

### Files to modify
- `src/hooks/useRanking.ts` — refactor bonus logic

