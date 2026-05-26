## Objetivo
No Rating, linhas com mesma chave (mês + tipo + unidade + matrícula) **não são duplicatas** — são **atualizações** dos valores existentes. O preview precisa refletir isso, sem afetar os outros importadores (031805, 031134, PDV, Relatos) onde "duplicado" ainda significa "ignorado".

## Mudanças

### 1. `src/components/admin/ImportPreviewTable.tsx`
Tornar a semântica de "duplicado" configurável por prop, sem quebrar os outros importadores:

- Adicionar prop opcional:
  ```ts
  duplicateMode?: 'ignore' | 'update'  // default: 'ignore'
  ```
- Quando `duplicateMode === 'update'`:
  - **Badge** (chip de filtro e chip da linha): trocar label `Duplicado` → `Atualização`, trocar ícone `Copy` → `RefreshCw` (lucide), manter cor warning (amarelo) para destacar que algo será modificado. Continuar contando como "X atualizações" no contador.
  - **Aviso no rodapé**: trocar `Linhas duplicadas serão ignoradas na importação.` por `Linhas existentes terão seus valores atualizados (sobrescritos).`
- Quando `duplicateMode === 'ignore'` (default): comportamento atual intacto.

### 2. `src/components/admin/ImportRating.tsx`
Passar `duplicateMode="update"` ao renderizar `<ImportPreviewTable />`. Nenhuma outra mudança de lógica (RPC, snapshot, índice único permanecem como estão).

### 3. Demais importadores
Nenhuma mudança — continuam usando o default `'ignore'`.

## Detalhes técnicos
- O mapa `STATUS_BADGE` continua com chave `duplicado` internamente (status type não muda). A renderização do label/ícone passa a depender de `duplicateMode`. Alternativa mais limpa: extrair `STATUS_BADGE` para uma função `getStatusBadge(status, duplicateMode)` que devolve `{ label, icon, className }`.
- O `title` (tooltip) da linha continua mostrando o `reason` vindo do ImportRating (que já diz "Será sobrescrito (mesmo mês/tipo/unidade)").
- Sem mudança de schema, sem mudança de tipos do Supabase.

## Fora de escopo
- Renomear o `RowStatus` literal de `'duplicado'` para outro nome (alto custo, baixo benefício — é interno).
- Mudar texto do toast final ("Y atualizadas" em vez de "Y sobrescritas") — pode ser feito junto se quiser, me avise.