

## Problem

The CSV header uses accented characters (`KmLaço`, `TmpoLaço`) while `ImportMapasDialog.tsx` defines the CSV_COLUMNS as `KmLaco` and `TmpoLaco`. The case-insensitive comparison still fails because `ç` ≠ `c`. This causes two columns to be silently skipped.

## Solution

Normalize the header matching to handle accented characters by stripping diacritics before comparing. This is a small, targeted fix.

### File: `src/components/admin/ImportMapasDialog.tsx`

Add a helper function that strips accents (using `String.normalize('NFD')` + regex to remove combining marks), then use it when comparing CSV headers to `CSV_COLUMNS`.

```typescript
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
```

Change the header matching (line 86) from:
```typescript
const csvIdx = CSV_COLUMNS.findIndex(c => c.toLowerCase() === h.toLowerCase());
```
to:
```typescript
const csvIdx = CSV_COLUMNS.findIndex(c => stripAccents(c.toLowerCase()) === stripAccents(h.toLowerCase()));
```

This ensures `KmLaço` matches `KmLaco`, `TmpoLaço` matches `TmpoLaco`, and any future accent variations are handled automatically. No other files need changes.

