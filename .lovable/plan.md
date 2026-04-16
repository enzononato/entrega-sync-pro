

# Corrigir cálculo mensal: média dos dias (não dos mapas)

## Problema
A Edge Function `calculate-monthly-bonus` calcula `sum / count` de todos os registros do mês, tratando cada mapa como um ponto. O correto é:
- **TX_DEVOLUCAO e DISP_TEMPO**: Agrupar por dia → média do dia → depois média das médias diárias
- **TX_REPOSICAO**: Soma total (já está correto)

## Mudança

### 1. Corrigir `calculate-monthly-bonus/index.ts`
Alterar a lógica de agregação para TX_DEVOLUCAO e DISP_TEMPO:
- Primeiro agrupar por `user_id + indicator_id + data_referencia` (dia)
- Calcular a média de cada dia
- Depois calcular a média das médias diárias

Estrutura do mapa de agregação:
```
Map<"userId|indicatorId", Map<"data_referencia", { sum, count }>>
```

Para TX_DEVOLUCAO/DISP_TEMPO: média das médias diárias
Para TX_REPOSICAO: soma total (sem mudança)

### 2. Atualizar memória
Registrar a regra de agregação correta no memory file `monthly-bonus`.

## Escopo
- 1 arquivo: `supabase/functions/calculate-monthly-bonus/index.ts`
- 1 memory update

