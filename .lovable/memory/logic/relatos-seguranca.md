---
name: Relatos de Segurança
description: Indicador mensal exclusivo para ajudantes, conta relatos cadastrados no mês (maior é melhor)
type: feature
---

## Regra (MAIOR é melhor)
- Código `RELATOS`, periodicidade `mensal`, `applies_to_worker_type='ajudante'`.
- Fonte: tabela `relatos_seguranca`, alimentada pelo importer "Relatos" (aba **Riscos** do XLSX `Planilha_de_relatos.xlsx`).
- Vínculo: por **CPF** (normalizado, só dígitos) em `users.cpf`. Fallback por matrícula. Só ajudantes (`worker_type='ajudante'`).
- Mês de referência: vem da coluna **"Data Cadastrado"** (formato `dd-mm-aaaa`). `data_referencia` = primeiro dia do mês.
- Linhas com CPF e matrícula iguais a `0` (ou vazias) são **ignoradas**.
- Meta: **5** relatos/mês (`valor_meta`). Desafio: **15** (`valor_desafio`).
- Bônus: meta = **R$ 52,50** (`valor_bonificacao`); desafio = **+R$ 10,00** (`valor_bonificacao_desafio`). Quem bate desafio recebe somados (R$ 62,50).
- Lógica: `status='dentro_meta'` se valor >= 5; `status_desafio='atingiu'` se valor >= 15.
- Edge `calculate-monthly-bonus` inclui o id do RELATOS em `HIGHER_IS_BETTER`.
- Recálculo: `recalcRelatos` em `src/components/admin/ImportRelatos.tsx` faz upsert em `user_indicator_daily` com `mapa_numero='MENSAL'` no dia 1 do mês.

## Importer
- Lote tipo `relatos` em `import_batches`. Undo deleta linhas pelo `import_batch_id` e limpa entradas em `user_indicator_daily` para `(indicator_id, mapa_numero='MENSAL', data_referencia in metadata.meses)`.
- Detecção de duplicidade: por `relato_id` (coluna ID da planilha). Fallback `(cpf, data_cadastrado, relato[:60], local, infracao)`.

## RLS
- Admin: full access. Ajudante: SELECT só dos próprios (`user_id = get_user_id(auth.uid())`).
