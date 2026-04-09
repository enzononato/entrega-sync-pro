

## Plan: Replace Percentages with Binary Status + Real Values

### Problem
The current system calculates `percentual_atingimento = (valor / meta) * 100` for all indicators. But TML, TR, TI, and JL are **binary** metrics — you either hit the goal or you don't. Showing "70%" is misleading.

### New Logic
- **TML**: Saída CDD between 07:50 and 08:20 → "Atingiu". Outside → "Não Atingiu". Store the actual departure time as `valor`.
- **TR**: valor ≤ 560 min → "Atingiu". Otherwise → "Não Atingiu".
- **TI**: valor ≤ 30 min → "Atingiu". Otherwise → "Não Atingiu".
- **JL**: valor ≤ 620 min → "Atingiu". Otherwise → "Não Atingiu".
- **percentual_atingimento**: Set to `100` (atingiu) or `0` (não atingiu) — binary, no proportional calculation.

### Changes

**1. Edge Function `calculate-daily-indicators/index.ts`**
- Change `addResult` to set `percentual_atingimento` to `100` or `0` (binary)
- Status remains `dentro_meta` or `abaixo_meta`

**2. Desempenho page (`src/pages/admin/Desempenho.tsx`)**
- Replace percentage displays with binary badges: green "Atingiu" / red "Não Atingiu"
- Keep showing the real value in HH:MM format (already done)
- Remove percentage-based progress bars for these indicators
- Update summary KPIs: instead of "avg atingimento %", show count of "X de Y metas atingidas"

**3. Ranking page (`src/pages/admin/Ranking.tsx`)**
- The ranking currently averages percentual_atingimento. With binary values (0 or 100), the average becomes "% of goals met" which is meaningful (e.g., "75%" = hit 3 of 4 goals)
- Update display to show "X/Y metas atingidas" alongside the percentage
- Keep HH:MM values as already implemented

**4. Collaborator pages**
- `src/pages/colaborador/Home.tsx` — update to show binary badge + real value
- `src/pages/colaborador/Indicadores.tsx` — same treatment
- `src/components/colaborador/EvolutionCharts.tsx` — evolution chart will show % of goals met per day (works with binary 0/100 values)
- `src/components/colaborador/MandatoryFeedbackModal.tsx` — adjust threshold check

**5. Incentivo page (`src/pages/colaborador/Incentivo.tsx`)**
- Update display to use binary status instead of percentage

**6. Dashboard (`src/pages/admin/Dashboard.tsx`)**
- Update any percentage-based KPIs to use binary approach

### Files Modified
- `supabase/functions/calculate-daily-indicators/index.ts`
- `src/pages/admin/Desempenho.tsx`
- `src/pages/admin/Ranking.tsx`
- `src/pages/admin/Dashboard.tsx`
- `src/pages/colaborador/Home.tsx`
- `src/pages/colaborador/Indicadores.tsx`
- `src/pages/colaborador/Incentivo.tsx`
- `src/components/colaborador/EvolutionCharts.tsx`
- `src/components/colaborador/MandatoryFeedbackModal.tsx`

### Important
After deploying the edge function update, existing data in `user_indicator_daily` will still have old percentages. A recalculation will be needed (using the existing "Recalcular Indicadores" button) to update all records with the new binary values.

