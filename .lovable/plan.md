

## Plan: Padronizar categorias de Causa Raiz

As categorias padrão passam a ser: **Veículo, Rota, Clima, Sistema, Pessoal, Outro**.

### Arquivos a alterar

1. **`src/components/colaborador/ReportCausaRaizSheet.tsx`** (linha 21-28)
   - Trocar CATEGORIAS para: Veículo, Rota, Clima, Sistema, Pessoal, Outro

2. **`src/pages/admin/CausaRaiz.tsx`** (linhas 30-40)
   - Trocar CATEGORIAS para: `['Veículo', 'Rota', 'Clima', 'Sistema', 'Pessoal', 'Outro']`
   - Atualizar CAT_CONFIG com ícones apropriados para cada nova categoria:
     - Veículo → Truck (azul)
     - Rota → GitBranch (âmbar)
     - Clima → Package (violeta) ou ícone similar
     - Sistema → Wrench (vermelho)
     - Pessoal → User (rosa)
     - Outro → HelpCircle (muted)

