

## Implementar Incentivo "Caixas Batidas"

Novo incentivo mensal acumulativo calculado automaticamente a partir dos mapas, com configuração editável e teto que corta + sinaliza.

### Regras

Por mapa em `mapa_historico`:
- 0 ajudantes (Fator 0): R$ 0,19 × `cx_entreg`
- 1 ajudante (Fator 1): R$ 0,18 × `cx_entreg`
- 2 ajudantes (Fator 2): R$ 0,06 × `cx_entreg`

Cada pessoa do mapa (motorista + ajudante(s)) recebe o valor calculado.
Acumula no mês com tetos: motorista R$ 624,00 | ajudante R$ 416,00. Quando atinge o teto, o valor é cortado e o quanto foi cortado fica visível.

### Banco de dados

Migration:
- Inserir em `indicators`: `codigo='CX_BATIDAS'`, `nome='Caixas Batidas'`, `categoria='incentivo'`, `applies_to_worker_type='ambos'`
- Inserir em `incentive_rules` uma regra padrão para `CX_BATIDAS` com `regra_json`:
  ```json
  {
    "tipo": "caixas_batidas",
    "fator_0": 0.19,
    "fator_1": 0.18,
    "fator_2": 0.06,
    "teto_motorista": 624,
    "teto_ajudante": 416
  }
  ```
- Os campos `meta`, `valor_minimo`, `valor_maximo` ficam = 0 (não usados nesse tipo).

### Edge Function: `calculate-caixas-batidas`

Input: `{ mes?: 'YYYY-MM' }` (default = mês atual). `verify_jwt = false`, valida admin via `has_role` no código.

Lógica:
1. Lê configuração ativa em `incentive_rules` (filtro pelo indicator `CX_BATIDAS`).
2. Lê todos `mapa_historico` do mês.
3. Para cada mapa:
   - Conta ajudantes presentes → escolhe fator
   - `bonus_mapa = cx_entreg × valor_caixa`
   - Distribui esse valor para `mot_user_id` e `aju*_user_id`
4. Agrega por colaborador e busca `worker_type` de cada um para aplicar o teto correto.
5. UPSERT em `user_incentives_daily` (`onConflict: user_id,data_referencia`):
   - `data_referencia = primeiro dia do mês`
   - `valor_estimado = min(bruto, teto)`
   - `detalhes_json = { tipo: 'caixas_batidas', mes, valor_bruto, teto, valor_cortado, total_caixas, qtd_mapas, mapas: [...] }`
   - `status = 'estimado'`

Acionada:
- Manualmente pelo admin via botão "Recalcular Caixas Batidas"
- Automaticamente ao final de `Import031805` (após inserir os mapas, chamar `supabase.functions.invoke('calculate-caixas-batidas')`)

### Frontend

**Admin** — nova página `src/pages/admin/Incentivos.tsx` (rota `/admin/incentivos`):
- Card "Configuração Caixas Batidas": inputs editáveis para fator_0, fator_1, fator_2, teto_motorista, teto_ajudante (salva no `regra_json` da `incentive_rules`)
- Botão "Recalcular mês atual"
- Tabela de resultado por colaborador (mês selecionável): nome, worker_type, qtd mapas, total caixas, valor bruto, **valor cortado**, valor final, badge "Teto atingido" quando aplicável

**Colaborador** — `src/pages/colaborador/Incentivo.tsx`:
- Novo card "📦 Caixas Batidas":
  - Valor acumulado / Teto + barra de progresso
  - Quantidade de mapas e total de caixas no mês
  - Se teto atingido: badge laranja "Teto atingido — R$ X,XX cortado"
  - Lista expansível dos mapas (data, mapa, fator aplicado, valor gerado)
- Somar `valor_estimado` desse registro ao "Bônus acumulado no mês" do Hero

### Arquivos

**Criar**:
- `supabase/functions/calculate-caixas-batidas/index.ts`
- `src/hooks/useCaixasBatidas.ts`
- `src/components/colaborador/CaixasBatidasCard.tsx`
- `src/pages/admin/Incentivos.tsx`

**Editar**:
- `supabase/config.toml` — registrar `calculate-caixas-batidas` com `verify_jwt = false`
- `src/components/admin/Sidebar.tsx` — adicionar item "Incentivos"
- `src/routes/AppRoutes.tsx` — registrar rota `/admin/incentivos`
- `src/components/admin/Import031805.tsx` — disparar `calculate-caixas-batidas` após importar
- `src/pages/colaborador/Incentivo.tsx` — incluir `CaixasBatidasCard` e somar no acumulado

