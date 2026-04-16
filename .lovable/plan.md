

## Upsert para Importação 03.18.05 (Reposição)

### Problema
Atualmente, se o mesmo CSV de reposição for importado novamente, registros duplicados são criados.

### Solução
Aplicar a mesma lógica de upsert usada nos mapas: adicionar uma constraint única e trocar `.insert()` por `.upsert()`.

### Chave única
A combinação `solicitacao_reposicao` + `produto` identifica unicamente cada linha (uma solicitação pode ter vários produtos, mas o mesmo produto não aparece duas vezes na mesma solicitação).

### Passos

1. **Migration**: Adicionar constraint única na tabela `reposicao_031805`:
   ```sql
   ALTER TABLE public.reposicao_031805
     ADD CONSTRAINT reposicao_031805_solicitacao_produto_unique
     UNIQUE (solicitacao_reposicao, produto);
   ```

2. **Import031805.tsx**: Trocar `.insert(batch)` por `.upsert(batch, { onConflict: 'solicitacao_reposicao,produto' })` no `handleImport`.

### Arquivos modificados
- Nova migration SQL
- `src/components/admin/Import031805.tsx` — uma linha alterada

