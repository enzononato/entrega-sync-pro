## Exportar Planos de Ação (CSV)

Adicionar um botão **"Exportar"** no cabeçalho da página `/admin/planos-de-acao` que gera um CSV (UTF-8 BOM, abre no Excel) com todos os planos atualmente filtrados (respeita aba ativa + filtro de responsável).

### Colunas do CSV

Cada linha = um plano de ação, com o máximo de informações disponíveis:

1. ID do plano
2. Data de abertura (DD/MM/AAAA)
3. Hora de abertura (HH:mm:ss)
4. Última atualização (DD/MM/AAAA HH:mm:ss)
5. Status (Aberto / Em Andamento / Concluído / Atrasado / Cancelado)
6. Atrasado (Sim/Não)
7. Prazo (DD/MM/AAAA)
8. Dias restantes / dias em atraso
9. Descrição da ação
10. Observações
11. Responsável — nome
12. Responsável — tipo (Motorista / Ajudante)
13. Indicador — código
14. Indicador — nome
15. Causa raiz — data de referência (DD/MM/AAAA)
16. Causa raiz — descrição do problema
17. Causa raiz — categoria
18. Causa raiz — causa raiz

### Implementação

- Reaproveitar `src/lib/exportCsv.ts` (já existe, com BOM UTF-8).
- Em `src/pages/admin/PlanosDeAcao.tsx`:
  - Importar `Download` do `lucide-react` e `exportToCsv`.
  - Adicionar botão `Exportar` ao lado do `PageHeader` (ou logo acima da lista, alinhado à direita), desabilitado quando `filteredPlanos.length === 0`.
  - Handler `handleExport()` constrói headers + rows a partir de `filteredPlanos`, com nome do arquivo `planos-de-acao_AAAA-MM-DD.csv`.
- Sem mudanças no hook `usePlanosDeAcao` — os dados já vêm com `users` e `root_cause_records.indicators` via join.
- Sem mudanças de banco / RLS / edge functions.

### Escopo

- Apenas a página admin (`src/pages/admin/PlanosDeAcao.tsx`).
- Não altera a versão do colaborador.
