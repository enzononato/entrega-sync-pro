

## Auditoria do "Bônus Estimado" — não, R$ 21.481,48 não está totalmente correto

Rodei o cálculo direto no banco replicando a lógica do dashboard. O valor real deveria ser **R$ 21.428,96**, não R$ 21.481,48 (diferença pequena, possivelmente arredondamento), e ainda assim **3 problemas estruturais** estão escondendo bônus que deveriam aparecer.

### Decomposição do mês atual (abril/2026)

| Bloco | Valor | Observação |
|---|---|---|
| DISP_TEMPO motorista — meta (24 atingiram) | R$ 1.260,00 | ✅ correto |
| DISP_TEMPO motorista — desafio (21 atingiram) | R$ 210,00 | ✅ correto |
| DISP_TEMPO ajudante — meta | **R$ 0,00** | ❌ **bug 1** — não há dados de DISP_TEMPO para ajudantes no mês |
| REFUGO ajudante — meta (37 atingiram) | R$ 1.942,50 | ✅ correto, agora entra |
| TX_DEVOLUCAO ajudante — meta | **R$ 0,00** | ❌ **bug 2** — `users_com_dado=0`, ajudantes não estão recebendo TX_DEVOLUCAO |
| TX_DEVOLUCAO motorista — meta | n/a | ⚠️ **bug 3** — sem meta específica de motorista, e fallback universal foi bloqueado (ver abaixo) |
| TX_REPOSICAO motorista — meta (12 atingiram) | R$ 630,00 | ✅ correto |
| TX_REPOSICAO motorista — desafio (7 atingiram) | R$ 70,00 | ✅ correto |
| Caixas Batidas (mês) | R$ 17.316,46 | ✅ correto |
| **Total esperado** | **R$ 21.428,96** | |
| **Exibido no card** | R$ 21.481,48 | diferença de ~R$ 52,50 (1 bonificação) |

### Os 3 bugs encontrados

**Bug 1 — DISP_TEMPO está marcado como `applies_to_worker_type = 'motorista'` no indicator**, mas existe meta cadastrada para ajudante. A lógica nova (que respeita `applies_to_worker_type`) está corretamente bloqueando essa meta de ajudante porque o indicador diz "só motorista". Ou o cadastro do indicador está errado (deveria ser `ambos`), ou a meta de ajudante não deveria existir. **Decisão necessária do usuário.**

**Bug 2 — TX_DEVOLUCAO tem `applies_to_worker_type = 'motorista,ajudante'`** (string com vírgula), e o `findGoal` checa `applies !== 'ambos' && applies !== workerType`. Como `'motorista,ajudante' !== 'ajudante'`, **a meta é descartada**. Por isso TX_DEVOLUCAO ajudante mostra zero. O valor correto de `applies_to_worker_type` para indicadores que valem para os dois é `'ambos'`, não `'motorista,ajudante'`.

**Bug 3 — A meta universal de TX_DEVOLUCAO** (worker_type = null) com `valor_bonificacao_desafio = 10` está sendo descartada para motoristas porque a lógica nova só aceita fallback universal se o indicador for `'ambos'` (e ele é `'motorista,ajudante'`, não `'ambos'`). Isso fechou o buraco anterior, mas agora motoristas perdem bônus de TX_DEVOLUCAO porque não existe meta específica `worker_type='motorista'`.

### Plano de correção

**Etapa A — corrigir os dados (migração SQL):**
1. Atualizar `indicators.applies_to_worker_type`:
   - DISP_TEMPO: `'motorista'` → `'ambos'` (afeta motoristas e ajudantes)
   - TX_DEVOLUCAO: `'motorista,ajudante'` → `'ambos'` (corrige a string fora do padrão)
2. Confirmar com o usuário se REFUGO deve continuar `'ajudante'` (correto) e TX_REPOSICAO `'motorista'` (correto).

**Etapa B — robustecer o `findGoal` no código** (defesa contra dados sujos no futuro):
- Tratar `applies_to_worker_type` contendo vírgula como lista: `applies.split(',').map(s=>s.trim()).includes(workerType)` ou igual a `'ambos'`. Sem isso, qualquer cadastro errado volta a quebrar silenciosamente.
- Aplicar em `src/pages/admin/Dashboard.tsx` e `supabase/functions/calculate-monthly-bonus/index.ts` (mesma função `findGoal`).

**Etapa C — investigar por que ajudantes não têm DISP_TEMPO nem TX_DEVOLUCAO no mês:**
- Possível causa: `calculate-daily-indicators` não está distribuindo esses indicadores para `aju1_user_id`/`aju2_user_id` do mapa. Vou ler a edge function antes de propor fix.

### Resultado esperado depois da correção

| Bloco | Antes | Depois |
|---|---|---|
| DISP_TEMPO ajudante | R$ 0 | provavelmente +R$ 1.000~2.000 (se etapa C confirmar dados) |
| TX_DEVOLUCAO motorista + ajudante | R$ 0 | + R$ 500~1.500 |
| Total bônus + caixas | ~R$ 21.428,96 | **estimado R$ 23.000~25.000** |

### Arquivos / artefatos alterados

- **Migração SQL** — UPDATE em `indicators.applies_to_worker_type` para DISP_TEMPO e TX_DEVOLUCAO
- `src/pages/admin/Dashboard.tsx` — `findGoal` aceita `applies_to_worker_type` como lista separada por vírgula
- `supabase/functions/calculate-monthly-bonus/index.ts` — mesma alteração no `findGoal`
- `supabase/functions/calculate-daily-indicators/index.ts` — investigação e possível fix se ajudantes não estão recebendo DISP_TEMPO/TX_DEVOLUCAO (etapa C, depois de confirmar)

