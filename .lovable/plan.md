

## Plano: Novo indicador "Dispersão de Tempo"

**Formula:** `Tempo Prev - (Hr Entrega - Hr Saída)` (em minutos)
**Lógica:** Quanto maior, melhor (valor >= meta = "Atingiu"). Meta padrão: 0 min.
**Formato `tempo_prev`:** Aceitar apenas HH:MM (2 partes); ignorar formatos inválidos.

---

### 1. Atualizar registro do indicador existente (DISP_TEMPO)
Já existe um indicador `DISP_TEMPO` (id: `488d1de9-...`). Renomear nome para "Dispersão de Tempo", atualizar descrição para a fórmula, e unidade_medida para "minutos".

### 2. Atualizar `HistoricoMapas.tsx`
- Adicionar o 6o indicador `DISP_TEMPO` na função `calculateMapIndicators`
- Formula: `parseTime(tempo_prev) - (parseTime(hr_entr) - parseTime(hr_sai))`
- Lógica invertida: `status = valor >= meta ? 'dentro_meta' : 'abaixo_meta'`
- Ícone: usar `Clock` ou `Timer` (diferenciado)
- Buscar meta do banco com código `DISP_TEMPO`, fallback = 0

### 3. Atualizar Edge Function `calculate-daily-indicators`
- Adicionar `DISP_TEMPO` ao `INDICATOR_IDS` com o UUID existente
- Adicionar ao `DEFAULT_METAS`: `DISP_TEMPO: 0`
- Calcular: `tempoPrev - trVal`
- Na lógica de `addResult`, tratar DISP_TEMPO como "quanto maior melhor" (`valor >= meta`)

### Arquivos modificados
- `src/pages/admin/HistoricoMapas.tsx` — adicionar indicador ao popup
- `supabase/functions/calculate-daily-indicators/index.ts` — adicionar cálculo
- Tabela `indicators` — atualizar nome/descrição do registro existente

