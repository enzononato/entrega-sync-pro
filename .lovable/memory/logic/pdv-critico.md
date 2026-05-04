---
name: PDV Crítico
description: Indicador mensal exclusivo para motoristas, conta feedbacks "Relevante" da planilha BEES (maior é melhor)
type: feature
---

## Regra (MAIOR é melhor)
- Código `PDV_CRITICO`, periodicidade `mensal`, `applies_to_worker_type='motorista'`.
- Fonte: tabela `pdv_critico_feedbacks`, alimentada pelo importer "PDV Crítico" (aba **BEES** do XLSX "Feedback_Motorista_*.xlsx").
- Vínculo: por **CPF** (normalizado, só dígitos) em `users.cpf`. Fallback por matrícula. Só motoristas.
- Contagem: somente linhas com `estado='Relevante'`. Trim antes de comparar.
- Meta: **5** feedbacks (`valor_meta`). Desafio: **15** (`valor_desafio`).
- Bônus: meta = **R$ 52,50** (`valor_bonificacao`); desafio = **+R$ 10,00** (`valor_bonificacao_desafio`). Quem bate desafio recebe os dois somados (R$ 62,50).
- Lógica: **maior é melhor**. `status='dentro_meta'` se valor >= 5; `status_desafio='atingiu'` se valor >= 15.
- `calculate-monthly-bonus` inclui o id do PDV_CRITICO em `HIGHER_IS_BETTER` para somar o bônus corretamente.
- Recálculo: `recalcPdvCritico` em `src/components/admin/ImportPDVCritico.tsx` faz upsert em `user_indicator_daily` com `mapa_numero='MENSAL'` e `data_referencia` no dia 1 do mês.
- Semanal: `pdv_critico_feedbacks.semana` permite breakdown por semana no front. Não é gravado em `user_indicator_daily`.

## Importer
- Lote tipo `pdv_critico` em `import_batches`. Undo deleta as linhas pelo `import_batch_id` e limpa entradas em `user_indicator_daily` para `(indicator_id, mapa_numero='MENSAL', data_referencia in metadata.meses)`.
- Detecção de duplicidade: `(cpf, mes_num, ano, semana, codigo_cliente, comentario[:60], data_analise, tmr)`.

## RLS
- Admin: full access. Motorista: SELECT só dos próprios (`user_id = get_user_id(auth.uid())`).
