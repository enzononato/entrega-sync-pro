

## Análise: o cálculo do Bônus Estimado está incompleto

Comparando o cálculo atual em `Dashboard.tsx` (linhas 67-121) com a edge function oficial `calculate-monthly-bonus`, **NÃO** estão sendo contabilizados todos os motoristas e ajudantes corretamente. Existem 4 problemas:

### Problemas identificados

1. **Colaboradores sem lançamento no mês ficam de fora**
   O cálculo só itera sobre quem aparece em `desempenhoMes`. Se um motorista/ajudante ativo não teve nenhum lançamento ainda no mês, ele não é considerado — isso está correto (não há base para estimar bônus dele), mas **não é o que o usuário pediu**. O usuário quer "todos motoristas e ajudantes" sendo contabilizados.

2. **Agregação errada para indicadores não-soma (TML, TR, TI, JL, TX_DEVOLUCAO, DISP_TEMPO)**
   Hoje: `agg.sum / agg.count` (média simples sobre todas as linhas).
   Edge function oficial: **média das médias diárias** (agrupa por dia → média por dia → média entre dias). Isso evita distorção quando um colaborador tem múltiplos mapas em um mesmo dia.

3. **Identificação de indicador SUM por código (frágil)**
   Hoje: `SUM_CODES = new Set(['TX_REPOSICAO'])` comparando contra `goal.indicators?.codigo`. A edge function usa o **UUID** do indicador (`c4c40e3e-f23b-46ce-a576-885c610f2df7`), que é mais confiável.

4. **Inclui colaboradores inativos / não-colaboradores**
   `usuarios` traz todos os usuários. A edge function filtra `ativo = true AND role = 'colaborador' AND worker_type IS NOT NULL`. Isso pode inflar o total se houver lançamentos antigos de usuários desativados.

5. **Não respeita prioridade de meta**
   Hoje: `find()` retorna a primeira meta que casa (pode pegar a meta `default` antes da meta específica do `worker_type`).
   Edge function: prioriza `worker_type` específico → fallback para `default`.

### Solução: unificar a lógica com a edge function

Reescrever o `useMemo` do `bonusMes` em `src/pages/admin/Dashboard.tsx` (linhas 67-112) replicando exatamente a lógica de `supabase/functions/calculate-monthly-bonus/index.ts`:

- **Filtrar usuários**: `usuarios.filter(u => u.ativo && u.role === 'colaborador' && u.worker_type)` antes de iterar.
- **Lookup de metas com prioridade**: construir um `Map<indicator_id|worker_type, goal>` com fallback para `default`, igual à edge function.
- **Agregação correta**:
  - `TX_REPOSICAO` (por UUID): soma de todos os valores no mês.
  - Demais indicadores: agrupar por dia (`Map<date, {sum, count}>`), tirar média de cada dia, depois média entre dias.
- **Iterar sobre TODOS os colaboradores ativos** (não apenas os que têm lançamento), pulando combinações sem dados (mas mantendo o universo completo de usuários no loop, como faz a edge function).
- **Constante de UUIDs** dos indicadores no topo do componente (mesmas do `INDICATOR_IDS` da edge function), para identificar SUM via UUID em vez de código.

### Resultado esperado

O valor exibido em "Bônus Estimado · {mês}" passa a ser idêntico ao que a edge function `calculate-monthly-bonus` gravaria se rodasse agora — somando os bônus mensais (metas + desafios) de **todos os colaboradores ativos** com base agregada do mês corrente, e mais as Caixas Batidas do mês (que já está correto).

### Arquivo alterado

- `src/pages/admin/Dashboard.tsx` (apenas o `useMemo` do `bonusMes`, ~50 linhas)

Sem mudanças em banco, edge functions ou outros componentes.

