

## Plano: Fluxo de Causa Raiz e Plano de Acao integrado ao Dashboard

### O que muda
Quando um indicador aparece como "Nao Atingiu" no dashboard do colaborador, um botao "Reportar" aparece ao lado do badge. Ao clicar, abre um Sheet (bottom drawer) com um formulario simplificado em 2 etapas:
1. **Causa Raiz** -- problema, categoria e causa
2. **Plano de Acao** -- acao corretiva e prazo

### Fluxo do usuario
```text
Dashboard > Expandir Mapa > Indicador "Nao Atingiu"
  > Botao "Reportar"
  > Sheet abre (etapa 1: Causa Raiz)
    - Descricao do problema (textarea)
    - Categoria (select: veiculo, rota, sistema, processo, outro)
    - Causa raiz (textarea)
  > Botao "Proximo"
  > Etapa 2: Plano de Acao
    - Acao corretiva (textarea)
    - Prazo (date picker)
  > Botao "Salvar"
  > Insere root_cause_record + action_plan no Supabase
  > Toast de sucesso, fecha sheet
```

### Arquivos modificados

**`src/pages/colaborador/Home.tsx`**:
- Adicionar estado para controlar o Sheet e o indicador selecionado
- No render de cada indicador com status "abaixo_meta", adicionar um botao "Reportar" (icone AlertTriangle)
- Adicionar componente `ReportSheet` inline ou extraido

**`src/components/colaborador/ReportCausaRaizSheet.tsx`** (novo):
- Sheet com 2 steps (causa raiz + plano de acao)
- Usa `useCreateCausaRaiz` e `useCreateActionPlan` do hook existente `useCausaRaiz.ts`
- Props: `open`, `onClose`, `userId`, `indicatorId`, `dataReferencia`, `indicatorNome`
- O `responsavel_user_id` do plano de acao e o proprio colaborador

### Sem mudancas no banco
As tabelas `root_cause_records` e `action_plans` ja possuem RLS que permite INSERT pelo proprio usuario. Nao precisa de migration.

### Detalhes tecnicos
- Reutiliza hooks existentes: `useCreateCausaRaiz()` e `useCreateActionPlan()` de `src/hooks/useCausaRaiz.ts`
- O campo `impacto` sera preenchido automaticamente como "Indicador abaixo da meta"
- Apos salvar, invalida queries de `root_cause_records` e `action_plans` para atualizar a secao "Meus Planos" no dashboard

