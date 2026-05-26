## Objetivo
Corrigir os 4 bugs reais + 2 pontos de atenção encontrados no fluxo de importação de Rating.

## Mudanças

### 1. Paginação manual nos 3 selects (`src/components/admin/ImportRating.tsx` + `src/hooks/useImportBatches.ts`)
Criar/usar loop `.range(from, from+999)` até esgotar.

**a) `ImportRating.tsx` (fetch matrícula→user_id em `handleImport`)**
Substituir o `.in('matricula', matriculas)` único por: dividir `matriculas` em chunks de 500 e, para cada chunk, paginar `.range()` até esgotar. Acumular num map.

**b) `useImportBatches.ts` (fetch `ratingUserIds` antes do delete)**
Paginar `.eq('import_batch_id', batch.id).not('user_id','is',null)` em loops de 1000.

**c) `useImportBatches.ts` (fetch `restored` no undo)**
Paginar `.eq('data_referencia_inicio', inicio).in('user_id', userIds)` em chunks de 500 user_ids × range de 1000.

### 2. Filtros faltantes no fetch `restored` (`useImportBatches.ts`)
Extrair `worker_type` e `unidade` de `batch.metadata` e adicionar:
```ts
.eq('worker_type', batch.metadata.worker_type)
.eq('unidade', batch.metadata.unidade)
```
Evita recalcular com o registro de outro tipo/unidade.

### 3. Race condition no `classify` (`ImportRating.tsx`)
Adicionar token/cancelamento no `useEffect`:
```ts
useEffect(() => {
  let cancelled = false;
  if (rows.length) classify(rows, () => cancelled);
  return () => { cancelled = true; };
}, [mesReferencia, unidade, workerType]);
```
Em `classify`, antes do `setClassifications`, checar `if (isCancelled()) return;`. Garante que apenas a última chamada atualiza o estado.

### 4. Bloquear "Confirmar" durante classify async (`ImportRating.tsx`)
- Adicionar estado `classifying: boolean`.
- `setClassifying(true)` ao entrar em `classify`, `setClassifying(false)` ao sair (com try/finally).
- `disabled` do botão: `... || classifying`.
- Pequeno texto "Verificando duplicidades..." quando `classifying`.

### 5. Preservar campos extras do `metadata` no update incremental (`ImportRating.tsx`)
Antes de salvar o snapshot incremental, fazer `select('metadata').eq('id', batchId).single()` e mesclar:
```ts
const merged = { ...(existing?.metadata ?? {}), ...baseMetadata, snapshot: snapshotTotal };
```
Isso evita perder qualquer chave adicionada em outro lugar.

### 6. Aviso de importação parcial entre chunks (`ImportRating.tsx`)
Envolver o loop de chunks em try/catch que, em caso de falha no chunk N>1:
- Toast: `Importação parcial: X de Y lotes aplicados. Use "Desfazer" para reverter os já aplicados.`
- Continua marcando o batch como `failed` com `error_message` indicando o chunk que falhou.

## Detalhes técnicos
- Nenhuma mudança de schema, nenhuma RPC nova.
- `users` select com paginação em chunks de 500 matrículas evita estourar URL e o limite de 1000.
- Manter `try/catch` que apenas avisa (não bloqueia o `handleImport` principal) onde já é assim hoje.

## Fora de escopo
- Reescrever `replace_rating_month` para receber tudo numa única transação (resolveria #6 de vez, mas é mudança de RPC e exige tratamento de payload jsonb grande). Pode ser tarefa separada.