---
name: Indicators & Status
description: Traffic light logic, strictly binary compliance, no averages, periodicidade flag for monthly vs daily
type: feature
---

## Status
- Strictly binary: Atingiu / Não Atingiu. NUNCA exibir percentuais médios ou agregados intermediários.
- Status traffic light: `dentro_meta` / `acima_meta` = verde (Atingiu); `abaixo_meta` = vermelho (Não Atingiu).
- Para indicadores mensais o importer também grava `status='atingiu'|'nao_atingiu'` — UI deve aceitar ambos os formatos.

## Periodicidade
- Coluna `indicators.periodicidade`: `'diario'` (default, vinculado a mapa) | `'mensal'` (não vinculado a mapa, ex: RATING).
- Indicadores mensais NÃO entram no agrupamento por mapa. Devem ser renderizados pela `<MonthlyIndicatorsSection>` acima da listagem de mapas.
- Helper: `splitByPeriodicidade(rows)` em `src/lib/indicatorPeriodicity.ts` separa diários (para o agrupamento por mapa) e mensais (para a seção dedicada).
- Telas afetadas: `/admin/desempenho`, `/admin/colaboradores` (drawer), `/colaborador/home`. Em `/colaborador/incentivo` o bônus mensal já é exibido pelo card "Bônus Mensal" existente.
- Override de meta/status do front (lógica "menor é melhor") NÃO se aplica a indicadores mensais — Rating é "maior é melhor" e o status correto vem do importer.
