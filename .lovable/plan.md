

## Diagnóstico Atualizado

O TX_REPOSICAO pertence ao mapa específico e **não deve ser mesclado**. O problema é que mapas com apenas TX_REPOSICAO aparecem como accordions separados sem os demais indicadores, criando confusão visual.

A solução correta é: **manter esses mapas visíveis, mas preencher os indicadores faltantes com placeholders zerados** — exatamente como já é feito para os mapas regulares. A linha 103 atualmente **pula** esses grupos, o que os deixa sem placeholders e visualmente incompletos.

## Plano de Correção

### Arquivo: `src/pages/admin/Desempenho.tsx`

**Duas mudanças:**

1. **Remover a linha 103** (`if (rows.every(...TX_REPOSICAO)) continue;`) — para que mapas com apenas TX_REPOSICAO também recebam placeholders dos indicadores faltantes (TML, TR, TI, etc.), ficando visualmente completos como qualquer outro mapa.

2. **Remover o bloco de merge das linhas 132-162** — a lógica de mesclagem de "mapas fantasma" será totalmente eliminada, já que cada mapa é individual e legítimo.

**Resultado**: Todo mapa que aparece na tela terá a lista completa de indicadores (com valor zero quando não houver dado), incluindo aqueles que originalmente só tinham TX_REPOSICAO.

