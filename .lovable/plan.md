## Objetivo
Mudar o comportamento da importação de Rating: linhas duplicadas (mesmo mês + tipo + unidade + matrícula) passam a **sobrescrever** o registro existente em vez de serem ignoradas.

## Mudanças em `src/components/admin/ImportRating.tsx`

### 1. Classificação dos duplicados
- Manter o status `'duplicado'`, mas tratá-lo como **"será substituído"**.
- Atualizar a `reason` para "Será sobrescrito (mesmo mês/tipo/unidade)".
- Repetidos dentro da mesma planilha continuam inválidos para evitar conflito interno.

### 2. `handleImport` — incluir duplicados na importação
- `toInsert` passa a incluir tanto `'novo'` quanto `'duplicado'`.
- Antes do `insert`, executar um `DELETE` na `rating_avaliacoes` filtrando por `data_referencia_inicio = inicio`, `worker_type`, `unidade` e `matricula IN (lista das matrículas duplicadas)` — feito em chunks de 300 para não estourar a URL.
- Em seguida, fazer o `insert` normal de todas as linhas (novas + sobrescritas).
- Botão "Confirmar" passa a habilitar quando há `novo` **ou** `duplicado`.

### 3. Metadados do lote
- `linhas_inseridas` = novos + sobrescritos.
- Adicionar campo `linhas_sobrescritas` no `metadata.json` do `import_batches` para rastreabilidade (a coluna `linhas_duplicadas` da tabela passa a ser 0, já que nada mais é ignorado por duplicidade).
- Toast final: "X importadas (Y novas, Z sobrescritas)".

### 4. UI do diálogo
- Trocar o aviso amarelo de "serão ignoradas" para algo como:
  > Linhas já existentes para o mesmo **mês + tipo + unidade** serão **sobrescritas** com os novos valores.
- Na `ImportPreviewTable`, o badge "duplicado" passa a significar "será substituído". (Se quiser texto diferente no badge, posso fazer depois — por ora mantemos.)

### 5. Atualização do indicador mensal
- O bloco que faz `upsert` em `user_indicator_daily` (com `onConflict: user_id,indicator_id,data_referencia`) **já sobrescreve** corretamente. Apenas precisa receber também as linhas sobrescritas — o que acontece naturalmente quando elas passam a integrar `enriched`.

## Impacto / efeitos colaterais
- O fluxo "Desfazer" do histórico continua funcionando para o lote novo, mas **não restaura** os valores antigos sobrescritos (eles foram apagados). Vou deixar isso explícito no aviso amarelo.
- Nenhuma mudança de schema; apenas lógica do componente.