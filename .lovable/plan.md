

## Plan: Ranking Baseado em Contagem de Metas (Sem Porcentagem)

### Problema
O ranking ainda exibe e ordena por `avg_atingimento` (média de percentuais). Com metas binárias, mostrar porcentagem é confuso -- se alguém "passou" do limite (ex: TR = 10:00 quando a meta é 09:20), não atingiu, mas o valor bruto é alto.

### Mudanças

**1. `src/hooks/useRanking.ts`**
- Ordenar o ranking por `on_target_count / total_indicators` (taxa de sucesso) em vez de `avg_atingimento`
- Remover o campo `avg_atingimento` ou mantê-lo internamente mas sem exibir

**2. `src/pages/admin/Ranking.tsx`**
- Remover todas as exibições de porcentagem (`avg_atingimento.toFixed(0)%`)
- Pódio e lista: mostrar apenas `X/Y metas atingidas`
- Cards de resumo: trocar "% Metas Atingidas" por contagem total de metas batidas vs total
- Remover `getPerformanceColor(pct)` baseada em porcentagem; usar cores baseadas na razão (ex: 4/4 = verde, 2/4 = amarelo, 0/4 = vermelho)
- Dialog de detalhe: remover referências a porcentagem
- Seção "Desempenho por Unidade": mostrar média de metas atingidas por colaborador em vez de porcentagem

### Arquivos Modificados
- `src/hooks/useRanking.ts`
- `src/pages/admin/Ranking.tsx`

