# Corrigir duplicidade no importador PDV Crítico

## Causa do erro

O toast "duplicate key value violates unique constraint `pdv_critico_feedbacks_uniq`" acontece porque o **banco rejeita** uma linha que o front considerou "nova". Há dois bugs no `classify` de `src/components/admin/ImportPDVCritico.tsx`:

### Bug 1 — limite de 1000 registros na pré-checagem
A query que carrega chaves existentes (linha 345) usa só `.eq('ano').in('mes_num', ...)` sem paginação. O Supabase corta em 1000 linhas por padrão. Quando o mês já tem mais de 1000 feedbacks no banco, parte das chaves não é carregada → o front marca como "novo" → o índice único `pdv_critico_feedbacks_uniq` rejeita no insert. É exatamente o mesmo problema que corrigimos no importador de Relatos.

### Bug 2 — chave do front diferente da chave do índice único
O índice único usa `md5(COALESCE(comentario, ''))` (comentário **inteiro**). O código usa `(comentario || '').slice(0, 60)`. Dois registros com mesmos primeiros 60 chars mas comentário completo diferente podem bater como "duplicado" no front e serem aceitos no banco — ou o contrário. Precisamos alinhar a chave de comparação à do índice (comentário inteiro).

## Mudanças

**Arquivo: `src/components/admin/ImportPDVCritico.tsx`**

1. Em `classify(parsed, anoRef)`:
   - Substituir a query única por um loop manual paginado (`.range(from, from+999)`) até a página retornar menos de 1000 registros, igual ao padrão já usado em `ImportRelatos.tsx` e definido na memória de paginação.
   - Filtrar por `ano = anoRef` e `mes_num IN (mesesNum)`.
   - Selecionar `cpf, mes_num, ano, semana, codigo_cliente, comentario, data_analise, tmr`.

2. Trocar `(comentario || '').slice(0, 60)` por `(comentario || '')` em **ambos** os pontos onde a chave é montada (existingKeys e seen) para bater 1:1 com o índice único.

3. Atualizar o texto de ajuda (linha ~554) removendo a menção a "primeiros 60 chars" — apenas dizer "mesmo comentário".

## Detalhes técnicos

Pseudo-código da paginação:

```text
const PAGE = 1000
let from = 0
while true:
  data = supabase.from('pdv_critico_feedbacks')
    .select('cpf,mes_num,ano,semana,codigo_cliente,comentario,data_analise,tmr')
    .eq('ano', anoRef).in('mes_num', mesesNum)
    .range(from, from + PAGE - 1)
  data.forEach(addToExistingKeys)
  if data.length < PAGE: break
  from += PAGE
```

Não é necessário chunkar por `IN` aqui (mesesNum tem no máximo 12 valores).

## Fora de escopo

- Sem migrações de banco. O índice único está correto e é exatamente a fonte de verdade.
- Outros importadores (031805, 031134, rating) não têm índice único equivalente, então não sofrem desse erro específico — não mexer neles agora.