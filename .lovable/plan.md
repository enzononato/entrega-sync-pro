

# Adicionar "Desafio" às Metas

## Resumo
Adicionar dois novos campos na tabela `goals`: `valor_desafio` (meta mais apertada) e `valor_bonificacao_desafio` (R$ extra, configurável por indicador e perfil). Se o colaborador bater o desafio, ganha a bonificação normal + a bonificação do desafio.

## Mudanças

### 1. Migration: novos campos em `goals`
```sql
ALTER TABLE public.goals
  ADD COLUMN valor_desafio numeric NOT NULL DEFAULT 0,
  ADD COLUMN valor_bonificacao_desafio numeric NOT NULL DEFAULT 0;
```

### 2. UI de Metas (`src/pages/admin/Metas.tsx`)
- No formulário de criação/edição, adicionar dois campos extras abaixo da bonificação:
  - **Desafio (valor)**: mesmo formato da meta (tempo HH:MM ou porcentagem), representando o valor mais exigente
  - **Bonificação Desafio (R$)**: valor monetário extra
- No card de listagem, mostrar o desafio quando configurado (ex: "🎯 Desafio: 04:00 → +R$ 10,00")
- Adicionar estados `desafioTimeStr`, `desafioValorStr`, `desafioBonusStr` no formulário

### 3. Hook `useMetas` (`src/hooks/useMetas.ts`)
- Adicionar `valor_desafio` e `valor_bonificacao_desafio` nos tipos e mutations

### 4. Edge Function `calculate-monthly-bonus`
- Para cada indicador mensal, após verificar se bateu a meta normal, verificar também se bateu o desafio (valor_desafio)
- Se bateu o desafio: bonus = `valor_bonificacao` + `valor_bonificacao_desafio`
- Incluir info do desafio no `detalhes_json`

### 5. Edge Function `calculate-daily-indicators`
- Para indicadores diários, incluir a lógica de desafio no cálculo diário de incentivos
- Registrar `status_desafio` e valor extra no `user_indicator_daily`

### 6. UI do Colaborador (`Incentivo.tsx`)
- Mostrar se o colaborador atingiu o desafio além da meta, com o valor extra ganho

### 7. Memória
- Atualizar `mem://logic/goals-and-bonus-management` com a regra do desafio

## Escopo
- 1 migration (2 colunas)
- 4 arquivos editados: `Metas.tsx`, `useMetas.ts`, `calculate-monthly-bonus/index.ts`, `Incentivo.tsx`
- 1 arquivo possivelmente editado: `calculate-daily-indicators/index.ts`
- 1 memory update

