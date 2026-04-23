

## Plano: limpar duplicatas e recalcular bônus de abril/2026

### Passo 1 — Aplicar migração de limpeza + índice único
Migração já criada em `supabase/migrations/20260423131223_*.sql`:
- Remove linhas duplicadas em `user_incentives_daily` mantendo a mais recente por `(user_id, data_referencia, tipo)`.
- Cria índice único `user_incentives_daily_user_date_tipo_uniq` em `(user_id, data_referencia, ((detalhes_json->>'tipo')))`.

### Passo 2 — Forçar recálculo limpo de abril/2026
Executar via SQL:
```sql
DELETE FROM public.user_incentives_daily
WHERE data_referencia = '2026-04-01'
  AND detalhes_json->>'tipo' = 'bonus_mensal';
```
Isso remove qualquer resíduo antes do recálculo, garantindo que o Refugo (importado em 23/abr) entre na próxima execução.

### Passo 3 — Disparar `calculate-monthly-bonus` para abril/2026
Chamar a edge function com `{ "month": "2026-04" }`. Ela usa o novo padrão delete-then-insert e grava `bonus_mensal` por colaborador em `user_incentives_daily` com o detalhamento por indicador (incluindo Refugo) em `detalhes_json.indicadores`.

### Passo 4 — Validar números
Após o recálculo, conferir via SQL:
- Total de `valor_estimado` somado para abril/2026 (deve bater com o card "Bônus Estimado" do Dashboard).
- Quantos colaboradores têm Refugo no `detalhes_json.indicadores` (esperado: > 0).
- Para 2-3 colaboradores de amostra: comparar valor agregado de Refugo no `user_indicator_daily` com o que foi gravado em `detalhes_json`.

### Passo 5 — Recarregar Dashboard
A query `bonus-mensal` (`staleTime: 5min`) é invalidada — fechar e reabrir o popup mostra:
- Refugo de volta na tabela.
- Totais atualizados.
- "Bônus por Meta" no resumo refletindo a soma correta.

### Sem mudanças de código
Toda a correção é em dados/banco. O código (`Dashboard.tsx`, `calculate-monthly-bonus/index.ts`) já está pronto desde os passos anteriores.

