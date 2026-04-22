

## Mudanças no Dashboard Administrativo

### 1. Remover o card "Incentivo Período"
No grid de KPIs principais (`src/pages/admin/Dashboard.tsx`, linhas ~405–410), removo o card que exibia `incentivoTotal` (soma de `user_incentives_daily.valor_estimado` do dia atual). Também removo os hooks/variáveis que ficam órfãos:
- `useIncentivoDiarioAdmin` (import e chamada)
- `incentivos`, `filteredIncentivos`, `incentivoTotal`

### 2. Renomear e ajustar a área "Bônus Mês" para refletir o estimado do mês atual

Hoje o `bonusMes` (linhas 69–114) já calcula a estimativa dos bônus do **mês corrente** agregando `desempenhoMes` (do dia 01 ao último dia do mês) contra as metas ativas com `valor_bonificacao > 0`. Ele já é exatamente "o quanto está estimado para o mês atual".

Ajustes para deixar isso claro ao usuário:
- Trocar o label do `HeroStat` de **"Bônus Mês"** para **"Bônus Estimado · {mês atual}"** (ex: "Bônus Estimado · Abril").
- Adicionar um `sub` ao `HeroStat` indicando "Acumulado do mês até hoje" para evidenciar que é uma projeção em tempo real, não um valor fechado.
- Garantir que o cálculo **não dependa dos filtros de unidade/perfil** do topo (hoje `desempenhoMes` herda os filtros via `useDesempenhoDiario`). Para representar fielmente "o estimado do mês", o cálculo deve sempre considerar todos os colaboradores ativos — vou remover os filtros do hook que alimenta `desempenhoMes` (passando sem `unidade_id` / `worker_type`), mantendo os filtros apenas para os outros widgets do dashboard.

### 3. Reorganizar o grid de KPIs
Após remover "Incentivo Período", o grid de KPIs (atualmente 4 colunas) é re-balanceado para 3 cards principais, mantendo o layout responsivo (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).

### Detalhes técnicos
- Arquivo único alterado: `src/pages/admin/Dashboard.tsx`
- Nenhuma mudança de banco, edge function ou tipos.
- Lógica de `bonusMes` permanece (aggregate por usuário+indicador, média para indicadores normais, soma para `TX_REPOSICAO`, soma de `valor_bonificacao` + `valor_bonificacao_desafio` quando atinge).
- Remoção de imports não utilizados (`useIncentivoDiarioAdmin`).

### Resultado visual

```text
[Hero gradient header com filtros]
┌──────────────┬──────────────┬───────────────────────────┬──────────────┐
│ Colaborad.   │ Metas Ating. │ Bônus Estimado · Abril    │ Desafio Met. │
│ 42           │ 78%          │ R$ 12.480,00              │ 35%          │
│ 30 mot·12 aj │ 234 de 300   │ Acumulado do mês até hoje │ 21/60 metas  │
└──────────────┴──────────────┴───────────────────────────┴──────────────┘

KPIs principais (sem mais "Incentivo Período"):
┌──────────────┬──────────────┬──────────────┐
│ Feedbacks    │ Planos Ação  │ Outro KPI    │
└──────────────┴──────────────┴──────────────┘
```

