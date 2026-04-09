

## Plan: Show Raw Values + Percentages in Ranking

Currently the Ranking page only shows percentages (e.g., `70.5%`). The user wants to also see the actual numeric values (e.g., `00:21 / 00:30` for time-based indicators like TML, TR, TI, JL).

### Problem

The `useRanking` hook only computes `avg_pct` (average percentage) per indicator. It does not carry the raw `valor` or `meta` values needed to display HH:MM figures.

### Changes

**1. Update `useRanking.ts` hook**
- Add `avg_valor` and `avg_meta` fields to the `IndicatorBreakdown` interface
- In the grouping logic, also accumulate `valor` and `meta` from each `user_indicator_daily` row
- Compute averages for both fields alongside the existing percentage average

**2. Update `Ranking.tsx` — Podium cards (top 3)**
- Below the percentage, show a compact list of each indicator with its value/meta in HH:MM format (for time indicators) or plain number

**3. Update `Ranking.tsx` — List items (4th–10th)**
- In the mini indicator breakdown (visible on `lg` screens), add the HH:MM value below the percentage

**4. Update `Ranking.tsx` — Detail Dialog**
- Next to each indicator's percentage and progress bar, show the raw value vs meta (e.g., `00:21 / 00:30`)
- Use `formatMinutesHHMM` from `src/lib/formatters.ts` for time-based indicators (TML, TR, TI, JL)

### Files Modified
- `src/hooks/useRanking.ts` — add `avg_valor` and `avg_meta` to breakdown
- `src/pages/admin/Ranking.tsx` — display raw values alongside percentages

