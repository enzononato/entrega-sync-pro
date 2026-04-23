

## Por que o "Bônus Estimado" demora a atualizar

A demora não é bug aleatório — tem 3 causas concretas, e duas delas são facilmente corrigíveis.

### O que acontece hoje quando a página abre

1. O Dashboard chama `useDesempenhoDiario(mesInicio, mesFim)` para o mês inteiro.
2. Esse hook faz `select('*, users(...), indicators(...)') from user_indicator_daily` paginado de 1.000 em 1.000 linhas.
3. Para abril/2026 são **6.159 linhas** (foram reprocessadas agora). Cada linha traz JOIN com `users` e `indicators` — payload de vários MB.
4. Só depois que TODAS as páginas chegam o `useMemo` do `bonusMesData` roda e o card atualiza.
5. Em paralelo, `useCaixasBatidasAdminMes` faz outra varredura grande. O card só fica "certo" quando os dois terminam.

Resultado: dependendo da rede dá **3 a 10 segundos** de "valor antigo na tela" até virar o número correto.

### As 3 causas

**Causa 1 — Cálculo pesado feito no cliente.** O front baixa 6k+ linhas só para somar bônus por colaborador. A edge function `calculate-monthly-bonus` já faz exatamente esse cálculo no servidor e grava em `user_incentives_daily`, mas o Dashboard ignora esse resultado e refaz tudo do zero no navegador.

**Causa 2 — Sem cache entre navegações.** O `useQuery` do `useDesempenhoDiario` não tem `staleTime`. Cada vez que você sai e volta para o Dashboard ele refaz a query gigante, mesmo que os dados não tenham mudado.

**Causa 3 — Sem placeholder enquanto carrega.** O card mostra `R$ 0,00` (ou o valor do render anterior) até o cálculo terminar, sem indicação de "atualizando". Dá a sensação de que o número está errado.

### Plano de correção

**A. Ler bônus pré-calculado em vez de recalcular no front (ganho principal)**

Trocar a fonte do `bonusMes` no Dashboard por uma query simples em `user_incentives_daily` filtrando `data_referencia = primeiro dia do mês` e `detalhes_json->>'tipo' = 'bonus_mensal'`:

```ts
const { data: bonusMensalRows } = useQuery({
  queryKey: ['bonus-mensal', mesInicio],
  queryFn: () => supabase
    .from('user_incentives_daily')
    .select('user_id, valor_estimado, detalhes_json')
    .eq('data_referencia', mesInicio),
  staleTime: 60_000,
});
```

Soma direta de `valor_estimado` = total de bônus por meta. O `breakdown` (por indicador) sai de `detalhes_json.indicadores` que a edge function já grava. Custo: ~100 linhas em vez de 6k+.

O `useMemo` antigo continua existindo como fallback se `user_incentives_daily` estiver vazio (primeira execução do mês), mas em uso normal nem dispara.

**B. Disparar `calculate-monthly-bonus` automaticamente quando ficar desatualizado**

Adicionar um `useEffect` que, ao montar o Dashboard, verifica se o registro mais recente em `user_incentives_daily` para o mês é mais antigo que X minutos (ex.: 15min) e, se for, chama a edge function em background. Assim o valor vai estar fresco sem o usuário precisar esperar reprocessamento manual.

**C. Cache + indicador visual**

- Adicionar `staleTime: 5 * 60_000` nas queries do Dashboard (`useDesempenhoDiario` do mês, `useCaixasBatidasAdminMes`, nova query de bônus mensal). Re-entrar na página vira instantâneo.
- Mostrar um pequeno spinner ou esqueleto no card "Bônus Estimado" enquanto `isFetching` for true, para o usuário entender que está atualizando.

### Resultado esperado

| Antes | Depois |
|---|---|
| 3–10s baixando 6k linhas, cálculo no cliente | <500ms lendo ~100 linhas pré-agregadas |
| Re-entrar refaz tudo | Re-entrar usa cache (5min) |
| Sem feedback visual | Spinner discreto enquanto atualiza |
| Recalcular = botão manual em /admin/importacoes | Reprocessamento automático em background quando dado fica velho |

### Arquivos alterados

- `src/pages/admin/Dashboard.tsx` — nova query `bonus-mensal`, `useMemo` lê `user_incentives_daily.detalhes_json` em vez de recalcular, `staleTime` nas queries do mês, indicador visual de carregamento, `useEffect` de auto-refresh
- `src/hooks/useDesempenho.ts` — `staleTime` padrão (defesa)

Sem mudanças em banco, sem alteração nas edge functions, sem novos componentes.

