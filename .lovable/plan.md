

# Plano: Importador Avançado "Fecho Operacional" (ImportacaoRevalleDialog)

## Resumo

Criar um novo componente `ImportacaoRevalleDialog.tsx` que lê planilhas "wide" (uma linha por colaborador, múltiplas métricas em colunas) e gera lançamentos de desempenho conforme regras de cargo. Adicionar botão na tela de Desempenho admin para abrir este importador.

---

## Arquivos a criar/editar

### 1. Criar `src/components/admin/ImportacaoRevalleDialog.tsx`

**Estrutura do componente:**
- Props: `open`, `onOpenChange`, `usuarios` (com matricula, worker_type), `indicators` (com codigo), `onImport` (batch)
- Estado: `mesReferencia` (input type="month"), `rows` parseadas, `fileName`, `importing`, `done`

**Dicionário De-Para (colunas da planilha -> códigos do banco):**
```typescript
const COLUMN_MAP: Record<string, string> = {
  'Dev. PDV': 'DEV_PDV',
  'Disp. Tem.': 'DISP_TEMPO',
  'Rating': 'RATING',
  'PDV crítico': 'PDV_CRITICO',
  'Reposição': 'REPOSICAO',
  'Relatos': 'RELATOS',
  'Refugo': 'REFUGO',
};
```

**Regras de cargo → indicadores:**
- "Motorista de entrega" → DEV_PDV, DISP_TEMPO, RATING, PDV_CRITICO, REPOSICAO
- "Ajudante de entrega" → RATING, RELATOS, REFUGO

**Parser XLSX:**
1. Ler a planilha com `xlsx`, iterar headers para identificar colunas que contenham os prefixos do dicionário
2. Para cada header reconhecido, extrair meta do texto (ex: "Rating - Meta 4,95" → meta=4.95) usando regex `/Meta\s*([\d.,]+)/i`
3. Extrair a coluna "Real" adjacente ao header para obter o valor atingido. Alternativa: procurar sub-colunas com padrão "Real" ou "Realizado"
4. Para cada linha, ler "Matrícula" e "Cargo", resolver user_id e filtrar indicadores conforme cargo
5. Gerar registos flat: `{ user_id, indicator_id, data_referencia: YYYY-MM-DD (último dia do mês selecionado), valor, meta, origem_dado: 'importacao' }`

**Leitura inteligente do header multi-linha:**
- Usar `XLSX.utils.sheet_to_json` com `{ header: 1 })` para ler como array de arrays
- Iterar as primeiras linhas para encontrar "Matrícula" e os nomes de indicadores
- Para cada grupo de indicador, localizar a sub-coluna "Real" e a meta no cabeçalho

**UI (shadcn/ui):**
1. **Step 1** - Campo `<Input type="month">` para selecionar mês/ano + área de upload (drag/click)
2. **Step 2** - Preview sumarizado:
   - Cards: "X Motoristas encontrados", "Y Ajudantes encontrados"
   - "Total de Z Lançamentos a serem gerados"
   - Lista de erros (matrículas não encontradas, cargos desconhecidos)
   - Tabela colapsável com detalhes dos registos gerados
3. **Step 3** - Tela de sucesso (como o importador existente)

**Footer:** Botões "Cancelar" e "Importar Z lançamento(s)"

### 2. Editar `src/pages/admin/Desempenho.tsx`

- Importar `ImportacaoRevalleDialog`
- Adicionar estado `revalleOpen`
- Adicionar botão "Importar Fecho Operacional" ao lado do botão existente "Importar CSV/Excel"
- Passar props: `usuarios` (colabs), `indicators`, `onImport` via `batchMut.mutateAsync`

---

## Detalhes Técnicos

- **Data de referência**: O mês selecionado será convertido para o último dia do mês (`YYYY-MM-DD`) para todos os registos
- **Matching de colunas**: Busca parcial (`.includes()`) nos headers da planilha contra as chaves do dicionário, case-insensitive
- **Extração de meta do header**: Regex `/Meta\s*([\d]+[.,]?\d*)/i`, substituindo vírgula por ponto
- **Validações**: Matrícula não encontrada, cargo desconhecido, indicador sem correspondência no banco, valor zerado
- **A função `onImport`** recebe o array flat e dispara `useBatchCreateLancamentos` (já existente)

