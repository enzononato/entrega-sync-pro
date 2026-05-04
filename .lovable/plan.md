
## Objetivo

Inverter a lógica do indicador **PDV Crítico**. Hoje está como "menor é melhor" (até 5 feedbacks atinge). A regra correta é **"maior é melhor"**:

- `valor < 5` → **Não atingiu** (nada)
- `valor >= 5` → **Atingiu meta** → bônus R$ 52,50
- `valor >= 15` → **Atingiu meta + desafio** → bônus R$ 52,50 + R$ 10,00 = **R$ 62,50**

A contagem continua sendo feedbacks com `Estado = 'Relevante'` na aba BEES, agrupados por motorista/mês (vínculo por CPF).

## O que muda

### 1. Recalculador `recalcPdvCritico` em `src/components/admin/ImportPDVCritico.tsx`

Inverter os comparadores e ajustar `percentual_atingimento`:

```ts
const atingiuMeta    = valor >= PDV_META;     // 5
const atingiuDesafio = valor >= PDV_DESAFIO;  // 15
status:         atingiuMeta    ? 'dentro_meta' : 'abaixo_meta',
status_desafio: atingiuDesafio ? 'atingiu'    : 'nao_atingiu',
percentual_atingimento: PDV_META > 0 ? Math.min(100, (valor / PDV_META) * 100) : 0,
```

Atualizar comentários do bloco e renomear menções a "menor é melhor" para "maior é melhor".

### 2. Migração: atualizar metas (`goals`) e recalcular dados existentes

Migration SQL para garantir os valores corretos no `goals` do PDV_CRITICO:

```sql
UPDATE public.goals
SET valor_meta = 5,
    valor_desafio = 15,
    valor_bonificacao = 52.50,
    valor_bonificacao_desafio = 10.00,
    periodo_tipo = 'mensal'
WHERE indicator_id = (SELECT id FROM public.indicators WHERE codigo = 'PDV_CRITICO');
```

E recalcular linhas já gravadas em `user_indicator_daily` (corrige os imports anteriores feitos com a lógica errada):

```sql
UPDATE public.user_indicator_daily
SET status         = CASE WHEN valor >= 5  THEN 'dentro_meta' ELSE 'abaixo_meta' END,
    status_desafio = CASE WHEN valor >= 15 THEN 'atingiu'    ELSE 'nao_atingiu' END,
    percentual_atingimento = LEAST(100, (valor / 5.0) * 100)
WHERE indicator_id = (SELECT id FROM public.indicators WHERE codigo = 'PDV_CRITICO');
```

### 3. Edge function `calculate-monthly-bonus`

Adicionar o ID do PDV_CRITICO ao set `HIGHER_IS_BETTER` (junto do RATING) para que o cálculo binário do bônus mensal trate `valor >= meta` como atingido. O resto do fluxo (somar `valor_bonificacao` + `valor_bonificacao_desafio` quando bate desafio) já funciona pelas configs do `goals`.

### 4. Atualizar memória do projeto

Atualizar `mem://logic/pdv-critico` para refletir a nova regra ("maior é melhor", bônus R$ 52,50 + R$ 10,00 desafio).

## Pontos que NÃO mudam

- Estrutura da tabela `pdv_critico_feedbacks` e do importer (parsing, deduplicação, undo).
- Periodicidade mensal, vínculo só para motoristas, contagem de `Estado = 'Relevante'`.
- UI já usa `splitByPeriodicidade` e renderiza badge binário a partir do `status` persistido — nada a mudar visualmente; após recálculo aparece o status correto automaticamente.

## Arquivos a editar

- `src/components/admin/ImportPDVCritico.tsx` (função `recalcPdvCritico` + constantes/comentários)
- `supabase/functions/calculate-monthly-bonus/index.ts` (incluir PDV_CRITICO em `HIGHER_IS_BETTER`)
- `supabase/migrations/<novo>.sql` (atualizar `goals` e recalcular `user_indicator_daily` existente)
- `mem://logic/pdv-critico` (memória)
