

## Plan: Converter importação 03.18.05 para Dialog (modal) como mapas

### O que muda
A importação 03.18.05 passará a funcionar como a importação de mapas: um botão "Importar CSV" na aba abre um Dialog (modal popup) com preview dos dados filtrados e botão de confirmação. A tabela de dados importados continua visível na aba abaixo do botão.

### Alterações

**Arquivo: `src/components/admin/Import031805.tsx`**

1. Extrair a lógica de upload/parse/preview para dentro de um `Dialog` (usando `@/components/ui/dialog`)
2. Na aba, exibir:
   - Botão "Importar CSV" que abre o Dialog
   - Card "Dados Importados" com a tabela do banco (como já existe)
3. No Dialog:
   - Input de arquivo CSV
   - Info de filtragem (X linhas no arquivo → Y registros filtrados)
   - Preview table com as primeiras 20 linhas filtradas
   - Botão "Confirmar Importação" que faz o insert em batch
   - Ao concluir, fecha o Dialog e atualiza a tabela de dados importados
4. Manter a vinculação de motorista_codigo/ajudante_codigo com user_ids (lookup na tabela `users` por matrícula), similar ao que a importação de mapas faz com `cd_mot`, `cd_aju1`, `cd_aju2`

### Detalhes técnicos
- Reutilizar os mesmos componentes de UI: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
- Manter toda a lógica de parse CSV, filtragem por justificativa, e batch insert
- Adicionar lookup de matrículas → user_ids antes do insert (campos `mot_user_id`, `aju1_user_id` na tabela `reposicao_031805` — precisará de migração para adicionar essas colunas se desejado, ou apenas salvar o código do motorista como já faz)
- O Dialog fecha automaticamente após importação bem-sucedida e chama `fetchDbRows()` para atualizar a listagem

