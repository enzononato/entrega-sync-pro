# Plano — Exibir indicadores mensais (não-mapa) em Desempenho/Home

## Objetivo

Hoje as telas de desempenho agrupam tudo por `mapa_numero`. Indicadores como o Rating, que são mensais e não estão atrelados a mapa, ficam num bucket "manual" confuso ou somem da visualização. Vamos:

1. Marcar formalmente quais indicadores são **mensais** no banco.
2. Renderizar uma **seção "Indicadores Mensais"** acima da listagem de mapas, em todas as telas relevantes — admin e colaborador.
3. Manter a visualização por mapa intacta para os indicadores diários/operacionais.

A solução já fica preparada para os próximos indicadores não-mapa que você vai adicionar.

## Mudança no banco

Adicionar coluna `periodicidade` na tabela `indicators`:

- Valores: `'diario'` (default) | `'mensal'`
- Migrar o indicador **RATING** para `periodicidade = 'mensal'`.
- Todos os demais indicadores existentes permanecem `'diario'`.

Quando você criar futuros indicadores não-mapa (ex: avaliação 360, NPS, etc.), basta marcar `periodicidade = 'mensal'` e eles entram automaticamente na nova seção, sem deploy.

## Telas afetadas

```text
Admin
  /admin/desempenho          → seção Mensais por colaborador (dentro do card expansível)
  /admin/colaboradores       → ficha do colaborador: seção Mensais antes dos mapas

Colaborador
  /colaborador/home          → seção Mensais antes da lista de mapas
  /colaborador/incentivo     → bloco Mensais somando bônus mensais ao total
```

## UX da seção "Indicadores Mensais"

Bloco visual distinto (card glassmorphism com header próprio), contendo:

- **Cabeçalho**: "Indicadores Mensais" + chip do mês de referência (ex: "Outubro/2026" — DD/MM/AAAA).
- **Linhas**: uma por indicador mensal disponível no período. Para o Rating mostra:
  - Valor realizado (ex: 4,98)
  - Meta 4,95 → badge **Atingiu** (verde)
  - Desafio 5,00 → badge **Atingiu Desafio** (azul/dourado) quando ≥ 5
  - Bônus correspondente (R$ 52,50 ou R$ 62,50)
- **Empty state**: "Nenhum indicador mensal importado para este período" quando não houver dado.

Mantém o padrão binário (Atingiu / Não Atingiu) já consagrado no projeto.

## Regra do filtro de período

Quando o usuário seleciona um intervalo de datas:

- Para cada indicador mensal, identificar todo `mês de referência` que tenha **qualquer interseção** com o intervalo selecionado.
- Mostrar o valor do mês completo, com a chip de mês deixando claro a referência.
- Se o intervalo cobrir mais de um mês, exibir uma linha por mês (ordenado mais recente primeiro).

## Detalhes técnicos

### Banco
- `ALTER TABLE indicators ADD COLUMN periodicidade text NOT NULL DEFAULT 'diario'` + check `('diario','mensal')`.
- `UPDATE indicators SET periodicidade='mensal' WHERE codigo='RATING'`.

### Tipos
- Atualizar `Indicator` em `src/types/index.ts` com `periodicidade: 'diario' | 'mensal'`.

### Hook de dados
- `useDesempenhoDiario` já traz `indicators(...)` no select — incluir `periodicidade` na projeção.
- Criar helper `splitByPeriodicidade(rows)` em `src/lib/indicatorPeriodicity.ts` retornando `{ diarios, mensais }`.
- Para `mensais`, agrupar por `(user_id, indicator_id, ano-mês de data_referencia)`; manter o registro mais recente (já que reimport faz upsert no primeiro dia do mês).

### Componente reutilizável
- Criar `src/components/shared/MonthlyIndicatorsSection.tsx` que recebe `rows` e `workerType` e renderiza o bloco. Usado nas 4 telas para garantir consistência visual.
- Reutiliza `StatusBadge` e tokens de cor existentes.

### Páginas
- `src/pages/admin/Desempenho.tsx`: dentro do card expandido de cada colaborador, renderizar `<MonthlyIndicatorsSection>` antes do `Array.from(group.mapas...)`.
- `src/pages/admin/Colaboradores.tsx`: idem, antes do `groupedByMapa.map(...)`.
- `src/pages/colaborador/Home.tsx`: antes do `groupedByMapa.map(...)`. O contador de "Mapas" no header continua refletindo só mapas (não conta os mensais).
- `src/pages/colaborador/Incentivo.tsx`: somar bônus mensais ao total estimado e listar abaixo dos diários.

### Ranking / Bônus mensal
- O cálculo de bônus mensal (`calculate-monthly-bonus`) já lê `user_indicator_daily`; nenhuma mudança funcional necessária. Apenas validar que o Rating entra corretamente no somatório (deve, pois usamos a mesma tabela com bônus 52,50/62,50).

## Fora do escopo

- Não criamos página dedicada nova; tudo é adicionado nas telas existentes.
- Não alteramos o agrupamento por mapa atual.
- Não mexemos em cálculo de gamificação/ranking — esses já consideram qualquer indicador atingido.

## Memória a atualizar (após implementação)

- Atualizar `mem://logic/indicators-and-status` mencionando a coluna `periodicidade` e a separação visual mensal vs diário.
- Atualizar `mem://features/admin-performance-ui` e `mem://features/collaborator-dashboard` indicando a nova seção de mensais.