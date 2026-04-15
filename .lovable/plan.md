

## Plano: Transformar TX_REPOSICAO em indicador de Reposição (R$) com meta mensal

### Resumo
Atualizar o indicador existente `TX_REPOSICAO` para refletir o novo propósito: medir o valor monetário (R$) de reposições por motorista/mês, com meta de até R$49,80. O dado virá da tabela `reposicao_031805`.

### Alterações

**1. Atualizar o indicador no banco de dados**
- Alterar `nome` de "Taxa de reposição" para "Reposição"
- Alterar `applies_to_worker_type` de "motorista,ajudante" para "motorista"
- Alterar `categoria` para "Financeiro"
- Alterar `unidade_medida` para "R$"
- Manter o `codigo` como `TX_REPOSICAO` (usado em ordenação canônica e cálculos)

**2. Criar meta mensal na tabela `goals`**
- `indicator_id`: ID do TX_REPOSICAO
- `valor_meta`: 49.80
- `periodo_tipo`: "mensal"
- `worker_type`: "motorista"
- `unidade_id`: NULL (vale para todas as unidades)
- `vigencia_inicio`: hoje

**3. Atualizar memória do projeto**
- Ajustar `mem://logic/daily-operational-goals` para refletir que TX_REPOSICAO agora é baseado em valor R$ da tabela `reposicao_031805`, não mais em taxa percentual do mapa.

### O que NÃO muda
- O código `TX_REPOSICAO` permanece (usado em `indicatorOrder.ts` e diversas telas)
- Nenhuma migração de schema necessária - apenas UPDATE de dados

### Detalhes técnicos
- UPDATE na tabela `indicators` via insert tool
- INSERT na tabela `goals` via insert tool
- Atualizar arquivo de memória

