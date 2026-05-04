
## Objetivo

Criar o indicador **PDV_CRITICO** — exclusivo para motoristas, periodicidade **mensal** (mesmo padrão do RATING) — alimentado por uma nova planilha "Feedback Motorista" (aba `BEES`). Cada motorista é contado pela quantidade de feedbacks com `Estado = "Relevante"`, agrupados por mês e por semana. Meta = 5, Desafio = 15. Lógica "menor é melhor": atinge quando `count <= meta`.

## Estrutura da planilha (aba BEES)

Cabeçalhos relevantes detectados:
- `Mês` (texto: janeiro…dezembro)
- `Semana` (1–5)
- `Motorista` (nome)
- `Estado` (`Relevante` / `Irrelevante`) — só conta `Relevante`
- `MATRICULA`
- `CPF` (formato `031.785.465-88`)
- `Categoria`, `Status`, `Data Notificação`, etc. (apenas armazenados como referência)

Vinculação ao usuário: por **CPF normalizado** (somente dígitos) → `users.cpf`. Fallback por matrícula se CPF não bater.

## Mudanças no banco (migration)

1. **Inserir o indicador**:
   ```sql
   INSERT INTO indicators (codigo, nome, categoria, descricao, applies_to_worker_type, periodicidade)
   VALUES ('PDV_CRITICO', 'PDV Crítico', 'Qualidade',
           'Quantidade de feedbacks relevantes recebidos por motorista (BEES)',
           'motorista', 'mensal');
   ```
   `PDV_CRITICO` já consta na ordem canônica em `src/lib/indicatorOrder.ts`, então aparece naturalmente.

2. **Nova tabela `pdv_critico_feedbacks`** — fonte bruta (mesmo padrão de `rating_avaliacoes` e `mapa_historico`):
   ```
   id uuid pk
   mes text                  -- 'janeiro'..'dezembro'
   mes_num int               -- 1..12
   ano int                   -- inferido (default ano corrente)
   semana int                -- 0..5
   data_referencia date      -- 1º dia do mês (para join mensal)
   codigo_cliente text
   cliente text
   motorista_nome text
   comentario text
   estado text               -- 'Relevante' | 'Irrelevante'
   data_notificacao date
   tratado_por text
   data_analise date
   instrucao text
   categoria text
   status text
   tmr numeric
   matricula text
   cpf text                  -- normalizado (só dígitos)
   user_id uuid              -- resolvido por cpf/matricula
   unidade_id uuid
   import_batch_id uuid
   imported_by uuid
   created_at timestamptz default now()
   ```
   - RLS: admin full access; motorista lê os próprios (`user_id = get_user_id(auth.uid())`).
   - Índices em `(cpf, mes_num, ano)`, `(user_id, data_referencia)`, `(import_batch_id)`.
   - Constraint única para deduplicar: `(cpf, mes_num, ano, semana, codigo_cliente, comentario)`.

3. **Metas**: inserir em `goals` para o indicador novo (worker_type = 'motorista', global ou por unidade):
   - `valor_meta = 5`, `valor_desafio = 15`, `periodo_tipo = 'mensal'`, vigência atual.

## Importer no admin

Novo componente `src/components/admin/ImportPDVCritico.tsx` + nova aba "PDV Crítico" em `src/pages/admin/Importacoes.tsx`. Reutiliza o fluxo já existente de **preview + duplicidade + undo** (mesmo padrão do `ImportRating`/`ImportMapasDialog`):

1. Upload `.xlsx` → ler aba `BEES` (usar `xlsx`/SheetJS — já é o padrão dos outros importers).
2. Parse:
   - Normaliza CPF (`replace(/\D/g, '')`).
   - `mes_num` via mapa `{janeiro:1, fevereiro:2, ...}`.
   - `data_referencia = ano-mes-01` (ano = ano corrente, ou input do admin).
   - Resolve `user_id` por CPF; se não achar, tenta matrícula; sinaliza linhas sem vínculo.
3. **Detecção de duplicidade**: para cada linha, gerar a chave única acima e marcar como duplicada se já existir naquele lote anterior (`status='confirmed'`).
4. **Preview** em `<ImportPreviewTable>` mostrando: motorista, CPF, mês, semana, estado, categoria, status (vinculado/sem vínculo/duplicado).
5. **Confirmação**: cria `import_batch` (tipo `'pdv_critico'`), insere `pdv_critico_feedbacks` com `import_batch_id`, dispara cálculo do indicador.
6. **Undo**: reaproveita `useImportBatches` — ao desfazer, deleta linhas pelo `import_batch_id` e recalcula o indicador.

## Cálculo do indicador (mensal + semanal)

Função em `src/lib/calcPdvCritico.ts` chamada após confirmar import e em `Importações → Recalcular Indicadores`:

- Para cada `(user_id, mes, ano)`:
  - `valor_mensal = COUNT(*) WHERE estado='Relevante'`
  - `meta = 5`, `desafio = 15`
  - `status = valor_mensal <= 5 ? 'atingiu' : 'nao_atingiu'` (menor é melhor)
  - `status_desafio = valor_mensal <= 15 ? 'atingiu' : 'nao_atingiu'`
- Upsert em `user_indicator_daily` com `data_referencia = primeiro dia do mês`, `indicator_id = PDV_CRITICO`, `origem_dado = 'import_pdv_critico'`.
- Para a **visão semanal**: armazenar nas mesmas linhas o detalhamento em campo derivado na UI (a tabela bruta já tem `semana`, então o front faz `GROUP BY semana` quando necessário). Não criamos linha por semana em `user_indicator_daily` para manter consistência com `RATING` (mensal puro).

Edge function `calculate-monthly-bonus` precisa reconhecer `PDV_CRITICO` para somar bônus se aplicável (mesma regra binária do RATING).

## UI — exibição

- **Admin → Desempenho / Colaboradores**: já consome `splitByPeriodicidade`, então `PDV_CRITICO` aparece automaticamente na `<MonthlyIndicatorsSection>` ao lado do RATING. Badge binário (Atingiu/Não Atingiu) já vem do status persistido.
- **Colaborador → Home (motoristas)**: o card mensal aparece automaticamente. Adicionar, abaixo do valor mensal, um mini-breakdown semanal (`Semana 1: 2`, `Semana 2: 4`, …) consultando `pdv_critico_feedbacks` agrupado.
- **Colaborador → Incentivo**: indicador entra no cálculo do bônus mensal (binário, peso a definir junto com Rating; por padrão `valor_bonificacao` do `goals`).
- **Ajudantes**: filtrado por `applies_to_worker_type='motorista'` — não exibido para ajudantes, conforme regra atual.

## Arquivos a criar / editar

Criar:
- `supabase/migrations/<timestamp>_pdv_critico.sql`
- `src/components/admin/ImportPDVCritico.tsx`
- `src/lib/calcPdvCritico.ts`
- `src/hooks/usePdvCritico.ts` (consulta agregada por semana p/ Home do motorista)

Editar:
- `src/pages/admin/Importacoes.tsx` (nova aba)
- `src/components/admin/ImportHistoryPanel.tsx` (suportar tipo `pdv_critico`)
- `src/hooks/useImportBatches.ts` (incluir `pdv_critico` no undo: deletar de `pdv_critico_feedbacks` e recalcular)
- `src/pages/colaborador/Home.tsx` (mini-breakdown semanal só para motoristas)
- `supabase/functions/calculate-monthly-bonus/index.ts` (incluir PDV_CRITICO no cálculo binário)
- `src/lib/indicatorOrder.ts` (já contém `PDV_CRITICO` — sem mudança)

## Pontos de confirmação (responda na mensagem; sigo com defaults se preferir)

1. **Ano de referência**: deduzimos pelo nome do arquivo (`_2026_3`)? Ou pedimos no formulário do importer? **Default sugerido**: campo `Ano` no importer com pré-seleção do ano corrente.
2. **Bônus**: o PDV Crítico entra no cálculo de bônus mensal junto com o Rating (mesma estrutura binária)? **Default**: sim, com `valor_bonificacao` configurável em `goals`.
3. **Vínculo sem CPF**: linhas sem CPF nem matrícula reconhecida — descartar ou importar mesmo assim como "sem vínculo" (não conta no indicador)? **Default**: importar como sem vínculo, exibir aviso no preview.
