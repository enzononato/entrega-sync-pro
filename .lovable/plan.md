

## Análise: o cálculo está quase completo, mas tem um problema concreto

Conferindo as metas ativas no banco contra o que o `useMemo` do `bonusMes` percorre, **5 das 6 bonificações configuradas estão sendo contabilizadas corretamente**, mas **1 não está**.

### Bonificações ativas no banco (todas com `valor_bonificacao = R$ 52,50`)

| Indicador | worker_type | Bônus meta | Bônus desafio | Entra no cálculo? |
|---|---|---|---|---|
| DISP_TEMPO | motorista | 52,50 | 10,00 | ✅ |
| DISP_TEMPO | ajudante | 52,50 | 10,00 | ✅ |
| TX_DEVOLUCAO | ajudante | 52,50 | 0 | ✅ |
| TX_DEVOLUCAO | `null` (default) | 52,50 | 10,00 | ⚠️ entra como fallback de motorista |
| TX_REPOSICAO | motorista | 52,50 | 10,00 | ✅ |
| REFUGO | ajudante | 52,50 | 0 | ❌ **não entra** |

### Por que Refugo (e potencialmente outros) ficam de fora

A função filtra colaboradores com:
```ts
const activeCollaborators = usuarios.filter(
  u => u.ativo && u.role === 'colaborador' && u.worker_type
);
```

Mas o hook `useUsuarios()` por padrão retorna **só os ativos da unidade do admin logado**, e em alguns casos não traz `worker_type` populado para todos. Pior: o filtro avalia ajudantes contra metas de motorista (e vice-versa) usando o `findGoal(indId, workerType)` que cai no fallback `default` quando não acha o `worker_type` específico — isso causa **dois efeitos colaterais**:

1. **TX_REPOSICAO (só motorista)** está sendo testado contra ajudantes via fallback `default`, podendo somar bônus indevido para ajudantes que tenham qualquer registro.
2. **REFUGO (só ajudante)** não tem fallback `default` no banco, então quando um ajudante tem dado de refugo, o cálculo passa — mas se um motorista tiver algum dado errado lançado, ele também seria avaliado contra a meta de ajudante via fallback.

Além disso, o card **"Bônus Estimado · {mês}"** soma `bonusMes + caixasBatidasTotal`, então:
- ✅ Caixas Batidas do mês: somando corretamente.
- ✅ DISP_TEMPO, TX_DEVOLUCAO, TX_REPOSICAO: somando corretamente para o `worker_type` correspondente.
- ⚠️ REFUGO: depende do estado do hook `useUsuarios` no momento — geralmente entra, mas pode falhar se o ajudante não estiver na unidade visível ao admin.
- ❌ A lógica não **respeita o campo `applies_to_worker_type` do indicador**, então metas com `worker_type: null` viram fallback universal e podem contar para perfis que não deveriam.

### Correções propostas

**1. Respeitar `applies_to_worker_type` da tabela `indicators`**
   Ao iterar, pular o indicador se `indicator.applies_to_worker_type` for diferente de `'ambos'` e diferente do `worker_type` do colaborador. Isso elimina o risco de TX_REPOSICAO ser avaliado para ajudante e REFUGO para motorista.

**2. Eliminar o fallback `default` quando a meta tem `worker_type` específico**
   A meta de TX_DEVOLUCAO com `worker_type: null` deve ser tratada como meta universal (vale para os dois perfis) **somente** se o indicador também for `applies_to_worker_type = 'ambos'`. Caso contrário, ignorar.

**3. Garantir que o `useUsuarios()` traga TODOS os colaboradores ativos do sistema** (não apenas da unidade do admin) para esse cálculo, já que o card "Bônus Estimado" representa o total estimado a pagar no mês — independente do filtro de unidade do topo.
   Trocar por uma query dedicada no `useMemo` (ou novo hook `useAllActiveCollaborators()`) que busca direto da tabela `users` sem aplicar o filtro de unidade.

**4. Replicar exatamente as mesmas correções na edge function `calculate-monthly-bonus/index.ts`** para que o valor exibido no dashboard seja idêntico ao que será gravado em `user_incentives_daily`.

### Resultado esperado

Após o ajuste, o card "Bônus Estimado · {mês}" vai mostrar:
- Soma de R$ 52,50 (+ R$ 10,00 desafio quando houver) por colaborador que atinja cada meta com bonificação configurada,
- Considerando **somente o perfil correto** para cada indicador (motorista para TX_REPOSICAO, ajudante para REFUGO, ambos para DISP_TEMPO e TX_DEVOLUCAO),
- Para **todos os colaboradores ativos do sistema** (não só os da unidade visível),
- Mais a soma de Caixas Batidas do mês (já correto).

### Arquivos alterados

- `src/pages/admin/Dashboard.tsx` — `useMemo` do `bonusMes` (filtro por `applies_to_worker_type`, sem fallback indevido, lista completa de colaboradores)
- `supabase/functions/calculate-monthly-bonus/index.ts` — mesmas regras de matching meta↔colaborador

Sem mudanças em banco, sem novos componentes.

