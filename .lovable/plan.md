

## Tornar o indicador Refugo um cidadão de primeira classe

O dado de Refugo já está sendo gravado em `user_indicator_daily` com `mapa_numero` para os ajudantes corretos (verifiquei no banco: 88 registros, 45 ajudantes). Tecnicamente ele já aparece no dashboard do ajudante, mas falta tratá-lo como os demais indicadores em vários pontos do sistema. Os ajustes abaixo garantem visibilidade, ordenação correta, contabilização no bônus e exibição correta da unidade.

### O que será alterado

**1. `src/lib/indicatorOrder.ts`** — adicionar `REFUGO` à ordem canônica dos indicadores (ao final da lista, depois de `TX_REPOSICAO`), para que apareça em uma posição estável e previsível, e não jogado ao fim alfabeticamente.

**2. `src/pages/admin/Desempenho.tsx`** — incluir `REFUGO` em `MAPA_INDICATORS_AJU` (linha 101). Hoje só `['TML','TR','TI','JL','TX_DEVOLUCAO']` são esperados para ajudante, então quando o admin abre o desempenho de um ajudante e o mapa não tem refugo, nem aparece placeholder. Após a mudança, o admin vai ver o Refugo listado em cada mapa do ajudante (com valor real ou zero quando ausente).

**3. `src/pages/admin/Dashboard.tsx`** — adicionar `REFUGO: 'f5ded347-5b60-4b87-a2bb-d4d79d4f8e2a'` ao mapa `INDICATOR_IDS` (linhas 42-50). Hoje, mesmo com `valor_bonificacao` configurado para Refugo, o card "Bônus Estimado" do mês não inclui esse indicador no cálculo porque a lógica filtra por `goalIndicatorIds` que vem das metas, mas o `findGoal` precisa estar alinhado. Na prática a constante já não bloqueia (o cálculo itera sobre `goalIndicatorIds` derivado das metas), mas adicionar a constante deixa o código consistente e documentado. (Refugo entra automaticamente no bônus quando a goal tiver `valor_bonificacao > 0`, tratado como indicador de média de médias diárias — não é SUM.)

**4. `supabase/functions/calculate-monthly-bonus/index.ts`** — adicionar `REFUGO: 'f5ded347-...'` ao `INDICATOR_IDS` (linhas 11-18). Mesma justificativa: garante que o cálculo persistido em `user_incentives_daily` reconheça Refugo. Refugo NÃO entra em `SUM_INDICATORS` — ele agrega como média de médias diárias (cada mapa daquele dia → média do dia → média entre dias), exatamente como TML/TR/TI/JL/TX_DEVOLUCAO.

**5. `src/pages/colaborador/Incentivo.tsx`** — a linha 295/302 atualmente faz `m.indicators?.codigo === 'TX_REPOSICAO' ? '' : '%'`. Refugo é `%`, então já cai no caminho correto. **Sem alteração.**

**6. `src/pages/colaborador/Home.tsx`** — o filtro nas linhas 167-169 já permite Refugo para ajudantes (`'refugo'` não contém `'repos'`). Vou apenas reforçar a checagem usando código exato (`code === 'TX_REPOSICAO'` para esconder de ajudantes; `code === 'REFUGO'` para esconder de motoristas) em vez de `String.includes`, que é frágil. Comportamento final idêntico, código mais robusto.

### Como Refugo será tratado (resumo final)

| Aspecto | Comportamento |
|---|---|
| Quem vê | Só ajudantes (motoristas filtrados) |
| Onde aparece | KPIs por Mapa do ajudante, agrupado pelo número do mapa |
| Status | Binário: `dentro_meta` se ≤ 0,50%; `abaixo_meta` se > 0,50% |
| Desafio | Não tem (sempre `null`) |
| Bônus mensal | Agrega como média de médias diárias do mês; paga `valor_bonificacao` da goal se aggregate ≤ 0,50% |
| Reportar causa raiz | Botão "Reportar" disponível quando `abaixo_meta`, igual aos outros |
| Ranking | Já entra automaticamente via `useRanking` (genérico, não hardcoded por código) |
| Ordem na lista | Após TX_REPOSICAO, no final da sequência canônica |

### Arquivos alterados

- `src/lib/indicatorOrder.ts`
- `src/pages/admin/Desempenho.tsx`
- `src/pages/admin/Dashboard.tsx`
- `src/pages/colaborador/Home.tsx`
- `supabase/functions/calculate-monthly-bonus/index.ts`

Sem mudanças em banco, sem mudanças em outras edge functions, sem novos componentes.

